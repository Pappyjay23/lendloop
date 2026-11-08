import { DAY_MS, startOfUtcDay } from "@/convex/lib/dates";

export function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRange(start: number, end: number): string {
  const format = (value: number) =>
    new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${format(start)} – ${format(end)}`;
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months === 1) return "last month";
  return `${months} months ago`;
}

/** Local calendar Date used by the range picker, derived from a UTC day timestamp. */
export function toCalendarDate(timestamp: number): Date {
  const date = new Date(timestamp);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Local calendar Date -> UTC midnight timestamp. */
export function fromCalendarDate(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function todayUtc(): number {
  return startOfUtcDay(Date.now());
}

export function daysFromToday(days: number): number {
  return todayUtc() + days * DAY_MS;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
