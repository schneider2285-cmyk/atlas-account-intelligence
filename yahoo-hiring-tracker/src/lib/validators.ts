import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────────────────

export const BusinessUnit = z.enum(["MAIL", "HOME_ECO", "PARANOIDS", "SPORTS", "OTHER"]);
export const JobStatus = z.enum(["ACTIVE", "ON_HOLD", "FUTURE_NEED", "CANCELLED"]);
export const SubmissionStatus = z.enum([
  "INTRODUCED",
  "INTERVIEWING",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
  "REMOVED_FOR_LOCATION",
  "PENDING_DECISION",
]);

// ─── Jobs ───────────────────────────────────────────────────────────

export const createJobSchema = z.object({
  roleTitle: z.string().min(1),
  businessUnit: BusinessUnit,
  projectName: z.string().min(1),
  yahooPoC: z.string().min(1),
  openHeadcount: z.number().int().min(1).default(1),
  sowNumber: z.string().optional(),
  poNumber: z.string().optional(),
  rateCap: z.number().optional(),
  toptalJobLink: z.string().url().optional().or(z.literal("")),
  salesforceLink: z.string().url().optional().or(z.literal("")),
  slackChannel: z.string().optional(),
  interviewerEmails: z.string().optional(),
  interviewPrepNotes: z.string().optional(),
  approvedLocations: z.string().optional(),
  status: JobStatus.default("ACTIVE"),
  matcher: z.string().optional(),
});

export const updateJobSchema = createJobSchema.partial().extend({
  id: z.string(),
});

// ─── Candidates ─────────────────────────────────────────────────────

export const createCandidateSchema = z.object({
  name: z.string().min(1),
  toptalProfileLink: z.string().url().optional().or(z.literal("")),
  location: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  rate: z.number().optional(),
  pstOverlap: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export const updateCandidateSchema = createCandidateSchema.partial().extend({
  id: z.string(),
});

// ─── Submissions ────────────────────────────────────────────────────

export const createSubmissionSchema = z.object({
  jobId: z.string(),
  candidateId: z.string(),
  status: SubmissionStatus.default("INTRODUCED"),
  dateIntroduced: z.date().optional(),
  interviewDateTime: z.date().optional(),
  clientFeedbackNotes: z.string().optional(),
  candidateIntroMessage: z.string().optional(),
});

export const updateSubmissionSchema = z.object({
  id: z.string(),
  status: SubmissionStatus.optional(),
  dateLastClientFeedback: z.date().optional(),
  interviewDateTime: z.date().optional(),
  clientFeedbackNotes: z.string().optional(),
  candidateIntroMessage: z.string().optional(),
});

// ─── Filters ────────────────────────────────────────────────────────

export const jobFilterSchema = z.object({
  businessUnit: BusinessUnit.optional(),
  status: JobStatus.optional(),
  projectName: z.string().optional(),
  yahooPoC: z.string().optional(),
  search: z.string().optional(),
});

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
