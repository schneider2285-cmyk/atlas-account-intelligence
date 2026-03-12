import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  accentColor?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  accentColor = "#204ECF",
  trend,
  className,
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border shadow-sm p-4 flex flex-col gap-1",
        className
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="font-mono text-2xl font-semibold" style={{ color: accentColor }}>
        {value}
      </div>
      {trend && (
        <span
          className={cn(
            "text-xs font-medium",
            trend.value >= 0 ? "text-green-600" : "text-red-600"
          )}
        >
          {trend.value >= 0 ? "+" : ""}
          {trend.value} {trend.label}
        </span>
      )}
    </div>
  );
}
