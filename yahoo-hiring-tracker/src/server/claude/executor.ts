import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { emitChange, CHANNELS, EVENTS } from "@/server/pusher";
import {
  notifyStatusChange,
  notifyInterviewScheduled,
} from "@/server/slack";
import {
  type ToolName,
  type CreateJobInput,
  type SubmitCandidateInput,
  type UpdateSubmissionStatusInput,
  type LogFollowupInput,
  type QueryPipelineInput,
  type SearchCandidatesInput,
  TOOL_SCHEMAS,
} from "./tools";

// ─── Result Types ──────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** When multiple jobs/candidates match, we return clarification options */
  clarification?: {
    type: "job" | "candidate" | "submission";
    options: Array<{ id: string; label: string }>;
    message: string;
  };
}

// ─── Main Executor ─────────────────────────────────────────────────

export async function executeTool(
  toolName: ToolName,
  rawInput: unknown,
  userId: string
): Promise<ToolResult> {
  // Validate input with the corresponding Zod schema
  const schema = TOOL_SCHEMAS[toolName];
  const parseResult = schema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid input for ${toolName}: ${parseResult.error.message}`,
    };
  }

  const input = parseResult.data;

  switch (toolName) {
    case "create_job":
      return executeCreateJob(input as CreateJobInput, userId);
    case "submit_candidate":
      return executeSubmitCandidate(input as SubmitCandidateInput, userId);
    case "update_submission_status":
      return executeUpdateSubmissionStatus(input as UpdateSubmissionStatusInput, userId);
    case "log_followup":
      return executeLogFollowup(input as LogFollowupInput, userId);
    case "query_pipeline":
      return executeQueryPipeline(input as QueryPipelineInput);
    case "search_candidates":
      return executeSearchCandidates(input as SearchCandidatesInput);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

// ─── Fuzzy Matching Helpers ────────────────────────────────────────

async function fuzzyMatchJobs(identifier: string) {
  const terms = identifier.toLowerCase().split(/\s+/);

  const jobs = await db.job.findMany({
    where: {
      status: { in: ["ACTIVE", "ON_HOLD"] },
      OR: [
        { roleTitle: { contains: identifier, mode: "insensitive" } },
        { projectName: { contains: identifier, mode: "insensitive" } },
        ...terms.flatMap((term) => [
          { roleTitle: { contains: term, mode: "insensitive" as const } },
          { projectName: { contains: term, mode: "insensitive" as const } },
        ]),
      ],
    },
    select: {
      id: true,
      roleTitle: true,
      projectName: true,
      businessUnit: true,
      yahooPoC: true,
      openHeadcount: true,
      rateCap: true,
    },
  });

  // Score matches: higher score = better match
  const scored = jobs.map((job) => {
    let score = 0;
    const title = job.roleTitle.toLowerCase();
    const project = job.projectName.toLowerCase();
    const ident = identifier.toLowerCase();

    // Exact matches score highest
    if (title === ident || project === ident) score += 100;
    // Contains full identifier
    if (title.includes(ident) || project.includes(ident)) score += 50;
    // Individual term matches
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      if (project.includes(term)) score += 10;
    }

    return { ...job, score };
  });

  // Sort by score descending and deduplicate
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return scored.filter((j) => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });
}

async function fuzzyMatchSubmissions(identifier: string) {
  // Parse "CandidateName on JobIdentifier" or just "CandidateName"
  const onMatch = identifier.match(/^(.+?)\s+(?:on|for|@)\s+(.+)$/i);
  const candidateSearch = onMatch ? onMatch[1].trim() : identifier.trim();
  const jobSearch = onMatch ? onMatch[2].trim() : undefined;

  const where: Prisma.SubmissionWhereInput = {
    candidate: {
      name: { contains: candidateSearch, mode: "insensitive" },
    },
  };

  if (jobSearch) {
    where.job = {
      OR: [
        { roleTitle: { contains: jobSearch, mode: "insensitive" } },
        { projectName: { contains: jobSearch, mode: "insensitive" } },
      ],
    };
  }

  return db.submission.findMany({
    where,
    include: {
      candidate: { select: { id: true, name: true } },
      job: { select: { id: true, roleTitle: true, projectName: true, businessUnit: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// ─── Tool Executors ────────────────────────────────────────────────

async function executeCreateJob(input: CreateJobInput, userId: string): Promise<ToolResult> {
  const job = await db.job.create({
    data: {
      roleTitle: input.roleTitle,
      businessUnit: input.businessUnit,
      projectName: input.projectName,
      yahooPoC: input.poc,
      openHeadcount: input.headcount ?? 1,
      sowNumber: input.sow ?? null,
      poNumber: input.po ?? null,
      rateCap: input.rateCap ? new Prisma.Decimal(input.rateCap) : null,
      toptalJobLink: input.links?.toptalJob ?? null,
      salesforceLink: input.links?.salesforce ?? null,
      slackChannel: input.links?.slack ?? null,
    },
  });

  await db.activityLog.create({
    data: {
      action: "JOB_CREATED",
      entityType: "Job",
      entityId: job.id,
      jobId: job.id,
      userId,
      details: {
        roleTitle: job.roleTitle,
        projectName: job.projectName,
        businessUnit: job.businessUnit,
        source: "chat",
      },
    },
  });

  await emitChange(CHANNELS.JOBS, EVENTS.CREATED, { id: job.id });
  await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});

  return {
    success: true,
    data: {
      id: job.id,
      roleTitle: job.roleTitle,
      businessUnit: job.businessUnit,
      projectName: job.projectName,
      poc: job.yahooPoC,
      headcount: job.openHeadcount,
      rateCap: job.rateCap ? `$${job.rateCap}/hr` : null,
      message: `Created job "${job.roleTitle}" for ${job.projectName} (${job.businessUnit})`,
    },
  };
}

async function executeSubmitCandidate(
  input: SubmitCandidateInput,
  userId: string
): Promise<ToolResult> {
  // Step 1: Find the job
  const matchedJobs = await fuzzyMatchJobs(input.jobIdentifier);

  if (matchedJobs.length === 0) {
    return {
      success: false,
      error: `No active jobs found matching "${input.jobIdentifier}". Please check the job title or project name.`,
    };
  }

  if (matchedJobs.length > 1) {
    // Check if the top match is significantly better than the second
    if (matchedJobs[0].score > matchedJobs[1].score * 1.5) {
      // Use the top match
    } else {
      return {
        success: false,
        clarification: {
          type: "job",
          options: matchedJobs.slice(0, 5).map((j) => ({
            id: j.id,
            label: `${j.roleTitle} — ${j.projectName} (${j.businessUnit})`,
          })),
          message: `Multiple jobs match "${input.jobIdentifier}". Which one did you mean?`,
        },
      };
    }
  }

  const job = matchedJobs[0];

  // Step 2: Find or create the candidate
  let candidate = await db.candidate.findFirst({
    where: { name: { equals: input.candidateName, mode: "insensitive" } },
  });

  // Parse Toptal profile URL for extra info
  const profileInfo = input.profileLink ? parseToptalProfile(input.profileLink) : null;

  if (!candidate) {
    candidate = await db.candidate.create({
      data: {
        name: input.candidateName,
        toptalProfileLink: input.profileLink ?? null,
        location: input.location ?? profileInfo?.location ?? null,
        rate: input.rate ? new Prisma.Decimal(input.rate) : null,
      },
    });

    await emitChange(CHANNELS.CANDIDATES, EVENTS.CREATED, { id: candidate.id });
  } else {
    // Update candidate with new info if provided
    const updates: Prisma.CandidateUpdateInput = {};
    if (input.profileLink && !candidate.toptalProfileLink) {
      updates.toptalProfileLink = input.profileLink;
    }
    if (input.location && !candidate.location) {
      updates.location = input.location;
    }
    if (input.rate && !candidate.rate) {
      updates.rate = new Prisma.Decimal(input.rate);
    }
    if (Object.keys(updates).length > 0) {
      candidate = await db.candidate.update({
        where: { id: candidate.id },
        data: updates,
      });
    }
  }

  // Step 3: Check for duplicate submission
  const existingSubmission = await db.submission.findFirst({
    where: { jobId: job.id, candidateId: candidate.id },
  });

  if (existingSubmission) {
    return {
      success: false,
      error: `${input.candidateName} has already been submitted to "${job.roleTitle}" (${job.projectName}). Current status: ${existingSubmission.status}.`,
    };
  }

  // Step 4: Create the submission
  const submission = await db.submission.create({
    data: {
      jobId: job.id,
      candidateId: candidate.id,
      status: "INTRODUCED",
      createdById: userId,
    },
    include: {
      job: { select: { roleTitle: true, projectName: true } },
      candidate: { select: { name: true } },
    },
  });

  await db.activityLog.create({
    data: {
      action: "SUBMISSION_CREATED",
      entityType: "Submission",
      entityId: submission.id,
      jobId: job.id,
      submissionId: submission.id,
      userId,
      details: {
        candidateName: candidate.name,
        roleTitle: job.roleTitle,
        projectName: job.projectName,
        source: "chat",
      },
    },
  });

  await emitChange(CHANNELS.SUBMISSIONS, EVENTS.CREATED, { id: submission.id, jobId: job.id });
  await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});

  // ── Slack: notify about new submission ────────────────────────
  const jobWithChannel = await db.job.findUnique({
    where: { id: job.id },
    select: { slackChannel: true },
  });
  if (jobWithChannel?.slackChannel) {
    void notifyStatusChange(
      job.roleTitle,
      candidate.name,
      "NEW",
      "INTRODUCED",
      jobWithChannel.slackChannel,
    );
  }

  return {
    success: true,
    data: {
      submissionId: submission.id,
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobTitle: job.roleTitle,
      projectName: job.projectName,
      status: "INTRODUCED",
      rate: candidate.rate ? `$${candidate.rate}/hr` : null,
      location: candidate.location,
      message: `Submitted ${candidate.name} to "${job.roleTitle}" (${job.projectName}). Status: INTRODUCED.`,
    },
  };
}

async function executeUpdateSubmissionStatus(
  input: UpdateSubmissionStatusInput,
  userId: string
): Promise<ToolResult> {
  const submissions = await fuzzyMatchSubmissions(input.submissionIdentifier);

  if (submissions.length === 0) {
    return {
      success: false,
      error: `No submissions found matching "${input.submissionIdentifier}". Check the candidate name and job.`,
    };
  }

  if (submissions.length > 1) {
    return {
      success: false,
      clarification: {
        type: "submission",
        options: submissions.slice(0, 5).map((s) => ({
          id: s.id,
          label: `${s.candidate.name} → ${s.job.roleTitle} (${s.job.projectName}) [${s.status}]`,
        })),
        message: `Multiple submissions match "${input.submissionIdentifier}". Which one?`,
      },
    };
  }

  const submission = submissions[0];
  const prevStatus = submission.status;

  const updateData: Prisma.SubmissionUpdateInput = {
    status: input.newStatus,
    dateLastStatusChange: new Date(),
  };

  if (input.feedback) {
    updateData.clientFeedbackNotes = input.feedback;
    updateData.dateLastClientFeedback = new Date();
  }

  if (input.interviewDate) {
    updateData.interviewDateTime = new Date(input.interviewDate);
  }

  const updated = await db.submission.update({
    where: { id: submission.id },
    data: updateData,
    include: {
      job: { select: { roleTitle: true, projectName: true } },
      candidate: { select: { name: true } },
    },
  });

  await db.activityLog.create({
    data: {
      action: "SUBMISSION_STATUS_CHANGED",
      entityType: "Submission",
      entityId: submission.id,
      jobId: submission.jobId,
      submissionId: submission.id,
      userId,
      details: {
        from: prevStatus,
        to: input.newStatus,
        candidateName: submission.candidate.name,
        roleTitle: submission.job.roleTitle,
        feedback: input.feedback ?? null,
        source: "chat",
      },
    },
  });

  await emitChange(CHANNELS.SUBMISSIONS, EVENTS.UPDATED, {
    id: submission.id,
    jobId: submission.jobId,
  });
  await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});

  // ── Slack Notifications ───────────────────────────────────────
  // Look up the job's Slack channel; fall back to nothing (no-op).
  const jobForSlack = await db.job.findUnique({
    where: { id: submission.jobId },
    select: { slackChannel: true },
  });
  const slackChannel = jobForSlack?.slackChannel;

  if (slackChannel) {
    // Fire-and-forget so we never block the mutation response
    void notifyStatusChange(
      updated.job.roleTitle,
      updated.candidate.name,
      prevStatus,
      input.newStatus,
      slackChannel,
    );

    // If an interview was scheduled, send an additional notification
    if (input.interviewDate && input.newStatus === "INTERVIEWING") {
      void notifyInterviewScheduled(
        updated.job.roleTitle,
        updated.candidate.name,
        input.interviewDate,
        slackChannel,
      );
    }
  }

  return {
    success: true,
    data: {
      submissionId: updated.id,
      candidateName: updated.candidate.name,
      jobTitle: updated.job.roleTitle,
      projectName: updated.job.projectName,
      previousStatus: prevStatus,
      newStatus: input.newStatus,
      feedback: input.feedback ?? null,
      message: `Updated ${updated.candidate.name} on "${updated.job.roleTitle}": ${prevStatus} → ${input.newStatus}`,
    },
  };
}

async function executeLogFollowup(input: LogFollowupInput, userId: string): Promise<ToolResult> {
  const matchedJobs = await fuzzyMatchJobs(input.jobIdentifier);

  if (matchedJobs.length === 0) {
    return {
      success: false,
      error: `No active jobs found matching "${input.jobIdentifier}".`,
    };
  }

  if (matchedJobs.length > 1 && matchedJobs[0].score <= matchedJobs[1].score * 1.5) {
    return {
      success: false,
      clarification: {
        type: "job",
        options: matchedJobs.slice(0, 5).map((j) => ({
          id: j.id,
          label: `${j.roleTitle} — ${j.projectName} (${j.businessUnit})`,
        })),
        message: `Multiple jobs match "${input.jobIdentifier}". Which one?`,
      },
    };
  }

  const job = matchedJobs[0];

  const activity = await db.activityLog.create({
    data: {
      action: "FOLLOWUP_LOGGED",
      entityType: "Job",
      entityId: job.id,
      jobId: job.id,
      userId,
      details: {
        contactPerson: input.contactPerson,
        notes: input.notes,
        source: "chat",
      },
    },
  });

  await emitChange(CHANNELS.ACTIVITY, EVENTS.CREATED, { id: activity.id, jobId: job.id });

  return {
    success: true,
    data: {
      activityId: activity.id,
      jobTitle: job.roleTitle,
      projectName: job.projectName,
      contactPerson: input.contactPerson,
      notes: input.notes,
      message: `Logged follow-up for "${job.roleTitle}" (${job.projectName}): contacted ${input.contactPerson}.`,
    },
  };
}

async function executeQueryPipeline(input: QueryPipelineInput): Promise<ToolResult> {
  const where: Prisma.JobWhereInput = {
    status: { in: ["ACTIVE", "ON_HOLD"] },
  };

  if (input.businessUnit) {
    where.businessUnit = input.businessUnit;
  }

  if (input.projectName) {
    where.projectName = { contains: input.projectName, mode: "insensitive" };
  }

  if (input.jobIdentifier) {
    where.OR = [
      { roleTitle: { contains: input.jobIdentifier, mode: "insensitive" } },
      { projectName: { contains: input.jobIdentifier, mode: "insensitive" } },
    ];
  }

  const jobs = await db.job.findMany({
    where,
    include: {
      submissions: {
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              location: true,
              rate: true,
              toptalProfileLink: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: [{ businessUnit: "asc" }, { updatedAt: "desc" }],
  });

  if (jobs.length === 0) {
    return {
      success: true,
      data: {
        totalJobs: 0,
        message: "No jobs found matching the criteria.",
        jobs: [],
      },
    };
  }

  const summary = jobs.map((job) => {
    const hired = job.submissions.filter((s) => s.status === "HIRED").length;
    const interviewing = job.submissions.filter((s) => s.status === "INTERVIEWING");
    const introduced = job.submissions.filter((s) => s.status === "INTRODUCED");
    const pending = job.submissions.filter((s) => s.status === "PENDING_DECISION");
    const rejected = job.submissions.filter((s) => s.status === "REJECTED").length;

    return {
      id: job.id,
      roleTitle: job.roleTitle,
      projectName: job.projectName,
      businessUnit: job.businessUnit,
      poc: job.yahooPoC,
      status: job.status,
      headcount: job.openHeadcount,
      filled: hired,
      remaining: job.openHeadcount - hired,
      rateCap: job.rateCap ? `$${job.rateCap}/hr` : null,
      submissions: {
        total: job.submissions.length,
        interviewing: interviewing.map((s) => ({
          name: s.candidate.name,
          rate: s.candidate.rate ? `$${s.candidate.rate}/hr` : null,
          location: s.candidate.location,
        })),
        introduced: introduced.map((s) => ({
          name: s.candidate.name,
          rate: s.candidate.rate ? `$${s.candidate.rate}/hr` : null,
          location: s.candidate.location,
        })),
        pendingDecision: pending.map((s) => ({
          name: s.candidate.name,
          rate: s.candidate.rate ? `$${s.candidate.rate}/hr` : null,
          location: s.candidate.location,
        })),
        rejectedCount: rejected,
      },
    };
  });

  // Aggregate stats
  const totalJobs = jobs.length;
  const totalOpenHeadcount = jobs.reduce((sum, j) => sum + j.openHeadcount, 0);
  const totalFilled = summary.reduce((sum, j) => sum + j.filled, 0);
  const totalSubmissions = jobs.reduce((sum, j) => sum + j.submissions.length, 0);

  return {
    success: true,
    data: {
      totalJobs,
      totalOpenHeadcount,
      totalFilled,
      totalRemaining: totalOpenHeadcount - totalFilled,
      totalSubmissions,
      jobs: summary,
      message: `Pipeline: ${totalJobs} jobs, ${totalOpenHeadcount} headcount (${totalFilled} filled, ${totalOpenHeadcount - totalFilled} remaining), ${totalSubmissions} total submissions.`,
    },
  };
}

async function executeSearchCandidates(input: SearchCandidatesInput): Promise<ToolResult> {
  const where: Prisma.CandidateWhereInput = {};
  const conditions: Prisma.CandidateWhereInput[] = [];

  if (input.name) {
    conditions.push({ name: { contains: input.name, mode: "insensitive" } });
  }

  if (input.location) {
    conditions.push({
      OR: [
        { location: { contains: input.location, mode: "insensitive" } },
        { city: { contains: input.location, mode: "insensitive" } },
        { country: { contains: input.location, mode: "insensitive" } },
      ],
    });
  }

  if (input.minRate !== undefined) {
    conditions.push({ rate: { gte: new Prisma.Decimal(input.minRate) } });
  }

  if (input.maxRate !== undefined) {
    conditions.push({ rate: { lte: new Prisma.Decimal(input.maxRate) } });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  const candidates = await db.candidate.findMany({
    where,
    include: {
      submissions: {
        include: {
          job: {
            select: {
              id: true,
              roleTitle: true,
              projectName: true,
              businessUnit: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  if (candidates.length === 0) {
    return {
      success: true,
      data: {
        total: 0,
        candidates: [],
        message: "No candidates found matching the criteria.",
      },
    };
  }

  const results = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    location: c.location,
    rate: c.rate ? `$${c.rate}/hr` : null,
    profileLink: c.toptalProfileLink,
    email: c.email,
    submissions: c.submissions.map((s) => ({
      jobTitle: s.job.roleTitle,
      projectName: s.job.projectName,
      businessUnit: s.job.businessUnit,
      status: s.status,
    })),
  }));

  return {
    success: true,
    data: {
      total: candidates.length,
      candidates: results,
      message: `Found ${candidates.length} candidate(s).`,
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseToptalProfile(url: string): { location?: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("toptal.com")) return null;
    // Toptal profile URLs don't encode location in the URL, but we
    // can flag it's a valid Toptal link for the system
    return {};
  } catch {
    return null;
  }
}
