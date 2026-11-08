import { internalMutation, mutation } from "./_generated/server";
import { fail, requireUserForWrite } from "./lib/auth";
import { DAY_MS, startOfUtcDay } from "./lib/dates";
import { dateRangeLabel } from "./lib/loans";
import { enqueueAutomation } from "./lib/outbox";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const DEMO_TOOLS = [
  { name: "DeWalt 20V drill", category: "power-tools", condition: "excellent", description: "Cordless drill with two batteries and a 30-piece bit set." },
  { name: "Stihl hedge trimmer", category: "garden", condition: "good", description: "Petrol trimmer, sharp blades. Great for boundary hedges." },
  { name: "Stand mixer", category: "kitchen", condition: "new", description: "5.5L bowl, whisk and dough hook included." },
  { name: "4-person dome tent", category: "camping", condition: "good", description: "Quick-pitch tent with footprint. Sleeps four comfortably." },
  { name: "Socket wrench set", category: "hand-tools", condition: "excellent", description: "Metric and imperial sockets in a hard case." },
  { name: "Trolley jack", category: "automotive", condition: "good", description: "2-tonne low-profile jack with stands." },
  { name: "Pressure washer", category: "outdoors", condition: "fair", description: "Works well; the hose has a patched section." },
  { name: "Charcoal kettle grill", category: "camping", condition: "good", description: "22-inch kettle, cleaned after each use." },
] as const;

const DEMO_EMAIL_DOMAIN = "yopmail.com";

function demoEmail(key: string): string {
  return `lendloop.${key}@${DEMO_EMAIL_DOMAIN}`;
}

async function ensureDemoNeighbour(
  ctx: MutationCtx,
  key: string,
  name: string,
  trustedLender: boolean,
): Promise<Id<"users">> {
  const tokenIdentifier = `seed|${key}`;
  const email = demoEmail(key);
  const existing = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();

  if (existing) {
    if (
      existing.email !== email ||
      existing.name !== name ||
      existing.trustedLender !== trustedLender
    ) {
      await ctx.db.patch(existing._id, {
        email,
        name,
        trustedLender,
        updatedAt: Date.now(),
      });
    }
    return existing._id;
  }

  const now = Date.now();
  return await ctx.db.insert("users", {
    tokenIdentifier,
    clerkId: `seed_${key}`,
    email,
    name,
    role: "user",
    trustedLender,
    createdAt: now,
    updatedAt: now,
  });
}

/** Patches existing demo contacts when the demo email domain changes. */
export const syncDemoContacts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ids = await Promise.all([
      ensureDemoNeighbour(ctx, "amara", "Amara Okafor", true),
      ensureDemoNeighbour(ctx, "tobi", "Tobi Adeyemi", true),
      ensureDemoNeighbour(ctx, "ngozi", "Ngozi Bello", false),
    ]);
    return { contacts: ids.length, domain: DEMO_EMAIL_DOMAIN };
  },
});

/**
 * Seeds public demo data. Internal so only the CLI/dashboard can call it.
 * Only allowed on an empty deployment unless ALLOW_SEED=true.
 */
export const demo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("tools").take(1);
    if (existing.length > 0 && process.env.ALLOW_SEED !== "true") {
      fail("SEED_SKIPPED", "Deployment already has listings. Set ALLOW_SEED=true to add more.");
    }

    const [amara, tobi, ngozi] = await Promise.all([
      ensureDemoNeighbour(ctx, "amara", "Amara Okafor", true),
      ensureDemoNeighbour(ctx, "tobi", "Tobi Adeyemi", true),
      ensureDemoNeighbour(ctx, "ngozi", "Ngozi Bello", false),
    ]);

    const owners = [amara, tobi, ngozi];
    const now = Date.now();
    let created = 0;
    for (const [index, tool] of DEMO_TOOLS.entries()) {
      await ctx.db.insert("tools", {
        ownerId: owners[index % owners.length],
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        isArchived: false,
        loanVersion: 0,
        createdAt: now - index * 3_600_000,
        updatedAt: now - index * 3_600_000,
      });
      created += 1;
    }

    return { created, neighbours: 3 };
  },
});

