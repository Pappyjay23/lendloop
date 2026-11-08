import type { Doc } from "@/convex/_generated/dataModel";
import {
  Car,
  ChefHat,
  Flower2,
  Package,
  Tent,
  Trees,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type Category = Doc<"tools">["category"];
export type Condition = Doc<"tools">["condition"];

export const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon }> = {
  "power-tools": { label: "Power tools", icon: Zap },
  "hand-tools": { label: "Hand tools", icon: Wrench },
  garden: { label: "Garden", icon: Flower2 },
  kitchen: { label: "Kitchen", icon: ChefHat },
  camping: { label: "Camping", icon: Tent },
  automotive: { label: "Automotive", icon: Car },
  outdoors: { label: "Outdoors", icon: Trees },
  other: { label: "Other", icon: Package },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
};

export type DisplayStatus =
  | "available"
  | "on-loan"
  | "pending"
  | "approved"
  | "overdue"
  | "declined"
  | "cancelled"
  | "returned";

export const STATUS_META: Record<
  DisplayStatus,
  { label: string; pill: string; dot: string }
> = {
  available: {
    label: "Available",
    pill: "border-moss/25 bg-moss-soft text-moss",
    dot: "bg-moss",
  },
  "on-loan": {
    label: "On loan",
    pill: "border-gold/30 bg-gold-soft text-gold",
    dot: "bg-gold",
  },
  pending: {
    label: "Pending",
    pill: "border-gold/30 bg-gold-soft text-gold",
    dot: "bg-gold",
  },
  approved: {
    label: "Approved",
    pill: "border-moss/25 bg-moss-soft text-moss",
    dot: "bg-moss",
  },
  overdue: {
    label: "Overdue",
    pill: "border-danger/25 bg-danger-soft text-danger",
    dot: "bg-danger",
  },
  declined: {
    label: "Declined",
    pill: "border-line bg-paper-deep text-ink-soft",
    dot: "bg-ink-faint",
  },
  cancelled: {
    label: "Cancelled",
    pill: "border-line bg-paper-deep text-ink-soft",
    dot: "bg-ink-faint",
  },
  returned: {
    label: "Returned",
    pill: "border-line bg-surface text-ink-soft",
    dot: "bg-ink-soft",
  },
};
