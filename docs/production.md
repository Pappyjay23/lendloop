# What I would change to run LendLoop in production

This is a deliberate list, not a disclaimer. The current build makes specific trade-offs to stay reviewable in a day; below is how each one evolves.

## Authentication and authorisation

- **Promote Clerk to a production instance** with a custom domain, MFA policy, bot protection, and breached-password detection (`clerk security` is a useful audit).
- **Replace `ADMIN_EMAILS` bootstrap** with an invitation flow and an admin role stored in an auditable table. Keep the rule that Convex is the source of truth; do not grant roles from client-settable metadata.
- **Add session revocation and device review** for admins.
- **Add rate limiting** to request creation and listing writes (Convex rate-limiter component or a per-user token bucket in a mutation). Today there is only input validation.
- **Extend the audit log** to cover every privileged mutation, with retention and export.

## Data and privacy

- Define retention: how long loan history, activity, and automation events are kept, and what is deleted with an account.
- Add **account deletion and data export** flows that respect referential integrity (anonymise the user, keep the loan record).
- **Encrypt sensitive columns at rest** if the product later adds addresses or phone numbers. Today the schema intentionally avoids them.
- Move from `ADMIN_EMAILS` and email-first identity to user preferences with explicit notification consent.
- Add **moderation tooling** for listings (reports, takedowns, appeal notes) and a content policy.
- Add **image uploads** with signed URLs, size/type validation, and CDN transforms — deliberately omitted from v1.
- Add a **data-processing register** and DPIA if this becomes a real neighbourhood product.

## Automation reliability

- **HMAC key rotation**: add a key id (`X-LendLoop-Key-Id`) and support two active secrets during rotation. Today there is one secret per direction.
- **Replay cache**: the 5-minute timestamp window is good; a Redis/Convex replay table would make replay detection explicit for high-value endpoints.
- **Dead-letter queue**: the outbox currently caps retries at 5 and marks the event failed. Production should route terminal failures to a DLQ with an operator UI and replay button.
- **Backoff with jitter** and a circuit breaker when n8n is unavailable, so a prolonged outage does not create retry storms.
- **Per-user timezones and quiet hours** for reminders; today everything runs at 09:00 UTC.
- **Batch/digest reminders** for users with many overdue loans, and a preference to opt out of email while keeping in-app notifications.
- **Provider-level delivery tracking**: handle Resend bounces and complaints, suppress bad addresses, and surface them on the loan.
- **Two-way confirmation**: let the borrower confirm return, with the lender acknowledging. Today either party can mark returned.

## n8n operations

- Move from a single Docker host to **n8n with external task runners**, a managed Postgres, and backups.
- Turn on **execution data pruning**, error workflow alerting to Slack/PagerDuty, and an on-call runbook.
- Keep workflow JSON in git (as here) and deploy it through CI rather than manual import. Use environment-specific credentials.
- Store secrets in a secret manager and inject them as environment variables at runtime. Do not rely on `.env` files on servers.
- Add **workflow-level tests** against a staging Convex deployment, including signature failure and retry paths.

## Infrastructure and delivery

- Separate **dev / staging / production** Convex deployments. Use `npx convex deploy` in CI with a deploy key and preview deployments per pull request.
- Build a **staging environment** with a dedicated Clerk instance and an n8n staging workflow set.
- Add **backups and restore drills** for Convex and n8n Postgres.
- Add a **status page** and uptime checks for the web app, Convex HTTP actions, and n8n.
- Put the app behind a WAF/CDN with sensible rate limits.
- Add **structured logs and tracing** (OpenTelemetry) across the Next.js server, Convex functions, and n8n execution ids. Correlate with `eventId`.

## Observability and quality

- Add **Sentry** (or equivalent) to the Next.js app and Convex actions.
- Alert on: failed automation events, reminder delivery failures, overdue counts growing unexpectedly, and 5xx rates on `/automation/*`.
- Add **end-to-end tests** (Playwright) for the request → approve → remind → return journey against a seeded staging deployment.
- Add property-based tests for date overlap and idempotency, and contract tests for the signed payload shape.
- Track product metrics: listings created, request approval rate, time-to-first-request, overdue rate, reminder effectiveness.

## Product and scale

- Add a **waitlist** for tools that are on loan, and auto-notify when they become available.
- Add **reputation** beyond a binary trusted flag (completed loans, response time, cancellations).
- Add **messaging** or structured pickup coordination instead of free-text notes.
- Add a **PWA/mobile shell** and push notifications.
- Add **search** (Convex search index) as the catalogue grows; today it is a bounded client-side filter.
- Add **soft-delete and restore** for listings, which is currently archive-only.
- Add **multi-neighbourhood scoping** with a location model. Today the board is global.

## Known limitations in this submission

- UTC-only dates and a single 09:00 UTC reminder run.
- The local n8n path needs a tunnel because Convex Cloud cannot reach `localhost`.
- Exported workflows reference the local Mailpit credential id; importing elsewhere requires re-selecting a credential.
- The quick tunnel used for local end-to-end testing has a rotating URL.
- No image uploads, chat, or payment handling (none were required).
