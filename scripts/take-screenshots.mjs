import { chromium } from "playwright";
import { join } from "path";

const BASE = "http://localhost:3000";
const OUT = join(import.meta.dirname, "..", "public", "screenshots");

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "agents", path: "/agents" },
  { name: "hierarchy", path: "/hierarchy" },
  { name: "goals", path: "/goals" },
  { name: "budgets", path: "/budgets" },
  { name: "approvals", path: "/approvals" },
  { name: "heartbeats", path: "/heartbeats" },
  { name: "ab-tests", path: "/ab-tests" },
  { name: "runs", path: "/runs" },
  { name: "team-chat", path: "/team-chat" },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  // Set workspace cookie
  await context.addCookies([
    {
      name: "workspace-id",
      value: "00000000-0000-0000-0000-000000000010",
      domain: "localhost",
      path: "/",
    },
  ]);

  for (const { name, path } of PAGES) {
    const page = await context.newPage();
    console.log(`📸 Capturing ${name}...`);
    try {
      await page.goto(`${BASE}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      // Wait for content to render
      await page.waitForTimeout(5000);
      await page.screenshot({
        path: join(OUT, `${name}.png`),
        fullPage: false,
      });
      console.log(`   ✓ ${name}.png saved`);
    } catch (e) {
      console.log(`   ✗ ${name} failed: ${e.message}`);
    }
    await page.close();
  }

  await browser.close();
  console.log("\nDone! Screenshots in public/screenshots/");
}

run();
