import { NextResponse } from "next/server";
import { type Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { verifySlackSignature } from "@/server/slack";

// Submission status values matching the Prisma enum
const VALID_STATUSES = [
  "INTRODUCED",
  "INTERVIEWING",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
  "REMOVED_FOR_LOCATION",
  "PENDING_DECISION",
] as const;

type SubmissionStatus = (typeof VALID_STATUSES)[number];

// ─── POST Handler — Slack Slash Commands ────────────────────────────

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "SLACK_SIGNING_SECRET not configured" },
      { status: 500 },
    );
  }

  // 1. Read the raw body for signature verification
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    return NextResponse.json({ error: "Request too old" }, { status: 403 });
  }

  // 2. Verify signature
  if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // 3. Parse the URL-encoded body from Slack
  const params = new URLSearchParams(rawBody);
  const command = params.get("command") ?? "";
  const text = (params.get("text") ?? "").trim();

  try {
    switch (command) {
      case "/pipeline":
        return handlePipelineCommand(text);
      case "/status":
        return handleStatusCommand(text);
      default:
        return slackResponse(`Unknown command: \`${command}\``);
    }
  } catch (err) {
    console.error("[Slack Webhook]", err);
    return slackResponse("Something went wrong. Please try again.");
  }
}

// ─── /pipeline [project] ────────────────────────────────────────────

async function handlePipelineCommand(text: string) {
  const projectFilter = text || undefined;

  const where: Prisma.JobWhereInput = {
    status: { in: ["ACTIVE", "ON_HOLD"] },
  };

  if (projectFilter) {
    where.OR = [
      { projectName: { contains: projectFilter, mode: "insensitive" } },
      { roleTitle: { contains: projectFilter, mode: "insensitive" } },
    ];
  }

  const jobs = await db.job.findMany({
    where,
    include: {
      submissions: {
        select: { status: true },
      },
    },
    orderBy: [{ businessUnit: "asc" }, { updatedAt: "desc" }],
  });

  if (jobs.length === 0) {
    return slackResponse(
      projectFilter
        ? `No active jobs found matching "${projectFilter}".`
        : "No active jobs in the pipeline.",
    );
  }

  // Build summary
  let totalHeadcount = 0;
  let totalFilled = 0;
  let totalSubmissions = 0;

  const lines: string[] = [];

  for (const job of jobs) {
    const hired = job.submissions.filter((s) => s.status === "HIRED").length;
    const interviewing = job.submissions.filter(
      (s) => s.status === "INTERVIEWING",
    ).length;
    const introduced = job.submissions.filter(
      (s) => s.status === "INTRODUCED",
    ).length;
    const pending = job.submissions.filter(
      (s) => s.status === "PENDING_DECISION",
    ).length;

    totalHeadcount += job.openHeadcount;
    totalFilled += hired;
    totalSubmissions += job.submissions.length;

    const remaining = job.openHeadcount - hired;
    const parts = [
      `*${job.roleTitle}* -- ${job.projectName} (${job.businessUnit})`,
      `  HC: ${job.openHeadcount} | Filled: ${hired} | Remaining: ${remaining}`,
      `  Submissions: ${job.submissions.length} (${interviewing} interviewing, ${introduced} introduced, ${pending} pending)`,
    ];
    lines.push(parts.join("\n"));
  }

  const header =
    `:bar_chart: *Pipeline Summary*${projectFilter ? ` -- "${projectFilter}"` : ""}\n` +
    `Jobs: ${jobs.length} | Headcount: ${totalHeadcount} | Filled: ${totalFilled} | Remaining: ${totalHeadcount - totalFilled} | Submissions: ${totalSubmissions}\n` +
    `---`;

  return slackResponse(`${header}\n\n${lines.join("\n\n")}`);
}

// ─── /status [candidate] [status] ───────────────────────────────────

async function handleStatusCommand(text: string) {
  if (!text) {
    return slackResponse(
      "Usage: `/status <candidate name> <new status>`\n" +
        "Example: `/status John Smith INTERVIEWING`\n" +
        "Valid statuses: INTRODUCED, INTERVIEWING, HIRED, REJECTED, WITHDRAWN, REMOVED_FOR_LOCATION, PENDING_DECISION",
    );
  }

  // Try to extract the status from the end of the text
  const words = text.split(/\s+/);
  const lastWord = words[words.length - 1].toUpperCase();

  if (!VALID_STATUSES.includes(lastWord as SubmissionStatus)) {
    return slackResponse(
      `Invalid status: \`${words[words.length - 1]}\`\n` +
        `Valid statuses: ${VALID_STATUSES.map((s) => `\`${s}\``).join(", ")}`,
    );
  }

  const newStatus = lastWord as SubmissionStatus;
  const candidateName = words.slice(0, -1).join(" ");

  if (!candidateName) {
    return slackResponse("Please provide a candidate name before the status.");
  }

  // Find the submission
  const submissions = await db.submission.findMany({
    where: {
      candidate: {
        name: { contains: candidateName, mode: "insensitive" },
      },
      status: { not: "HIRED" }, // don't update already-hired
    },
    include: {
      candidate: { select: { name: true } },
      job: { select: { roleTitle: true, projectName: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (submissions.length === 0) {
    return slackResponse(
      `No active submissions found for "${candidateName}".`,
    );
  }

  if (submissions.length > 1) {
    const list = submissions
      .slice(0, 5)
      .map(
        (s) =>
          `- ${s.candidate.name} on ${s.job.roleTitle} (${s.job.projectName}) -- currently \`${s.status}\``,
      )
      .join("\n");
    return slackResponse(
      `Multiple submissions found for "${candidateName}". Please be more specific:\n${list}`,
    );
  }

  const submission = submissions[0];
  const prevStatus = submission.status;

  // Update the status
  await db.submission.update({
    where: { id: submission.id },
    data: {
      status: newStatus,
      dateLastStatusChange: new Date(),
    },
  });

  await db.activityLog.create({
    data: {
      action: "SUBMISSION_STATUS_CHANGED",
      entityType: "Submission",
      entityId: submission.id,
      jobId: submission.jobId,
      submissionId: submission.id,
      userId: "slack-webhook",
      details: {
        from: prevStatus,
        to: newStatus,
        candidateName: submission.candidate.name,
        roleTitle: submission.job.roleTitle,
        source: "slack-command",
      },
    },
  });

  return slackResponse(
    `:white_check_mark: Updated *${submission.candidate.name}* on *${submission.job.roleTitle}* (${submission.job.projectName}): \`${prevStatus}\` :arrow_right: \`${newStatus}\``,
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Return a Slack-compatible response visible in the channel.
 */
function slackResponse(text: string) {
  return NextResponse.json({
    response_type: "in_channel",
    text,
  });
}
