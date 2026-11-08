"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const TONES: Record<string, string> = {
  "request.created": "bg-gold",
  "request.approved": "bg-moss",
  "request.declined": "bg-ink-faint",
  "request.cancelled": "bg-ink-faint",
  "request.returned": "bg-moss",
  "reminder.sent": "bg-accent",
  "reminder.failed": "bg-danger",
  "automation.sent": "bg-ink-faint",
  "automation.failed": "bg-danger",
  "notification.delivered": "bg-moss",
  "notification.failed": "bg-danger",
};

export function ActivityTimeline({ requestId }: { requestId: Id<"requests"> }) {
  const activity = useQuery(api.requests.activityFor, { requestId });

  if (activity === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    );
  }

  if (activity.length === 0) {
    return <p className="text-[12px] text-ink-faint">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-line pl-4">
      {activity.map((entry) => (
        <li key={entry._id} className="relative">
          <span
            className={cn(
              "absolute -left-[21px] top-1 h-2 w-2 rounded-full ring-4 ring-paper/40",
              TONES[entry.kind] ?? "bg-ink-faint",
            )}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[13px] text-ink">{entry.message}</p>
            <time className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
              {relativeTime(entry.createdAt)}
            </time>
          </div>
          {entry.actorName ? (
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {entry.actorKind === "system" ? "Automation" : entry.actorName}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
