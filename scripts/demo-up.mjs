#!/usr/bin/env node
/**
 * Prepares the local LendLoop demo:
 *   1. starts n8n + Postgres + Mailpit,
 *   2. waits for n8n,
 *   3. starts a fresh Cloudflare quick tunnel,
 *   4. points Convex's N8N_REQUEST_WEBHOOK_URL at the new public URL,
 *   5. verifies the webhook rejects unsigned requests.
 *
 * Usage: npm run demo:up
 * Requires: Docker running, `npx convex` logged in, .env.n8n present.
 */
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = join(root, ".env.n8n");
const compose = `docker compose --env-file "${envFile}"`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function run(command, options = {}) {
  return execSync(command, {
    cwd: root,
    stdio: options.quiet ? "pipe" : "inherit",
    encoding: "utf8",
  });
}

function tryRun(command) {
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: "utf8",
  });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

async function statusOf(url, init) {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
    await response.text().catch(() => "");
    return response.status;
  } catch {
    return 0;
  }
}

async function waitForN8n(timeoutMs = 150_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if ((await statusOf("http://localhost:5678/healthz")) === 200) return;
    await sleep(2000);
  }
  fail("n8n did not become healthy. Run: docker compose --env-file .env.n8n logs n8n");
}

async function waitForTunnelUrl(timeoutMs = 40_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const logs = tryRun("docker logs lendloop-tunnel");
    const match = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) return match[0];
    await sleep(1000);
  }
  fail("Could not read the tunnel URL. Run: docker logs lendloop-tunnel");
}

async function waitForWebhook(hook, timeoutMs = 45_000) {
  const started = Date.now();
  let lastStatus = 0;
  while (Date.now() - started < timeoutMs) {
    lastStatus = await statusOf(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventKind: "probe" }),
    });
    if (lastStatus === 401) return;
    await sleep(2000);
  }
  fail(
    `The webhook is not answering with 401 (last status: ${lastStatus}).\n` +
      "Make sure the request workflow is active:\n" +
      "  docker exec lendloop-n8n-1 n8n update:workflow --id=LendLoopRequest1 --active=true\n" +
      "  docker restart lendloop-n8n-1",
  );
}

function networkName() {
  try {
    const names = execFileSync(
      "docker",
      ["network", "ls", "--filter", "name=lendloop", "--format", "{{.Name}}"],
      { encoding: "utf8" },
    )
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    return names.find((name) => name.endsWith("_default")) ?? "lendloop_default";
  } catch {
    return "lendloop_default";
  }
}

console.log("\nLendLoop demo setup\n");

if (!existsSync(envFile)) {
  fail(
    "Missing .env.n8n. Copy .env.n8n.example to .env.n8n and fill in the secrets first.",
  );
}

try {
  execFileSync("docker", ["info"], { stdio: "ignore" });
} catch {
  fail("Docker is not running. Start Docker Desktop and try again.");
}

console.log("- Starting n8n, Postgres and Mailpit...");
run(`${compose} up -d`);

console.log("- Waiting for n8n...");
await waitForN8n();
console.log("  n8n is healthy.");

console.log("- Opening a fresh public tunnel...");
tryRun("docker rm -f lendloop-tunnel");
const network = networkName();
run(
  `docker run -d --name lendloop-tunnel --network ${network} ` +
    "cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://n8n:5678",
);

const tunnelUrl = await waitForTunnelUrl();
const hook = `${tunnelUrl}/webhook/lendloop/request-event`;
console.log(`  ${tunnelUrl}`);

console.log("- Verifying the signed webhook...");
await waitForWebhook(hook);

console.log("- Updating Convex N8N_REQUEST_WEBHOOK_URL...");
try {
  run(`npx convex env set N8N_REQUEST_WEBHOOK_URL "${hook}"`);
} catch {
  fail(
    "Could not update Convex. Make sure `npx convex login` has been run in this project.",
  );
}

console.log(`
✔ Demo stack ready.

  App        http://localhost:3000
  Mailpit    http://localhost:8025
  n8n        http://localhost:5678   (owner login is in .env.n8n)
  Webhook    ${hook}

  Demo inboxes
  https://yopmail.com/en/?lendloop.amara
  https://yopmail.com/en/?lendloop.tobi
  https://yopmail.com/en/?lendloop.ngozi

Next:
  npx convex dev --start "npm run dev"
`);
