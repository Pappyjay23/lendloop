"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { RequestRow, type RequestRowData } from "@/components/request-row";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { RowSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { DisplayStatus } from "@/lib/tool-meta";

const FILTERS: { value: "all" | DisplayStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "overdue", label: "Overdue" },
  { value: "returned", label: "Returned" },
];

export default function MyRequestsPage() {
  const requests = useQuery(api.requests.listMine);
  const [filter, setFilter] = useState<"all" | DisplayStatus>("all");

  const visible = (requests ?? []).filter(
    (request) => filter === "all" || request.status === filter,
  );

  return (
    <>
      <PageHeader
        eyebrow="Your loop"
        title="My requests"
        description="Everything you've asked to borrow, with the lender's decision and the automation trail attached."
        action={
          <Link href="/browse" className={buttonClasses("primary", "md")}>
            <Compass className="h-4 w-4" />
            Browse tools
          </Link>
        }
      />

      <FilterBar filter={filter} onChange={setFilter} />

      {requests === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <RowSkeleton key={index} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ArrowUpRight}
          title={filter === "all" ? "No requests yet" : "Nothing in this view"}
          description={
            filter === "all"
              ? "Find something on the board and pick your dates. The lender gets a notification straight away."
              : "Try another tab, or head back to the board to start a new request."
          }
          action={
            <Link href="/browse" className={buttonClasses("primary", "md")}>
              Browse the board
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((request) => (
            <RequestRow key={request._id} request={request as RequestRowData} mode="mine" />
          ))}
        </div>
      )}
    </>
  );
}

function FilterBar({
  filter,
  onChange,
}: {
  filter: "all" | DisplayStatus;
  onChange: (value: "all" | DisplayStatus) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {FILTERS.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          aria-pressed={filter === item.value}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
            filter === item.value
              ? "border-ink bg-ink text-surface"
              : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
