"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/pill";
import { errorMessage } from "@/lib/errors";
import { formatRange, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DisplayStatus } from "@/lib/tool-meta";

export type RequestRowData = {
  _id: Id<"requests">;
  toolName: string;
  categoryLabel: string;
  ownerName: string;
  ownerTrusted: boolean;
  borrowerName: string;
  borrowerTrusted: boolean;
  startDate: number;
  endDate: number;
  status: DisplayStatus;
  note: string | null;
  createdAt: number;
  reminderCount: number;
  lastReminderAt: number | null;
  viewerRole: "owner" | "borrower" | "admin";
  canApprove: boolean;
  canDecline: boolean;
  canCancel: boolean;
  canReturn: boolean;
};

export function RequestRow({
  request,
  mode,
}: {
  request: RequestRowData;
  mode: "incoming" | "mine" | "admin";
}) {
  const decide = useMutation(api.requests.decide);
  const cancel = useMutation(api.requests.cancel);
  const markReturned = useMutation(api.requests.markReturned);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const counterpart =
    mode === "incoming" ? request.borrowerName : request.ownerName;
  const counterpartTrusted =
    mode === "incoming" ? request.borrowerTrusted : request.ownerTrusted;

  async function run(action: string, task: () => Promise<unknown>, success: string) {
    setBusy(action);
    try {
      await task();
      toast.success(success);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={cn(
        "card-surface overflow-hidden",
        request.status === "overdue" && "border-l-2 border-l-danger",
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={counterpart} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-medium text-ink">{request.toolName}</h3>
              <StatusPill status={request.status} />
              {request.reminderCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                  <RotateCcw className="h-3 w-3" />
                  {request.reminderCount} reminder{request.reminderCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-[12px] text-ink-soft">
              {mode === "incoming" ? (
                <>
                  Requested by <span className="font-medium text-ink">{request.borrowerName}</span>
                  {counterpartTrusted ? " · trusted lender" : ""}
                </>
              ) : mode === "mine" ? (
                <>
                  Listed by <span className="font-medium text-ink">{request.ownerName}</span>
                  {counterpartTrusted ? " · trusted lender" : ""}
                </>
              ) : (
                <>
                  {request.borrowerName} borrowing from {request.ownerName}
                </>
              )}
              <span className="mx-1.5 text-line-strong">·</span>
              {formatRange(request.startDate, request.endDate)}
              <span className="mx-1.5 text-line-strong">·</span>
              requested {relativeTime(request.createdAt)}
            </p>

            <p className="mt-1 text-[11px] text-ink-faint">{request.categoryLabel}</p>

            {request.note ? (
              <p className="mt-3 rounded-lg border border-line bg-paper/50 px-3 py-2 text-[12px] italic leading-relaxed text-ink-soft">
                “{request.note}”
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft transition hover:text-ink"
          >
            {expanded ? "Hide activity" : "View activity"}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            />
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {request.canApprove ? (
              <Button
                size="sm"
                variant="primary"
                disabled={busy !== null}
                onClick={() =>
                  run("approve", () => decide({ requestId: request._id, decision: "approve" }), "Request approved")
                }
              >
                {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Approve
              </Button>
            ) : null}

            {request.canDecline ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run("decline", () => decide({ requestId: request._id, decision: "decline" }), "Request declined")
                }
              >
                {busy === "decline" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Decline
              </Button>
            ) : null}

            {request.canCancel ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => run("cancel", () => cancel({ requestId: request._id }), "Request cancelled")}
              >
                {busy === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Cancel
              </Button>
            ) : null}

            {request.canReturn ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run("return", () => markReturned({ requestId: request._id }), "Loan marked returned")
                }
              >
                {busy === "return" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Mark returned
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-line bg-paper/30 p-5">
          <p className="eyebrow mb-3">Loan activity</p>
          <ActivityTimeline requestId={request._id} />
          {request.lastReminderAt ? (
            <p className="mt-4 text-[11px] text-ink-faint">
              Last reminder {relativeTime(request.lastReminderAt)}.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
