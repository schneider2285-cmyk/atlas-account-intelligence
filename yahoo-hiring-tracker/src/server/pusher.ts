import Pusher from "pusher";

const globalForPusher = globalThis as unknown as {
  pusher: Pusher | undefined;
};

export const pusher =
  globalForPusher.pusher ??
  new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });

if (process.env.NODE_ENV !== "production") globalForPusher.pusher = pusher;

// Event helper — fire after any mutation
export async function emitChange(
  channel: string,
  event: string,
  data: Record<string, unknown> = {}
) {
  try {
    await pusher.trigger(channel, event, data);
  } catch (err) {
    console.error("[Pusher] Failed to emit:", err);
  }
}

// Standard channels
export const CHANNELS = {
  JOBS: "jobs",
  CANDIDATES: "candidates",
  SUBMISSIONS: "submissions",
  ACTIVITY: "activity",
  DASHBOARD: "dashboard",
} as const;

// Standard events
export const EVENTS = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
  REFRESH: "refresh",
} as const;
