"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { usePusher } from "@/hooks/usePusher";
import { CHANNELS, EVENTS } from "@/lib/pusher-channels";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type RefRow = {
  id: string;
  roleTitle: string;
  projectName: string;
  businessUnit: string;
  matcher: string | null;
  yahooPoC: string;
  slackChannel: string | null;
  interviewerEmails: string | null;
  interviewPrepNotes: string | null;
  status: string;
};

const buLabels: Record<string, string> = {
  MAIL: "Mail",
  HOME_ECO: "Home Eco",
  PARANOIDS: "Paranoids",
  SPORTS: "Sports",
  OTHER: "Other",
};

export default function ReferencePage() {
  // Real-time: refresh job reference data when jobs change
  const jobEvents = [EVENTS.CREATED, EVENTS.UPDATED, EVENTS.DELETED, EVENTS.REFRESH].reduce(
    (map, evt) => ({ ...map, [evt]: [["jobs", "list"]] }),
    {} as Record<string, string[][]>,
  );
  usePusher({
    channelName: CHANNELS.JOBS,
    eventQueryMap: jobEvents,
  });

  const [search, setSearch] = useState("");

  const { data: jobs, isLoading } = trpc.jobs.list.useQuery({
    search: search || undefined,
  });

  const columns: ColumnDef<RefRow>[] = [
    {
      key: "roleTitle",
      header: "Role",
      sortable: true,
      sortValue: (row) => row.roleTitle,
      render: (row) => <span className="font-medium">{row.roleTitle}</span>,
    },
    {
      key: "projectName",
      header: "Project",
      sortable: true,
      sortValue: (row) => row.projectName,
      render: (row) => row.projectName,
    },
    {
      key: "matcher",
      header: "Matcher",
      sortable: true,
      sortValue: (row) => row.matcher ?? "",
      render: (row) => row.matcher ?? "—",
    },
    {
      key: "yahooPoC",
      header: "Yahoo POC",
      sortable: true,
      sortValue: (row) => row.yahooPoC,
      render: (row) => row.yahooPoC,
    },
    {
      key: "slackChannel",
      header: "Slack Channel",
      render: (row) =>
        row.slackChannel ? (
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {row.slackChannel}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "interviewerEmails",
      header: "Interviewer Emails",
      className: "max-w-[200px]",
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
          {row.interviewerEmails ?? "—"}
        </span>
      ),
    },
    {
      key: "interviewPrepNotes",
      header: "Interview Prep",
      className: "max-w-[250px]",
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[250px]">
          {row.interviewPrepNotes ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Internal Reference</h1>
        <p className="text-sm text-muted-foreground">
          Quick reference for internal job details, contacts, and interview prep
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading reference data...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={(jobs as RefRow[]) ?? []}
          rowKey={(row) => row.id}
          emptyMessage="No jobs found."
        />
      )}
    </div>
  );
}
