import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { fail, requireAdmin, requireAdminForWrite } from "./lib/auth";
import { CATEGORY_LABELS } from "./lib/constants";
import { isOverdue } from "./lib/dates";
import { effectiveStatus } from "./lib/loans";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const [users, tools, requests, events] = await Promise.all([
      ctx.db.query("users").take(500),
      ctx.db.query("tools").take(500),
      ctx.db.query("requests").take(1000),
      ctx.db
        .query("automationEvents")
        .withIndex("by_created")
        .order("desc")
        .take(100),
    ]);

    const activeLoans = requests.filter(
      (request) => request.status === "approved" && !isOverdue(request.endDate, now),
    );

    return {
      counts: {
        users: users.length,
        tools: tools.filter((tool) => !tool.isArchived).length,
        archivedTools: tools.filter((tool) => tool.isArchived).length,
        pendingRequests: requests.filter((request) => request.status === "pending").length,
        activeLoans: activeLoans.length,
        overdueLoans: requests.filter(
          (request) => request.status === "approved" && isOverdue(request.endDate, now),
        ).length,
        totalLoans: requests.filter((request) => request.status === "approved").length,
        failedAutomations: events.filter((event) => event.status === "failed").length,
        remindersSent: events.filter((event) => event.kind === "reminder.sent").length,
      },
      recentEvents: events.slice(0, 8),
    };
  },
});

export const listLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const requests = await ctx.db.query("requests").order("desc").take(200);
    const rows = [];
    for (const request of requests) {
      const [tool, owner, borrower] = await Promise.all([
        ctx.db.get(request.toolId),
        ctx.db.get(request.ownerId),
        ctx.db.get(request.borrowerId),
      ]);
      rows.push({
        _id: request._id,
        toolName: tool?.name ?? "Listing removed",
        categoryLabel: tool ? CATEGORY_LABELS[tool.category] : "Other",
        ownerName: owner?.name ?? "Unknown",
        borrowerName: borrower?.name ?? "Unknown",
        startDate: request.startDate,
        endDate: request.endDate,
        status: effectiveStatus(request, now),
        reminderCount: request.reminderCount,
        createdAt: request.createdAt,
      });
    }
    return rows;
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    const admin = await requireAdminForWrite(ctx);
    const target = await ctx.db.get(userId);
    if (!target) fail("NOT_FOUND", "That user no longer exists.");
    if (target.role === "admin") fail("INVALID_TARGET", "Admins are always trusted.");

    await ctx.db.patch(userId, { trustedLender: trusted, updatedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      actorId: admin._id,
      actorEmail: admin.email,
      action: trusted ? "user.trust" : "user.untrust",
      targetType: "users",
      targetId: userId,
      detail: `${trusted ? "Granted" : "Revoked"} trusted lender for ${target.email}.`,
      createdAt: Date.now(),
    });
    return { trusted };
  },
});

export const removeListing = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const admin = await requireAdminForWrite(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) fail("NOT_FOUND", "That listing no longer exists.");

    await ctx.db.patch(toolId, {
      isArchived: true,
      loanVersion: tool.loanVersion + 1,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: admin._id,
      actorEmail: admin.email,
      action: "listing.remove",
      targetType: "tools",
      targetId: toolId,
      detail: `Removed "${tool.name}".`,
      createdAt: Date.now(),
    });
    return { removed: true as const };
  },
});

/** Re-queues a failed outbound delivery and resets its attempt budget. */
export const retryEvent = mutation({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, { eventId }) => {
    const admin = await requireAdminForWrite(ctx);
    const event = await ctx.db.get(eventId);
    if (!event) fail("NOT_FOUND", "That automation event no longer exists.");
    if (event.direction !== "outbound") {
      fail("INVALID_EVENT", "Only outbound deliveries can be retried.");
    }
    if (event.status === "sent") {
      return { queued: false as const, reason: "already_sent" };
    }

    await ctx.db.patch(eventId, {
      status: "queued",
      attempts: 0,
      lastError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.delivery.deliverRequestEvent, { eventId });
    await ctx.db.insert("auditLog", {
      actorId: admin._id,
      actorEmail: admin.email,
      action: "automation.retry",
      targetType: "automationEvents",
      targetId: eventId,
      detail: `Re-queued ${event.kind} delivery.`,
      createdAt: Date.now(),
    });
    return { queued: true as const };
  },
});

export const auditTrail = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("auditLog").withIndex("by_created").order("desc").take(40);
  },
});
