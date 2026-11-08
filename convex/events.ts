import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { CATEGORY_LABELS } from "./lib/constants";
import { daysOverdue } from "./lib/dates";
import { dateRangeLabel, firstName } from "./lib/loans";

const RETRYABLE_KINDS = new Set([
  "request.created",
  "request.approved",
  "request.declined",
  "request.cancelled",
  "request.returned",
]);

function siteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

/**
 * Builds the minimal payload sent to n8n. No addresses, no descriptions, no
 * secondary emails — only what the email template needs to render.
 */
export const getForDelivery = internalQuery({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.direction !== "outbound") return null;
    if (!event.requestId) return null;

    const request = await ctx.db.get(event.requestId);
    if (!request) return null;
    const [tool, owner, borrower] = await Promise.all([
      ctx.db.get(request.toolId),
      ctx.db.get(request.ownerId),
      ctx.db.get(request.borrowerId),
    ]);
    if (!tool || !owner || !borrower) return null;

    const notifyOwner =
      event.kind === "request.created" ||
      event.kind === "request.cancelled" ||
      event.kind === "request.returned";
    const recipient = notifyOwner ? owner : borrower;
    const counterpart = notifyOwner ? borrower : owner;

    const payload = {
      version: 1,
      eventId,
      eventKind: event.kind,
      requestId: request._id,
      toolName: tool.name,
      categoryLabel: CATEGORY_LABELS[tool.category],
      startDate: new Date(request.startDate).toISOString().slice(0, 10),
      endDate: new Date(request.endDate).toISOString().slice(0, 10),
      dateRange: dateRangeLabel(request.startDate, request.endDate),
      recipient: {
        firstName: firstName(recipient.name),
        email: recipient.email,
      },
      counterpartFirstName: firstName(counterpart.name),
      recipientIsTrustedLender: recipient.trustedLender,
      actionUrl: `${siteUrl()}${notifyOwner ? "/incoming" : "/my-requests"}`,
    };

    return {
      event: {
        _id: event._id,
        kind: event.kind,
        status: event.status,
        attempts: event.attempts,
      },
      payload,
    };
  },
});

export const markRetry = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    attempts: v.number(),
    error: v.string(),
  },
  handler: async (ctx, { eventId, attempts, error }) => {
    await ctx.db.patch(eventId, {
      status: "queued",
      attempts,
      lastError: error.slice(0, 500),
      updatedAt: Date.now(),
    });
  },
});

export const markDelivery = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    ok: v.boolean(),
    attempts: v.number(),
    externalId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, ok, attempts, externalId, error }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return;
    const now = Date.now();
    await ctx.db.patch(eventId, {
      status: ok ? "sent" : "failed",
      attempts,
      externalId,
      lastError: ok ? undefined : error?.slice(0, 500),
      updatedAt: now,
    });

    if (event.requestId && RETRYABLE_KINDS.has(event.kind)) {
      const request = await ctx.db.get(event.requestId);
      if (request) {
        await ctx.db.insert("activity", {
          requestId: event.requestId,
          toolId: request.toolId,
          kind: ok ? "automation.sent" : "automation.failed",
          message: ok
            ? "Notification handed to automation"
            : "Notification delivery failed after retries",
          actorKind: "system",
          createdAt: now,
        });
      }
    }

    if (!ok) {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .take(10);
      for (const admin of admins) {
        await ctx.db.insert("notifications", {
          userId: admin._id,
          kind: "automation.failed",
          title: "Automation delivery failed",
          body: `${event.kind} could not be delivered to n8n: ${error?.slice(0, 180) ?? "unknown error"}.`,
          requestId: event.requestId,
          createdAt: now,
        });
      }
    }
  },
});

async function notifyAdmins(
  ctx: MutationCtx,
  args: { title: string; body: string; requestId?: Id<"requests"> },
) {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .take(10);
  const now = Date.now();
  for (const admin of admins) {
    await ctx.db.insert("notifications", {
      userId: admin._id,
      kind: "automation",
      title: args.title,
      body: args.body,
      requestId: args.requestId,
      createdAt: now,
    });
  }
}

