import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Types ───────────────────────────────────────────────────────────────────

export type ComplianceResult = {
  candidateName: string;
  candidateCountry: string;
  status: "APPROVED" | "REQUIRES_APPROVAL" | "NOT_APPROVED";
  maxDurationMonths?: number;
};

// ─── Country Normalization ───────────────────────────────────────────────────

const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "united states": "United States",
  "united states of america": "United States",
  ca: "Canada",
  canada: "Canada",
  mx: "Mexico",
  mexico: "Mexico",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  germany: "Germany",
  france: "France",
  italy: "Italy",
  poland: "Poland",
  romania: "Romania",
  spain: "Spain",
  brazil: "Brazil",
  argentina: "Argentina",
  india: "India",
  japan: "Japan",
  uae: "UAE",
  "united arab emirates": "UAE",
  china: "China",
  "south korea": "South Korea",
  ukraine: "Ukraine",
};

function normalizeCountry(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  return COUNTRY_ALIASES[lower] ?? trimmed;
}

/**
 * Attempt to extract a country from a location string.
 * Handles formats like "San Francisco, CA", "Toronto, Canada", "Bangalore, India"
 * US states are detected and mapped to "United States".
 */
const US_STATES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
  "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
  "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
  "dc",
  // Full names
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
  "maine", "maryland", "massachusetts", "michigan", "minnesota",
  "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "new york",
  "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
  "pennsylvania", "rhode island", "south carolina", "south dakota",
  "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming",
]);

function extractCountryFromLocation(location: string): string {
  if (!location) return "";
  const parts = location.split(",").map((p) => p.trim());
  if (parts.length === 0) return "";

  const lastPart = parts[parts.length - 1];
  const lastPartLower = lastPart.toLowerCase();

  // Check if last part is a US state
  if (US_STATES.has(lastPartLower)) {
    return "United States";
  }

  return normalizeCountry(lastPart);
}

// ─── Single Submission Validation ────────────────────────────────────────────

export async function validateCompliance(submissionId: string): Promise<ComplianceResult> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { candidate: true },
  });

  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  const candidate = submission.candidate;
  const rawCountry = candidate.country || extractCountryFromLocation(candidate.location ?? "");
  const country = normalizeCountry(rawCountry);

  if (!country) {
    return {
      candidateName: candidate.name,
      candidateCountry: "Unknown",
      status: "NOT_APPROVED",
    };
  }

  const approvedCountry = await prisma.approvedCountry.findFirst({
    where: {
      country: {
        equals: country,
        mode: "insensitive",
      },
    },
  });

  if (!approvedCountry) {
    return {
      candidateName: candidate.name,
      candidateCountry: country,
      status: "NOT_APPROVED",
    };
  }

  if (approvedCountry.requiresAdditionalApproval) {
    return {
      candidateName: candidate.name,
      candidateCountry: country,
      status: "REQUIRES_APPROVAL",
      maxDurationMonths: approvedCountry.maxDurationMonths ?? undefined,
    };
  }

  return {
    candidateName: candidate.name,
    candidateCountry: country,
    status: "APPROVED",
    maxDurationMonths: approvedCountry.maxDurationMonths ?? undefined,
  };
}

// ─── Validate All Submissions ────────────────────────────────────────────────

export async function validateAllCompliance(): Promise<ComplianceResult[]> {
  const submissions = await prisma.submission.findMany({
    include: { candidate: true },
  });

  const results: ComplianceResult[] = [];

  for (const submission of submissions) {
    const candidate = submission.candidate;
    const rawCountry = candidate.country || extractCountryFromLocation(candidate.location ?? "");
    const country = normalizeCountry(rawCountry);

    if (!country) {
      results.push({
        candidateName: candidate.name,
        candidateCountry: "Unknown",
        status: "NOT_APPROVED",
      });
      continue;
    }

    const approvedCountry = await prisma.approvedCountry.findFirst({
      where: {
        country: {
          equals: country,
          mode: "insensitive",
        },
      },
    });

    if (!approvedCountry) {
      results.push({
        candidateName: candidate.name,
        candidateCountry: country,
        status: "NOT_APPROVED",
      });
      continue;
    }

    if (approvedCountry.requiresAdditionalApproval) {
      results.push({
        candidateName: candidate.name,
        candidateCountry: country,
        status: "REQUIRES_APPROVAL",
        maxDurationMonths: approvedCountry.maxDurationMonths ?? undefined,
      });
    } else {
      results.push({
        candidateName: candidate.name,
        candidateCountry: country,
        status: "APPROVED",
        maxDurationMonths: approvedCountry.maxDurationMonths ?? undefined,
      });
    }
  }

  return results;
}

// ─── CLI Runner ──────────────────────────────────────────────────────────────

async function main() {
  console.log("Running compliance validation for all submissions...\n");

  try {
    const results = await validateAllCompliance();

    if (results.length === 0) {
      console.log("No submissions found to validate.");
      return;
    }

    // Group by status
    const approved = results.filter((r) => r.status === "APPROVED");
    const requiresApproval = results.filter((r) => r.status === "REQUIRES_APPROVAL");
    const notApproved = results.filter((r) => r.status === "NOT_APPROVED");

    console.log("=== Compliance Validation Report ===\n");
    console.log(`Total submissions checked: ${results.length}`);
    console.log(`  APPROVED: ${approved.length}`);
    console.log(`  REQUIRES_APPROVAL: ${requiresApproval.length}`);
    console.log(`  NOT_APPROVED: ${notApproved.length}`);

    if (approved.length > 0) {
      console.log("\n--- APPROVED ---");
      for (const r of approved) {
        const duration = r.maxDurationMonths ? ` (max ${r.maxDurationMonths} months)` : " (no limit)";
        console.log(`  ${r.candidateName} - ${r.candidateCountry}${duration}`);
      }
    }

    if (requiresApproval.length > 0) {
      console.log("\n--- REQUIRES ADDITIONAL APPROVAL ---");
      for (const r of requiresApproval) {
        const duration = r.maxDurationMonths ? ` (max ${r.maxDurationMonths} months)` : "";
        console.log(`  ${r.candidateName} - ${r.candidateCountry}${duration}`);
      }
    }

    if (notApproved.length > 0) {
      console.log("\n--- NOT APPROVED ---");
      for (const r of notApproved) {
        console.log(`  ${r.candidateName} - ${r.candidateCountry}`);
      }
    }

    console.log("\n=== End Report ===");
  } catch (error) {
    console.error("Compliance validation failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run when executed directly
main();
