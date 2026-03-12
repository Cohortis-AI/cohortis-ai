/**
 * End-to-end feature test script for Cohortis AI.
 *
 * Prerequisites:
 *   1. The app must be running (npm run dev / next dev)
 *   2. DISABLE_AUTH=true must be set in .env.local
 *   3. Dev seed must be applied: node scripts/seed-dev.mjs
 *
 * Run:  npx tsx scripts/test-features.ts
 *
 * Override the base URL with: BASE_URL=http://localhost:3001 npx tsx scripts/test-features.ts
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const DEV_WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let passed = 0;
let failed = 0;
let workspaceId = DEV_WORKSPACE_ID;

function log(msg: string) {
  console.log(msg);
}

function pass(label: string, detail?: string) {
  passed++;
  const extra = detail ? ` ${DIM}${detail}${RESET}` : "";
  log(`  ${GREEN}PASS${RESET} ${label}${extra}`);
}

function fail(label: string, detail?: string) {
  failed++;
  const extra = detail ? ` ${DIM}${detail}${RESET}` : "";
  log(`  ${RED}FAIL${RESET} ${label}${extra}`);
}

function section(title: string) {
  log(`\n${CYAN}${BOLD}--- ${title} ---${RESET}`);
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-workspace-id": workspaceId,
    ...extra,
  };
}

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const url = `${BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: headers(),
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data: any;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function assert(
  condition: boolean,
  label: string,
  detail?: string
): boolean {
  if (condition) {
    pass(label, detail);
  } else {
    fail(label, detail);
  }
  return condition;
}

// ---------------------------------------------------------------------------
// 0. Workspace resolution
// ---------------------------------------------------------------------------
async function testWorkspaceResolution() {
  section("WORKSPACE RESOLUTION");

  // Try to get existing workspaces first
  const { status, data } = await api("GET", "/api/workspaces/mine");

  if (status === 200 && Array.isArray(data) && data.length > 0) {
    // Use the first workspace that has a workspace property
    const ws = data[0]?.workspace ?? data[0];
    if (ws?.id) {
      workspaceId = ws.id;
      pass("Fetched existing workspace", `id=${workspaceId}`);
      return;
    }
  }

  // Fallback: create a workspace
  const create = await api("POST", "/api/workspaces", {
    name: "E2E Test Workspace",
  });

  if (create.status === 201 && create.data?.id) {
    workspaceId = create.data.id;
    pass("Created test workspace", `id=${workspaceId} (status=${create.status})`);
  } else {
    // Last fallback: use hardcoded dev workspace
    workspaceId = DEV_WORKSPACE_ID;
    log(
      `  ${YELLOW}WARN${RESET} Could not fetch or create workspace. Using DEV_WORKSPACE_ID=${DEV_WORKSPACE_ID}`
    );
    log(`       Workspace API responded: status=${status} data=${JSON.stringify(data).slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Helper: Create a test agent (needed by heartbeats, budgets, approvals)
// ---------------------------------------------------------------------------
async function createTestAgent(
  name: string,
  extra?: Record<string, unknown>
): Promise<string | null> {
  const { status, data } = await api("POST", "/api/agents", {
    name,
    type: "general",
    ...extra,
  });
  if (status === 201 && data?.id) {
    return data.id;
  }
  fail(`Create helper agent "${name}"`, `status=${status} body=${JSON.stringify(data).slice(0, 200)}`);
  return null;
}

async function deleteTestAgent(agentId: string) {
  await api("DELETE", `/api/agents/${agentId}`);
}

// ---------------------------------------------------------------------------
// 1. GOALS
// ---------------------------------------------------------------------------
async function testGoals() {
  section("GOALS");

  // 1a. Create a goal
  const { status: s1, data: goal } = await api("POST", "/api/goals", {
    title: "E2E Test Goal",
    description: "Created by test-features.ts",
    priority: 2,
  });
  if (
    !assert(s1 === 201 && !!goal?.id, "Create goal", `status=${s1} id=${goal?.id}`)
  ) {
    return; // Cannot continue without a goal
  }
  const goalId = goal.id;

  // 1b. Create a sub-goal
  const { status: s2, data: subGoal } = await api("POST", "/api/goals", {
    title: "E2E Sub-Goal",
    description: "Child of the main test goal",
    parentGoalId: goalId,
  });
  const subGoalCreated = assert(
    s2 === 201 && subGoal?.parentGoalId === goalId,
    "Create sub-goal",
    `status=${s2} parentGoalId=${subGoal?.parentGoalId}`
  );
  const subGoalId = subGoal?.id;

  // 1c. Update progress
  const { status: s3, data: progGoal } = await api(
    "PATCH",
    `/api/goals/${goalId}`,
    { progress: 50 }
  );
  assert(
    s3 === 200 && progGoal?.progress === 50,
    "Update goal progress to 50%",
    `status=${s3} progress=${progGoal?.progress}`
  );

  // 1d. Update status to completed (should auto-set completedAt)
  const { status: s4, data: compGoal } = await api(
    "PATCH",
    `/api/goals/${goalId}`,
    { status: "completed" }
  );
  assert(
    s4 === 200 && compGoal?.status === "completed" && !!compGoal?.completedAt,
    "Update goal status to completed (auto-sets completedAt)",
    `status=${s4} goalStatus=${compGoal?.status} completedAt=${compGoal?.completedAt}`
  );

  // 1e. List goals
  const { status: s5, data: goals } = await api("GET", "/api/goals");
  assert(
    s5 === 200 && Array.isArray(goals) && goals.some((g: any) => g.id === goalId),
    "List goals contains created goal",
    `status=${s5} count=${goals?.length}`
  );

  // 1f. Delete sub-goal
  if (subGoalCreated && subGoalId) {
    const { status: s6 } = await api("DELETE", `/api/goals/${subGoalId}`);
    assert(s6 === 200, "Delete sub-goal", `status=${s6}`);
  }

  // 1g. Delete goal
  const { status: s7, data: delData } = await api(
    "DELETE",
    `/api/goals/${goalId}`
  );
  assert(
    s7 === 200 && delData?.deleted === true,
    "Delete goal",
    `status=${s7}`
  );

  // 1h. Verify deleted
  const { status: s8 } = await api("GET", `/api/goals/${goalId}`);
  assert(s8 === 404, "Verify goal deleted (404)", `status=${s8}`);
}

// ---------------------------------------------------------------------------
// 2. HEARTBEATS
// ---------------------------------------------------------------------------
async function testHeartbeats() {
  section("HEARTBEATS");

  // Need an agent first
  const agentId = await createTestAgent("Heartbeat Test Agent");
  if (!agentId) return;

  try {
    // 2a. Create a heartbeat
    const { status: s1, data: hb } = await api("POST", "/api/heartbeats", {
      agentId,
      task: "Check server health every hour",
      frequency: "1h",
    });
    if (
      !assert(
        s1 === 201 && !!hb?.id,
        "Create heartbeat",
        `status=${s1} id=${hb?.id} frequency=${hb?.frequency}`
      )
    ) {
      return;
    }
    const hbId = hb.id;

    // 2b. List heartbeats
    const { status: s2, data: list } = await api("GET", "/api/heartbeats");
    assert(
      s2 === 200 && Array.isArray(list) && list.some((h: any) => h.id === hbId),
      "List heartbeats contains created heartbeat",
      `status=${s2} count=${list?.length}`
    );

    // 2c. Toggle isEnabled (disable)
    const { status: s3, data: disabled } = await api(
      "PATCH",
      `/api/heartbeats/${hbId}`,
      { isEnabled: false }
    );
    assert(
      s3 === 200 && disabled?.isEnabled === false,
      "Toggle isEnabled to false",
      `status=${s3} isEnabled=${disabled?.isEnabled}`
    );

    // 2d. Update frequency
    const { status: s4, data: updated } = await api(
      "PATCH",
      `/api/heartbeats/${hbId}`,
      { frequency: "15m" }
    );
    assert(
      s4 === 200 && updated?.frequency === "15m",
      "Update frequency to 15m",
      `status=${s4} frequency=${updated?.frequency}`
    );

    // 2e. Delete heartbeat
    const { status: s5, data: delData } = await api(
      "DELETE",
      `/api/heartbeats/${hbId}`
    );
    assert(
      s5 === 200 && delData?.deleted === true,
      "Delete heartbeat",
      `status=${s5}`
    );

    // 2f. Verify deleted
    const { status: s6 } = await api("GET", `/api/heartbeats/${hbId}`);
    assert(s6 === 404, "Verify heartbeat deleted (404)", `status=${s6}`);
  } finally {
    await deleteTestAgent(agentId);
  }
}

// ---------------------------------------------------------------------------
// 3. BUDGETS
// ---------------------------------------------------------------------------
async function testBudgets() {
  section("BUDGETS");

  const agentId = await createTestAgent("Budget Test Agent");
  if (!agentId) return;

  try {
    // 3a. Create a budget
    const { status: s1, data: budget } = await api("POST", "/api/budgets", {
      agentId,
      monthlyLimitUsd: 100,
      warningThreshold: 80,
    });
    if (
      !assert(
        s1 === 201 && !!budget?.id,
        "Create budget",
        `status=${s1} id=${budget?.id} limit=${budget?.monthlyLimitUsd}`
      )
    ) {
      return;
    }
    const budgetId = budget.id;

    // 3b. List budgets
    const { status: s2, data: list } = await api("GET", "/api/budgets");
    assert(
      s2 === 200 &&
        Array.isArray(list) &&
        list.some((b: any) => b.id === budgetId),
      "List budgets contains created budget",
      `status=${s2} count=${list?.length}`
    );

    // 3c. Update monthly limit
    const { status: s3, data: updated } = await api(
      "PATCH",
      `/api/budgets/${budgetId}`,
      { monthlyLimitUsd: 250 }
    );
    assert(
      s3 === 200 && parseFloat(updated?.monthlyLimitUsd) === 250,
      "Update monthly limit to $250",
      `status=${s3} monthlyLimitUsd=${updated?.monthlyLimitUsd}`
    );

    // 3d. Delete budget
    const { status: s4, data: delData } = await api(
      "DELETE",
      `/api/budgets/${budgetId}`
    );
    assert(
      s4 === 200 && delData?.deleted === true,
      "Delete budget",
      `status=${s4}`
    );

    // 3e. Verify deleted
    const { status: s5 } = await api("GET", `/api/budgets/${budgetId}`);
    assert(s5 === 404, "Verify budget deleted (404)", `status=${s5}`);
  } finally {
    await deleteTestAgent(agentId);
  }
}

// ---------------------------------------------------------------------------
// 4. APPROVALS
// ---------------------------------------------------------------------------
async function testApprovals() {
  section("APPROVALS");

  const agentId = await createTestAgent("Approval Test Agent");
  if (!agentId) return;

  try {
    // 4a. Create an approval
    const { status: s1, data: approval } = await api(
      "POST",
      "/api/approvals",
      {
        agentId,
        action: "Increase marketing budget by $500",
        actionType: "budget_override",
        metadata: { amount: 500, currency: "USD" },
      }
    );
    if (
      !assert(
        s1 === 201 && !!approval?.id && approval?.status === "pending",
        "Create approval",
        `status=${s1} id=${approval?.id} approvalStatus=${approval?.status}`
      )
    ) {
      return;
    }
    const approvalId = approval.id;

    // 4b. List all approvals
    const { status: s2, data: allList } = await api("GET", "/api/approvals");
    assert(
      s2 === 200 &&
        Array.isArray(allList) &&
        allList.some((a: any) => a.id === approvalId),
      "List all approvals contains created approval",
      `status=${s2} count=${allList?.length}`
    );

    // 4c. List filtered by status=pending
    const { status: s3, data: pendingList } = await api(
      "GET",
      "/api/approvals?status=pending"
    );
    assert(
      s3 === 200 &&
        Array.isArray(pendingList) &&
        pendingList.every((a: any) => a.status === "pending"),
      "List approvals filtered by status=pending",
      `status=${s3} count=${pendingList?.length}`
    );

    // 4d. Review (approve) the approval
    const { status: s4, data: reviewed } = await api(
      "PATCH",
      `/api/approvals/${approvalId}`,
      { status: "approved", reviewNote: "Approved by E2E test" }
    );
    assert(
      s4 === 200 && reviewed?.status === "approved",
      "Review (approve) approval",
      `status=${s4} approvalStatus=${reviewed?.status} reviewedBy=${reviewed?.reviewedBy}`
    );

    // 4e. Verify status changed by fetching it directly
    const { status: s5, data: fetched } = await api(
      "GET",
      `/api/approvals/${approvalId}`
    );
    assert(
      s5 === 200 &&
        fetched?.status === "approved" &&
        !!fetched?.reviewedAt,
      "Verify approval status is now approved",
      `status=${s5} approvalStatus=${fetched?.status} reviewedAt=${fetched?.reviewedAt}`
    );

    // 4f. Verify double-review is rejected (409)
    const { status: s6 } = await api(
      "PATCH",
      `/api/approvals/${approvalId}`,
      { status: "rejected" }
    );
    assert(
      s6 === 409,
      "Double-review rejected with 409",
      `status=${s6}`
    );

    // Note: approvals don't have a DELETE endpoint, so no cleanup needed.
    // The approval will remain in the database.
  } finally {
    await deleteTestAgent(agentId);
  }
}

// ---------------------------------------------------------------------------
// 5. BYOA (Bring Your Own Agent)
// ---------------------------------------------------------------------------
async function testBYOA() {
  section("BYOA (EXTERNAL AGENTS)");

  // 5a. Create an external agent
  const { status: s1, data: agent } = await api("POST", "/api/agents", {
    name: "External Webhook Agent",
    description: "BYOA test agent with external runtime",
    type: "general",
    runtime: "external",
    webhookUrl: "https://example.com/webhook/agent",
    webhookSecret: "test-secret-123",
    webhookHeaders: { "X-Custom": "value" },
    capabilities: ["web_search", "send_email"],
  });
  if (
    !assert(
      s1 === 201 && !!agent?.id,
      "Create external agent",
      `status=${s1} id=${agent?.id}`
    )
  ) {
    return;
  }
  const agentId = agent.id;

  // 5b. Verify fields
  assert(
    agent.runtime === "external",
    "Agent runtime is 'external'",
    `runtime=${agent.runtime}`
  );
  assert(
    agent.webhookUrl === "https://example.com/webhook/agent",
    "Agent webhookUrl is set correctly",
    `webhookUrl=${agent.webhookUrl}`
  );
  assert(
    agent.webhookSecret === "test-secret-123",
    "Agent webhookSecret is set correctly",
    `webhookSecret=${agent.webhookSecret}`
  );

  // 5c. Fetch agent by ID to double-check persistence
  const { status: s2, data: fetched } = await api(
    "GET",
    `/api/agents/${agentId}`
  );
  assert(
    s2 === 200 &&
      fetched?.runtime === "external" &&
      fetched?.webhookUrl === "https://example.com/webhook/agent",
    "Fetched agent has correct external fields",
    `status=${s2} runtime=${fetched?.runtime} webhookUrl=${fetched?.webhookUrl}`
  );

  // 5d. Delete agent
  const { status: s3, data: delData } = await api(
    "DELETE",
    `/api/agents/${agentId}`
  );
  assert(
    s3 === 200 && delData?.deleted === true,
    "Delete external agent",
    `status=${s3}`
  );

  // 5e. Verify deleted
  const { status: s4 } = await api("GET", `/api/agents/${agentId}`);
  assert(s4 === 404, "Verify external agent deleted (404)", `status=${s4}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(
    `\n${BOLD}Cohortis AI — End-to-End Feature Tests${RESET}`
  );
  log(`${DIM}Base URL: ${BASE}${RESET}`);
  log(`${DIM}Workspace: ${workspaceId}${RESET}`);

  // Check server is up and responsive
  try {
    const res = await fetch(`${BASE}/api/goals`, {
      method: "GET",
      headers: { "x-workspace-id": DEV_WORKSPACE_ID },
    });
    if (res.status === 500) {
      log(
        `\n${RED}${BOLD}ERROR:${RESET} Server returned 500. Likely causes:`
      );
      log(`  - Dev seed not applied (run: node scripts/seed-dev.mjs)`);
      log(`  - Database connection issue (check POSTGRES_URL in .env.local)`);
      log(`  - DISABLE_AUTH=true not set in .env.local`);
      log(`${DIM}Continuing anyway -- tests will show specific failures.${RESET}`);
    } else if (res.status === 401) {
      log(
        `\n${YELLOW}${BOLD}WARNING:${RESET} Server returned 401 Unauthorized.`
      );
      log(`  Ensure DISABLE_AUTH=true is set in .env.local and restart the dev server.`);
      log(`${DIM}Continuing anyway -- tests will show specific failures.${RESET}`);
    } else {
      log(`${DIM}Server health check OK (status=${res.status})${RESET}`);
    }
  } catch (err: any) {
    log(
      `\n${RED}${BOLD}ERROR:${RESET} Cannot reach ${BASE}. Is the app running?`
    );
    log(`  Start with: npm run dev`);
    log(`  Or override: BASE_URL=http://localhost:3000 npx tsx scripts/test-features.ts`);
    log(`${DIM}${err.message}${RESET}\n`);
    process.exit(1);
  }

  try {
    await testWorkspaceResolution();
    await testGoals();
    await testHeartbeats();
    await testBudgets();
    await testApprovals();
    await testBYOA();
  } catch (err: any) {
    log(`\n${RED}${BOLD}UNEXPECTED ERROR:${RESET} ${err.message}`);
    log(`${DIM}${err.stack}${RESET}`);
    failed++;
  }

  // Summary
  const total = passed + failed;
  log(`\n${BOLD}========================================${RESET}`);
  log(`  Total:  ${total}`);
  log(`  ${GREEN}Passed: ${passed}${RESET}`);
  if (failed > 0) {
    log(`  ${RED}Failed: ${failed}${RESET}`);
  } else {
    log(`  ${RED}Failed: 0${RESET}`);
  }
  log(`${BOLD}========================================${RESET}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
