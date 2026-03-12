import { cn } from "@/lib/utils";

interface AgingBadgeProps {
  days: number | null;
  className?: string;
}

export function AgingBadge({ days, className }: AgingBadgeProps) {
  if (days === null) {
    return <span className={cn("text-muted-foreground text-xs", className)}>—</span>;
  }

  let dotColor: string;
  let label: string;
  if (days <= 7) {
    dotColor = "#0D9E6E";
    label = "Fresh";
  } else if (days <= 14) {
    dotColor = "#D97B00";
    label = "Aging";
  } else {
    dotColor = "#DC2626";
    label = "Stale";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className
      )}
      title={`${days} days — ${label}`}
    >
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      {days}d
    </span>
  );
}
