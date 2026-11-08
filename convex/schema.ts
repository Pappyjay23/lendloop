import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  conditionValidator,
  requestStatusValidator,
  roleValidator,
} from "./lib/constants";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role: roleValidator,
    trustedLender: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
    isArchived: v.boolean(),
    // Bumped on every loan-state transition. A write to the same tool document
    // makes two concurrent approvals conflict under Convex OCC, which is what
    // prevents double-booking the same date range.
    loanVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"])
    .index("by_archived", ["isArchived"]),

  requests: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
    status: requestStatusValidator,
    note: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    reminderCount: v.number(),
    lastReminderAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tool", ["toolId"])
    .index("by_tool_status", ["toolId", "status"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_status", ["ownerId", "status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_borrower_status", ["borrowerId", "status"])
    .index("by_status_end", ["status", "endDate"]),

  notifications: defineTable({
    userId: v.id("users"),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    requestId: v.optional(v.id("requests")),
    toolId: v.optional(v.id("tools")),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  activity: defineTable({
    requestId: v.id("requests"),
    toolId: v.id("tools"),
    kind: v.string(),
    message: v.string(),
    actorKind: v.union(v.literal("user"), v.literal("admin"), v.literal("system")),
    actorName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_request", ["requestId", "createdAt"])
    .index("by_tool", ["toolId"]),

  automationEvents: defineTable({
    idempotencyKey: v.string(),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    kind: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("received"),
      v.literal("failed"),
      v.literal("duplicate"),
    ),
    attempts: v.number(),
    requestId: v.optional(v.id("requests")),
    payloadSummary: v.optional(v.string()),
    lastError: v.optional(v.string()),
    externalId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_status", ["status"])
    .index("by_request", ["requestId"])
    .index("by_created", ["createdAt"]),

  auditLog: defineTable({
    actorId: v.id("users"),
    actorEmail: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    detail: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),
});
