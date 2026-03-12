import { cn } from "@/lib/utils";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

interface InitialsAvatarProps {
  name: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function InitialsAvatar({ name, href, size = "md", className }: InitialsAvatarProps) {
  const hue = hashCode(name) % 360;
  const bg = `hsl(${hue}, 50%, 44%)`;
  const initials = getInitials(name);

  const circle = (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        sizeMap[size],
        className
      )}
      style={{ backgroundColor: bg }}
      title={name}
    >
      {initials}
    </span>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {circle}
      </a>
    );
  }

  return circle;
}
