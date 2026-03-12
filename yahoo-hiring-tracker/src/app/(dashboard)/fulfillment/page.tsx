"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { FilterBar, type FilterValues } from "@/components/shared/FilterBar";
import { AgingBadge } from "@/components/shared/AgingBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SummaryCard } from "@/components/shared/SummaryCard";
import { daysSince } from "@/lib/utils";
import { useMultiChannelPusher } from "@/hooks/usePusher";
import { CHANNELS, EVENTS } from "@/lib/pusher-channels";
import {
  Briefcase,
  Users,
  Calendar,
  Clock,
  Trophy,
} from "lucide-react";

type JobRow = {
  id: string;
  roleTitle: string;
  projectName: string;
  businessUnit: string;
  yahooPoC: string;
  openHeadcount: number;
  status: string;
  dateOpened: Date;
  updatedAt: Date;
  totalSubmissions: number;
  interviewingCount: number;
  filledHeadcount: number;
  remainingHeadcount: number;
  introducedCount: number;
};

const buLabels: Record<string, string> = {
  MAIL: "Mail",
  HOME_ECO: "Home Eco",
  PARANOIDS: "Paranoids",
  SPORTS: "Sports",
  SEARCH: "Search",
  ADS: "Ads",
  OTHER: "Other",
};

const buColors: Record<string, string> = {
  MAIL: "#204ECF",
  HOME_ECO: "#0D9E6E",
  PARANOIDS: "#D6336C",
  SPORTS: "#D97B00",
  SEARCH: "#6941C6",
  ADS: "#EA580C",
  OTHER: "#6B7280",
};

export default function FulfillmentPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterValues>({});

  const { data: jobs, isLoading } = trpc.jobs.list.useQuery(
    {
      businessUnit: filters.businessUnit as "MAIL" | "HOME_ECO" | "PARANOIDS" | "SPORTS" | "SEARCH" | "ADS" | "OTHER" | undefined,
      status: (filters.status as "ACTIVE" | "ON_HOLD" | "FUTURE_NEED" | "CANCELLED" | "FINDING_TALENT" | "ENGAGEMENT_COMPLETED" | "ROLE_CANCELLED") ?? "ACTIVE",
      projectName: filters.projectName,
      yahooPoC: filters.yahooPoC,
      search: filters.search,
    }
  );

  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: filterOptions } = trpc.jobs.filterOptions.useQuery();

  // Real-time: invalidate queries on Pusher events
  const allEvents = [EVENTS.CREATED, EVENTS.UPDATED, EVENTS.DELETED, EVENTS.REFRESH];
  const jobKeys = allEvents.reduce(
    (map, evt) => ({ ...map, [evt]: [["jobs", "list"], ["jobs", "filterOptions"], ["dashboard", "stats"]] }),
    {} as Record<string, string[][]>,
  );
  const subKeys = allEvents.reduce(
    (map, evt) => ({ ...map, [evt]: [["jobs", "list"], ["dashboard", "stats"]] }),
    {} as Record<string, string[][]>,
  );
  const dashKeys = allEvents.reduce(
    (map, evt) => ({ ...map, [evt]: [["jobs", "list"], ["jobs", "filterOptions"], ["dashboard", "stats"]] }),
    {} as Record<string, string[][]>,
  );
  useMultiChannelPusher([
    { channel: CHANNELS.JOBS, eventQueryMap: jobKeys },
    { channel: CHANNELS.SUBMISSIONS, eventQueryMap: subKeys },
    { channel: CHANNELS.DASHBOARD, eventQueryMap: dashKeys },
  ]);

  const columns: ColumnDef<JobRow>[] = [
    {
      key: "roleTitle",
      header: "Role",
      sortable: true,
      sortValue: (row) => row.roleTitle,
      render: (row) => (
        <span className="font-medium">{row.roleTitle}</span>
      ),
    },
    {
      key: "projectName",
      header: "Project",
      sortable: true,
      sortValue: (row) => row.projectName,
      render: (row) => row.projectName,
    },
    {
      key: "businessUnit",
      header: "BU",
      sortable: true,
      sortValue: (row) => row.businessUnit,
      render: (row) => (
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color: buColors[row.businessUnit] ?? "#6B7280" }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: buColors[row.businessUnit] ?? "#6B7280" }}
          />
          {buLabels[row.businessUnit] ?? row.businessUnit}
        </span>
      ),
    },
    {
      key: "yahooPoC",
      header: "POC",
      sortable: true,
      sortValue: (row) => row.yahooPoC,
      render: (row) => row.yahooPoC,
    },
    {
      key: "openHeadcount",
      header: "Open HC",
      sortable: true,
      sortValue: (row) => row.openHeadcount,
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => row.openHeadcount,
    },
    {
      key: "totalSubmissions",
      header: "Submitted",
      sortable: true,
      sortValue: (row) => row.totalSubmissions,
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => row.totalSubmissions,
    },
    {
      key: "interviewingCount",
      header: "Interviewing",
      sortable: true,
      sortValue: (row) => row.interviewingCount,
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => (
        <span className={row.interviewingCount > 0 ? "text-[#6941C6] font-medium" : ""}>
          {row.interviewingCount}
        </span>
      ),
    },
    {
      key: "filledHeadcount",
      header: "Hired",
      sortable: true,
      sortValue: (row) => row.filledHeadcount,
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => (
        <span className={row.filledHeadcount > 0 ? "text-[#0D9E6E] font-medium" : ""}>
          {row.filledHeadcount}
        </span>
      ),
    },
    {
      key: "remainingHeadcount",
      header: "Remaining",
      sortable: true,
      sortValue: (row) => row.remainingHeadcount,
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => (
        <span className={row.remainingHeadcount > 0 ? "text-[#D97B00] font-medium" : "text-[#0D9E6E]"}>
          {row.remainingHeadcount}
        </span>
      ),
    },
    {
      key: "daysOpen",
      header: "Days Open",
      sortable: true,
      sortValue: (row) => daysSince(row.dateOpened),
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => daysSince(row.dateOpened) ?? "—",
    },
    {
      key: "lastActivity",
      header: "Last Activity",
      sortable: true,
      sortValue: (row) => new Date(row.updatedAt).getTime(),
      render: (row) => <AgingBadge days={daysSince(row.updatedAt)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Job Fulfillment Board</h1>
          <p className="text-sm text-muted-foreground">
            Track active job openings and their pipeline status
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard
          label="Active Jobs"
          value={stats?.activeJobs ?? 0}
          icon={Briefcase}
          accentColor="#204ECF"
        />
        <SummaryCard
          label="In Pipeline"
          value={stats?.totalSubmissions ?? 0}
          icon={Users}
          accentColor="#6941C6"
        />
        <SummaryCard
          label="Interviewing"
          value={stats?.interviewingCount ?? 0}
          icon={Calendar}
          accentColor="#D97B00"
        />
        <SummaryCard
          label="Pending Decisions"
          value={stats?.pendingDecisionCount ?? 0}
          icon={Clock}
          accentColor="#D6336C"
        />
        <SummaryCard
          label="Hired"
          value={stats?.hiredCount ?? 0}
          icon={Trophy}
          accentColor="#0D9E6E"
        />
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        projectNames={filterOptions?.projectNames ?? []}
        yahooPocs={filterOptions?.yahooPocs ?? []}
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading jobs...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={(jobs as JobRow[]) ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/jobs/${row.id}`)}
          emptyMessage="No jobs match your filters."
        />
      )}
    </div>
  );
}
