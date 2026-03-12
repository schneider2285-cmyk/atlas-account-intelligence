import { z, type ZodObject, type ZodRawShape } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Zod Schemas for Validation ────────────────────────────────────

export const createJobInput = z.object({
  roleTitle: z.string().describe("Title of the role (e.g., 'Senior React Developer')"),
  businessUnit: z.enum(["MAIL", "HOME_ECO", "PARANOIDS", "SPORTS", "OTHER"]).describe("Yahoo business unit"),
  projectName: z.string().describe("Project name (e.g., 'Mail Redesign')"),
  poc: z.string().describe("Yahoo point of contact name"),
  headcount: z.number().int().min(1).default(1).describe("Number of open positions"),
  sow: z.string().optional().describe("SOW number if available"),
  po: z.string().optional().describe("PO number if available"),
  rateCap: z.number().optional().describe("Maximum hourly rate in USD"),
  links: z.object({
    toptalJob: z.string().optional().describe("Toptal job listing URL"),
    salesforce: z.string().optional().describe("Salesforce opportunity URL"),
    slack: z.string().optional().describe("Slack channel name"),
  }).optional().describe("Related links"),
});

export const submitCandidateInput = z.object({
  jobIdentifier: z.string().describe("Job to submit to — can be partial role title, project name, or both (e.g., 'React dev for Mail Redesign')"),
  candidateName: z.string().describe("Full name of the candidate"),
  profileLink: z.string().optional().describe("Toptal profile URL or other resume link"),
  location: z.string().optional().describe("Candidate's location (e.g., 'Lisbon, Portugal')"),
  rate: z.number().optional().describe("Candidate's hourly rate in USD"),
});

export const updateSubmissionStatusInput = z.object({
  submissionIdentifier: z.string().describe("Identify the submission by candidate name and/or job (e.g., 'John Smith on the React role' or 'John Smith')"),
  newStatus: z.enum([
    "INTRODUCED",
    "INTERVIEWING",
    "HIRED",
    "REJECTED",
    "WITHDRAWN",
    "REMOVED_FOR_LOCATION",
    "PENDING_DECISION",
  ]).describe("New status for the submission"),
  feedback: z.string().optional().describe("Client feedback or notes about the status change"),
  interviewDate: z.string().optional().describe("Interview date/time if scheduling (ISO 8601 format)"),
});

export const logFollowupInput = z.object({
  jobIdentifier: z.string().describe("Job reference — partial role title or project name"),
  contactPerson: z.string().describe("Name of the person contacted (e.g., Yahoo PoC or hiring manager)"),
  notes: z.string().describe("Summary of the follow-up conversation or action"),
});

export const queryPipelineInput = z.object({
  jobIdentifier: z.string().optional().describe("Specific job to query — partial role title or project name"),
  businessUnit: z.enum(["MAIL", "HOME_ECO", "PARANOIDS", "SPORTS", "OTHER"]).optional().describe("Filter by business unit"),
  projectName: z.string().optional().describe("Filter by project name"),
});

export const searchCandidatesInput = z.object({
  name: z.string().optional().describe("Search by candidate name (partial match)"),
  location: z.string().optional().describe("Search by location (partial match)"),
  minRate: z.number().optional().describe("Minimum hourly rate filter"),
  maxRate: z.number().optional().describe("Maximum hourly rate filter"),
});

// ─── Type Exports ──────────────────────────────────────────────────

export type CreateJobInput = z.infer<typeof createJobInput>;
export type SubmitCandidateInput = z.infer<typeof submitCandidateInput>;
export type UpdateSubmissionStatusInput = z.infer<typeof updateSubmissionStatusInput>;
export type LogFollowupInput = z.infer<typeof logFollowupInput>;
export type QueryPipelineInput = z.infer<typeof queryPipelineInput>;
export type SearchCandidatesInput = z.infer<typeof searchCandidatesInput>;

// ─── Schema-to-JSON-Schema Converter ───────────────────────────────

function zodToInputSchema(schema: ZodObject<ZodRawShape>): Anthropic.Tool["input_schema"] {
  const jsonSchema = z.toJSONSchema(schema);
  // Remove the $schema key — Anthropic doesn't want it
  const { $schema: _, ...rest } = jsonSchema;
  return rest as Anthropic.Tool["input_schema"];
}

// ─── Tool Definitions for Anthropic API ────────────────────────────

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "create_job",
    description:
      "Create a new job opening in the Yahoo Hiring Tracker. Use this when the user wants to add a new role that needs to be filled. Returns the created job details.",
    input_schema: zodToInputSchema(createJobInput),
  },
  {
    name: "submit_candidate",
    description:
      "Submit a candidate to a specific job opening. The job can be identified by partial role title, project name, or a combination. If the match is ambiguous, returns a list of matching jobs for clarification. Creates the candidate record if they don't already exist.",
    input_schema: zodToInputSchema(submitCandidateInput),
  },
  {
    name: "update_submission_status",
    description:
      "Update the status of a candidate's submission. Identify the submission by candidate name and optionally the job. Supports status transitions like INTRODUCED → INTERVIEWING → HIRED/REJECTED. Include feedback notes when available.",
    input_schema: zodToInputSchema(updateSubmissionStatusInput),
  },
  {
    name: "log_followup",
    description:
      "Log a follow-up interaction (call, email, Slack message) about a job. Records who was contacted and what was discussed. Useful for tracking communication with Yahoo stakeholders.",
    input_schema: zodToInputSchema(logFollowupInput),
  },
  {
    name: "query_pipeline",
    description:
      "Query the current hiring pipeline. Can filter by specific job, business unit, or project name. Returns a formatted summary of jobs, submissions, and statuses. Use this for any read-only questions about the current state.",
    input_schema: zodToInputSchema(queryPipelineInput),
  },
  {
    name: "search_candidates",
    description:
      "Search for candidates across the entire system by name, location, or rate range. Returns candidate details and their submission history. Useful for finding if a candidate has been submitted before or checking availability.",
    input_schema: zodToInputSchema(searchCandidatesInput),
  },
];

// ─── Tool Name Union Type ──────────────────────────────────────────

export type ToolName =
  | "create_job"
  | "submit_candidate"
  | "update_submission_status"
  | "log_followup"
  | "query_pipeline"
  | "search_candidates";

export const TOOL_NAMES = new Set<string>([
  "create_job",
  "submit_candidate",
  "update_submission_status",
  "log_followup",
  "query_pipeline",
  "search_candidates",
]);

// ─── Schema Map for Validation ─────────────────────────────────────

export const TOOL_SCHEMAS: Record<ToolName, z.ZodType> = {
  create_job: createJobInput,
  submit_candidate: submitCandidateInput,
  update_submission_status: updateSubmissionStatusInput,
  log_followup: logFollowupInput,
  query_pipeline: queryPipelineInput,
  search_candidates: searchCandidatesInput,
};
