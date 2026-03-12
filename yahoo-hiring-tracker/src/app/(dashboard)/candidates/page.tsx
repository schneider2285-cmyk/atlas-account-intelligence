"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { usePusher } from "@/hooks/usePusher";
import { CHANNELS, EVENTS } from "@/lib/pusher-channels";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, X } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type SubmissionStatus =
  | "INTRODUCED"
  | "INTERVIEWING"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN"
  | "REMOVED_FOR_LOCATION"
  | "PENDING_DECISION";

type CandidateRow = {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
  rate: { toString(): string } | null;
  email: string | null;
  submissions: Array<{
    id: string;
    status: SubmissionStatus;
    job: {
      id: string;
      roleTitle: string;
      projectName: string;
      businessUnit: string;
    };
  }>;
};

export default function CandidatesPage() {
  // Real-time: refresh candidates list when candidate data changes
  const candidateEvents = [EVENTS.CREATED, EVENTS.UPDATED, EVENTS.DELETED, EVENTS.REFRESH].reduce(
    (map, evt) => ({ ...map, [evt]: [["candidates", "list"]] }),
    {} as Record<string, string[][]>,
  );
  usePusher({
    channelName: CHANNELS.CANDIDATES,
    eventQueryMap: candidateEvents,
  });

  const [search, setSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.candidates.list.useInfiniteQuery(
      { search: search || undefined, limit: 50 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialCursor: undefined,
      }
    );

  const allCandidates = (data?.pages.flatMap((p) => p.candidates) ?? []) as CandidateRow[];

  const columns: ColumnDef<CandidateRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      sortValue: (row) => row.location ?? "",
      render: (row) => row.location ?? "—",
    },
    {
      key: "country",
      header: "Country",
      sortable: true,
      sortValue: (row) => row.country ?? "",
      render: (row) => row.country ?? "—",
    },
    {
      key: "rate",
      header: "Rate",
      sortable: true,
      sortValue: (row) => (row.rate ? Number(row.rate.toString()) : 0),
      render: (row) =>
        row.rate ? `$${Number(row.rate.toString()).toFixed(0)}/hr` : "—",
    },
    {
      key: "submissions",
      header: "Submissions",
      sortable: true,
      sortValue: (row) => row.submissions.length,
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => (
        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {row.submissions.length}
        </span>
      ),
    },
    {
      key: "statuses",
      header: "Current Statuses",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.submissions.slice(0, 3).map((sub) => (
            <StatusBadge key={sub.id} status={sub.status} />
          ))}
          {row.submissions.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{row.submissions.length - 3}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
        <p className="text-sm text-muted-foreground">
          View all candidates and their submissions across jobs
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedCandidate ? "lg:col-span-2" : "lg:col-span-3"}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Loading candidates...
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={allCandidates}
                rowKey={(row) => row.id}
                onRowClick={(row) => setSelectedCandidate(row)}
                emptyMessage="No candidates found."
              />
              {hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedCandidate && (
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selectedCandidate.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setSelectedCandidate(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Location</dt>
                  <dd>{selectedCandidate.location ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Country</dt>
                  <dd>{selectedCandidate.country ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Rate</dt>
                  <dd>
                    {selectedCandidate.rate
                      ? `$${Number(selectedCandidate.rate.toString()).toFixed(0)}/hr`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="truncate text-xs">{selectedCandidate.email ?? "—"}</dd>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">
                  Submissions ({selectedCandidate.submissions.length})
                </h3>
                <div className="space-y-2">
                  {selectedCandidate.submissions.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/jobs/${sub.job.id}`}
                      className="block rounded-md border p-2 hover:bg-accent/30 transition-colors"
                    >
                      <p className="text-sm font-medium">{sub.job.roleTitle}</p>
                      <p className="text-xs text-muted-foreground">{sub.job.projectName}</p>
                      <div className="mt-1">
                        <StatusBadge status={sub.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
