import {
  getStatusBadgeClassName,
  type StatusTone,
} from "@/lib/status-colors";

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={getStatusBadgeClassName(tone, className)}>
      {children}
    </span>
  );
}
