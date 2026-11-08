import type { Doc } from "../_generated/dataModel";
import { isOverdue, startOfUtcDay } from "./dates";

export type EffectiveStatus =
  | "pending"
  | "approved"
  | "overdue"
  | "declined"
  | "cancelled"
  | "returned";

export function effectiveStatus(request: Doc<"requests">, now: number): EffectiveStatus {
  if (request.status === "approved" && isOverdue(request.endDate, now)) {
    return "overdue";
  }
  return request.status;
}

export function coversDay(request: Doc<"requests">, day: number): boolean {
  return request.startDate <= day && request.endDate >= day;
}

export function coversToday(request: Doc<"requests">, now: number): boolean {
  return request.status === "approved" && coversDay(request, startOfUtcDay(now));
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function dateRangeLabel(startDate: number, endDate: number): string {
  const format = (value: number) =>
    new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${format(startDate)} – ${format(endDate)}`;
}
