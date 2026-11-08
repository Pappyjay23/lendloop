import { query, mutation } from "./_generated/server";
import { findUser, requireAdmin, requireUserForWrite } from "./lib/auth";

/** Idempotent. Called once by the client after Clerk reports a signed-in session. */
export const sync = mutation({
  args: {},
  handler: async (ctx) => {
    return await requireUserForWrite(ctx);
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    return await findUser(ctx);
  },
});

export const notifications = query({
  args: {},
  handler: async (ctx) => {
    const user = await findUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
    return rows;
  },
});

export const markNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await findUser(ctx);
    if (!user) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const now = Date.now();
    let changed = 0;
    for (const row of rows) {
      if (!row.readAt) {
        await ctx.db.patch(row._id, { readAt: now });
        changed += 1;
      }
    }
    return changed;
  },
});

export const directory = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(100);
    return users
      .map((user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        trustedLender: user.trustedLender,
        createdAt: user.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});
