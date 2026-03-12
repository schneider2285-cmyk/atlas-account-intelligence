import { cn } from "@/lib/utils";

type SubmissionStatus =
  | "INTRODUCED"
  | "INTERVIEWING"
  | "INTERVIEW_SCHEDULED"
  | "PENDING_DECISION"
  | "PENDING_2ND_INTERVIEW"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN"
  | "REMOVED_FOR_LOCATION"
  | "FINDING_TALENT"
  | "CONSIDER_FOR_OTHER_ROLE"
  | "TALENT_NO_LONGER_AVAILABLE"
  | "TALENT_WITHDRAWN";

const statusConfig: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  INTRODUCED: {
    label: "Introduced",
    dotColor: "#204ECF",
    bgColor: "#EBF0FF",
    textColor: "#204ECF",
  },
  INTERVIEWING: {
    label: "Interviewing",
    dotColor: "#6941C6",
    bgColor: "#F0EBFF",
    textColor: "#6941C6",
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview Scheduled",
    dotColor: "#6941C6",
    bgColor: "#F0EBFF",
    textColor: "#6941C6",
  },
  PENDING_DECISION: {
    label: "Pending Decision",
    dotColor: "#D97B00",
    bgColor: "#FFF3E0",
    textColor: "#D97B00",
  },
  PENDING_2ND_INTERVIEW: {
    label: "Pending 2nd Interview",
    dotColor: "#D6336C",
    bgColor: "#FDE8EF",
    textColor: "#D6336C",
  },
  HIRED: {
    label: "Hired",
    dotColor: "#0D9E6E",
    bgColor: "#E6F7F1",
    textColor: "#0D9E6E",
  },
  REJECTED: {
    label: "Rejected",
    dotColor: "#6B7280",
    bgColor: "#F3F4F6",
    textColor: "#6B7280",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    dotColor: "#6B7280",
    bgColor: "#F3F4F6",
    textColor: "#6B7280",
  },
  REMOVED_FOR_LOCATION: {
    label: "Removed (Location)",
    dotColor: "#6B7280",
    bgColor: "#F3F4F6",
    textColor: "#6B7280",
  },
  FINDING_TALENT: {
    label: "Finding Talent",
    dotColor: "#204ECF",
    bgColor: "#EBF0FF",
    textColor: "#204ECF",
  },
  CONSIDER_FOR_OTHER_ROLE: {
    label: "Consider for Other",
    dotColor: "#D97B00",
    bgColor: "#FFF3E0",
    textColor: "#D97B00",
  },
  TALENT_NO_LONGER_AVAILABLE: {
    label: "No Longer Available",
    dotColor: "#6B7280",
    bgColor: "#F3F4F6",
    textColor: "#6B7280",
  },
  TALENT_WITHDRAWN: {
    label: "Talent Withdrawn",
    dotColor: "#6B7280",
    bgColor: "#F3F4F6",
    textColor: "#6B7280",
  },
};

interface StatusBadgeProps {
  status: SubmissionStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    dotColor: "#6B7280",
    bgColor: "#F3F4F6",
    textColor: "#6B7280",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: config.dotColor }}
      />
      {config.label}
    </span>
  );
}
