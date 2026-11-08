import { v } from "convex/values";

export const CATEGORIES = [
  "power-tools",
  "hand-tools",
  "garden",
  "kitchen",
  "camping",
  "automotive",
  "outdoors",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  "power-tools": "Power tools",
  "hand-tools": "Hand tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  automotive: "Automotive",
  outdoors: "Outdoors",
  other: "Other",
};

export const CONDITIONS = ["new", "excellent", "good", "fair"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
};

export const REQUEST_STATUSES = [
  "pending",
  "approved",
  "declined",
  "cancelled",
  "returned",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const MAX_LOAN_DAYS = 60;

export const categoryValidator = v.union(
  v.literal("power-tools"),
  v.literal("hand-tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("automotive"),
  v.literal("outdoors"),
  v.literal("other"),
);

export const conditionValidator = v.union(
  v.literal("new"),
  v.literal("excellent"),
  v.literal("good"),
  v.literal("fair"),
);

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

export const roleValidator = v.union(v.literal("user"), v.literal("admin"));
