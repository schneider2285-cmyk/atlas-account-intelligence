"use client";

import { trpc } from "@/lib/trpc-client";
import { usePusher } from "@/hooks/usePusher";
import { CHANNELS, EVENTS } from "@/lib/pusher-channels";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  Briefcase,
  UserPlus,
  ArrowRightLeft,
  FileText,
  Clock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const actionIcons: Record<string, LucideIcon> = {
  JOB_CREATED: Briefcase,
  JOB_UPDATED: FileText,
  SUBMISSION_CREATED: UserPlus,
  SUBMISSION_STATUS_CHANGED: ArrowRightLeft,
  CANDIDATE_CREATED: UserPlus,
};

const actionLabels: Record<string, string> = {
  JOB_CREATED: "created a new job",
  JOB_UPDATED: "updated a job",
  SUBMISSION_CREATED: "submitted a candidate",
  SUBMISSION_STATUS_CHANGED: "changed submission status",
  CANDIDATE_CREATED: "added a candidate",
};

function formatDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "";
  switch (action) {
    case "SUBMISSION_STATUS_CHANGED":
      return `${details.candidateName}: ${String(details.from ?? "").replace(/_/g, " ")} -> ${String(details.to ?? "").replace(/_/g, " ")}`;
    case "SUBMISSION_CREATED":
      return `${details.candidateName} for ${details.roleTitle} (${details.projectName})`;
    case "JOB_CREATED":
      return `${details.roleTitle} - ${details.projectName}`;
    default:
      return "";
  }
}

export default function ActivityPage() {
  // Real-time: refresh the activity feed on any activity event
  const activityEvents = [EVENTS.CREATED, EVENTS.UPDATED, EVENTS.DELETED, EVENTS.REFRESH].reduce(
    (map, evt) => ({ ...map, [evt]: [["activity", "list"]] }),
    {} as Record<string, string[][]>,
  );
  usePusher({
    channelName: CHANNELS.ACTIVITY,
    eventQueryMap: activityEvents,
  });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.activity.list.useInfiniteQuery(
      { limit: 30 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialCursor: undefined,
      }
    );

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
        <p className="text-sm text-muted-foreground">
          Chronological log of all pipeline activity
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading activity...
        </div>
      ) : allItems.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No activity recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {allItems.map((item) => {
            const Icon = actionIcons[item.action] ?? Clock;
            const detailsObj = item.details as Record<string, unknown> | null;
            const detailText = formatDetails(item.action, detailsObj);

            return (
              <Card key={item.id} className="shadow-none">
                <CardContent className="flex items-start gap-3 py-3 px-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">
                        {item.user?.name ?? "System"}
                      </span>{" "}
                      {actionLabels[item.action] ?? item.action.toLowerCase().replace(/_/g, " ")}
                    </p>
                    {detailText && (
                      <p className="text-xs text-muted-foreground mt-0.5">{detailText}</p>
                    )}
                    {item.job && (
                      <Link
                        href={`/jobs/${item.job.id}`}
                        className="text-xs text-blue-600 hover:underline mt-0.5 inline-block"
                      >
                        {item.job.roleTitle} - {item.job.projectName}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </span>
                </CardContent>
              </Card>
            );
          })}

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
        </div>
      )}
    </div>
  );
}
