# LendLoop demo guide

This is the 10-minute path through the product, plus the checks that prove the automation and security work. It is written for a reviewer who wants to run it locally.

## Prerequisites

- Node.js 22+
- Docker Desktop
- `npx convex` already authenticated for this project
- `.env.local` and `.env.n8n` present (see the README)

## 1. Start the stack

```bash
npm run demo:up
```

This starts n8n, Postgres, and Mailpit, opens a public tunnel for Convex to reach n8n, updates `N8N_REQUEST_WEBHOOK_URL` in the dev deployment, and verifies the webhook rejects unsigned calls.

Then start the app:

```bash
npx convex dev --start "npm run dev"
```

| Service | URL |
| --- | --- |
| App | http://localhost:3000 |
| Mailpit (all outbound email) | http://localhost:8025 |
| n8n | http://localhost:5678 |

Sign in with the email in `ADMIN_EMAILS` to access the admin control room.

> **Local inbox:** Mailpit is the only inbox. It captures every message and never forwards it to the internet, so **Yopmail does not receive anything during a local demo**. The Yopmail addresses are realistic recipient labels only; they become real inboxes solely if you swap the n8n SMTP credential to Resend for a hosted demo.

## 2. Public board (signed out)

1. Open http://localhost:3000.
2. Note that the board shows **tool name and category only**. Owner names, descriptions, and conditions are absent.

**Proof:** the public query (`convex/tools.ts:listPublic`) projects only `_id`, `name`, and `category`.

## 3. Sign in and list tools

1. Sign in with the admin email.
2. Open **My listings → Add demo listings**.
3. You now have three listings, one incoming request, and one overdue loan.

## 4. Request → approve → email

1. Open **Incoming requests** and approve the pending request.
2. In Mailpit (not Yopmail), confirm **Request approved: Bosch cordless drill**.
3. Open **Admin → Automation**. You should see:
   - `request.approved` — outbound — **sent**
   - `notification.delivered` — inbound — **received**

**Proof:** the business change and the outbox row commit together; n8n verifies the HMAC and writes a signed delivery receipt back.

## 5. Overdue reminder + idempotency

1. Open n8n → **LendLoop — Overdue reminders** → **Execute workflow**.
2. Mailpit receives **Overdue: DeWalt 20V drill (2 days)**.
3. In the app, open the loan activity. The reminder appears in the timeline.
4. Execute the workflow **again**.

**Expected:** no second email. The endpoint skips loans already reminded today, and `reminder:{loanId}:{date}` is unique.

## 6. Failure is visible and recoverable

1. Stop n8n: `docker compose --env-file .env.n8n stop n8n`.
2. Approve another request in the app.
3. Wait for the five delivery attempts to exhaust.
4. **Admin → Automation** shows a **failed** outbound event, and admins receive an in-app notification.
5. Start n8n again and click **Retry** on the failed row.
6. The email arrives and the event becomes **sent**. The retry is written to the audit log.

## 7. Security checks

| Check | Expected |
| --- | --- |
| `POST /automation/reminder-result` without headers | `401 Unauthorized` |
| `GET /automation/overdue` without a signature | `401 Unauthorized` |
| Sign in as a non-admin, visit `/admin` | "Admins only"; the backend query also rejects it |
| Public board as a signed-out visitor | No owner details |
| Inspect an n8n execution input | Only tool name/category, dates, first name, email, and IDs — no descriptions or addresses |
| Two overlapping approvals on one tool | The second is rejected with "Another approved loan already covers those dates." |

## 8. Automated confidence checks

```bash
npm run lint
npm run typecheck
npm test          # 19 unit tests
npm run build
npm run test:e2e  # browser walkthrough + screenshots (dev server must be running)
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `demo:up` cannot reach n8n | `docker compose --env-file .env.n8n logs n8n` |
| Webhook returns 404 | Activate the workflow: `docker exec lendloop-n8n-1 n8n update:workflow --id=LendLoopRequest1 --active=true`, then restart n8n |
| Mailpit is empty | Check **Admin → Automation** and the n8n execution list; the event will show `failed` with a reason |
| Email is in Mailpit but not Yopmail | Expected locally. Mailpit does not forward; Yopmail only receives mail when n8n uses Resend |
| Tunnel expired | Run `npm run demo:up` again; it refreshes the URL and Convex env var |
| Approval email failed | Start n8n, then use **Retry** in the automation panel |
| Clerk asks for a code | Use the email you control; development instances send a real code |

## Scope

This demo runs locally by design. A hosted deployment would use Vercel + Convex production + a publicly reachable n8n; see the Deploy section of the README and `docs/production.md`.
