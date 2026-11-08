import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { fail, findUser, requireUser, requireUserForWrite } from "./lib/auth";
import { CATEGORY_LABELS } from "./lib/constants";
import {
  dayKey,
  daysOverdue,
  rangesOverlap,
  startOfUtcDay,
  validateLoanRange,
} from "./lib/dates";
import { coversToday, dateRangeLabel, effectiveStatus, firstName } from "./lib/loans";
import { enqueueAutomation } from "./lib/outbox";

type Viewer = Doc<"users">;

async function buildRequestView(
  ctx: Parameters<typeof findUser>[0],
  request: Doc<"requests">,
  viewer: Viewer,
  now: number,
) {
  const [tool, owner, borrower] = await Promise.all([
    ctx.db.get(request.toolId),
    ctx.db.get(request.ownerId),
    ctx.db.get(request.borrowerId),
  ]);

  const status = effectiveStatus(request, now);
  const isOwner = viewer._id === request.ownerId;
  const isBorrower = viewer._id === request.borrowerId;
  const isAdmin = viewer.role === "admin";
  const today = startOfUtcDay(now);

  return {
    _id: request._id,
    toolId: request.toolId,
    toolName: tool?.name ?? "Listing removed",
    toolDescription: tool?.description ?? "",
    categoryLabel: tool ? CATEGORY_LABELS[tool.category] : "Other",
    ownerId: request.ownerId,
    ownerName: owner?.name ?? "A neighbour",
    ownerTrusted: owner?.trustedLender ?? false,
    borrowerId: request.borrowerId,
    borrowerName: borrower?.name ?? "A neighbour",
    borrowerTrusted: borrower?.trustedLender ?? false,
    startDate: request.startDate,
    endDate: request.endDate,
    status,
    note: request.note ?? null,
    createdAt: request.createdAt,
    decidedAt: request.decidedAt ?? null,
    returnedAt: request.returnedAt ?? null,
    reminderCount: request.reminderCount,
    lastReminderAt: request.lastReminderAt ?? null,
    viewerRole: isOwner ? ("owner" as const) : isBorrower ? ("borrower" as const) : ("admin" as const),
    canApprove: isOwner && request.status === "pending",
    canDecline: isOwner && request.status === "pending",
    canCancel:
      isBorrower &&
      (request.status === "pending" ||
        (request.status === "approved" && request.startDate > today)),
    canReturn: request.status === "approved" && (isOwner || isBorrower || isAdmin),
  };
}

export const listIncoming = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await findUser(ctx);
    if (!viewer) return [];
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .take(100);
    const now = Date.now();
    return await Promise.all(requests.map((request) => buildRequestView(ctx, request, viewer, now)));
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await findUser(ctx);
    if (!viewer) return [];
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .order("desc")
      .take(100);
    const now = Date.now();
    return await Promise.all(requests.map((request) => buildRequestView(ctx, request, viewer, now)));
  },
});

export const detail = query({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const viewer = await requireUser(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) fail("NOT_FOUND", "That request no longer exists.");
    const allowed =
      viewer._id === request.ownerId ||
      viewer._id === request.borrowerId ||
      viewer.role === "admin";
    if (!allowed) fail("FORBIDDEN", "You are not part of this loan.");

    const [view, activity] = await Promise.all([
      buildRequestView(ctx, request, viewer, Date.now()),
      ctx.db
        .query("activity")
        .withIndex("by_request", (q) => q.eq("requestId", requestId))
        .order("desc")
        .take(30),
    ]);
    return { request: view, activity };
  },
});

export const activityFor = query({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const viewer = await requireUser(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) return [];
    const allowed =
      viewer._id === request.ownerId ||
      viewer._id === request.borrowerId ||
      viewer.role === "admin";
    if (!allowed) return [];
    return await ctx.db
      .query("activity")
      .withIndex("by_request", (q) => q.eq("requestId", requestId))
      .order("desc")
      .take(30);
  },
});

export const badges = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await findUser(ctx);
    if (!viewer) return { incomingPending: 0, outgoingActive: 0, unread: 0 };
    const [incoming, outgoing, notifications] = await Promise.all([
      ctx.db
        .query("requests")
        .withIndex("by_owner_status", (q) => q.eq("ownerId", viewer._id).eq("status", "pending"))
        .collect(),
      ctx.db
        .query("requests")
        .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
        .collect(),
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", viewer._id))
        .collect(),
    ]);
    return {
      incomingPending: incoming.length,
      outgoingActive: outgoing.filter(
        (request) => request.status === "pending" || request.status === "approved",
      ).length,
      unread: notifications.filter((row) => !row.readAt).length,
    };
  },
});

