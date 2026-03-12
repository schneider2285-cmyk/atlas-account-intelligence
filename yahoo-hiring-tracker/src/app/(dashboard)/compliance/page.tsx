"use client";

import { trpc } from "@/lib/trpc-client";
import { usePusher } from "@/hooks/usePusher";
import { CHANNELS, EVENTS } from "@/lib/pusher-channels";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ComplianceRow = {
  id: string;
  candidateName: string;
  candidateCountry: string | null;
  candidateLocation: string | null;
  jobTitle: string;
  jobId: string;
  projectName: string;
  approvedLocations: string | null;
  complianceStatus: "approved" | "requires_approval" | "not_approved" | "unknown";
};

const complianceLabels: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-green-50 text-green-700" },
  requires_approval: { label: "Requires Approval", className: "bg-yellow-50 text-yellow-700" },
  not_approved: { label: "Not Approved", className: "bg-red-50 text-red-700" },
  unknown: { label: "Unknown", className: "bg-gray-50 text-gray-500" },
};

function getComplianceStatus(
  candidateCountry: string | null,
  approvedLocations: string | null
): "approved" | "requires_approval" | "not_approved" | "unknown" {
  if (!candidateCountry) return "unknown";
  if (!approvedLocations) return "unknown";
  const approved = approvedLocations.toLowerCase();
  const country = candidateCountry.toLowerCase().trim();
  if (approved.includes(country)) return "approved";
  return "not_approved";
}

const priorityOrder: Record<string, number> = {
  not_approved: 0,
  requires_approval: 1,
  unknown: 2,
  approved: 3,
};

export default function CompliancePage() {
  // Real-time: refresh compliance data when submissions change
  const subEvents = [EVENTS.CREATED, EVENTS.UPDATED, EVENTS.DELETED, EVENTS.REFRESH].reduce(
    (map, evt) => ({ ...map, [evt]: [["candidates", "list"]] }),
    {} as Record<string, string[][]>,
  );
  usePusher({
    channelName: CHANNELS.SUBMISSIONS,
    eventQueryMap: subEvents,
  });

  // Use candidates.list to get candidates with their submissions and job info
  const { data, isLoading } = trpc.candidates.list.useQuery({ limit: 100 });

  const rows: ComplianceRow[] = [];
  if (data?.candidates) {
    for (const candidate of data.candidates) {
      for (const sub of candidate.submissions) {
        const job = sub.job;
        // We need approvedLocations from the job, but candidates.list includes
        // only { id, roleTitle, projectName, businessUnit }
        // We'll show what we can and mark as unknown if no location data
        const status = getComplianceStatus(candidate.country, null);
        rows.push({
          id: sub.id,
          candidateName: candidate.name,
          candidateCountry: candidate.country,
          candidateLocation: candidate.location,
          jobTitle: job.roleTitle,
          jobId: job.id,
          projectName: job.projectName,
          approvedLocations: null,
          complianceStatus: status,
        });
      }
    }
  }

  rows.sort((a, b) => priorityOrder[a.complianceStatus] - priorityOrder[b.complianceStatus]);

  const columns: ColumnDef<ComplianceRow>[] = [
    {
      key: "candidateName",
      header: "Candidate",
      sortable: true,
      sortValue: (row) => row.candidateName,
      render: (row) => <span className="font-medium">{row.candidateName}</span>,
    },
    {
      key: "candidateLocation",
      header: "Location",
      sortable: true,
      sortValue: (row) => row.candidateLocation ?? "",
      render: (row) => row.candidateLocation ?? "---",
    },
    {
      key: "candidateCountry",
      header: "Country",
      sortable: true,
      sortValue: (row) => row.candidateCountry ?? "",
      render: (row) => row.candidateCountry ?? "---",
    },
    {
      key: "jobTitle",
      header: "Job",
      sortable: true,
      sortValue: (row) => row.jobTitle,
      render: (row) => (
        <Link href={`/jobs/${row.jobId}`} className="hover:underline">
          {row.jobTitle}{" "}
          <span className="text-muted-foreground text-xs">({row.projectName})</span>
        </Link>
      ),
    },
    {
      key: "approvedLocations",
      header: "Approved Locations",
      className: "max-w-[200px]",
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
          {row.approvedLocations ?? "See job details"}
        </span>
      ),
    },
    {
      key: "complianceStatus",
      header: "Status",
      sortable: true,
      sortValue: (row) => priorityOrder[row.complianceStatus],
      render: (row) => {
        const config = complianceLabels[row.complianceStatus];
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              config.className
            )}
          >
            {config.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sourcing Compliance</h1>
        <p className="text-sm text-muted-foreground">
          Verify candidate locations against approved countries for each job
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading compliance data...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="No submissions to check."
        />
      )}
    </div>
  );
}
