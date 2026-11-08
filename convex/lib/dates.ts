export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS) * DAY_MS;
}

export function dayKey(timestamp: number): string {
  return new Date(startOfUtcDay(timestamp)).toISOString().slice(0, 10);
}

export function isWholeDay(timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp % DAY_MS === 0;
}

export type RangeValidation =
  | { ok: true; startDate: number; endDate: number }
  | { ok: false; reason: string };

export function validateLoanRange(
  startDate: number,
  endDate: number,
  now: number,
  maxDays = 60,
): RangeValidation {
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) {
    return { ok: false, reason: "Dates must be valid timestamps." };
  }
  if (!isWholeDay(startDate) || !isWholeDay(endDate)) {
    return { ok: false, reason: "Dates must fall on UTC day boundaries." };
  }
  const today = startOfUtcDay(now);
  if (startDate < today) {
    return { ok: false, reason: "The start date cannot be in the past." };
  }
  if (endDate < startDate) {
    return { ok: false, reason: "The return date must be on or after the start date." };
  }
  const span = Math.round((endDate - startDate) / DAY_MS) + 1;
  if (span > maxDays) {
    return { ok: false, reason: `Loans are limited to ${maxDays} days.` };
  }
  return { ok: true, startDate, endDate };
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function isOverdue(endDate: number, now: number): boolean {
  return endDate < startOfUtcDay(now);
}

export function daysOverdue(endDate: number, now: number): number {
  if (!isOverdue(endDate, now)) return 0;
  return Math.max(0, Math.round((startOfUtcDay(now) - endDate) / DAY_MS));
}

export function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}
