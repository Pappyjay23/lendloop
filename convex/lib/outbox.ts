import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Transactional outbox. The event row and the business change commit together,
 * so a network failure can never silently drop a notification. Delivery is a
 * retrying action; its progress is visible in `automationEvents`.
 */
export async function enqueueAutomation(
  ctx: MutationCtx,
  args: {
    idempotencyKey: string;
    kind: string;
    requestId?: Id<"requests">;
    payloadSummary?: string;
  },
): Promise<Id<"automationEvents">> {
  const existing = await ctx.db
    .query("automationEvents")
    .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
    .unique();

  if (existing) {
    return existing._id;
  }

  const now = Date.now();
  const eventId = await ctx.db.insert("automationEvents", {
    idempotencyKey: args.idempotencyKey,
    direction: "outbound",
    kind: args.kind,
    status: "queued",
    attempts: 0,
    requestId: args.requestId,
    payloadSummary: args.payloadSummary,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(0, internal.delivery.deliverRequestEvent, { eventId });
  return eventId;
}
