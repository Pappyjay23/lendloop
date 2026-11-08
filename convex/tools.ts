import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { fail, findUser, requireUser, requireUserForWrite } from "./lib/auth";
import { CATEGORY_LABELS, categoryValidator, conditionValidator } from "./lib/constants";
import { coversToday } from "./lib/loans";
import { startOfUtcDay } from "./lib/dates";

function cleanText(value: string, field: string, min: number, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    fail("VALIDATION", `${field} must be at least ${min} characters.`);
  }
  if (trimmed.length > max) {
    fail("VALIDATION", `${field} must be at most ${max} characters.`);
  }
  return trimmed;
}

async function approvedRequestsForTool(
  ctx: Parameters<typeof findUser>[0],
  toolId: Id<"tools">,
): Promise<Doc<"requests">[]> {
  return await ctx.db
    .query("requests")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();
}

async function toolView(
  ctx: Parameters<typeof findUser>[0],
  tool: Doc<"tools">,
  viewerId: Id<"users"> | null,
  now: number,
) {
  const owner = await ctx.db.get(tool.ownerId);
  const approved = await approvedRequestsForTool(ctx, tool._id);
  const today = startOfUtcDay(now);
  const current = approved.find((request) => coversToday(request, now)) ?? null;
  const upcoming = approved
    .filter((request) => request.startDate > today)
    .sort((a, b) => a.startDate - b.startDate)[0];

  return {
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    categoryLabel: CATEGORY_LABELS[tool.category],
    condition: tool.condition,
    description: tool.description,
    isArchived: tool.isArchived,
    createdAt: tool.createdAt,
    ownerId: tool.ownerId,
    ownerName: owner?.name ?? "A neighbour",
    ownerTrusted: owner?.trustedLender ?? false,
    isOwner: viewerId !== null && viewerId === tool.ownerId,
    availability: current ? ("on-loan" as const) : ("available" as const),
    currentLoanEnd: current?.endDate ?? null,
    currentLoanId: current?._id ?? null,
    nextBookingStart: upcoming?.startDate ?? null,
  };
}

/** Public, unauthenticated projection: name and category only. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_archived", (q) => q.eq("isArchived", false))
      .take(80);

    const available: { _id: Id<"tools">; name: string; category: Doc<"tools">["category"] }[] = [];
    for (const tool of tools) {
      const approved = await approvedRequestsForTool(ctx, tool._id);
      if (!approved.some((request) => coversToday(request, now))) {
        available.push({ _id: tool._id, name: tool.name, category: tool.category });
      }
    }
    return available.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const browse = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    const viewer = await findUser(ctx);
    const now = Date.now();

    const tools = category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", category))
          .take(120)
      : await ctx.db
          .query("tools")
          .withIndex("by_archived", (q) => q.eq("isArchived", false))
          .take(120);

    const visible = tools.filter((tool) => !tool.isArchived);
    return await Promise.all(
      visible.map((tool) => toolView(ctx, tool, viewer?._id ?? null, now)),
    ).then((rows) =>
      rows.sort((a, b) => Number(b.createdAt) - Number(a.createdAt)),
    );
  },
});

export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await findUser(ctx);
    if (!viewer) return [];
    const now = Date.now();
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .take(100);

    const rows = [];
    for (const tool of tools) {
      const view = await toolView(ctx, tool, viewer._id, now);
      const requests = await ctx.db
        .query("requests")
        .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
        .collect();
      rows.push({
        ...view,
        pendingCount: requests.filter((request) => request.status === "pending").length,
        totalRequests: requests.length,
      });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) fail("NOT_FOUND", "That listing no longer exists.");
    return await toolView(ctx, tool, viewer._id, Date.now());
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserForWrite(ctx);
    const name = cleanText(args.name, "Name", 2, 80);
    const description = cleanText(args.description, "Description", 5, 400);
    const now = Date.now();

    const id = await ctx.db.insert("tools", {
      ownerId: user._id,
      name,
      category: args.category,
      condition: args.condition,
      description,
      isArchived: false,
      loanVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserForWrite(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) fail("NOT_FOUND", "That listing no longer exists.");
    if (tool.ownerId !== user._id) fail("FORBIDDEN", "You can only edit your own listings.");
    if (tool.isArchived) fail("ARCHIVED", "Restore the listing before editing it.");

    await ctx.db.patch(args.toolId, {
      name: cleanText(args.name, "Name", 2, 80),
      category: args.category,
      condition: args.condition,
      description: cleanText(args.description, "Description", 5, 400),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const user = await requireUserForWrite(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) fail("NOT_FOUND", "That listing no longer exists.");

    const isOwner = tool.ownerId === user._id;
    const isAdmin = user.role === "admin";
    if (!isOwner && !isAdmin) fail("FORBIDDEN", "You can only remove your own listings.");

    if (!isAdmin) {
      const requests = await ctx.db
        .query("requests")
        .withIndex("by_tool", (q) => q.eq("toolId", toolId))
        .collect();
      const blocking = requests.filter(
        (request) => request.status === "pending" || request.status === "approved",
      );
      if (blocking.length > 0) {
        fail(
          "HAS_ACTIVE_REQUESTS",
          "Resolve pending or active loans before removing this listing.",
        );
      }
    }

    await ctx.db.patch(toolId, {
      isArchived: true,
      loanVersion: tool.loanVersion + 1,
      updatedAt: Date.now(),
    });

    if (isAdmin && !isOwner) {
      await ctx.db.insert("auditLog", {
        actorId: user._id,
        actorEmail: user.email,
        action: "listing.remove",
        targetType: "tools",
        targetId: toolId,
        detail: `Admin archived "${tool.name}" (owner ${tool.ownerId}).`,
        createdAt: Date.now(),
      });
    }
    return { removed: true as const };
  },
});

/** Owner-only helper used by the UI to show a listing even after archival. */
export const listArchivedOwn = query({
  args: {},
  handler: async (ctx) => {
    const user = await findUser(ctx);
    if (!user) return [];
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return tools
      .filter((tool) => tool.isArchived)
      .map((tool) => ({ _id: tool._id, name: tool.name, categoryLabel: CATEGORY_LABELS[tool.category] }));
  },
});
