/**
 * Seed dev user + workspace for local development
 * Run: node scripts/seed-dev.mjs
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.POSTGRES_URL);
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";

async function seed() {
  console.log("Seeding dev user and workspace...");

  // 1. Create dev user
  await sql`
    INSERT INTO users (id, name, email, created_at)
    VALUES (${DEV_USER_ID}, 'Dev User', 'dev@cohortis.ai', NOW())
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("✓ Dev user created");

  // 2. Create dev workspace
  await sql`
    INSERT INTO workspaces (id, name, slug, owner_id, plan, created_at, updated_at)
    VALUES (${DEV_WORKSPACE_ID}, 'Cohortis Demo', 'cohortis-demo', ${DEV_USER_ID}, 'team', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("✓ Dev workspace created");

  // 3. Add user as workspace owner
  await sql`
    INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
    VALUES (${DEV_WORKSPACE_ID}, ${DEV_USER_ID}, 'owner', NOW())
    ON CONFLICT (workspace_id, user_id) DO NOTHING
  `;
  console.log("✓ Dev user added to workspace as owner");

  console.log("\nDone! Workspace ID:", DEV_WORKSPACE_ID);
  console.log("Set cookie 'cohortis_workspace_id' to this value in browser dev tools.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
