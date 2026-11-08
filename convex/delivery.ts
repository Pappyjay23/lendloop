import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { canonicalize, signMessage } from "./lib/hmac";

const MAX_ATTEMPTS = 5;

/**
 * Signed delivery to the n8n request-notification webhook.
 * Retries with capped exponential backoff. After MAX_ATTEMPTS the event is
 * marked failed, surfaced in the admin automation panel, and the admin gets an
 * in-app notification. It never fails silently.
 */
export const deliverRequestEvent = internalAction({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, { eventId }) => {
    const bundle = await ctx.runQuery(internal.events.getForDelivery, { eventId });
    if (!bundle) return;
    if (bundle.event.status === "sent") return;

    const url = process.env.N8N_REQUEST_WEBHOOK_URL;
    const secret = process.env.OUTBOUND_SECRET;
    const attempts = bundle.event.attempts + 1;

    if (!url || !secret) {
      await ctx.runMutation(internal.events.markDelivery, {
        eventId,
        ok: false,
        attempts,
        error: "N8N_REQUEST_WEBHOOK_URL or OUTBOUND_SECRET is not configured.",
      });
      return;
    }

    const timestamp = Date.now();
    const body = canonicalize(bundle.payload);
    const signature = await signMessage(secret, timestamp, body);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "LendLoop-Automation/1.0",
          "x-lendloop-timestamp": String(timestamp),
          "x-lendloop-signature": signature,
          "x-lendloop-event-id": String(eventId),
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`n8n webhook responded ${response.status}`);
      }

      const deliveryId = response.headers.get("x-lendloop-delivery-id") ?? undefined;
      await ctx.runMutation(internal.events.markDelivery, {
        eventId,
        ok: true,
        attempts,
        externalId: deliveryId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempts < MAX_ATTEMPTS) {
        await ctx.runMutation(internal.events.markRetry, {
          eventId,
          attempts,
          error: message,
        });
        const delayMs = Math.min(60_000, 2 ** attempts * 1_000);
        await ctx.scheduler.runAfter(delayMs, internal.delivery.deliverRequestEvent, {
          eventId,
        });
      } else {
        await ctx.runMutation(internal.events.markDelivery, {
          eventId,
          ok: false,
          attempts,
          error: message,
        });
      }
    }
  },
});
