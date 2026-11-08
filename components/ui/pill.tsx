import { cn } from "@/lib/cn";
import { STATUS_META, type DisplayStatus } from "@/lib/tool-meta";

export function StatusPill({
  status,
  className,
}: {
  status: DisplayStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none tracking-wide",
        meta.pill,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium leading-none text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TrustedPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-moss-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-moss",
        className,
      )}
    >
      Trusted lender
    </span>
  );
}
