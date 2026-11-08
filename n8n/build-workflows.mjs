#!/usr/bin/env node
/**
 * Generates the importable n8n workflow JSON in ./workflows.
 * Keeping the source here avoids hand-editing minified JSON and makes the
 * signing contract reviewable next to the Convex implementation.
 *
 * Run: node n8n/build-workflows.mjs
 *
 * Secrets are NEVER baked in. Workflows read them from n8n environment
 * variables (LENDLOOP_OUTBOUND_SECRET, LENDLOOP_INBOUND_SECRET,
 * LENDLOOP_CONVEX_SITE_URL, LENDLOOP_MAIL_FROM).
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "workflows");
mkdirSync(outDir, { recursive: true });

const CANONICALIZER = `
function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(function (entry) { return entry === undefined ? null : sortValue(entry); });
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(function (key) {
      if (value[key] !== undefined) out[key] = sortValue(value[key]);
    });
    return out;
  }
  return value;
}
`.trim();

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({
  parameters,
  id: randomUUID(),
  name,
  type,
  typeVersion,
  position,
  ...extra,
});

const httpHeaders = [
  { name: "x-lendloop-timestamp", value: "={{ $json.timestamp }}" },
  { name: "x-lendloop-signature", value: "={{ $json.signature }}" },
];

const signedPost = (name, position, urlExpression) =>
  node(
    name,
    "n8n-nodes-base.httpRequest",
    4.2,
    position,
    {
      method: "POST",
      url: urlExpression,
      sendHeaders: true,
      headerParameters: { parameters: httpHeaders },
      sendBody: true,
      contentType: "raw",
      rawContentType: "application/json",
      body: "={{ $json.bodyString }}",
      options: { timeout: 10000 },
    },
    { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 },
  );

const emailNode = (name, position) =>
  node(
    name,
    "n8n-nodes-base.emailSend",
    2.1,
    position,
    {
      fromEmail: "={{ $env.LENDLOOP_MAIL_FROM }}",
      toEmail: "={{ $json.to }}",
      subject: "={{ $json.subject }}",
      emailFormat: "html",
      html: "={{ $json.html }}",
      options: {},
    },
    {
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
      // Reference only — the credential (and its secrets) lives in n8n.
      credentials: {
        smtp: { id: "LendLoopMailpit1", name: "LendLoop SMTP (Mailpit)" },
      },
    },
  );

const respondNode = (name, position, code, body) =>
  node(name, "n8n-nodes-base.respondToWebhook", 1.1, position, {
    respondWith: "text",
    responseBody: body,
    options: { responseCode: code },
  });

const sticky = (position, width, height, content) =>
  node(
    "Read me",
    "n8n-nodes-base.stickyNote",
    1,
    position,
    { width, height, color: 4, content },
  );

/* -------------------------------------------------------------------------- */
/* Workflow 1 — request notifications (Convex -> n8n)                          */
/* -------------------------------------------------------------------------- */

const verifySignature = `${CANONICALIZER}

const crypto = require('crypto');
const item = $input.first().json;
const body = item.body || {};
const headers = item.headers || {};
const timestamp = headers['x-lendloop-timestamp'];
const signature = String(headers['x-lendloop-signature'] || '').toLowerCase();
const canonical = JSON.stringify(sortValue(body));
const expected = crypto
  .createHmac('sha256', $env.LENDLOOP_OUTBOUND_SECRET)
  .update(String(timestamp) + '.' + canonical)
  .digest('hex');
const fresh = Boolean(timestamp) && Math.abs(Date.now() - Number(timestamp)) < 300000;
let valid = false;
try {
  valid = fresh && expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
} catch (error) {
  valid = false;
}

if (!valid) {
  return [{ json: { valid: false, status: 401, error: 'invalid_signature' } }];
}

return [{
  json: {
    valid: true,
    status: 202,
    body: body,
    eventId: headers['x-lendloop-event-id'] || body.eventId || null
  }
}];`;

