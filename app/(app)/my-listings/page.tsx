"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import { ListingFormModal, type EditableListing } from "@/components/listing-form-modal";
import { Button, buttonClasses } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";
import { CATEGORY_META, CONDITION_LABELS } from "@/lib/tool-meta";
import { formatDay } from "@/lib/format";

export default function MyListingsPage() {
  const listings = useQuery(api.tools.myListings);
  const archived = useQuery(api.tools.listArchivedOwn);
  const remove = useMutation(api.tools.remove);
  const showcase = useMutation(api.seed.myShowcase);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditableListing | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ _id: Id<"tools">; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await remove({ toolId: removeTarget._id });
      toast.success("Listing removed");
      setRemoveTarget(null);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Your loop"
        title="My listings"
        description="The tools you're willing to share. Keep descriptions honest — a good note is what turns a browse into a request."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            List a tool
          </Button>
        }
      />

      {listings === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Your shelf is empty"
          description="List the drill, ladder, or stand mixer that mostly lives in a cupboard. You decide who borrows it and when."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                List your first tool
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await showcase({});
                    toast.success("Demo listings added");
                  } catch (caught) {
                    toast.error(errorMessage(caught));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Add demo listings
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map((listing) => (
            <article key={listing._id} className="card-surface flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-medium text-ink">{listing.name}</h3>
                  <p className="mt-0.5 text-[12px] text-ink-faint">
                    {CATEGORY_META[listing.category].label} ·{" "}
                    {CONDITION_LABELS[listing.condition]}
                  </p>
                </div>
                <StatusPill status={listing.availability} />
              </div>

              <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-ink-soft">
                {listing.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                {listing.pendingCount > 0 ? (
                  <Link
                    href="/incoming"
                    className="rounded-full bg-gold-soft px-2 py-0.5 font-medium text-gold"
                  >
                    {listing.pendingCount} pending request
                    {listing.pendingCount === 1 ? "" : "s"}
                  </Link>
                ) : (
                  <span className="rounded-full bg-paper-deep px-2 py-0.5">No pending requests</span>
                )}
                {listing.currentLoanEnd ? (
                  <span className="rounded-full bg-moss-soft px-2 py-0.5 font-medium text-moss">
                    Back {formatDay(listing.currentLoanEnd)}
                  </span>
                ) : null}
                <span className="rounded-full bg-paper-deep px-2 py-0.5">
                  {listing.totalRequests} total request{listing.totalRequests === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing({
                      _id: listing._id,
                      name: listing.name,
                      category: listing.category,
                      condition: listing.condition,
                      description: listing.description,
                    });
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRemoveTarget({ _id: listing._id, name: listing.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {archived && archived.length > 0 ? (
        <section className="mt-12">
          <p className="eyebrow">Archive</p>
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface/60">
            {archived.map((item) => (
              <div key={item._id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[13px] text-ink-soft">{item.name}</p>
                  <p className="text-[11px] text-ink-faint">{item.categoryLabel}</p>
                </div>
                <span className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">Archived</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {formOpen ? (
        <ListingFormModal
          open
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          listing={editing}
        />
      ) : null}

      <Modal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove this listing?"
        description="It will disappear from the board. Existing loan history stays intact."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmRemove} disabled={busy}>
              {busy ? "Removing…" : "Remove listing"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">{removeTarget?.name}</span> will be archived. You
          can relist it later by creating a new listing.
        </p>
        <Link href="/incoming" className={`${buttonClasses("outline", "sm")} mt-4`}>
          Review pending requests first
        </Link>
      </Modal>
    </>
  );
}
