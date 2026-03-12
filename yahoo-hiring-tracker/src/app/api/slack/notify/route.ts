import { NextResponse } from "next/server";
import { z } from "zod";
import {
  notifyStatusChange,
  notifyInterviewScheduled,
  sendDailyDigest,
  sendStaleAlert,
  type DigestStats,
  type StaleItem,
} from "@/server/slack";

// ─── Request Schemas ────────────────────────────────────────────────

const statusChangePayload = z.object({
  jobTitle: z.string(),
  candidateName: z.string(),
  oldStatus: z.string(),
  newStatus: z.string(),
  slackChannel: z.string(),
});

const interviewPayload = z.object({
  jobTitle: z.string(),
  candidateName: z.string(),
  dateTime: z.string(),
  slackChannel: z.string(),
});

const digestPayload = z.object({
  channel: z.string(),
  stats: z.object({
    activeJobs: z.number(),
    totalHeadcount: z.number(),
    filledPositions: z.number(),
    pendingSubmissions: z.number(),
    interviewsThisWeek: z.number(),
    staleCount: z.number(),
  }),
});

const stalePayload = z.object({
  channel: z.string(),
  staleItems: z.array(
    z.object({
      candidateName: z.string(),
      jobTitle: z.string(),
      currentStatus: z.string(),
      daysSinceUpdate: z.number(),
    }),
  ),
});

const requestBody = z.object({
  type: z.enum(["status_change", "interview", "digest", "stale"]),
  payload: z.unknown(),
});

// ─── POST Handler ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { type, payload } = requestBody.parse(json);

    let success = false;

    switch (type) {
      case "status_change": {
        const p = statusChangePayload.parse(payload);
        success = await notifyStatusChange(
          p.jobTitle,
          p.candidateName,
          p.oldStatus,
          p.newStatus,
          p.slackChannel,
        );
        break;
      }

      case "interview": {
        const p = interviewPayload.parse(payload);
        success = await notifyInterviewScheduled(
          p.jobTitle,
          p.candidateName,
          p.dateTime,
          p.slackChannel,
        );
        break;
      }

      case "digest": {
        const p = digestPayload.parse(payload);
        success = await sendDailyDigest(p.channel, p.stats as DigestStats);
        break;
      }

      case "stale": {
        const p = stalePayload.parse(payload);
        success = await sendStaleAlert(
          p.channel,
          p.staleItems as StaleItem[],
        );
        break;
      }
    }

    return NextResponse.json({ success }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Slack Notify API]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}
