import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL ?? "lendloop.demo+clerk_test@example.com";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(25_000);

const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

try {
  console.log("public board...");
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.locator("#tools article").first().waitFor({ timeout: 25_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/01-public.png`, fullPage: true });

  console.log("signing in as", email);
  await page.goto(`${base}/sign-in`, { waitUntil: "load" });
  const emailInput = page.locator('input[name="identifier"], input[type="email"]').first();
  await emailInput.waitFor();
  await emailInput.fill(email);
  await emailInput.press("Enter");

  const codeInput = page.locator('input[name="code"], input[inputmode="numeric"]').first();
  await codeInput.waitFor({ timeout: 25_000 });
  await codeInput.fill("424242");
  await codeInput.press("Enter");

  await page.waitForURL("**/browse", { timeout: 40_000 });
  await page.getByRole("heading", { name: /borrow from your neighbourhood/i }).waitFor();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/02-browse.png`, fullPage: true });

  const requestButton = page.getByRole("button", { name: /request dates/i }).first();
  if (await requestButton.count()) {
    await requestButton.click();
    await page.getByRole("dialog").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/07-request.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  console.log("my listings...");
  await page.goto(`${base}/my-listings`, { waitUntil: "load" });
  await page.getByRole("heading", { name: /^my listings$/i }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(600);
  const demoButton = page.getByRole("button", { name: /add demo listings/i });
  if (await demoButton.count()) {
    await demoButton.first().click();
    await page.getByText("Demo listings added").waitFor({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${out}/03-my-listings.png`, fullPage: true });

  console.log("incoming...");
  await page.goto(`${base}/incoming`, { waitUntil: "load" });
  await page.getByRole("heading", { name: /^incoming requests$/i }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/04-incoming.png`, fullPage: true });

  const approve = page.getByRole("button", { name: /^approve$/i }).first();
  if (await approve.count()) {
    await approve.click();
    await page.getByText("Request approved").waitFor({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/04b-approved.png`, fullPage: true });
  }

  console.log("admin...");
  await page.goto(`${base}/admin`, { waitUntil: "load" });
  await page.getByRole("heading", { name: /^control room$/i }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/05-admin.png`, fullPage: true });

  const automationTab = page.getByRole("button", { name: /^automation$/i });
  if (await automationTab.count()) {
    await automationTab.first().click();
    await page.waitForTimeout(800);
    const retry = page.getByRole("button", { name: /^retry$/i }).first();
    if (await retry.count()) {
      await retry.click();
      await page.getByText("Delivery re-queued").waitFor({ timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: `${out}/06-automation.png`, fullPage: true });
  }

  console.log("screenshots written to", out);
  if (errors.length) {
    console.log("browser errors:");
    for (const error of errors) console.log(" -", error);
  } else {
    console.log("no browser errors");
  }
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  console.error("E2E FAILED:", error.message);
  console.error("current url:", page.url());
  const text = await page.locator("body").innerText().catch(() => "");
  console.error(text.slice(0, 1500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
