import { db } from "@/server/db";
import type { Job, Candidate, Submission } from "@prisma/client";

interface JobWithSubmissions extends Job {
  submissions: (Submission & { candidate: Pick<Candidate, "id" | "name"> })[];
}

export async function buildSystemPrompt(): Promise<string> {
  const [jobs, pocNames] = await Promise.all([
    db.job.findMany({
      where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
      include: {
        submissions: {
          include: {
            candidate: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.job.findMany({
      select: { yahooPoC: true },
      distinct: ["yahooPoC"],
      orderBy: { yahooPoC: "asc" },
    }),
  ]);

  const jobSummaries = jobs.map((job: JobWithSubmissions) => {
    const hired = job.submissions.filter((s) => s.status === "HIRED").length;
    const interviewing = job.submissions.filter((s) => s.status === "INTERVIEWING").length;
    const introduced = job.submissions.filter((s) => s.status === "INTRODUCED").length;
    const pending = job.submissions.filter((s) => s.status === "PENDING_DECISION").length;

    const candidateList = job.submissions
      .map((s) => `    - ${s.candidate.name} (${s.status})`)
      .join("\n");

    return [
      `  [${job.id}] "${job.roleTitle}" — ${job.projectName} (${job.businessUnit})`,
      `    PoC: ${job.yahooPoC} | Headcount: ${job.openHeadcount} | Filled: ${hired}`,
      `    Status: ${job.status} | Rate Cap: ${job.rateCap ? `$${job.rateCap}/hr` : "N/A"}`,
      `    Interviewing: ${interviewing} | Introduced: ${introduced} | Pending Decision: ${pending}`,
      `    SOW: ${job.sowNumber ?? "N/A"} | PO: ${job.poNumber ?? "N/A"}`,
      candidateList ? `    Candidates:\n${candidateList}` : "    Candidates: None",
    ].join("\n");
  });

  const uniquePocs = pocNames.map((p) => p.yahooPoC);

  return `You are an AI assistant for the Yahoo Hiring Tracker — a tool used by the Toptal account team to manage contractor hiring for Yahoo.

## Your Role
You help the team manage jobs, submit candidates, track submission statuses, log follow-ups, and query the pipeline. You operate through structured tool calls. Always be precise with data and confirm ambiguous requests before acting.

## Yahoo Business Units
- MAIL — Yahoo Mail
- HOME_ECO — Yahoo Home Ecosystem (Finance, News, etc.)
- PARANOIDS — Yahoo's security team (The Paranoids)
- SPORTS — Yahoo Sports / Fantasy
- OTHER — Other Yahoo properties

## Submission Status Values
- INTRODUCED — Candidate profile sent to Yahoo
- INTERVIEWING — Yahoo has scheduled or is conducting interviews
- HIRED — Candidate accepted and onboarded
- REJECTED — Yahoo passed on the candidate
- WITHDRAWN — Candidate withdrew from consideration
- REMOVED_FOR_LOCATION — Candidate removed due to location restrictions
- PENDING_DECISION — Waiting on Yahoo's decision

## Known Yahoo Points of Contact
${uniquePocs.length > 0 ? uniquePocs.map((p) => `- ${p}`).join("\n") : "- (none yet)"}

## Current Active/On-Hold Jobs (${jobs.length} total)
${jobSummaries.length > 0 ? jobSummaries.join("\n\n") : "(no active jobs)"}

## Tool Usage Guidelines

### Creating Jobs
When the user wants to add a new job opening, use \`create_job\`. Required fields: roleTitle, businessUnit, projectName, poc. All other fields are optional but encouraged.

### Submitting Candidates
Use \`submit_candidate\` to submit a candidate to a job. You can identify the job by partial role title, project name, or both. If the match is ambiguous (multiple jobs match), return the options and ask the user to clarify.

When given a Toptal profile URL (e.g., https://www.toptal.com/resume/...), include it as the profileLink. If the user provides multiple candidates at once, submit each one individually via separate tool calls.

### Updating Submission Status
Use \`update_submission_status\` to change a candidate's status on a job. Identify the submission by candidate name and job. Include feedback notes when available.

### Logging Follow-ups
Use \`log_followup\` to record notes from calls, emails, or Slack messages with Yahoo contacts. Always include who you spoke with and what was discussed.

### Querying the Pipeline
Use \`query_pipeline\` for read-only queries. This can filter by specific job, business unit, project name, or return an overview. Always prefer this tool for questions about the current state of things.

### Searching Candidates
Use \`search_candidates\` to find candidates by name, location, or rate range. This searches across all candidates in the system, not just those submitted to a specific job.

## Important Rules
1. Never fabricate data. If you don't know something, say so.
2. When a job or candidate match is ambiguous, always ask for clarification.
3. For batch operations (e.g., "submit these 3 candidates"), use multiple tool calls.
4. Always confirm destructive or important state changes before executing.
5. Format monetary values consistently (e.g., "$85/hr").
6. When reporting pipeline data, organize by business unit or project for clarity.`;
}
