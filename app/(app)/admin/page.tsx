"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";
import { formatRange, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tab = "loans" | "listings" | "automation" | "people" | "audit";

const TABS: { value: Tab; label: string }[] = [
  { value: "loans", label: "Loans" },
  { value: "listings", label: "Listings" },
  { value: "automation", label: "Automation" },
  { value: "people", label: "People" },
  { value: "audit", label: "Audit log" },
];

export default function AdminPage() {
  const me = useQuery(api.users.me);
  const overview = useQuery(api.admin.overview);
  const loans = useQuery(api.admin.listLoans);
  const listings = useQuery(api.tools.browse, {});
  const people = useQuery(api.users.directory);
  const events = useQuery(api.events.recent);
  const audit = useQuery(api.admin.auditTrail);

  const removeListing = useMutation(api.admin.removeListing);
  const setTrusted = useMutation(api.admin.setTrustedLender);
  const retryEvent = useMutation(api.admin.retryEvent);

  const [tab, setTab] = useState<Tab>("loans");
  const [removeTarget, setRemoveTarget] = useState<{ _id: Id<"tools">; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  if (me === undefined) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (me?.role !== "admin") {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Admins only"
        description="The control room is limited to accounts on the admin allowlist. If you need access, ask the operator to add your email."
      />
    );
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await removeListing({ toolId: removeTarget._id });
      toast.success("Listing removed");
      setRemoveTarget(null);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function retry(eventId: Id<"automationEvents">) {
    setRetrying(eventId);
    try {
      await retryEvent({ eventId });
      toast.success("Delivery re-queued");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setRetrying(null);
    }
  }

  async function toggleTrust(userId: Id<"users">, trusted: boolean) {
    try {
      await setTrusted({ userId, trusted });
      toast.success(trusted ? "Marked as trusted lender" : "Trusted status removed");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Control room"
        description="Moderate listings, verify lenders, and watch the automation layer. Every action here is audited."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-paper">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wrench}
          label="Live listings"
          value={overview?.counts.tools}
          hint={`${overview?.counts.archivedTools ?? 0} archived`}
        />
        <StatCard
          icon={CalendarClock}
          label="Active loans"
          value={overview?.counts.activeLoans}
          hint={`${overview?.counts.pendingRequests ?? 0} pending requests`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={overview?.counts.overdueLoans}
          hint={`${overview?.counts.remindersSent ?? 0} reminders sent`}
          tone={overview?.counts.overdueLoans ? "danger" : "default"}
        />
        <StatCard
          icon={Activity}
          label="Failed automations"
          value={overview?.counts.failedAutomations}
          hint="Retries exhausted or workflow errors"
          tone={overview?.counts.failedAutomations ? "danger" : "default"}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-1.5 border-b border-line pb-3">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            aria-pressed={tab === item.value}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
              tab === item.value
                ? "border-ink bg-ink text-surface"
                : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "loans" ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[12px]">
                <thead className="border-b border-line bg-paper/60 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tool</th>
                    <th className="px-4 py-3 font-medium">Borrower</th>
                    <th className="px-4 py-3 font-medium">Lender</th>
                    <th className="px-4 py-3 font-medium">Window</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Reminders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(loans ?? []).map((loan) => (
                    <tr key={loan._id} className="hover:bg-paper/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{loan.toolName}</p>
                        <p className="text-[11px] text-ink-faint">{loan.categoryLabel}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{loan.borrowerName}</td>
                      <td className="px-4 py-3 text-ink-soft">{loan.ownerName}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {formatRange(loan.startDate, loan.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={loan.status} />
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{loan.reminderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loans && loans.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-ink-faint">
                No loans yet. Seed the demo or ask a neighbour to request something.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "listings" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(listings ?? []).map((listing) => (
              <div key={listing._id} className="card-surface flex items-start gap-4 p-4">
                <Avatar name={listing.ownerName} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">{listing.name}</p>
                  <p className="text-[11px] text-ink-faint">
                    {listing.categoryLabel} · {listing.ownerName}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-ink-soft">
                    {listing.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoveTarget({ _id: listing._id, name: listing.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "automation" ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <Activity className="mt-0.5 h-4 w-4 text-accent" />
              <p className="text-[12px] leading-relaxed text-ink-soft">
                Outbound events are signed and retried up to 5 times. Inbound write-backs are
                idempotent by key. Failed events raise an in-app notification for admins.
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12px]">
                  <thead className="border-b border-line bg-paper/60 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    <tr>
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Direction</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Attempts</th>
                      <th className="px-4 py-3 font-medium">Last error</th>
                      <th className="px-4 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(events ?? []).map((event) => (
                      <tr key={event._id} className="hover:bg-paper/40">
                        <td className="px-4 py-3 font-mono text-[11px] text-ink">
                          {event.kind}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{event.direction}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <EventStatus status={event.status} />
                            {event.direction === "outbound" && event.status === "failed" ? (
                              <button
                                type="button"
                                onClick={() => retry(event._id)}
                                disabled={retrying === event._id}
                                className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-ink-soft transition hover:border-accent hover:text-accent disabled:opacity-50"
                              >
                                {retrying === event._id ? "Retrying…" : "Retry"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{event.attempts}</td>
                        <td className="max-w-[240px] truncate px-4 py-3 text-[11px] text-danger">
                          {event.lastError ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-ink-faint">
                          {relativeTime(event.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {events && events.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-ink-faint">
                  No automation events yet.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "people" ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {(people ?? []).map((person) => (
              <div
                key={person._id}
                className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <Avatar name={person.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{person.name}</p>
                  <p className="text-[11px] text-ink-faint">{person.email}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                    person.role === "admin"
                      ? "bg-ink text-paper"
                      : "bg-paper-deep text-ink-faint",
                  )}
                >
                  {person.role}
                </span>
                {person.role === "admin" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-moss">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Trusted
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={person.trustedLender ? "outline" : "primary"}
                    onClick={() => toggleTrust(person._id, !person.trustedLender)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {person.trustedLender ? "Remove trusted" : "Mark trusted"}
                  </Button>
                )}
              </div>
            ))}
            {people && people.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-ink-faint">No users yet.</p>
            ) : null}
          </div>
        ) : null}

        {tab === "audit" ? (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {(audit ?? []).map((entry) => (
              <div key={entry._id} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-[11px] text-ink">{entry.action}</p>
                  <time className="text-[10px] text-ink-faint">
                    {relativeTime(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-[12px] text-ink-soft">{entry.detail}</p>
                <p className="mt-0.5 text-[10px] text-ink-faint">{entry.actorEmail}</p>
              </div>
            ))}
            {audit && audit.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-ink-faint">
                No admin actions recorded yet.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/browse" className={buttonClasses("outline", "sm")}>
          View the public board
        </Link>
        <Link href="/my-listings" className={buttonClasses("ghost", "sm")}>
          <Archive className="h-3.5 w-3.5" />
          Manage my listings
        </Link>
      </div>

      <Modal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove listing as admin"
        description="The listing is archived immediately and the action is written to the audit log."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRemove} disabled={busy}>
              {busy ? "Removing…" : "Archive listing"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">{removeTarget?.name}</span> will be removed from
          the board. Active loans keep their history.
        </p>
      </Modal>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  hint: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">{label}</p>
        <Icon className={cn("h-4 w-4", tone === "danger" ? "text-danger" : "text-ink-faint")} />
      </div>
      <p
        className={cn(
          "mt-2 font-display text-3xl",
          tone === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {value ?? "—"}
      </p>
      <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>
    </div>
  );
}

function EventStatus({ status }: { status: string }) {
  const tones: Record<string, string> = {
    sent: "bg-moss-soft text-moss",
    received: "bg-moss-soft text-moss",
    queued: "bg-gold-soft text-gold",
    sending: "bg-gold-soft text-gold",
    failed: "bg-danger-soft text-danger",
    duplicate: "bg-paper-deep text-ink-faint",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        tones[status] ?? "bg-paper-deep text-ink-faint",
      )}
    >
      {status}
    </span>
  );
}
