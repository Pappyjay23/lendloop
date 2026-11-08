import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  dayKey,
  daysOverdue,
  isOverdue,
  rangesOverlap,
  startOfUtcDay,
  validateLoanRange,
} from "../convex/lib/dates";

const now = Date.UTC(2026, 10, 6, 15, 30);
const today = startOfUtcDay(now);

describe("validateLoanRange", () => {
  it("accepts a valid inclusive range", () => {
    expect(validateLoanRange(today, today + 2 * DAY_MS, now)).toEqual({
      ok: true,
      startDate: today,
      endDate: today + 2 * DAY_MS,
    });
  });

  it("rejects the past", () => {
    const result = validateLoanRange(today - DAY_MS, today, now);
    expect(result.ok).toBe(false);
  });

  it("rejects reversed ranges", () => {
    const result = validateLoanRange(today + 2 * DAY_MS, today, now);
    expect(result.ok).toBe(false);
  });

  it("rejects ranges longer than the cap", () => {
    const result = validateLoanRange(today, today + 61 * DAY_MS, now);
    expect(result.ok).toBe(false);
  });

  it("rejects partial-day timestamps", () => {
    const result = validateLoanRange(today + 1, today + DAY_MS, now);
    expect(result.ok).toBe(false);
  });
});

describe("rangesOverlap", () => {
  it("detects inclusive overlap", () => {
    expect(rangesOverlap(today, today + 2 * DAY_MS, today + 2 * DAY_MS, today + 4 * DAY_MS)).toBe(true);
  });

  it("returns false for adjacent ranges", () => {
    expect(rangesOverlap(today, today + DAY_MS, today + 2 * DAY_MS, today + 3 * DAY_MS)).toBe(false);
  });
});

describe("overdue helpers", () => {
  it("treats yesterday as overdue and today as not overdue", () => {
    expect(isOverdue(today - DAY_MS, now)).toBe(true);
    expect(isOverdue(today, now)).toBe(false);
  });

  it("counts whole days overdue", () => {
    expect(daysOverdue(today - 3 * DAY_MS, now)).toBe(3);
    expect(daysOverdue(today + DAY_MS, now)).toBe(0);
  });

  it("produces a stable UTC day key", () => {
    expect(dayKey(now)).toBe("2026-11-06");
  });
});
