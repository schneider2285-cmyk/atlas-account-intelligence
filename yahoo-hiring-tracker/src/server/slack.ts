import { WebClient, type ChatPostMessageArguments } from "@slack/web-api";

// ─── Singleton ──────────────────────────────────────────────────────

const globalForSlack = globalThis as unknown as {
  slackClient: WebClient | undefined;
};

/**
 * Returns a Slack WebClient if SLACK_BOT_TOKEN is configured, otherwise null.
 * In dev mode without a token this silently returns null so every call
 * through the public API becomes a no-op.
 */
function getClient(): WebClient | null {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  if (!globalForSlack.slackClient) {
    globalForSlack.slackClient = new WebClient(token);
  }
  return globalForSlack.slackClient;
}

if (process.env.NODE_ENV !== "production") {
  // keep the singleton across HMR reloads
}

// ─── Block Kit Helpers ──────────────────────────────────────────────

type Block =
  | { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
  | { type: "section"; text: { type: "mrkdwn"; text: string }; accessory?: unknown }
  | { type: "divider" }
  | { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> };

function headerBlock(text: string): Block {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}

function sectionBlock(markdown: string): Block {
  return { type: "section", text: { type: "mrkdwn", text: markdown } };
}

function contextBlock(...lines: string[]): Block {
  return {
    type: "context",
    elements: lines.map((text) => ({ type: "mrkdwn", text })),
  };
}

function divider(): Block {
  return { type: "divider" };
}

// ─── Internal send helper ───────────────────────────────────────────

async function postMessage(
  channel: string,
  text: string,
  blocks: Block[],
): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.log("[Slack] No SLACK_BOT_TOKEN set — skipping message to", channel);
    return false;
  }

  try {
    await client.chat.postMessage({
      channel,
      text, // fallback for notifications
      blocks,
    } as ChatPostMessageArguments);
    return true;
  } catch (err) {
    console.error("[Slack] Failed to post message:", err);
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Notify a channel that a candidate's submission status changed.
 */
export async function notifyStatusChange(
  jobTitle: string,
  candidateName: string,
  oldStatus: string,
  newStatus: string,
  slackChannel: string,
): Promise<boolean> {
  const emoji = statusEmoji(newStatus);
  const fallback = `${candidateName} on "${jobTitle}": ${oldStatus} -> ${newStatus}`;

  const blocks: Block[] = [
    headerBlock(`${emoji} Status Update`),
    sectionBlock(
      `*${candidateName}* on *${jobTitle}*\n` +
        `\`${oldStatus}\` :arrow_right: \`${newStatus}\``,
    ),
    contextBlock(`Updated ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`),
  ];

  return postMessage(slackChannel, fallback, blocks);
}

/**
 * Notify a channel that an interview has been scheduled.
 */
export async function notifyInterviewScheduled(
  jobTitle: string,
  candidateName: string,
  dateTime: string,
  slackChannel: string,
): Promise<boolean> {
  const formatted = new Date(dateTime).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const fallback = `Interview scheduled: ${candidateName} for "${jobTitle}" on ${formatted}`;

  const blocks: Block[] = [
    headerBlock(":calendar: Interview Scheduled"),
    sectionBlock(
      `*${candidateName}* for *${jobTitle}*\n:calendar: ${formatted}`,
    ),
    contextBlock("Please confirm availability in the thread"),
  ];

  return postMessage(slackChannel, fallback, blocks);
}

/**
 * Send a daily digest / pipeline health summary.
 */
export interface DigestStats {
  activeJobs: number;
  totalHeadcount: number;
  filledPositions: number;
  pendingSubmissions: number;
  interviewsThisWeek: number;
  staleCount: number;
}

export async function sendDailyDigest(
  channel: string,
  stats: DigestStats,
): Promise<boolean> {
  const remaining = stats.totalHeadcount - stats.filledPositions;
  const fallback = `Daily Digest: ${stats.activeJobs} active jobs, ${remaining} positions remaining, ${stats.pendingSubmissions} pending`;

  const blocks: Block[] = [
    headerBlock(":bar_chart: Pipeline Daily Digest"),
    sectionBlock(
      `*Active Jobs:* ${stats.activeJobs}\n` +
        `*Open Headcount:* ${stats.totalHeadcount} (${stats.filledPositions} filled, ${remaining} remaining)\n` +
        `*Pending Submissions:* ${stats.pendingSubmissions}\n` +
        `*Interviews This Week:* ${stats.interviewsThisWeek}`,
    ),
    divider(),
    ...(stats.staleCount > 0
      ? [
          sectionBlock(
            `:warning: *${stats.staleCount} stale item(s)* need attention — no updates in 7+ days`,
          ),
        ]
      : [
          sectionBlock(":white_check_mark: No stale items — pipeline is healthy!"),
        ]),
    contextBlock(
      `Generated ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
    ),
  ];

  return postMessage(channel, fallback, blocks);
}

/**
 * Send an alert about stale pipeline items (7-day and 14-day thresholds).
 */
export interface StaleItem {
  candidateName: string;
  jobTitle: string;
  currentStatus: string;
  daysSinceUpdate: number;
}

export async function sendStaleAlert(
  channel: string,
  staleItems: StaleItem[],
): Promise<boolean> {
  if (staleItems.length === 0) return false;

  const critical = staleItems.filter((i) => i.daysSinceUpdate >= 14);
  const warning = staleItems.filter(
    (i) => i.daysSinceUpdate >= 7 && i.daysSinceUpdate < 14,
  );

  const fallback = `Stale alert: ${staleItems.length} items need attention`;

  const blocks: Block[] = [
    headerBlock(":rotating_light: Stale Pipeline Alert"),
  ];

  if (critical.length > 0) {
    blocks.push(
      sectionBlock(
        `:red_circle: *Critical (14+ days) — ${critical.length} item(s):*`,
      ),
    );
    for (const item of critical.slice(0, 10)) {
      blocks.push(
        contextBlock(
          `*${item.candidateName}* on ${item.jobTitle} — \`${item.currentStatus}\` — *${item.daysSinceUpdate}d* stale`,
        ),
      );
    }
  }

  if (warning.length > 0) {
    blocks.push(divider());
    blocks.push(
      sectionBlock(
        `:large_yellow_circle: *Warning (7-13 days) — ${warning.length} item(s):*`,
      ),
    );
    for (const item of warning.slice(0, 10)) {
      blocks.push(
        contextBlock(
          `*${item.candidateName}* on ${item.jobTitle} — \`${item.currentStatus}\` — *${item.daysSinceUpdate}d* stale`,
        ),
      );
    }
  }

  blocks.push(divider());
  blocks.push(
    contextBlock("Follow up on these items to keep the pipeline moving"),
  );

  return postMessage(channel, fallback, blocks);
}

// ─── Helpers ────────────────────────────────────────────────────────

function statusEmoji(status: string): string {
  switch (status) {
    case "INTRODUCED":
      return ":wave:";
    case "INTERVIEWING":
      return ":speech_balloon:";
    case "HIRED":
      return ":tada:";
    case "REJECTED":
      return ":x:";
    case "WITHDRAWN":
      return ":no_entry_sign:";
    case "REMOVED_FOR_LOCATION":
      return ":earth_americas:";
    case "PENDING_DECISION":
      return ":hourglass_flowing_sand:";
    default:
      return ":arrow_right:";
  }
}

/**
 * Verify a Slack request signature. Used by the webhook route.
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  // Slack sends X-Slack-Signature as v0=<hex HMAC-SHA256>
  // The base string is v0:<timestamp>:<body>
  const crypto = require("crypto") as typeof import("crypto");
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const expectedSignature = `v0=${hmac}`;

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}
