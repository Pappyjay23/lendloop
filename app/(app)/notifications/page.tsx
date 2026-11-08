"use client";

import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonClasses } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function NotificationsPage() {
  const notifications = useQuery(api.users.notifications);
  const markRead = useMutation(api.users.markNotificationsRead);
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current || !notifications) return;
    if (notifications.some((item) => !item.readAt)) {
      marked.current = true;
      void markRead({});
    }
  }, [notifications, markRead]);

  return (
    <>
      <PageHeader
        eyebrow="Your loop"
        title="Notifications"
        description="Requests, decisions, and automation events addressed to you — the in-app record alongside email."
      />

      {notifications === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="All quiet"
          description="When a neighbour requests one of your tools or a lender responds to you, it lands here."
          action={
            <Link href="/browse" className={buttonClasses("primary", "md")}>
              Browse the board
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {notifications.map((item) => (
            <article
              key={item._id}
              className={cn(
                "flex items-start gap-3 px-4 py-4",
                !item.readAt && "bg-accent-soft/30",
              )}
            >
              <span
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  !item.readAt ? "bg-accent" : "bg-line-strong",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-ink">{item.title}</p>
                  <time className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                    {relativeTime(item.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {notifications && notifications.length > 0 ? (
        <p className="mt-5 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <CheckCheck className="h-3.5 w-3.5" />
          Opening this page marks everything as read.
        </p>
      ) : null}
    </>
  );
}
