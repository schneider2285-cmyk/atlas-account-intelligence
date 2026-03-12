/**
 * Shared Pusher channel and event constants.
 * Safe to import from both server and client code.
 * Keep in sync with src/server/pusher.ts.
 */
export const CHANNELS = {
  JOBS: "jobs",
  CANDIDATES: "candidates",
  SUBMISSIONS: "submissions",
  ACTIVITY: "activity",
  DASHBOARD: "dashboard",
} as const;

export const EVENTS = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
  REFRESH: "refresh",
} as const;
