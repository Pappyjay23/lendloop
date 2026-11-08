"use client";

import { useQuery } from "convex/react";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { RequestRow, type RequestRowData } from "@/components/request-row";
import { EmptyState } from "@/components/ui/empty";
import { RowSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { DisplayStatus } from "@/lib/tool-meta";

type Filter = "all" | DisplayStatus;

export default function IncomingPage() {
  const requests = useQuery(api.requests.listIncoming);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = {
    pending: (requests ?? []).filter((request) => request.status === "pending").length,
    approved: (requests ?? []).filter((request) => request.status === "approved").length,
    overdue: (requests ?? []).filter((request) => request.status === "overdue").length,
  };

  const visible = (requests ?? []).filter(
    (request) => filter === "all" || request.status === filter,
  );

  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: "all", label: "All", count: requests?.length },
    { value: "pending", label: "Needs a decision", count: counts.pending },
    { value: "approved", label: "On loan", count: counts.approved },
    { value: "overdue", label: "Overdue", count: counts.overdue },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Your loop"
        title="Incoming requests"
        description="People asking to borrow your tools. Approving books the dates; declining closes it politely."
      />

      {counts.pending > 0 ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold-soft/70 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-surface text-gold">
            <Inbox className="h-4 w-4" />
          </span>
          <p className="text-[13px] text-ink">
            <span className="font-semibold">{counts.pending}</span> request
            {counts.pending === 1 ? "" : "s"} waiting on you.
          </p>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
              filter === item.value
                ? "border-ink bg-ink text-surface"
                : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
            )}
          >
            {item.label}
            {item.count ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  filter === item.value ? "bg-paper/20 text-paper" : "bg-paper-deep text-ink-faint",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {requests === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <RowSkeleton key={index} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === "all" ? "No incoming requests" : "Nothing in this view"}
          description={
            filter === "all"
              ? "Once someone asks to borrow one of your tools, the request will appear here with approve and decline controls."
              : "Switch tabs to see other requests, or check back later."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((request) => (
            <RequestRow key={request._id} request={request as RequestRowData} mode="incoming" />
          ))}
        </div>
      )}
    </>
  );
}
