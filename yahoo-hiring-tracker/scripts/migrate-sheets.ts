import { PrismaClient, BusinessUnit, SubmissionStatus, JobStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`  CSV file not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

// ─── Field Helpers ───────────────────────────────────────────────────────────

function getField(row: Record<string, string>, ...candidates: string[]): string {
  for (const key of candidates) {
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === lowerKey || k.toLowerCase().replace(/[^a-z0-9]/g, "") === lowerKey.replace(/[^a-z0-9]/g, "")) {
        if (v && v.trim() !== "") return v.trim();
      }
    }
  }
  return "";
}

function parseHeadcount(raw: string, roleTitle?: string): number {
  if (raw) {
    const cleaned = raw.replace(/[()]/g, "").trim();
    const match = cleaned.match(/(\d+)\s*x?/i);
    if (match) return parseInt(match[1], 10);
    const num = parseInt(cleaned, 10);
    if (!isNaN(num)) return num;
  }
  // Try extracting from role title, e.g., "iOS Developer (3x)"
  if (roleTitle) {
    const match = roleTitle.match(/\((\d+)x?\)/i);
    if (match) return parseInt(match[1], 10);
  }
  return 1;
}

function parseRate(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Status Mapping ──────────────────────────────────────────────────────────

// Maps both submission status AND infers job status
interface StatusMapping {
  subStatus: SubmissionStatus;
  jobStatus: "ACTIVE" | "ON_HOLD" | "FUTURE_NEED" | "CANCELLED" | "FINDING_TALENT" | "ENGAGEMENT_COMPLETED" | "ROLE_CANCELLED";
}

const STATUS_MAP: Record<string, StatusMapping> = {
  active: { subStatus: "INTRODUCED", jobStatus: "ACTIVE" },
  "talent introduced": { subStatus: "INTRODUCED", jobStatus: "ACTIVE" },
  introduced: { subStatus: "INTRODUCED", jobStatus: "ACTIVE" },
  submitted: { subStatus: "INTRODUCED", jobStatus: "ACTIVE" },
  interviewing: { subStatus: "INTERVIEWING", jobStatus: "ACTIVE" },
  "interview scheduled": { subStatus: "INTERVIEW_SCHEDULED", jobStatus: "ACTIVE" },
  "pending interview": { subStatus: "INTERVIEW_SCHEDULED", jobStatus: "ACTIVE" },
  "pending decision": { subStatus: "PENDING_DECISION", jobStatus: "ACTIVE" },
  "pending 2nd interview": { subStatus: "PENDING_2ND_INTERVIEW", jobStatus: "ACTIVE" },
  "hired-pending sow": { subStatus: "HIRED", jobStatus: "ACTIVE" },
  hired: { subStatus: "HIRED", jobStatus: "ACTIVE" },
  accepted: { subStatus: "HIRED", jobStatus: "ACTIVE" },
  rejected: { subStatus: "REJECTED", jobStatus: "ACTIVE" },
  declined: { subStatus: "REJECTED", jobStatus: "ACTIVE" },
  "not a fit": { subStatus: "REJECTED", jobStatus: "ACTIVE" },
  "talent withdrawn": { subStatus: "TALENT_WITHDRAWN", jobStatus: "ACTIVE" },
  withdrawn: { subStatus: "WITHDRAWN", jobStatus: "ACTIVE" },
  "talent no longer available": { subStatus: "TALENT_NO_LONGER_AVAILABLE", jobStatus: "ACTIVE" },
  "removed due to location": { subStatus: "REMOVED_FOR_LOCATION", jobStatus: "ACTIVE" },
  "removed - location": { subStatus: "REMOVED_FOR_LOCATION", jobStatus: "ACTIVE" },
  "location issue": { subStatus: "REMOVED_FOR_LOCATION", jobStatus: "ACTIVE" },
  "consider for other role": { subStatus: "CONSIDER_FOR_OTHER_ROLE", jobStatus: "ACTIVE" },
  "finding talent": { subStatus: "FINDING_TALENT", jobStatus: "FINDING_TALENT" },
  "future need": { subStatus: "INTRODUCED", jobStatus: "FUTURE_NEED" },
  "on-hold": { subStatus: "INTRODUCED", jobStatus: "ON_HOLD" },
  "on hold": { subStatus: "INTRODUCED", jobStatus: "ON_HOLD" },
  "role cancelled/filed": { subStatus: "WITHDRAWN", jobStatus: "ROLE_CANCELLED" },
  "role cancelled": { subStatus: "WITHDRAWN", jobStatus: "ROLE_CANCELLED" },
  "engagement completed": { subStatus: "HIRED", jobStatus: "ENGAGEMENT_COMPLETED" },
};

function mapStatus(raw: string): StatusMapping | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return STATUS_MAP[lower] ?? null;
}

// ─── Business Unit Mapping ───────────────────────────────────────────────────

const BU_MAP: Record<string, BusinessUnit> = {
  mail: "MAIL",
  "yahoo mail": "MAIL",
  home: "HOME_ECO",
  "home ecosystem": "HOME_ECO",
  "home eco": "HOME_ECO",
  "yahoo home ecosystem": "HOME_ECO",
  paranoids: "PARANOIDS",
  security: "PARANOIDS",
  sports: "SPORTS",
  "yahoo sports": "SPORTS",
  search: "SEARCH",
  "yahoo search": "SEARCH",
  ads: "ADS",
  "yahoo ads": "ADS",
};

function mapBusinessUnit(raw: string): BusinessUnit | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return BU_MAP[lower] ?? null;
}

// ─── Reconciliation Tracking ─────────────────────────────────────────────────

interface ReconciliationReport {
  jobsCreated: number;
  candidatesCreated: number;
  submissionsCreated: number;
  activityLogEntries: number;
  approvedCountries: number;
  unmappedData: string[];
  duplicateCandidatesMerged: number;
  jobsDeduplicatedCount: number;
  totalTrackerRows: number;
}

const report: ReconciliationReport = {
  jobsCreated: 0,
  candidatesCreated: 0,
  submissionsCreated: 0,
  activityLogEntries: 0,
  approvedCountries: 0,
  unmappedData: [],
  duplicateCandidatesMerged: 0,
  jobsDeduplicatedCount: 0,
  totalTrackerRows: 0,
};

// ─── Migration: Sourcing Locations ───────────────────────────────────────────

async function migrateSourcingLocations(dataDir: string) {
  console.log("\n--- Migrating Sourcing Locations ---");
  const rows = parseCSV(path.join(dataDir, "sourcing-locations.csv"));
  if (rows.length === 0) {
    console.log("  No sourcing location data found.");
    return;
  }

  // Real format: "APPROVED COUNTRIES" + "PROJECT DURATION" columns
  // Region markers look like "------->>>>EMEA" or "------->>>>LATAM"
  let currentRegion = "Americas";

  for (const row of rows) {
    const country = getField(row, "APPROVED COUNTRIES", "Country", "Region");
    const durationRaw = getField(row, "PROJECT DURATION", "Max Duration (Months)", "Max Duration");

    if (!country) continue;

    // Check for region marker
    const regionMatch = country.match(/^-*>+\s*(.+)/);
    if (regionMatch) {
      currentRegion = regionMatch[1].trim();
      continue;
    }

    // Skip header-like or empty rows
    if (country === "APPROVED COUNTRIES" || country.startsWith("---")) continue;

    // Parse duration: "18 Months" → 18
    let maxDurationMonths: number | null = null;
    if (durationRaw) {
      const dMatch = durationRaw.match(/(\d+)/);
      if (dMatch) maxDurationMonths = parseInt(dMatch[1], 10);
    }

    await prisma.approvedCountry.upsert({
      where: { region_country: { region: currentRegion, country } },
      update: {
        maxDurationMonths: maxDurationMonths && !isNaN(maxDurationMonths) ? maxDurationMonths : null,
        requiresAdditionalApproval: false,
      },
      create: {
        region: currentRegion,
        country,
        maxDurationMonths: maxDurationMonths && !isNaN(maxDurationMonths) ? maxDurationMonths : null,
        requiresAdditionalApproval: false,
      },
    });
    report.approvedCountries++;
  }
  console.log(`  Created/updated ${report.approvedCountries} approved countries.`);
}

// ─── Migration: Hiring Tracker ───────────────────────────────────────────────

function jobKeyStr(roleTitle: string, projectName: string): string {
  return `${roleTitle.toLowerCase().trim()}|||${projectName.toLowerCase().trim()}`;
}

function candidateKeyStr(name: string): string {
  return name.toLowerCase().trim();
}

async function migrateHiringTracker(dataDir: string) {
  console.log("\n--- Migrating Hiring Tracker ---");
  const rows = parseCSV(path.join(dataDir, "hiring-tracker.csv"));
  if (rows.length === 0) {
    console.log("  No hiring tracker data found.");
    return;
  }

  report.totalTrackerRows = rows.length;

  // Phase 1: Group rows by job key, collect candidate info
  const jobGroups = new Map<
    string,
    {
      roleTitle: string;
      projectName: string;
      businessUnit: BusinessUnit;
      yahooPoC: string;
      headcount: number;
      sowNumber: string;
      poNumber: string;
      rateCap: number | null;
      toptalJobLink: string;
      slackChannel: string;
      jobStatus: string;
      dateOpened: Date | null;
      rows: { rowIndex: number; row: Record<string, string> }[];
    }
  >();

  const candidateNames = new Map<string, { name: string; count: number }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    const roleTitle = getField(row, "Role title / Job Description Link", "Role Title", "RoleTitle");
    const projectName = getField(row, "Project Name", "ProjectName");
    const buRaw = getField(row, "BU", "Business Unit", "BusinessUnit", "Business Group");
    const yahooPoC = getField(row, "POC(s) for Req", "Yahoo POC", "YahooPoC");
    const headcountRaw = getField(row, "Headcount");
    const sowNumber = getField(row, "SOW", "SOW#", "SowNumber");
    const poNumber = getField(row, "PO", "PO#", "PoNumber");
    const rateCapRaw = getField(row, "Rate Max", "Rate Cap", "RateCap");
    const candidateName = getField(row, "Candidate Name", "CandidateName");
    const statusRaw = getField(row, "Status");
    const toptalJobLink = getField(row, "Toptal Job Link", "ToptalJobLink");
    const slackChannel = getField(row, "Slack Channel", "SlackChannel");
    const dateOpenedRaw = getField(row, "Date");

    if (!roleTitle || !projectName) {
      report.unmappedData.push(`Row ${rowNum}: Missing role title or project name`);
      continue;
    }

    const businessUnit = mapBusinessUnit(buRaw);
    if (!businessUnit) {
      report.unmappedData.push(`Row ${rowNum}: Could not determine business unit from "${buRaw}"`);
    }

    const statusMapping = mapStatus(statusRaw);
    if (statusRaw && !statusMapping) {
      report.unmappedData.push(`Row ${rowNum}: Unknown status "${statusRaw}"`);
    }

    // Determine job status from the most "active" row status
    const jobStatus = statusMapping?.jobStatus ?? "ACTIVE";

    const key = jobKeyStr(roleTitle, projectName);
    if (!jobGroups.has(key)) {
      jobGroups.set(key, {
        roleTitle,
        projectName,
        businessUnit: businessUnit ?? "OTHER",
        yahooPoC,
        headcount: parseHeadcount(headcountRaw, roleTitle),
        sowNumber: sowNumber || null!,
        poNumber: poNumber || null!,
        rateCap: parseRate(rateCapRaw),
        toptalJobLink: toptalJobLink || null!,
        slackChannel: slackChannel || null!,
        jobStatus,
        dateOpened: parseDate(dateOpenedRaw),
        rows: [],
      });
    } else {
      // Update job status: ACTIVE takes priority over other statuses
      const existing = jobGroups.get(key)!;
      if (jobStatus === "ACTIVE" && existing.jobStatus !== "ACTIVE") {
        existing.jobStatus = "ACTIVE";
      }
      // Update slackChannel/toptalJobLink if not set yet
      if (slackChannel && !existing.slackChannel) existing.slackChannel = slackChannel;
      if (toptalJobLink && !existing.toptalJobLink) existing.toptalJobLink = toptalJobLink;
    }
    jobGroups.get(key)!.rows.push({ rowIndex: rowNum, row });

    // Track candidate dedup
    if (candidateName) {
      const ck = candidateKeyStr(candidateName);
      if (candidateNames.has(ck)) {
        candidateNames.get(ck)!.count++;
      } else {
        candidateNames.set(ck, { name: candidateName, count: 1 });
      }
    }
  }

  report.jobsDeduplicatedCount = jobGroups.size;
  report.duplicateCandidatesMerged = Array.from(candidateNames.values()).filter((c) => c.count > 1).length;

  // Phase 2: Create Job records
  const jobIdMap = new Map<string, string>(); // jobKeyStr -> db id

  for (const [key, group] of jobGroups) {
    // Use findFirst + create/update since there's no unique constraint on roleTitle+projectName
    let existing = await prisma.job.findFirst({
      where: {
        roleTitle: group.roleTitle,
        projectName: group.projectName,
      },
    });

    if (existing) {
      existing = await prisma.job.update({
        where: { id: existing.id },
        data: {
          businessUnit: group.businessUnit,
          yahooPoC: group.yahooPoC,
          openHeadcount: group.headcount,
          sowNumber: group.sowNumber || undefined,
          poNumber: group.poNumber || undefined,
          rateCap: group.rateCap,
          toptalJobLink: group.toptalJobLink || undefined,
          slackChannel: group.slackChannel || undefined,
          status: group.jobStatus as any,
          dateOpened: group.dateOpened ?? undefined,
        },
      });
    } else {
      existing = await prisma.job.create({
        data: {
          roleTitle: group.roleTitle,
          projectName: group.projectName,
          businessUnit: group.businessUnit,
          yahooPoC: group.yahooPoC,
          openHeadcount: group.headcount,
          sowNumber: group.sowNumber || undefined,
          poNumber: group.poNumber || undefined,
          rateCap: group.rateCap,
          toptalJobLink: group.toptalJobLink || undefined,
          slackChannel: group.slackChannel || undefined,
          status: group.jobStatus as any,
          dateOpened: group.dateOpened ?? undefined,
        },
      });
      report.jobsCreated++;

      // Activity: JOB_CREATED
      await prisma.activityLog.create({
        data: {
          action: "JOB_CREATED",
          entityType: "Job",
          entityId: existing.id,
          jobId: existing.id,
          details: {
            roleTitle: group.roleTitle,
            projectName: group.projectName,
            businessUnit: group.businessUnit,
            source: "migration",
          },
        },
      });
      report.activityLogEntries++;
    }

    jobIdMap.set(key, existing.id);
  }

  // Phase 3: Create Candidate and Submission records
  const candidateIdMap = new Map<string, string>(); // candidateKeyStr -> db id

  for (const [key, group] of jobGroups) {
    const jobId = jobIdMap.get(key)!;

    for (const { rowIndex, row } of group.rows) {
      const candidateName = getField(row, "Candidate Name", "CandidateName");
      if (!candidateName) continue;

      const profileLink = getField(row, "Profile Link", "Toptal Profile Link", "ToptalProfileLink");
      const location = getField(row, "Candidate Location (city/country)", "Location");
      const rateRaw = getField(row, "Rate");
      const pstOverlap = getField(row, "Overlap w/ PST", "PST Overlap", "PSTOverlap");
      const statusRaw = getField(row, "Status");
      const dateIntroducedRaw = getField(row, "Date Introduced", "DateIntroduced");
      const dateHiredRejectedRaw = getField(row, "Date Hired / Rejected");
      const interviewDateRaw = getField(row, "Interview date / time (PST)", "Interview Date", "InterviewDate");
      const candidateIntro = getField(row, "Candidate Intro", "CandidateIntro");
      const clientFeedback = getField(row, "Yahoo Candidate Feedback", "Client Feedback", "ClientFeedback");

      // Extract country from location string (last part after comma)
      let country: string | undefined;
      let city: string | undefined;
      if (location) {
        const parts = location.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          country = parts[parts.length - 1];
          city = parts.slice(0, parts.length - 1).join(", ");
        } else {
          country = location;
        }
      }

      // Upsert candidate
      const ck = candidateKeyStr(candidateName);
      let candidateId = candidateIdMap.get(ck);

      if (!candidateId) {
        let existingCandidate = await prisma.candidate.findFirst({
          where: { name: candidateName },
        });

        if (existingCandidate) {
          // Update with latest info if we have new data
          await prisma.candidate.update({
            where: { id: existingCandidate.id },
            data: {
              toptalProfileLink: profileLink || existingCandidate.toptalProfileLink || undefined,
              location: location || existingCandidate.location || undefined,
              city: city || existingCandidate.city || undefined,
              country: country || existingCandidate.country || undefined,
              rate: parseRate(rateRaw) ?? (existingCandidate.rate ? undefined : undefined),
              pstOverlap: pstOverlap || existingCandidate.pstOverlap || undefined,
            },
          });
          candidateId = existingCandidate.id;
        } else {
          const newCandidate = await prisma.candidate.create({
            data: {
              name: candidateName,
              toptalProfileLink: profileLink || undefined,
              location: location || undefined,
              city: city || undefined,
              country: country || undefined,
              rate: parseRate(rateRaw),
              pstOverlap: pstOverlap || undefined,
            },
          });
          candidateId = newCandidate.id;
          report.candidatesCreated++;
        }

        candidateIdMap.set(ck, candidateId);
      }

      // Map status
      const statusMapping = mapStatus(statusRaw);
      const status = statusMapping?.subStatus ?? "INTRODUCED";

      // Parse dates
      const dateIntroduced = parseDate(dateIntroducedRaw) ?? new Date();
      const dateHiredRejected = parseDate(dateHiredRejectedRaw);
      const interviewDate = parseDate(interviewDateRaw);
      const dateLastStatusChange = dateHiredRejected ?? dateIntroduced;

      // Check if submission already exists
      let existingSub = await prisma.submission.findFirst({
        where: {
          jobId,
          candidateId,
        },
      });

      if (existingSub) {
        await prisma.submission.update({
          where: { id: existingSub.id },
          data: {
            status,
            dateIntroduced,
            interviewDateTime: interviewDate,
            clientFeedbackNotes: clientFeedback || undefined,
            candidateIntroMessage: candidateIntro || undefined,
            dateLastStatusChange,
          },
        });
      } else {
        existingSub = await prisma.submission.create({
          data: {
            jobId,
            candidateId,
            status,
            dateIntroduced,
            interviewDateTime: interviewDate,
            clientFeedbackNotes: clientFeedback || undefined,
            candidateIntroMessage: candidateIntro || undefined,
            dateLastStatusChange,
          },
        });
        report.submissionsCreated++;

        // Activity: SUBMISSION_CREATED
        await prisma.activityLog.create({
          data: {
            action: "SUBMISSION_CREATED",
            entityType: "Submission",
            entityId: existingSub.id,
            jobId,
            submissionId: existingSub.id,
            details: {
              candidateName,
              roleTitle: group.roleTitle,
              projectName: group.projectName,
              source: "migration",
            },
          },
        });
        report.activityLogEntries++;

        // Activity: SUBMISSION_STATUS_CHANGED (if not INTRODUCED)
        if (status !== "INTRODUCED") {
          await prisma.activityLog.create({
            data: {
              action: "SUBMISSION_STATUS_CHANGED",
              entityType: "Submission",
              entityId: existingSub.id,
              jobId,
              submissionId: existingSub.id,
              details: {
                previousStatus: "INTRODUCED",
                newStatus: status,
                candidateName,
                source: "migration",
              },
            },
          });
          report.activityLogEntries++;
        }
      }
    }
  }

  return jobIdMap;
}

// ─── Migration: Internal Info ────────────────────────────────────────────────

async function migrateInternalInfo(dataDir: string) {
  console.log("\n--- Migrating Internal Info ---");
  const rows = parseCSV(path.join(dataDir, "internal-info.csv"));
  if (rows.length === 0) {
    console.log("  No internal info data found.");
    return;
  }

  let updated = 0;
  for (const row of rows) {
    const roleTitle = getField(row, "Role title / Job Description Link", "Role Title", "RoleTitle");
    const projectName = getField(row, "Project Name", "ProjectName");
    const matcher = getField(row, "Matcher");
    const slackChannel = getField(row, "Yahoo channel", "Slack Channel", "SlackChannel");
    const interviewerEmails = getField(row, "EMAILS/CALENDLY", "Interviewer Emails", "InterviewerEmails");
    const interviewPrepNotes = getField(row, "INTERVIEW CONTEXT &  PREP", "Interview Prep Notes", "InterviewPrepNotes");

    if (!roleTitle || !projectName) continue;

    const job = await prisma.job.findFirst({
      where: {
        roleTitle,
        projectName,
      },
    });

    if (job) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          matcher: matcher || undefined,
          slackChannel: slackChannel || undefined,
          interviewerEmails: interviewerEmails || undefined,
          interviewPrepNotes: interviewPrepNotes || undefined,
        },
      });
      updated++;
    } else {
      console.log(`  Warning: No matching job for "${roleTitle}" / "${projectName}"`);
    }
  }
  console.log(`  Updated ${updated} jobs with internal info.`);
}

// ─── Migration: Hired Talent ─────────────────────────────────────────────────

async function migrateHiredTalent(dataDir: string) {
  console.log("\n--- Migrating Hired Talent ---");
  const rows = parseCSV(path.join(dataDir, "hired-talent.csv"));
  if (rows.length === 0) {
    console.log("  No hired talent data found.");
    return;
  }

  let updated = 0;
  for (const row of rows) {
    const candidateName = getField(row, "Talent", "Candidate Name", "CandidateName");
    const address = getField(row, "Address");
    const phone = getField(row, "Phone number", "Phone");
    const email = getField(row, "Email address", "Email");

    if (!candidateName) continue;

    const candidate = await prisma.candidate.findFirst({
      where: { name: candidateName },
    });

    if (candidate) {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          address: address || undefined,
          phone: phone || undefined,
          email: email || undefined,
        },
      });
      updated++;
    } else {
      console.log(`  Warning: No matching candidate for "${candidateName}"`);
    }
  }
  console.log(`  Updated ${updated} candidates with hired talent info.`);
}

// ─── Print Report ────────────────────────────────────────────────────────────

function printReport() {
  console.log("\n=== Migration Reconciliation Report ===");
  console.log(`Jobs created: ${report.jobsCreated}`);
  console.log(`Candidates created: ${report.candidatesCreated}`);
  console.log(`Submissions created: ${report.submissionsCreated}`);
  console.log(`Activity log entries: ${report.activityLogEntries}`);
  console.log(`Approved countries: ${report.approvedCountries}`);
  console.log("");

  if (report.unmappedData.length > 0) {
    console.log("Unmapped data:");
    for (const msg of report.unmappedData) {
      console.log(`  - ${msg}`);
    }
  } else {
    console.log("Unmapped data: none");
  }

  console.log("");
  console.log(`Duplicate candidates merged: ${report.duplicateCandidatesMerged}`);
  console.log(
    `Jobs deduplicated: ${report.jobsDeduplicatedCount} (from ${report.totalTrackerRows} rows)`
  );
  console.log("=== End Report ===\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dataDir = path.join(__dirname, "data");

  console.log("Starting Yahoo Hiring Tracker migration...");
  console.log(`Data directory: ${dataDir}`);

  if (!fs.existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`);
    console.error("Please place CSV files in scripts/data/ before running migration.");
    process.exit(1);
  }

  try {
    // 1. Approved sourcing locations (no dependencies)
    await migrateSourcingLocations(dataDir);

    // 2. Hiring tracker (creates jobs, candidates, submissions)
    await migrateHiringTracker(dataDir);

    // 3. Internal info (updates existing jobs)
    await migrateInternalInfo(dataDir);

    // 4. Hired talent (updates existing candidates)
    await migrateHiredTalent(dataDir);

    // 5. Print reconciliation report
    printReport();

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
