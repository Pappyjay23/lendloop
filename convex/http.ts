import { httpRouter } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { dayKey } from "./lib/dates";
import { canonicalize, verifyMessage } from "./lib/hmac";

const http = httpRouter();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function rejectIfUnsigned(request: Request, message: string): Promise<Response | null> {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) {
    return json({ error: "server_misconfigured" }, 500);
  }
  const result = await verifyMessage(
    secret,
    request.headers.get("x-lendloop-timestamp"),
    request.headers.get("x-lendloop-signature"),
    message,
  );
  if (!result.ok) {
    return json({ error: "unauthorized", reason: result.reason }, 401);
  }
  return null;
}

async function readSignedBody(
  request: Request,
): Promise<{ payload: Record<string, unknown> } | { response: Response }> {
  const raw = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { response: json({ error: "invalid_json" }, 400) };
  }
  if (!isRecord(parsed)) {
    return { response: json({ error: "invalid_payload" }, 400) };
  }
  const rejected = await rejectIfUnsigned(request, canonicalize(parsed));
  if (rejected) return { response: rejected };
  return { payload: parsed };
}

const overdue = httpAction(async (ctx, request) => {
  const rejected = await rejectIfUnsigned(request, "GET /automation/overdue");
  if (rejected) return rejected;

  const now = Date.now();
  const loans = await ctx.runQuery(internal.requests.overdueForAutomation, { now });
  return json({
    generatedAt: new Date(now).toISOString(),
    day: dayKey(now),
    count: loans.length,
    loans,
  });
});

const reminderResult = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if ("response" in body) return body.response;
  const payload = body.payload;

  const { loanId, day, outcome, providerMessageId, error } = payload;
  if (
    typeof loanId !== "string" ||
    typeof day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    (outcome !== "sent" && outcome !== "failed") ||
    (providerMessageId !== undefined && typeof providerMessageId !== "string") ||
    (error !== undefined && typeof error !== "string")
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  try {
    const result = await ctx.runMutation(internal.events.recordReminderResult, {
      loanId: loanId as Id<"requests">,
      day,
      outcome,
      providerMessageId,
      error,
    });
    return json(result, result.ok ? 200 : 404);
  } catch {
    return json({ error: "invalid_loan_id" }, 400);
  }
});

const notificationResult = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if ("response" in body) return body.response;
  const payload = body.payload;

  const { eventId, outcome, providerMessageId, error } = payload;
  if (
    typeof eventId !== "string" ||
    (outcome !== "delivered" && outcome !== "failed") ||
    (providerMessageId !== undefined && typeof providerMessageId !== "string") ||
    (error !== undefined && typeof error !== "string")
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  try {
    const result = await ctx.runMutation(internal.events.recordNotificationResult, {
      eventId: eventId as Id<"automationEvents">,
      outcome,
      providerMessageId,
      error,
    });
    return json(result, result.ok ? 200 : 404);
  } catch {
    return json({ error: "invalid_event_id" }, 400);
  }
});

const workflowError = httpAction(async (ctx, request) => {
  const body = await readSignedBody(request);
  if ("response" in body) return body.response;
  const payload = body.payload;

  const { workflow, executionId, message, requestId } = payload;
  if (
    typeof workflow !== "string" ||
    typeof executionId !== "string" ||
    typeof message !== "string" ||
    (requestId !== undefined && typeof requestId !== "string")
  ) {
    return json({ error: "invalid_payload" }, 400);
  }

  try {
    const result = await ctx.runMutation(internal.events.recordWorkflowError, {
      workflow,
      executionId,
      message,
      requestId: requestId as Id<"requests"> | undefined,
    });
    return json(result);
  } catch {
    return json({ error: "invalid_request_id" }, 400);
  }
});

http.route({ path: "/automation/overdue", method: "GET", handler: overdue });
http.route({ path: "/automation/reminder-result", method: "POST", handler: reminderResult });
http.route({
  path: "/automation/notification-result",
  method: "POST",
  handler: notificationResult,
});
http.route({ path: "/automation/workflow-error", method: "POST", handler: workflowError });

export default http;
