"use client";

import {
  Briefcase,
  UserCheck,
  ArrowRight,
  LayoutList,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ToolResult } from "@/hooks/useChat";

// ─── Helpers ────────────────────────────────────────────────────────

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function getToolMeta(toolName: string): {
  icon: React.ReactNode;
  label: string;
  color: string;
} {
  switch (toolName) {
    case "createJob":
    case "create_job":
      return {
        icon: <Briefcase className="size-3.5" />,
        label: "Job Created",
        color: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-800/50",
      };
    case "createSubmission":
    case "create_submission":
    case "submit_candidate":
      return {
        icon: <UserCheck className="size-3.5" />,
        label: "Candidate Submitted",
        color: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/30 dark:border-purple-800/50",
      };
    case "updateStatus":
    case "update_status":
    case "update_submission_status":
      return {
        icon: <ArrowRight className="size-3.5" />,
        label: "Status Updated",
        color: "text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/30 dark:border-green-800/50",
      };
    case "log_followup":
      return {
        icon: <CheckCircle2 className="size-3.5" />,
        label: "Follow-up Logged",
        color: "text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/30 dark:border-teal-800/50",
      };
    case "queryPipeline":
    case "query_pipeline":
      return {
        icon: <LayoutList className="size-3.5" />,
        label: "Pipeline Results",
        color: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-800/50",
      };
    case "search_candidates":
      return {
        icon: <UserCheck className="size-3.5" />,
        label: "Candidate Search",
        color: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/30 dark:border-violet-800/50",
      };
    default:
      return {
        icon: <CheckCircle2 className="size-3.5" />,
        label: "Result",
        color: "text-foreground bg-muted border-border",
      };
  }
}

// ─── Sub-components ─────────────────────────────────────────────────

function StatusChangeDisplay({
  result,
}: {
  result: Record<string, unknown>;
}) {
  const oldStatus = String(result.previousStatus ?? result.oldStatus ?? result.old_status ?? "");
  const newStatus = String(result.newStatus ?? result.new_status ?? "");

  if (!oldStatus && !newStatus) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-md bg-muted px-2 py-0.5">{oldStatus || "—"}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className="rounded-md bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
        {newStatus || "—"}
      </span>
    </div>
  );
}

function PipelineTable({
  rows,
}: {
  rows: Record<string, unknown>[];
}) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No results</p>;

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted-foreground"
              >
                {formatKey(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-2 py-1.5">
                  {String(row[col] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          ...and {rows.length - 10} more rows
        </p>
      )}
    </div>
  );
}

function KeyValueDisplay({
  data,
  linkKey,
}: {
  data: Record<string, unknown>;
  linkKey?: string;
}) {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined && typeof value !== "object"
  );

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-2 text-xs">
          <span className="shrink-0 text-muted-foreground">{formatKey(key)}:</span>
          {key === linkKey || key === "url" || key === "link" ? (
            <a
              href={String(value)}
              className="truncate text-blue-500 underline hover:text-blue-600"
            >
              View details
            </a>
          ) : (
            <span className="truncate font-medium">{String(value)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

interface ToolResultCardProps {
  result: ToolResult;
}

export function ToolResultCard({ result }: ToolResultCardProps) {
  const { icon, label, color } = getToolMeta(result.toolName);
  // The executor returns {success, data, error} — unwrap to the inner data object
  const raw = result.result;
  const data: Record<string, unknown> = (raw?.data && typeof raw.data === "object")
    ? raw.data as Record<string, unknown>
    : raw;
  const isError = raw?.success === false;

  // Determine which sub-display to render
  const isStatusUpdate =
    result.toolName.includes("Status") || result.toolName.includes("status");
  const isPipelineQuery =
    result.toolName.includes("Pipeline") || result.toolName.includes("pipeline");
  const isCandidateSearch = result.toolName === "search_candidates";
  const pipelineRows = isPipelineQuery
    ? (Array.isArray(data.jobs) ? data.jobs : Array.isArray(data.rows) ? data.rows : Array.isArray(data.results) ? data.results : null)
    : isCandidateSearch
      ? (Array.isArray(data.candidates) ? data.candidates : null)
      : null;

  return (
    <Card size="sm" className={`w-full ${color}`}>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isError ? (
          <p className="text-xs text-destructive">
            {String(raw.error ?? raw.message ?? "An error occurred")}
          </p>
        ) : isStatusUpdate ? (
          <StatusChangeDisplay result={data} />
        ) : pipelineRows ? (
          <PipelineTable rows={pipelineRows as Record<string, unknown>[]} />
        ) : (
          <KeyValueDisplay data={data} />
        )}

        {/* Success message if present */}
        {!isError && typeof data.message === "string" && data.message && (
          <p className="mt-2 text-xs text-muted-foreground">{String(data.message)}</p>
        )}
      </CardContent>
    </Card>
  );
}