/** Idempotent write-back for the daily overdue workflow. */
export const recordReminderResult = internalMutation({
  args: {
    loanId: v.id("requests"),
    day: v.string(),
    outcome: v.union(v.literal("sent"), v.literal("failed")),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { loanId, day, outcome, providerMessageId, error }) => {
    const idempotencyKey = `reminder:${loanId}:${day}`;
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (existing) {
      return { ok: true as const, duplicate: true as const, eventId: existing._id };
    }

    const request = await ctx.db.get(loanId);
    if (!request) return { ok: false as const, duplicate: false as const, reason: "not_found" };

    const now = Date.now();
    const eventId = await ctx.db.insert("automationEvents", {
      idempotencyKey,
      direction: "inbound",
      kind: outcome === "sent" ? "reminder.sent" : "reminder.failed",
      status: "received",
      attempts: 1,
      requestId: loanId,
      payloadSummary: `overdue reminder · ${day}`,
      externalId: providerMessageId,
      lastError: error?.slice(0, 500),
      createdAt: now,
      updatedAt: now,
    });

    if (outcome === "sent") {
      await ctx.db.patch(loanId, {
        reminderCount: request.reminderCount + 1,
        lastReminderAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("activity", {
        requestId: loanId,
        toolId: request.toolId,
        kind: "reminder.sent",
        message: `Overdue reminder sent (${daysOverdue(request.endDate, now)} day${
          daysOverdue(request.endDate, now) === 1 ? "" : "s"
        } past due)`,
        actorKind: "system",
        createdAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: request.borrowerId,
        kind: "reminder.sent",
        title: "Your loan is overdue",
        body: `A reminder was sent for your loan. Please return it or contact the lender.`,
        requestId: loanId,
        toolId: request.toolId,
        createdAt: now,
      });
    } else {
      await ctx.db.insert("activity", {
        requestId: loanId,
        toolId: request.toolId,
        kind: "reminder.failed",
        message: "Overdue reminder failed",
        actorKind: "system",
        createdAt: now,
      });
      await notifyAdmins(ctx, {
        title: "Overdue reminder failed",
        body: `Reminder for loan ${loanId} on ${day} failed: ${error?.slice(0, 180) ?? "unknown error"}.`,
        requestId: loanId,
      });
    }

    return { ok: true as const, duplicate: false as const, eventId };
  },
});

/** Idempotent confirmation that n8n actually sent the request email. */
export const recordNotificationResult = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    outcome: v.union(v.literal("delivered"), v.literal("failed")),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, outcome, providerMessageId, error }) => {
    const idempotencyKey = `notify:${eventId}`;
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (existing) return { ok: true as const, duplicate: true as const };

    const source = await ctx.db.get(eventId);
    if (!source) return { ok: false as const, duplicate: false as const, reason: "not_found" };

    const now = Date.now();
    await ctx.db.insert("automationEvents", {
      idempotencyKey,
      direction: "inbound",
      kind: outcome === "delivered" ? "notification.delivered" : "notification.failed",
      status: "received",
      attempts: 1,
      requestId: source.requestId,
      payloadSummary: source.payloadSummary,
      externalId: providerMessageId,
      lastError: error?.slice(0, 500),
      createdAt: now,
      updatedAt: now,
    });

    if (providerMessageId) {
      await ctx.db.patch(eventId, { externalId: providerMessageId, updatedAt: now });
    }

    if (source.requestId) {
      const request = await ctx.db.get(source.requestId);
      if (request) {
        await ctx.db.insert("activity", {
          requestId: source.requestId,
          toolId: request.toolId,
          kind: outcome === "delivered" ? "notification.delivered" : "notification.failed",
          message:
            outcome === "delivered" ? "Email delivered to recipient" : "Email delivery failed",
          actorKind: "system",
          createdAt: now,
        });
      }
    }

    if (outcome === "failed") {
      await notifyAdmins(ctx, {
        title: "Notification email failed",
        body: `Email for ${source.kind} failed: ${error?.slice(0, 180) ?? "unknown error"}.`,
        requestId: source.requestId,
      });
    }

    return { ok: true as const, duplicate: false as const };
  },
});

/** Target of the n8n error workflow. Failures are visible, never silent. */
export const recordWorkflowError = internalMutation({
  args: {
    workflow: v.string(),
    executionId: v.string(),
    message: v.string(),
    requestId: v.optional(v.id("requests")),
  },
  handler: async (ctx, { workflow, executionId, message, requestId }) => {
    const idempotencyKey = `workflow-error:${workflow}:${executionId}`;
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (existing) return { ok: true as const, duplicate: true as const };

    const now = Date.now();
    await ctx.db.insert("automationEvents", {
      idempotencyKey,
      direction: "inbound",
      kind: "workflow.error",
      status: "failed",
      attempts: 1,
      requestId,
      payloadSummary: `${workflow} · execution ${executionId}`,
      lastError: message.slice(0, 500),
      createdAt: now,
      updatedAt: now,
    });

    await notifyAdmins(ctx, {
      title: "n8n workflow failed",
      body: `${workflow} (execution ${executionId}) failed: ${message.slice(0, 180)}`,
      requestId,
    });

    return { ok: true as const, duplicate: false as const };
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("automationEvents")
      .withIndex("by_created")
      .order("desc")
      .take(40);
  },
});

export const forRequest = query({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const user = await requireAdmin(ctx);
    void user;
    return await ctx.db
      .query("automationEvents")
      .withIndex("by_request", (q) => q.eq("requestId", requestId))
      .order("desc")
      .take(20);
  },
});