/** Adds a personalized showcase for the signed-in user: listings, an incoming request, and an overdue loan. */
export const myShowcase = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserForWrite(ctx);
    const existing = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .take(1);
    if (existing.length > 0) {
      return { skipped: true as const, reason: "You already have listings." };
    }

    const [amara, tobi] = await Promise.all([
      ensureDemoNeighbour(ctx, "amara", "Amara Okafor", true),
      ensureDemoNeighbour(ctx, "tobi", "Tobi Adeyemi", true),
    ]);

    const now = Date.now();
    const today = startOfUtcDay(now);

    const drill = await ctx.db.insert("tools", {
      ownerId: user._id,
      name: "Bosch cordless drill",
      category: "power-tools",
      condition: "excellent",
      description: "Two batteries, charger, and a full bit set.",
      isArchived: false,
      loanVersion: 0,
      createdAt: now - 5 * DAY_MS,
      updatedAt: now - 5 * DAY_MS,
    });
    await ctx.db.insert("tools", {
      ownerId: user._id,
      name: "Extension ladder",
      category: "outdoors",
      condition: "good",
      description: "3m aluminium ladder, rated to 150kg.",
      isArchived: false,
      loanVersion: 0,
      createdAt: now - 4 * DAY_MS,
      updatedAt: now - 4 * DAY_MS,
    });
    await ctx.db.insert("tools", {
      ownerId: user._id,
      name: "Camping stove",
      category: "camping",
      condition: "fair",
      description: "Two-burner gas stove. Works reliably.",
      isArchived: false,
      loanVersion: 0,
      createdAt: now - 3 * DAY_MS,
      updatedAt: now - 3 * DAY_MS,
    });

    const neighbourTool = await ctx.db.insert("tools", {
      ownerId: tobi,
      name: "Tile cutter",
      category: "hand-tools",
      condition: "good",
      description: "Manual tile cutter for up to 600mm tiles.",
      isArchived: false,
      loanVersion: 0,
      createdAt: now - 2 * DAY_MS,
      updatedAt: now - 2 * DAY_MS,
    });

    const incoming = await ctx.db.insert("requests", {
      toolId: drill,
      ownerId: user._id,
      borrowerId: amara,
      startDate: today + 2 * DAY_MS,
      endDate: today + 4 * DAY_MS,
      status: "pending",
      note: "Hanging a few shelves this weekend.",
      reminderCount: 0,
      createdAt: now - 6 * 3_600_000,
      updatedAt: now - 6 * 3_600_000,
    });

    const overdue = await ctx.db.insert("requests", {
      toolId: neighbourTool,
      ownerId: tobi,
      borrowerId: user._id,
      startDate: today - 6 * DAY_MS,
      endDate: today - 2 * DAY_MS,
      status: "approved",
      reminderCount: 1,
      lastReminderAt: now - DAY_MS,
      decidedAt: now - 7 * DAY_MS,
      createdAt: now - 7 * DAY_MS,
      updatedAt: now - DAY_MS,
    });

    await ctx.db.insert("activity", {
      requestId: incoming,
      toolId: drill,
      kind: "request.created",
      message: "Borrow request sent",
      actorKind: "user",
      actorName: "Amara Okafor",
      createdAt: now - 6 * 3_600_000,
    });
    await ctx.db.insert("activity", {
      requestId: overdue,
      toolId: neighbourTool,
      kind: "request.approved",
      message: "Request approved",
      actorKind: "user",
      actorName: "Tobi Adeyemi",
      createdAt: now - 7 * DAY_MS,
    });
    await ctx.db.insert("activity", {
      requestId: overdue,
      toolId: neighbourTool,
      kind: "reminder.sent",
      message: "Overdue reminder sent (1 day past due)",
      actorKind: "system",
      createdAt: now - DAY_MS,
    });

    await ctx.db.insert("notifications", {
      userId: user._id,
      kind: "request.created",
      title: "New borrow request",
      body: "Amara asked to borrow Bosch cordless drill.",
      requestId: incoming,
      toolId: drill,
      createdAt: now - 6 * 3_600_000,
    });

    return { skipped: false as const, incoming, overdue };
  },
});

