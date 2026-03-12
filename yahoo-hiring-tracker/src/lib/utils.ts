import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date Helpers ───────────────────────────────────────────────────

export function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export type AgingLevel = "fresh" | "warning" | "critical";

export function getAgingLevel(days: number | null): AgingLevel {
  if (days === null) return "fresh";
  if (days < 7) return "fresh";
  if (days < 14) return "warning";
  return "critical";
}

export function agingColor(level: AgingLevel): string {
  switch (level) {
    case "fresh":
      return "text-green-600 bg-green-50";
    case "warning":
      return "text-yellow-600 bg-yellow-50";
    case "critical":
      return "text-red-600 bg-red-50";
  }
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
