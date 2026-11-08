"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";
import { formatRange, fromCalendarDate, toCalendarDate, todayUtc } from "@/lib/format";
import { cn } from "@/lib/cn";

export function RequestModal({
  open,
  onClose,
  tool,
}: {
  open: boolean;
  onClose: () => void;
  tool: {
    _id: Id<"tools">;
    name: string;
    categoryLabel: string;
    condition: string;
    ownerName: string;
    ownerTrusted: boolean;
  } | null;
}) {
  const create = useMutation(api.requests.create);
  const [range, setRange] = useState<DateRange | undefined>();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = range?.from ? fromCalendarDate(range.from) : null;
  const end = range?.to ? fromCalendarDate(range.to) : range?.from ? fromCalendarDate(range.from) : null;
  const days = start !== null && end !== null ? Math.round((end - start) / 86_400_000) + 1 : 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!tool) return;
    setError(null);
    if (!range?.from) {
      setError("Pick the dates you'd like to borrow.");
      return;
    }
    setSaving(true);
    try {
      await create({
        toolId: tool._id,
        startDate: fromCalendarDate(range.from),
        endDate: fromCalendarDate(range.to ?? range.from),
        note: note.trim() || undefined,
      });
      toast.success("Request sent — the lender will be notified");
      setRange(undefined);
      setNote("");
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={tool ? `Request ${tool.name}` : "Request a tool"}
      description={
        tool
          ? `${tool.categoryLabel} · ${tool.condition} · Listed by ${tool.ownerName}`
          : undefined
      }
      width="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="request-form" disabled={saving || !tool}>
            {saving ? "Sending…" : "Send request"}
          </Button>
        </>
      }
    >
      <form id="request-form" onSubmit={onSubmit}>
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="rounded-xl border border-line bg-surface-raised p-2">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={1}
              showOutsideDays
              disabled={{ before: toCalendarDate(todayUtc()) }}
              className="lendloop-calendar"
            />
          </div>

          <div className="flex flex-col">
            <div className="rounded-xl border border-line bg-paper/50 p-4">
              <p className="eyebrow">Loan window</p>
              <p className="mt-2 font-display text-lg text-ink">
                {start !== null && end !== null
                  ? formatRange(start, end)
                  : "Choose your dates"}
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">
                {days > 0
                  ? `${days} day${days === 1 ? "" : "s"} · the lender approves before anything is booked.`
                  : "Inclusive of both the pick-up and return day."}
              </p>
            </div>

            <div className="mt-5">
              <Label htmlFor="request-note" hint={`${note.length}/280`}>
                Note to the lender <span className="font-normal text-ink-faint">(optional)</span>
              </Label>
              <Textarea
                id="request-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={280}
                placeholder="What are you working on? When could you collect it?"
                className="min-h-24"
              />
            </div>

            {tool?.ownerTrusted ? (
              <p className="mt-4 rounded-lg bg-moss-soft px-3 py-2 text-[12px] text-moss">
                {tool.ownerName} is a trusted lender on LendLoop.
              </p>
            ) : null}

            <FieldError>{error}</FieldError>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] text-ink-faint", className)}>
      Dates are shown in UTC to keep loan windows unambiguous.
    </p>
  );
}
