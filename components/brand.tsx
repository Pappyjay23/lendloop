import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="LendLoop"
      className={cn("h-7 w-7", className)}
      fill="none"
    >
      <circle cx="12.5" cy="16" r="8.25" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="19.5" cy="16" r="8.25" stroke="var(--accent)" strokeWidth="2.1" />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  className,
  markClassName,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5 text-ink", className)}
      aria-label="LendLoop home"
    >
      <LogoMark className={cn("transition-transform duration-300 group-hover:rotate-12", markClassName)} />
      <span className="font-display text-[19px] font-semibold tracking-tight">
        Lend<span className="text-accent">Loop</span>
      </span>
    </Link>
  );
}
