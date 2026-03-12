"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { usePusher } from "@/hooks/usePusher";
import { CHANNELS, EVENTS } from "@/lib/pusher-channels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AgingBadge } from "@/components/shared/AgingBadge";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { daysSince, formatDate } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

type SubmissionStatus =
  | "INTRODUCED"
  | "INTERVIEWING"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN"
  | "REMOVED_FOR_LOCATION"
  | "PENDING_DECISION";

const allStatuses: { value: SubmissionStatus; label: string }[] = [
  { value: "INTRODUCED", label: "Introduced" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "HIRED", label: "Hired" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "REMOVED_FOR_LOCATION", label: "Removed (Location)" },
  { value: "PENDING_DECISION", label: "Pending Decision" },
];

const buLabels: Record<string, string> = {
  MAIL: "Mail",
  HOME_ECO: "Home Eco",
  PARANOIDS: "Paranoids",
  SPORTS: "Sports",
  OTHER: "Other",
};

const jobStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  ON_HOLD: "bg-yellow-50 text-yellow-700",
  FUTURE_NEED: "bg-blue-50 text-blue-700",
  CANCELLED: "bg-red-50 text-red-700",
};

type SubRow = {
  id: string;
  status: SubmissionStatus;
  dateIntroduced: Date;
  dateLastStatusChange: Date;
  dateLastClientFeedback: Date | null;
  interviewDateTime: Date | null;
  clientFeedbackNotes: string | null;
  candidate: {
    id: string;
    name: string;
    location: string | null;
    rate: { toString(): string } | null;
    pstOverlap: string | null;
  };
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: job, isLoading } = trpc.jobs.getById.useQuery({ id });
  const utils = trpc.useUtils();

  // Real-time: refresh job detail when submissions change
  const submissionEvents = [EVENTS.CREATED, EVENTS.UPDATED, EVENTS.DELETED, EVENTS.REFRESH].reduce(
    (map, evt) => ({ ...map, [evt]: [["jobs", "getById"]] }),
    {} as Record<string, string[][]>,
  );
  usePusher({
    channelName: CHANNELS.SUBMISSIONS,
    eventQueryMap: submissionEvents,
  });

  const updateStatus = trpc.submissions.updateStatus.useMutation({
    onSuccess: () => {
      utils.jobs.getById.invalidate({ id });
    },
  });

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = (submissionId: string, newStatus: SubmissionStatus) => {
    setUpdatingId(submissionId);
    updateStatus.mutate(
      { id: submissionId, status: newStatus },
      { onSettled: () => setUpdatingId(null) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading job details...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Job not found.
      </div>
    );
  }

  const submissions = (job.submissions ?? []) as SubRow[];

  const columns: ColumnDef<SubRow>[] = [
    {
      key: "candidateName",
      header: "Candidate",
      sortable: true,
      sortValue: (row) => row.candidate.name,
      render: (row) => <span className="font-medium">{row.candidate.name}</span>,
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      sortValue: (row) => row.candidate.location ?? "",
      render: (row) => row.candidate.location ?? "—",
    },
    {
      key: "rate",
      header: "Rate",
      sortable: true,
      sortValue: (row) => row.candidate.rate ? Number(row.candidate.rate.toString()) : 0,
      render: (row) =>
        row.candidate.rate ? `$${Number(row.candidate.rate.toString()).toFixed(0)}/hr` : "—",
    },
    {
      key: "pstOverlap",
      header: "PST Overlap",
      render: (row) => row.candidate.pstOverlap ?? "—",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => row.status,
      render: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          <Select
            value={row.status}
            onValueChange={(val) => handleStatusChange(row.id, val as SubmissionStatus)}
            disabled={updatingId === row.id}
          >
            <SelectTrigger className="h-7 w-7 p-0 border-0 shadow-none [&>svg]:h-3 [&>svg]:w-3">
              <span className="sr-only">Change status</span>
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: "dateIntroduced",
      header: "Introduced",
      sortable: true,
      sortValue: (row) => new Date(row.dateIntroduced).getTime(),
      render: (row) => formatDate(row.dateIntroduced),
    },
    {
      key: "daysWaiting",
      header: "Days Waiting",
      sortable: true,
      sortValue: (row) => daysSince(row.dateLastStatusChange),
      render: (row) => <AgingBadge days={daysSince(row.dateLastStatusChange)} />,
    },
    {
      key: "feedback",
      header: "Feedback",
      className: "max-w-[200px] truncate",
      render: (row) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
          {row.clientFeedbackNotes ?? "—"}
        </span>
      ),
    },
  ];

  const rateCap = job.rateCap ? Number(job.rateCap.toString()) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/fulfillment">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.roleTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {job.projectName} &middot; {buLabels[job.businessUnit] ?? job.businessUnit}
          </p>
        </div>
        <span
          className={`ml-3 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
            jobStatusColors[job.status] ?? ""
          }`}
        >
          {job.status.replace("_", " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job metadata */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <InfoField label="Yahoo POC" value={job.yahooPoC} />
              <InfoField label="Open Headcount" value={String(job.openHeadcount)} />
              <InfoField label="Rate Cap" value={rateCap ? `$${rateCap}/hr` : "—"} />
              <InfoField label="SOW #" value={job.sowNumber ?? "—"} />
              <InfoField label="PO #" value={job.poNumber ?? "—"} />
              <InfoField label="Date Opened" value={formatDate(job.dateOpened)} />
              <InfoField label="Matcher" value={job.matcher ?? "—"} />
              <InfoField label="Slack Channel" value={job.slackChannel ?? "—"} />
              {job.approvedLocations && (
                <div className="col-span-2 md:col-span-3">
                  <dt className="text-xs text-muted-foreground">Approved Locations</dt>
                  <dd className="font-medium mt-0.5">{job.approvedLocations}</dd>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              {job.toptalJobLink && (
                <a
                  href={job.toptalJobLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Toptal Job <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {job.salesforceLink && (
                <a
                  href={job.salesforceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Salesforce <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {job.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                job.activities.map((activity) => (
                  <div key={activity.id} className="flex gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs leading-snug">
                        <span className="font-medium">{activity.user?.name ?? "System"}</span>
                        {" "}{formatAction(activity.action)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidate Pipeline */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Candidate Pipeline ({submissions.length})
        </h2>
        <DataTable
          columns={columns}
          data={submissions}
          rowKey={(row) => row.id}
          emptyMessage="No candidates submitted yet."
        />
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium mt-0.5">{value}</dd>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    JOB_CREATED: "created this job",
    JOB_UPDATED: "updated this job",
    SUBMISSION_CREATED: "submitted a candidate",
    SUBMISSION_STATUS_CHANGED: "changed submission status",
    CANDIDATE_CREATED: "added a candidate",
  };
  return map[action] ?? action.toLowerCase().replace(/_/g, " ");
}