/**
 * Internal diagnostic used by the CLI to exercise the full outbox path:
 * writes a real request + event, then the delivery action posts to n8n.
 * Not callable from the browser.
 */
export const automationProbe = internalMutation({
  args: {},
  handler: async (ctx) => {
    const amara = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", "seed|amara"))
      .unique();
    const tobi = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", "seed|tobi"))
      .unique();
    const tool = amara
      ? await ctx.db
          .query("tools")
          .withIndex("by_owner", (q) => q.eq("ownerId", amara._id))
          .first()
      : null;

    if (!amara || !tobi || !tool) {
      fail("PROBE_SETUP", "Run `npx convex run seed:demo` first.");
    }

    const now = Date.now();
    const today = startOfUtcDay(now);
    const requestId = await ctx.db.insert("requests", {
      toolId: tool._id,
      ownerId: amara._id,
      borrowerId: tobi._id,
      startDate: today + 7 * DAY_MS,
      endDate: today + 9 * DAY_MS,
      status: "pending",
      note: "Automation probe — safe to ignore.",
      reminderCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activity", {
      requestId,
      toolId: tool._id,
      kind: "request.created",
      message: "Borrow request sent (automation probe)",
      actorKind: "system",
      actorName: "Tobi Adeyemi",
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      userId: amara._id,
      kind: "request.created",
      title: "New borrow request",
      body: `Tobi asked to borrow ${tool.name} (${dateRangeLabel(today + 7 * DAY_MS, today + 9 * DAY_MS)}).`,
      requestId,
      toolId: tool._id,
      createdAt: now,
    });

    const eventId = await enqueueAutomation(ctx, {
      idempotencyKey: `request:${requestId}:created`,
      kind: "request.created",
      requestId,
      payloadSummary: `${tool.name} · automation probe`,
    });

    return { requestId, eventId, recipient: demoEmail("amara") };
  },
});

/** Internal diagnostic: creates an approved loan that is already two days overdue. */
export const overdueProbe = internalMutation({
  args: {},
  handler: async (ctx) => {
    const amara = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", "seed|amara"))
      .unique();
    const tobi = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", "seed|tobi"))
      .unique();
    const tool = amara
      ? await ctx.db
          .query("tools")
          .withIndex("by_owner", (q) => q.eq("ownerId", amara._id))
          .first()
      : null;

    if (!amara || !tobi || !tool) {
      fail("PROBE_SETUP", "Run `npx convex run seed:demo` first.");
    }

    const now = Date.now();
    const today = startOfUtcDay(now);
    const requestId = await ctx.db.insert("requests", {
      toolId: tool._id,
      ownerId: amara._id,
      borrowerId: tobi._id,
      startDate: today - 5 * DAY_MS,
      endDate: today - 2 * DAY_MS,
      status: "approved",
      reminderCount: 0,
      decidedAt: today - 6 * DAY_MS,
      createdAt: today - 6 * DAY_MS,
      updatedAt: now,
    });

    await ctx.db.insert("activity", {
      requestId,
      toolId: tool._id,
      kind: "request.approved",
      message: "Request approved (overdue probe)",
      actorKind: "system",
      createdAt: today - 6 * DAY_MS,
    });

    return {
      requestId,
      toolName: tool.name,
      borrower: tobi.email,
      dueDate: new Date(today - 2 * DAY_MS).toISOString().slice(0, 10),
    };
  },
});