export const create = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.number(),
    endDate: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserForWrite(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) fail("NOT_FOUND", "That listing no longer exists.");
    if (tool.isArchived) fail("ARCHIVED", "That listing is no longer available.");
    if (tool.ownerId === user._id) fail("OWN_TOOL", "You cannot borrow your own tool.");

    const range = validateLoanRange(args.startDate, args.endDate, Date.now());
    if (!range.ok) fail("BAD_DATES", range.reason);

    const toolRequests = await ctx.db
      .query("requests")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .collect();

    const clash = toolRequests.find(
      (request) =>
        request.status === "approved" &&
        rangesOverlap(args.startDate, args.endDate, request.startDate, request.endDate),
    );
    if (clash) fail("DATES_UNAVAILABLE", "Those dates are already booked for this tool.");

    const mine = await ctx.db
      .query("requests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .collect();
    const duplicate = mine.find(
      (request) =>
        request.toolId === args.toolId &&
        (request.status === "pending" || request.status === "approved") &&
        rangesOverlap(args.startDate, args.endDate, request.startDate, request.endDate),
    );
    if (duplicate) fail("DUPLICATE_REQUEST", "You already have a request for those dates.");

    const note = args.note?.trim().slice(0, 280) || undefined;
    const now = Date.now();
    const requestId = await ctx.db.insert("requests", {
      toolId: args.toolId,
      ownerId: tool.ownerId,
      borrowerId: user._id,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      note,
      reminderCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activity", {
      requestId,
      toolId: tool._id,
      kind: "request.created",
      message: "Borrow request sent",
      actorKind: "user",
      actorName: user.name,
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      userId: tool.ownerId,
      kind: "request.created",
      title: "New borrow request",
      body: `${firstName(user.name)} asked to borrow ${tool.name} (${dateRangeLabel(args.startDate, args.endDate)}).`,
      requestId,
      toolId: tool._id,
      createdAt: now,
    });

    await enqueueAutomation(ctx, {
      idempotencyKey: `request:${requestId}:created`,
      kind: "request.created",
      requestId,
      payloadSummary: `${tool.name} · ${dateRangeLabel(args.startDate, args.endDate)}`,
    });

    return requestId;
  },
});

export const decide = mutation({
  args: {
    requestId: v.id("requests"),
    decision: v.union(v.literal("approve"), v.literal("decline")),
  },
  handler: async (ctx, { requestId, decision }) => {
    const user = await requireUserForWrite(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) fail("NOT_FOUND", "That request no longer exists.");
    if (request.ownerId !== user._id) fail("FORBIDDEN", "Only the lender can decide this request.");
    if (request.status !== "pending") fail("NOT_PENDING", "This request was already decided.");

    const tool = await ctx.db.get(request.toolId);
    if (!tool) fail("NOT_FOUND", "That listing no longer exists.");
    const now = Date.now();

    if (decision === "approve") {
      if (tool.isArchived) fail("ARCHIVED", "This listing has been removed.");
      const range = validateLoanRange(request.startDate, request.endDate, now);
      if (!range.ok) fail("BAD_DATES", range.reason);

      const approved = await ctx.db
        .query("requests")
        .withIndex("by_tool_status", (q) =>
          q.eq("toolId", request.toolId).eq("status", "approved"),
        )
        .collect();
      const clash = approved.find(
        (other) =>
          other._id !== requestId &&
          rangesOverlap(request.startDate, request.endDate, other.startDate, other.endDate),
      );
      if (clash) fail("DATES_UNAVAILABLE", "Another approved loan already covers those dates.");

      await ctx.db.patch(requestId, { status: "approved", decidedAt: now, updatedAt: now });
      // OCC barrier: concurrent approvals on the same tool now conflict.
      await ctx.db.patch(tool._id, { loanVersion: tool.loanVersion + 1, updatedAt: now });
    } else {
      await ctx.db.patch(requestId, { status: "declined", decidedAt: now, updatedAt: now });
      await ctx.db.patch(tool._id, { loanVersion: tool.loanVersion + 1, updatedAt: now });
    }

    const label = decision === "approve" ? "approved" : "declined";
    await ctx.db.insert("activity", {
      requestId,
      toolId: request.toolId,
      kind: `request.${label}`,
      message: `Request ${label}`,
      actorKind: "user",
      actorName: user.name,
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      userId: request.borrowerId,
      kind: `request.${label}`,
      title: decision === "approve" ? "Request approved" : "Request declined",
      body:
        decision === "approve"
          ? `${firstName(user.name)} approved your loan of ${tool.name}.`
          : `${firstName(user.name)} declined your request for ${tool.name}.`,
      requestId,
      toolId: request.toolId,
      createdAt: now,
    });

    await enqueueAutomation(ctx, {
      idempotencyKey: `request:${requestId}:${label}`,
      kind: `request.${label}`,
      requestId,
      payloadSummary: `${tool.name} · ${dateRangeLabel(request.startDate, request.endDate)}`,
    });

    return { status: label };
  },
});