const composeRequestEmail = `const body = $('Verify signature').item.json.body;
const eventId = $('Verify signature').item.json.eventId;
const kind = body.eventKind || 'request.created';

const subjects = {
  'request.created': 'New borrow request',
  'request.approved': 'Request approved',
  'request.declined': 'Request declined',
  'request.cancelled': 'Request cancelled',
  'request.returned': 'Tool returned'
};

const messages = {
  'request.created': body.counterpartFirstName + ' would like to borrow your ' + body.toolName + ' (' + body.dateRange + '). Open LendLoop to approve or decline.',
  'request.approved': body.counterpartFirstName + ' approved your loan of ' + body.toolName + ' (' + body.dateRange + ').',
  'request.declined': body.counterpartFirstName + ' declined your request for ' + body.toolName + '.',
  'request.cancelled': body.counterpartFirstName + ' cancelled their request for ' + body.toolName + '.',
  'request.returned': body.counterpartFirstName + ' marked ' + body.toolName + ' as returned. Thank you.'
};

const subject = (subjects[kind] || 'LendLoop update') + ': ' + body.toolName;
const message = messages[kind] || ('There is an update on ' + body.toolName + '.');
const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1712;line-height:1.6">' +
  '<h2 style="margin:0 0 12px">' + subject + '</h2>' +
  '<p style="margin:0 0 16px">Hi ' + body.recipient.firstName + ',</p>' +
  '<p style="margin:0 0 16px">' + message + '</p>' +
  '<p style="margin:0 0 24px"><a href="' + body.actionUrl + '" style="background:#1a1712;color:#fffcf6;padding:10px 18px;border-radius:8px;text-decoration:none">Open LendLoop</a></p>' +
  '<p style="margin:0;color:#8b8272;font-size:12px">LendLoop &middot; neighbourhood tool library</p>' +
  '</div>';

return [{
  json: {
    to: body.recipient.email,
    subject: subject,
    html: html,
    eventId: eventId,
    kind: kind
  }
}];`;

const signNotificationResult = `${CANONICALIZER}

const crypto = require('crypto');
const composed = $('Compose message').item.json;
const email = $input.first().json;
const payload = {
  eventId: composed.eventId,
  outcome: 'delivered',
  providerMessageId: email.messageId || undefined
};
const canonical = JSON.stringify(sortValue(payload));
const timestamp = Date.now();
const signature = crypto
  .createHmac('sha256', $env.LENDLOOP_INBOUND_SECRET)
  .update(String(timestamp) + '.' + canonical)
  .digest('hex');

return [{
  json: {
    bodyString: canonical,
    timestamp: timestamp,
    signature: signature,
    url: $env.LENDLOOP_CONVEX_SITE_URL + '/automation/notification-result'
  }
}];`;

