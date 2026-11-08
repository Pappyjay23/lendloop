"use client";

import { CalendarDays, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusPill, TrustedPill } from "@/components/ui/pill";
import { CATEGORY_META, CONDITION_LABELS, type Category, type Condition } from "@/lib/tool-meta";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/cn";

export type ToolCardData = {
  _id: import("@/convex/_generated/dataModel").Id<"tools">;
  name: string;
  category: Category;
  condition: Condition;
  description: string;
  ownerName: string;
  ownerTrusted: boolean;
  isOwner: boolean;
  availability: "available" | "on-loan";
  currentLoanEnd: number | null;
  nextBookingStart: number | null;
};

export function ToolCard({
  tool,
  onRequest,
}: {
  tool: ToolCardData;
  onRequest?: (tool: ToolCardData) => void;
}) {
  const meta = CATEGORY_META[tool.category];
  const Icon = meta.icon;

  return (
    <article
      className={cn(
        "group card-surface flex flex-col p-5 transition-all duration-200",
        !tool.isOwner && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-paper-deep text-ink-soft transition-colors group-hover:border-accent/25 group-hover:text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <StatusPill status={tool.availability} />
      </div>

      <h3 className="mt-4 text-[15px] font-medium leading-snug text-ink">{tool.name}</h3>
      <p className="mt-1 text-[12px] text-ink-faint">
        {meta.label} · {CONDITION_LABELS[tool.condition]}
      </p>
      <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-ink-soft">
        {tool.description}
      </p>

      <div className="mt-auto pt-4">
        {tool.currentLoanEnd !== null ? (
          <p className="mb-3 flex items-center gap-1.5 text-[11px] text-gold">
            <CalendarDays className="h-3.5 w-3.5" />
            Back on {formatDay(tool.currentLoanEnd)}
          </p>
        ) : tool.nextBookingStart !== null ? (
          <p className="mb-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
            <CalendarDays className="h-3.5 w-3.5" />
            Next booking {formatDay(tool.nextBookingStart)}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={tool.ownerName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-ink">{tool.ownerName}</p>
              {tool.ownerTrusted ? (
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-moss">
                  Trusted lender
                </p>
              ) : (
                <p className="flex items-center gap-1 text-[10px] text-ink-faint">
                  <UserRound className="h-3 w-3" /> Neighbour
                </p>
              )}
            </div>
          </div>

          {tool.isOwner ? (
            <span className="rounded-full border border-line bg-paper-deep px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Your listing
            </span>
          ) : (
            <Button size="sm" variant="primary" onClick={() => onRequest?.(tool)}>
              Request dates
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ToolCardSkeleton() {
  return (
    <div className="card-surface p-5">
      <div className="flex justify-between">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-line/60" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-line/60" />
      </div>
      <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-line/60" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-line/60" />
      <div className="mt-5 h-3 w-full animate-pulse rounded bg-line/60" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-line/60" />
      <div className="mt-6 flex items-center justify-between border-t border-line pt-3">
        <div className="h-7 w-28 animate-pulse rounded-full bg-line/60" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-line/60" />
      </div>
    </div>
  );
}

export function TrustedBadge({ className }: { className?: string }) {
  return <TrustedPill className={className} />;
}
