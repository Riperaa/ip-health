import {
  getStatusBadgeClassName,
  type StatusBadgeVariant,
  type StatusTone,
} from "@/lib/status-colors";

export function StatusBadge({
  tone,
  children,
  className,
  variant = "default",
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  variant?: StatusBadgeVariant;
}) {
  return (
    <span className={getStatusBadgeClassName(tone, className, variant)}>
      {children}
    </span>
  );
}
