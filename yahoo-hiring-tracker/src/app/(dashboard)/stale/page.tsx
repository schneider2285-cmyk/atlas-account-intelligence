"use client";

import { trpc } from "@/lib/trpc-client";
import { usePusher } from "@/hooks/usePusher";
import { CHANNELS, EVENTS } from "@/lib/pusher-channels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { daysSince, formatDate } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Inbox } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function StalePage() {
  // Real-time: refresh stale items when dashboard data changes
  const dashEvents = [EVENTS.CREATED, EVENTS.UPDATED, EVENTS.DELETED, EVENTS.REFRESH].reduce(
    (map, evt) => ({ ...map, [evt]: [["dashboard", "staleItems"]] }),
    {} as Record<string, string[][]>,
  );
  usePusher({
    channelName: CHANNELS.DASHBOARD,
    eventQueryMap: dashEvents,
  });

  const { data, isLoading } = trpc.dashboard.staleItems.useQuery({
    warningDays: 7,
    criticalDays: 14,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading stale items...
      </div>
    );
  }

  const staleJobs = data?.staleJobs ?? [];
  const staleSubs = data?.staleSubmissions ?? [];
  const emptyJobs = data?.emptyJobs ?? [];

  const totalIssues = staleJobs.length + staleSubs.length + emptyJobs.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stale Pipeline Report</h1>
        <p className="text-sm text-muted-foreground">
          {totalIssues === 0
            ? "Pipeline is healthy - no stale items found."
            : `${totalIssues} item${totalIssues > 1 ? "s" : ""} need${totalIssues === 1 ? "s" : ""} attention`}
        </p>
      </div>

      {/* Stale Jobs */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Stale Jobs ({staleJobs.length})
        </h2>
        {staleJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground ml-7">No stale jobs.</p>
        ) : (
          <div className="grid gap-2">
            {staleJobs.map((job) => {
              const days = daysSince(job.updatedAt);
              return (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <Card
                    className={cn(
                      "shadow-none border-l-4 hover:bg-accent/30 transition-colors",
                      job.severity === "critical"
                        ? "border-l-red-500"
                        : "border-l-yellow-500"
                    )}
                  >
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{job.roleTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.projectName} &middot; {job._count.submissions} candidates
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-md",
                            job.severity === "critical"
                              ? "bg-red-50 text-red-700"
                              : "bg-yellow-50 text-yellow-700"
                          )}
                        >
                          {days}d since update
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Stale Submissions */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          Stale Submissions ({staleSubs.length})
        </h2>
        {staleSubs.length === 0 ? (
          <p className="text-sm text-muted-foreground ml-7">No stale submissions.</p>
        ) : (
          <div className="grid gap-2">
            {staleSubs.map((sub) => {
              const days = daysSince(sub.dateLastStatusChange);
              return (
                <Link key={sub.id} href={`/jobs/${sub.job.id}`}>
                  <Card
                    className={cn(
                      "shadow-none border-l-4 hover:bg-accent/30 transition-colors",
                      sub.severity === "critical"
                        ? "border-l-red-500"
                        : "border-l-yellow-500"
                    )}
                  >
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{sub.candidate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.job.roleTitle} &middot; {sub.job.projectName} &middot;{" "}
                          {sub.status.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-md",
                            sub.severity === "critical"
                              ? "bg-red-50 text-red-700"
                              : "bg-yellow-50 text-yellow-700"
                          )}
                        >
                          {days}d waiting
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Empty Jobs */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Inbox className="h-5 w-5 text-blue-600" />
          Empty Jobs - No Candidates ({emptyJobs.length})
        </h2>
        {emptyJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground ml-7">All jobs have candidates.</p>
        ) : (
          <div className="grid gap-2">
            {emptyJobs.map((job) => {
              const days = daysSince(job.dateOpened);
              return (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <Card className="shadow-none border-l-4 border-l-blue-500 hover:bg-accent/30 transition-colors">
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="text-sm font-medium">{job.roleTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.projectName} &middot; {job.openHeadcount} HC needed
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Opened {formatDate(job.dateOpened)} ({days}d ago)
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