const requestNotification = {
  id: "LendLoopRequest1",
  name: "LendLoop — Request notifications",
  nodes: [
    sticky([-460, -260], 380, 260, `## Request notifications

Convex signs the payload with **LENDLOOP_OUTBOUND_SECRET**; this workflow verifies it before doing anything.

Required n8n environment variables:
- LENDLOOP_OUTBOUND_SECRET
- LENDLOOP_INBOUND_SECRET
- LENDLOOP_CONVEX_SITE_URL
- LENDLOOP_MAIL_FROM

Select an SMTP credential on **Send email** (Mailpit locally, Resend in production).`),
    node(
      "Webhook",
      "n8n-nodes-base.webhook",
      2,
      [0, 0],
      {
        httpMethod: "POST",
        path: "lendloop/request-event",
        responseMode: "responseNode",
        options: {},
      },
      { webhookId: randomUUID() },
    ),
    node("Verify signature", "n8n-nodes-base.code", 2, [220, 0], {
      jsCode: verifySignature,
    }),
    node(
      "Signature valid?",
      "n8n-nodes-base.if",
      2.2,
      [440, 0],
      {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "loose",
            version: 2,
          },
          conditions: [
            {
              id: "is-valid",
              leftValue: "={{ $json.valid }}",
              rightValue: true,
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    ),
    respondNode("Accepted", [660, -100], 202, "accepted"),
    node("Compose message", "n8n-nodes-base.code", 2, [880, -100], {
      jsCode: composeRequestEmail,
    }),
    emailNode("Send email", [1100, -100]),
    node("Sign write-back", "n8n-nodes-base.code", 2, [1320, -100], {
      jsCode: signNotificationResult,
    }),
    signedPost("Confirm delivery", [1540, -100], "={{ $json.url }}"),
    respondNode("Unauthorized", [660, 120], 401, "unauthorized"),
  ],
  connections: {
    Webhook: { main: [[{ node: "Verify signature", type: "main", index: 0 }]] },
    "Verify signature": {
      main: [[{ node: "Signature valid?", type: "main", index: 0 }]],
    },
    "Signature valid?": {
      main: [
        [{ node: "Accepted", type: "main", index: 0 }],
        [{ node: "Unauthorized", type: "main", index: 0 }],
      ],
    },
    Accepted: { main: [[{ node: "Compose message", type: "main", index: 0 }]] },
    "Compose message": { main: [[{ node: "Send email", type: "main", index: 0 }]] },
    "Send email": { main: [[{ node: "Sign write-back", type: "main", index: 0 }]] },
    "Sign write-back": {
      main: [[{ node: "Confirm delivery", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    timezone: "UTC",
    errorWorkflow: "LendLoopErrors01",
  },
  pinData: {},
  active: false,
};

/* -------------------------------------------------------------------------- */
/* Workflow 2 — daily overdue reminders (n8n -> Convex -> n8n)                 */
/* -------------------------------------------------------------------------- */

const signOverdueRequest = `${CANONICALIZER}

const crypto = require('crypto');
const timestamp = Date.now();
const message = 'GET /automation/overdue';
const signature = crypto
  .createHmac('sha256', $env.LENDLOOP_INBOUND_SECRET)
  .update(String(timestamp) + '.' + message)
  .digest('hex');

return [{
  json: {
    url: $env.LENDLOOP_CONVEX_SITE_URL + '/automation/overdue',
    timestamp: timestamp,
    signature: signature
  }
}];`;

const expandLoans = `const data = $input.first().json;
const loans = Array.isArray(data.loans) ? data.loans : [];
return loans.map(function (loan) {
  return { json: Object.assign({}, loan, { day: data.day }) };
});`;

const composeReminder = `const loan = $input.first().json;
const days = loan.daysOverdue;
const subject = 'Overdue: ' + loan.toolName + ' (' + days + ' day' + (days === 1 ? '' : 's') + ')';
const due = String(loan.dueDate).slice(0, 10);
const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1712;line-height:1.6">' +
  '<h2 style="margin:0 0 12px">' + subject + '</h2>' +
  '<p style="margin:0 0 16px">Hi ' + loan.borrowerFirstName + ',</p>' +
  '<p style="margin:0 0 16px">The <strong>' + loan.toolName + '</strong> you borrowed from ' + loan.lenderFirstName +
  ' was due back on ' + due + ' and is now ' + days + ' day' + (days === 1 ? '' : 's') + ' overdue.</p>' +
  '<p style="margin:0 0 16px">Please arrange its return, or reply to your lender if you need a little longer.</p>' +
  '<p style="margin:0;color:#8b8272;font-size:12px">LendLoop &middot; neighbourhood tool library</p>' +
  '</div>';

return [{
  json: {
    to: loan.borrowerEmail,
    subject: subject,
    html: html,
    loanId: loan.loanId,
    day: loan.day
  }
}];`;

const signReminderResult = `${CANONICALIZER}

const crypto = require('crypto');
const composed = $('Compose reminder').item.json;
const email = $input.first().json;
const payload = {
  loanId: composed.loanId,
  day: composed.day,
  outcome: 'sent',
  providerMessageId: email.messageId || undefined
};
const canonical = JSON.stringify(sortValue(payload));
const timestamp = Date.now();
const signature = crypto
  .createHmac('sha256', $env.LENDLOOP_INBOUND_SECRET)
  .update(String(timestamp) + '.' + canonical)
  .digest('hex');

return [{
  json: {
    bodyString: canonical,
    timestamp: timestamp,
    signature: signature,
    url: $env.LENDLOOP_CONVEX_SITE_URL + '/automation/reminder-result'
  }
}];`;

const overdueWorkflow = {
  id: "LendLoopOverdue1",
  name: "LendLoop — Overdue reminders",
  nodes: [
    sticky([-460, -280], 380, 280, `## Daily overdue reminders

Runs at **09:00 UTC**. Fetches overdue loans from Convex with a signed GET, sends one email per borrower, then writes the result back.

Write-back is idempotent by \`reminder:{loanId}:{YYYY-MM-DD}\`, so retries cannot duplicate a reminder.

Environment: LENDLOOP_INBOUND_SECRET, LENDLOOP_CONVEX_SITE_URL, LENDLOOP_MAIL_FROM.
Select the SMTP credential on **Send reminder**.`),
    node("Daily 09:00", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 0], {
      rule: { interval: [{ field: "cronExpression", expression: "0 9 * * *" }] },
    }),
    node("Manual run", "n8n-nodes-base.manualTrigger", 1, [0, 180], {}),
    node("Sign request", "n8n-nodes-base.code", 2, [220, 0], {
      jsCode: signOverdueRequest,
    }),
    node(
      "Fetch overdue loans",
      "n8n-nodes-base.httpRequest",
      4.2,
      [440, 0],
      {
        method: "GET",
        url: "={{ $json.url }}",
        sendHeaders: true,
        headerParameters: { parameters: httpHeaders },
        options: { timeout: 10000 },
      },
      { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 },
    ),
    node("Expand loans", "n8n-nodes-base.code", 2, [660, 0], {
      jsCode: expandLoans,
    }),
    node("Compose reminder", "n8n-nodes-base.code", 2, [880, 0], {
      jsCode: composeReminder,
    }),
    emailNode("Send reminder", [1100, 0]),
    node("Sign reminder result", "n8n-nodes-base.code", 2, [1320, 0], {
      jsCode: signReminderResult,
    }),
    signedPost("Record reminder", [1540, 0], "={{ $json.url }}"),
  ],
  connections: {
    "Daily 09:00": { main: [[{ node: "Sign request", type: "main", index: 0 }]] },
    "Manual run": { main: [[{ node: "Sign request", type: "main", index: 0 }]] },
    "Sign request": {
      main: [[{ node: "Fetch overdue loans", type: "main", index: 0 }]],
    },
    "Fetch overdue loans": {
      main: [[{ node: "Expand loans", type: "main", index: 0 }]],
    },
    "Expand loans": { main: [[{ node: "Compose reminder", type: "main", index: 0 }]] },
    "Compose reminder": { main: [[{ node: "Send reminder", type: "main", index: 0 }]] },
    "Send reminder": {
      main: [[{ node: "Sign reminder result", type: "main", index: 0 }]],
    },
    "Sign reminder result": {
      main: [[{ node: "Record reminder", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    timezone: "UTC",
    errorWorkflow: "LendLoopErrors01",
  },
  pinData: {},
  active: false,
};

/* -------------------------------------------------------------------------- */
/* Workflow 3 — error handler                                                   */
/* -------------------------------------------------------------------------- */

const buildErrorPayload = `const data = $input.first().json;
const workflowName = (data.workflow && data.workflow.name) || 'LendLoop workflow';
const executionId = String((data.execution && data.execution.id) || Date.now());
const message =
  (data.execution && data.execution.error && data.execution.error.message) ||
  (data.error && data.error.message) ||
  'Unknown workflow error';
const requestId =
  (data.execution && data.execution.error && data.execution.error.requestId) || undefined;

return [{
  json: {
    workflow: workflowName,
    executionId: executionId,
    message: message,
    requestId: requestId
  }
}];`;

const signWorkflowError = `${CANONICALIZER}

const crypto = require('crypto');
const error = $input.first().json;
const payload = {
  workflow: error.workflow,
  executionId: error.executionId,
  message: error.message,
  requestId: error.requestId
};
const canonical = JSON.stringify(sortValue(payload));
const timestamp = Date.now();
const signature = crypto
  .createHmac('sha256', $env.LENDLOOP_INBOUND_SECRET)
  .update(String(timestamp) + '.' + canonical)
  .digest('hex');

return [{
  json: {
    bodyString: canonical,
    timestamp: timestamp,
    signature: signature,
    url: $env.LENDLOOP_CONVEX_SITE_URL + '/automation/workflow-error'
  }
}];`;

const errorWorkflow = {
  id: "LendLoopErrors01",
  name: "LendLoop — Automation errors",
  nodes: [
    sticky([-420, -240], 380, 240, `## Automation error handler

Set this workflow as the **Error Workflow** on both LendLoop workflows (Settings → Error Workflow). Failed runs are written to Convex and raise an in-app notification for admins, so nothing fails silently.`),
    node("Error trigger", "n8n-nodes-base.errorTrigger", 1, [0, 0], {}),
    node("Build error payload", "n8n-nodes-base.code", 2, [220, 0], {
      jsCode: buildErrorPayload,
    }),
    node("Sign error", "n8n-nodes-base.code", 2, [440, 0], {
      jsCode: signWorkflowError,
    }),
    signedPost("Record workflow error", [660, 0], "={{ $json.url }}"),
  ],
  connections: {
    "Error trigger": {
      main: [[{ node: "Build error payload", type: "main", index: 0 }]],
    },
    "Build error payload": {
      main: [[{ node: "Sign error", type: "main", index: 0 }]],
    },
    "Sign error": {
      main: [[{ node: "Record workflow error", type: "main", index: 0 }]],
    },
  },
  settings: { executionOrder: "v1", timezone: "UTC" },
  pinData: {},
  active: false,
};

const files = [
  ["01-request-notification.json", requestNotification],
  ["02-overdue-reminders.json", overdueWorkflow],
  ["03-error-handler.json", errorWorkflow],
];

for (const [file, workflow] of files) {
  writeFileSync(join(outDir, file), JSON.stringify(workflow, null, 2) + "\n", "utf8");
  console.log(`wrote n8n/workflows/${file}`);
}