export const cancel = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const user = await requireUserForWrite(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) fail("NOT_FOUND", "That request no longer exists.");
    if (request.borrowerId !== user._id) fail("FORBIDDEN", "Only the borrower can cancel.");
    if (request.status !== "pending" && request.status !== "approved") {
      fail("NOT_ACTIVE", "This request is no longer active.");
    }
    const now = Date.now();
    if (request.status === "approved" && request.startDate <= startOfUtcDay(now)) {
      fail("LOAN_STARTED", "This loan has started. Ask the lender to mark it returned.");
    }

    await ctx.db.patch(requestId, { status: "cancelled", updatedAt: now });
    const tool = await ctx.db.get(request.toolId);
    if (tool) {
      await ctx.db.patch(tool._id, { loanVersion: tool.loanVersion + 1, updatedAt: now });
    }

    await ctx.db.insert("activity", {
      requestId,
      toolId: request.toolId,
      kind: "request.cancelled",
      message: "Request cancelled by borrower",
      actorKind: "user",
      actorName: user.name,
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      userId: request.ownerId,
      kind: "request.cancelled",
      title: "Request cancelled",
      body: `${firstName(user.name)} cancelled their request for ${tool?.name ?? "your tool"}.`,
      requestId,
      toolId: request.toolId,
      createdAt: now,
    });

    await enqueueAutomation(ctx, {
      idempotencyKey: `request:${requestId}:cancelled`,
      kind: "request.cancelled",
      requestId,
      payloadSummary: `${tool?.name ?? "Tool"} · cancelled`,
    });

    return { status: "cancelled" as const };
  },
});

export const markReturned = mutation({
  args: { requestId: v.id("requests") },
  handler: async (ctx, { requestId }) => {
    const user = await requireUserForWrite(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) fail("NOT_FOUND", "That request no longer exists.");

    const isParticipant =
      request.ownerId === user._id || request.borrowerId === user._id;
    if (!isParticipant && user.role !== "admin") {
      fail("FORBIDDEN", "Only the lender, borrower, or an admin can mark a loan returned.");
    }
    if (request.status !== "approved") {
      fail("NOT_ACTIVE", "Only approved loans can be marked returned.");
    }

    const now = Date.now();
    await ctx.db.patch(requestId, { status: "returned", returnedAt: now, updatedAt: now });
    const tool = await ctx.db.get(request.toolId);
    if (tool) {
      await ctx.db.patch(tool._id, { loanVersion: tool.loanVersion + 1, updatedAt: now });
    }

    await ctx.db.insert("activity", {
      requestId,
      toolId: request.toolId,
      kind: "request.returned",
      message: coversToday(request, now) ? "Marked returned" : "Marked returned after the due date",
      actorKind: user.role === "admin" && !isParticipant ? "admin" : "user",
      actorName: user.name,
      createdAt: now,
    });

    const otherParty = user._id === request.ownerId ? request.borrowerId : request.ownerId;
    await ctx.db.insert("notifications", {
      userId: otherParty,
      kind: "request.returned",
      title: "Loan returned",
      body: `${firstName(user.name)} marked ${tool?.name ?? "the tool"} as returned.`,
      requestId,
      toolId: request.toolId,
      createdAt: now,
    });

    await enqueueAutomation(ctx, {
      idempotencyKey: `request:${requestId}:returned`,
      kind: "request.returned",
      requestId,
      payloadSummary: `${tool?.name ?? "Tool"} · returned`,
    });

    return { status: "returned" as const };
  },
});

/**
 * Read model for the n8n scheduled workflow. Only fields needed to compose a
 * reminder leave the database. Loans already reminded today are skipped, which
 * makes the daily job safe to re-run.
 */
export const overdueForAutomation = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const today = startOfUtcDay(now);
    const key = dayKey(now);
    const approved = await ctx.db
      .query("requests")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", today))
      .take(200);

    const output = [];
    for (const request of approved) {
      const reminderKey = `reminder:${request._id}:${key}`;
      const already = await ctx.db
        .query("automationEvents")
        .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", reminderKey))
        .unique();
      if (already && already.status !== "failed") continue;

      const [tool, borrower, lender] = await Promise.all([
        ctx.db.get(request.toolId),
        ctx.db.get(request.borrowerId),
        ctx.db.get(request.ownerId),
      ]);
      if (!tool || !borrower || !lender) continue;

      output.push({
        loanId: request._id,
        toolName: tool.name,
        categoryLabel: CATEGORY_LABELS[tool.category],
        startDate: new Date(request.startDate).toISOString(),
        dueDate: new Date(request.endDate).toISOString(),
        daysOverdue: daysOverdue(request.endDate, now),
        borrowerFirstName: firstName(borrower.name),
        borrowerEmail: borrower.email,
        lenderFirstName: firstName(lender.name),
        senderIsTrusted: lender.trustedLender,
      });
    }
    return output;
  },
});
