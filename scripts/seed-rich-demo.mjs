/**
 * Seed rich demo data for impressive screenshots
 * Run: node scripts/seed-rich-demo.mjs
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { randomUUID } from "crypto";

config({ path: ".env.local" });

const sql = neon(process.env.POSTGRES_URL);
const WS = "00000000-0000-0000-0000-000000000010";
const USER = "00000000-0000-0000-0000-000000000001";

// First, delete existing agents (cascade deletes runs, etc.)
async function cleanup() {
  console.log("Cleaning up old demo data...");
  await sql`DELETE FROM approval_gates WHERE workspace_id = ${WS}`;
  await sql`DELETE FROM agent_budgets WHERE workspace_id = ${WS}`;
  await sql`DELETE FROM goals WHERE workspace_id = ${WS}`;
  await sql`DELETE FROM heartbeats WHERE workspace_id = ${WS}`;
  await sql`DELETE FROM ab_test_runs WHERE agent_id IN (SELECT id FROM agents WHERE workspace_id = ${WS})`;
  await sql`DELETE FROM prompt_variants WHERE workspace_id = ${WS}`;
  await sql`DELETE FROM agent_messages WHERE workspace_id = ${WS}`;
  await sql`DELETE FROM agent_runs WHERE workspace_id = ${WS}`;
  await sql`DELETE FROM agents WHERE workspace_id = ${WS}`;
  console.log("  Done.");
}

// ─── Agent definitions (realistic enterprise hierarchy) ───

const agentDefs = [
  // Level 0: CEO Agent
  {
    id: randomUUID(),
    name: "CEO Agent",
    description: "Strategic oversight and company-wide decision making",
    type: "general",
    role: "Chief Executive",
    model: "claude-opus-4-6",
    provider: "anthropic",
    parent: null,
    prompt: "You are the CEO agent. You oversee all operations, set strategic direction, and coordinate between department heads.",
    tasks: 24, failed: 1, avgTime: 8500,
  },
  // Level 1: Department heads
  {
    id: randomUUID(),
    name: "VP Sales",
    description: "Manages the entire sales pipeline and revenue targets",
    type: "general",
    role: "Head of Sales",
    model: "gpt-5.2",
    provider: "openai",
    parent: "CEO Agent",
    prompt: "You are the VP of Sales. You manage the sales team, set quotas, and drive revenue growth.",
    tasks: 47, failed: 2, avgTime: 4200,
  },
  {
    id: randomUUID(),
    name: "VP Marketing",
    description: "Brand strategy, content, and demand generation",
    type: "general",
    role: "Head of Marketing",
    model: "gpt-5.2",
    provider: "openai",
    parent: "CEO Agent",
    prompt: "You are the VP of Marketing. You drive brand awareness, content strategy, and lead generation.",
    tasks: 38, failed: 0, avgTime: 3800,
  },
  {
    id: randomUUID(),
    name: "VP Engineering",
    description: "Technical architecture and product development",
    type: "general",
    role: "Head of Engineering",
    model: "claude-opus-4-6",
    provider: "anthropic",
    parent: "CEO Agent",
    prompt: "You are the VP of Engineering. You oversee technical architecture, code quality, and product development.",
    tasks: 56, failed: 3, avgTime: 6100,
  },
  {
    id: randomUUID(),
    name: "VP Operations",
    description: "Internal operations, HR, and process optimization",
    type: "general",
    role: "Head of Operations",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    parent: "CEO Agent",
    prompt: "You are the VP of Operations. You optimize internal processes, manage HR tasks, and ensure operational efficiency.",
    tasks: 31, failed: 1, avgTime: 3200,
  },
  // Level 2: Sales team
  {
    id: randomUUID(),
    name: "Outbound SDR",
    description: "Cold outreach and prospect qualification",
    type: "email",
    role: "Sales Development Rep",
    model: "gpt-5.2",
    provider: "openai",
    parent: "VP Sales",
    prompt: "You are an SDR focused on outbound. You research prospects, write personalized cold emails, and qualify leads.",
    tasks: 112, failed: 5, avgTime: 2100,
  },
  {
    id: randomUUID(),
    name: "Account Executive",
    description: "Closes deals and manages enterprise accounts",
    type: "general",
    role: "Senior AE",
    model: "gpt-5.2",
    provider: "openai",
    parent: "VP Sales",
    prompt: "You are a senior Account Executive. You run demos, negotiate contracts, and close enterprise deals.",
    tasks: 34, failed: 1, avgTime: 5400,
  },
  {
    id: randomUUID(),
    name: "CRM Manager",
    description: "Keeps CRM data clean and generates pipeline reports",
    type: "data",
    role: "CRM Analyst",
    model: "gpt-4o-mini",
    provider: "openai",
    parent: "VP Sales",
    prompt: "You manage the CRM system. You clean data, track pipeline metrics, and generate sales reports.",
    tasks: 89, failed: 2, avgTime: 1800,
  },
  // Level 2: Marketing team
  {
    id: randomUUID(),
    name: "Content Writer",
    description: "Creates blog posts, case studies, and whitepapers",
    type: "social",
    role: "Content Strategist",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    parent: "VP Marketing",
    prompt: "You are a content strategist. You write compelling blog posts, case studies, and thought leadership pieces.",
    tasks: 67, failed: 0, avgTime: 4500,
  },
  {
    id: randomUUID(),
    name: "SEO Analyst",
    description: "Keyword research and on-page optimization",
    type: "data",
    role: "SEO Specialist",
    model: "gpt-4o-mini",
    provider: "openai",
    parent: "VP Marketing",
    prompt: "You are an SEO specialist. You research keywords, optimize content, and track search rankings.",
    tasks: 43, failed: 1, avgTime: 2800,
  },
  {
    id: randomUUID(),
    name: "Social Media Agent",
    description: "Manages social presence across platforms",
    type: "social",
    role: "Social Media Manager",
    model: "gpt-5.2",
    provider: "openai",
    parent: "VP Marketing",
    prompt: "You manage social media accounts. You create posts, engage with followers, and analyze social metrics.",
    tasks: 156, failed: 4, avgTime: 1200,
  },
  // Level 2: Engineering team
  {
    id: randomUUID(),
    name: "Code Reviewer",
    description: "Automated PR reviews and code quality checks",
    type: "custom",
    role: "Senior Engineer",
    model: "claude-opus-4-6",
    provider: "anthropic",
    parent: "VP Engineering",
    prompt: "You review pull requests for code quality, security vulnerabilities, and architectural consistency.",
    tasks: 203, failed: 8, avgTime: 7200,
  },
  {
    id: randomUUID(),
    name: "DevOps Agent",
    description: "CI/CD pipelines, monitoring, and infrastructure",
    type: "custom",
    role: "DevOps Engineer",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    parent: "VP Engineering",
    prompt: "You manage CI/CD pipelines, monitor infrastructure health, and handle deployments.",
    tasks: 78, failed: 6, avgTime: 3400,
  },
  {
    id: randomUUID(),
    name: "QA Tester",
    description: "Automated testing and bug detection",
    type: "custom",
    role: "QA Engineer",
    model: "gpt-4o-mini",
    provider: "openai",
    parent: "VP Engineering",
    prompt: "You write and run automated tests, detect regressions, and verify bug fixes.",
    tasks: 145, failed: 12, avgTime: 2600,
  },
  // Level 2: Operations team
  {
    id: randomUUID(),
    name: "HR Assistant",
    description: "Onboarding, policy questions, and employee support",
    type: "general",
    role: "HR Coordinator",
    model: "gpt-5.2",
    provider: "openai",
    parent: "VP Operations",
    prompt: "You handle HR tasks including onboarding, policy questions, time-off requests, and employee communications.",
    tasks: 52, failed: 0, avgTime: 1500,
  },
  {
    id: randomUUID(),
    name: "Finance Bot",
    description: "Expense reports, invoicing, and financial analysis",
    type: "data",
    role: "Financial Analyst",
    model: "gpt-4o-mini",
    provider: "openai",
    parent: "VP Operations",
    prompt: "You process expense reports, generate invoices, and provide financial analysis and forecasts.",
    tasks: 67, failed: 1, avgTime: 2200,
  },
  // BYOA External agent
  {
    id: randomUUID(),
    name: "Zapier Webhook",
    description: "External automation agent connected via webhook",
    type: "custom",
    role: "Integration Specialist",
    model: "gpt-5.2",
    provider: "openai",
    parent: "VP Operations",
    runtime: "external",
    webhookUrl: "https://hooks.zapier.com/hooks/catch/123456/abcdef",
    prompt: null,
    tasks: 23, failed: 2, avgTime: 4100,
  },
];

async function seedAgents() {
  console.log("\nCreating agents...");
  const agentMap = {};

  for (const a of agentDefs) {
    const parentId = a.parent ? agentMap[a.parent] : null;
    const lastActive = new Date(Date.now() - Math.random() * 3600000 * 48); // random within last 48h

    await sql`
      INSERT INTO agents (
        id, workspace_id, user_id, name, description, type, role,
        parent_agent_id, system_prompt, model, provider, runtime,
        webhook_url, is_active, last_active_at,
        total_tasks_completed, total_tasks_failed, average_execution_time,
        created_at, updated_at
      ) VALUES (
        ${a.id}, ${WS}, ${USER}, ${a.name}, ${a.description}, ${a.type}, ${a.role},
        ${parentId}, ${a.prompt}, ${a.model}, ${a.provider}, ${a.runtime || "internal"},
        ${a.webhookUrl || null}, true, ${lastActive.toISOString()},
        ${a.tasks}, ${a.failed}, ${a.avgTime},
        NOW() - INTERVAL '14 days', NOW()
      )
    `;
    agentMap[a.name] = a.id;
    console.log(`  + ${a.name} (${a.role})`);
  }
  return agentMap;
}

async function seedRuns(agentMap) {
  console.log("\nCreating agent runs...");

  const tasks = [
    { agent: "CEO Agent", task: "Compile Q1 performance review across all departments", status: "completed", duration: 12400, tokens: 4850, cost: "0.0728" },
    { agent: "CEO Agent", task: "Evaluate expansion into APAC market", status: "completed", duration: 9200, tokens: 3200, cost: "0.0480" },
    { agent: "VP Sales", task: "Generate weekly pipeline report for board meeting", status: "completed", duration: 3400, tokens: 1890, cost: "0.0284" },
    { agent: "VP Sales", task: "Analyze win/loss ratio for enterprise deals", status: "completed", duration: 5100, tokens: 2450, cost: "0.0368" },
    { agent: "VP Marketing", task: "Create content calendar for March 2026", status: "completed", duration: 4200, tokens: 2100, cost: "0.0315" },
    { agent: "VP Marketing", task: "Analyze competitor messaging for product launch", status: "running", duration: null, tokens: null, cost: null },
    { agent: "VP Engineering", task: "Review architecture proposal for microservices migration", status: "completed", duration: 8700, tokens: 5200, cost: "0.0780" },
    { agent: "VP Engineering", task: "Assess technical debt and prioritize refactoring", status: "completed", duration: 6300, tokens: 3800, cost: "0.0570" },
    { agent: "VP Operations", task: "Optimize onboarding workflow for new hires", status: "completed", duration: 2800, tokens: 1400, cost: "0.0210" },
    { agent: "Outbound SDR", task: "Research and qualify 50 SaaS companies in fintech", status: "completed", duration: 2300, tokens: 1200, cost: "0.0180" },
    { agent: "Outbound SDR", task: "Write personalized outreach for Stripe engineering leads", status: "completed", duration: 1800, tokens: 980, cost: "0.0147" },
    { agent: "Outbound SDR", task: "Follow up with unresponsive leads from last week", status: "completed", duration: 1500, tokens: 750, cost: "0.0113" },
    { agent: "Account Executive", task: "Prepare demo deck for Acme Corp enterprise trial", status: "completed", duration: 6200, tokens: 3100, cost: "0.0465" },
    { agent: "Account Executive", task: "Draft contract terms for DataFlow Inc. annual plan", status: "completed", duration: 4800, tokens: 2400, cost: "0.0360" },
    { agent: "CRM Manager", task: "Clean duplicate contacts and merge accounts", status: "completed", duration: 1200, tokens: 600, cost: "0.0030" },
    { agent: "CRM Manager", task: "Generate March pipeline forecast by region", status: "completed", duration: 2100, tokens: 1050, cost: "0.0053" },
    { agent: "Content Writer", task: "Write blog post: 'Why AI Agent Teams Outperform Solo Agents'", status: "completed", duration: 5400, tokens: 3800, cost: "0.0570" },
    { agent: "Content Writer", task: "Draft case study for Fleece AI deployment", status: "completed", duration: 4800, tokens: 3200, cost: "0.0480" },
    { agent: "SEO Analyst", task: "Keyword research for 'AI agent orchestration' cluster", status: "completed", duration: 3200, tokens: 1600, cost: "0.0080" },
    { agent: "Social Media Agent", task: "Schedule 15 tweets for AI Agent Week campaign", status: "completed", duration: 1400, tokens: 700, cost: "0.0105" },
    { agent: "Social Media Agent", task: "Engage with top 20 comments on LinkedIn launch post", status: "completed", duration: 800, tokens: 400, cost: "0.0060" },
    { agent: "Code Reviewer", task: "Review PR #247: Implement agent budget throttling", status: "completed", duration: 7800, tokens: 5600, cost: "0.0840" },
    { agent: "Code Reviewer", task: "Review PR #251: Add BYOA webhook executor", status: "completed", duration: 6500, tokens: 4200, cost: "0.0630" },
    { agent: "Code Reviewer", task: "Review PR #254: Fix delegation depth overflow", status: "running", duration: null, tokens: null, cost: null },
    { agent: "DevOps Agent", task: "Deploy v2.4.1 to staging environment", status: "completed", duration: 3100, tokens: 1550, cost: "0.0233" },
    { agent: "DevOps Agent", task: "Investigate Neon connection pool exhaustion", status: "completed", duration: 4500, tokens: 2250, cost: "0.0338" },
    { agent: "QA Tester", task: "Run regression suite for approval gates feature", status: "completed", duration: 2800, tokens: 1400, cost: "0.0070" },
    { agent: "QA Tester", task: "Verify budget throttling edge cases", status: "failed", duration: 1200, tokens: 600, cost: "0.0030" },
    { agent: "HR Assistant", task: "Process time-off requests for March", status: "completed", duration: 1100, tokens: 550, cost: "0.0083" },
    { agent: "HR Assistant", task: "Draft onboarding guide for new engineer", status: "completed", duration: 2200, tokens: 1100, cost: "0.0165" },
    { agent: "Finance Bot", task: "Process Q1 expense reports for engineering team", status: "completed", duration: 1800, tokens: 900, cost: "0.0045" },
    { agent: "Finance Bot", task: "Generate monthly burn rate analysis", status: "completed", duration: 2400, tokens: 1200, cost: "0.0060" },
    { agent: "Zapier Webhook", task: "Sync new Hubspot contacts to Notion database", status: "completed", duration: 3800, tokens: null, cost: "0.0000" },
    { agent: "Zapier Webhook", task: "Trigger Slack notification for high-priority leads", status: "completed", duration: 2200, tokens: null, cost: "0.0000" },
  ];

  for (const t of tasks) {
    const agentId = agentMap[t.agent];
    const startedAt = new Date(Date.now() - Math.random() * 86400000 * 7); // random within last 7d
    const completedAt = t.status === "completed" ? new Date(startedAt.getTime() + (t.duration || 0)) : null;

    await sql`
      INSERT INTO agent_runs (
        workspace_id, agent_id, initiated_by, task, status,
        started_at, completed_at, duration_ms, tokens_used,
        estimated_cost_usd, result_summary, error_message, created_at
      ) VALUES (
        ${WS}, ${agentId}, ${USER}, ${t.task}, ${t.status},
        ${startedAt.toISOString()}, ${completedAt?.toISOString() || null}, ${t.duration},
        ${t.tokens}, ${t.cost},
        ${t.status === "completed" ? "Task completed successfully." : null},
        ${t.status === "failed" ? "Assertion failed: budget threshold exceeded expected range" : null},
        ${startedAt.toISOString()}
      )
    `;
  }
  console.log(`  + ${tasks.length} runs created`);
}

async function seedGoals(agentMap) {
  console.log("\nCreating goals...");

  const topGoal = randomUUID();
  const salesGoal = randomUUID();
  const marketingGoal = randomUUID();
  const engGoal = randomUUID();

  const goals = [
    { id: topGoal, title: "Reach $1M ARR by Q2 2026", desc: "Company-wide revenue target", agent: "CEO Agent", parent: null, progress: 68, status: "active" },
    { id: salesGoal, title: "Close 25 enterprise deals this quarter", desc: "Enterprise sales pipeline target", agent: "VP Sales", parent: topGoal, progress: 72, status: "active" },
    { id: marketingGoal, title: "Generate 500 qualified leads/month", desc: "Demand generation target", agent: "VP Marketing", parent: topGoal, progress: 85, status: "active" },
    { id: engGoal, title: "Ship v3.0 with zero critical bugs", desc: "Product release quality target", agent: "VP Engineering", parent: topGoal, progress: 45, status: "active" },
    { id: randomUUID(), title: "Qualify 200 outbound prospects", desc: "Weekly prospecting quota", agent: "Outbound SDR", parent: salesGoal, progress: 91, status: "active" },
    { id: randomUUID(), title: "Close Acme Corp annual contract", desc: "$120K deal", agent: "Account Executive", parent: salesGoal, progress: 60, status: "active" },
    { id: randomUUID(), title: "Publish 12 blog posts this month", desc: "Content velocity target", agent: "Content Writer", parent: marketingGoal, progress: 75, status: "active" },
    { id: randomUUID(), title: "Grow organic traffic 30% MoM", desc: "SEO growth target", agent: "SEO Analyst", parent: marketingGoal, progress: 52, status: "active" },
    { id: randomUUID(), title: "0 P0 bugs in production", desc: "Zero critical bugs policy", agent: "QA Tester", parent: engGoal, progress: 100, status: "completed" },
    { id: randomUUID(), title: "Reduce CI build time to < 3min", desc: "Developer experience improvement", agent: "DevOps Agent", parent: engGoal, progress: 80, status: "active" },
  ];

  for (const g of goals) {
    await sql`
      INSERT INTO goals (
        id, workspace_id, title, description, assigned_agent_id, parent_goal_id,
        progress, status, created_at, updated_at
      ) VALUES (
        ${g.id}, ${WS}, ${g.title}, ${g.desc}, ${agentMap[g.agent]}, ${g.parent},
        ${g.progress}, ${g.status}, NOW() - INTERVAL '30 days', NOW()
      )
    `;
  }
  console.log(`  + ${goals.length} goals created`);
}

async function seedBudgets(agentMap) {
  console.log("\nCreating budgets...");

  const budgets = [
    { agent: "CEO Agent", limit: "50.00", spent: "18.72", warning: 80 },
    { agent: "VP Sales", limit: "100.00", spent: "67.34", warning: 80 },
    { agent: "VP Marketing", limit: "75.00", spent: "42.15", warning: 80 },
    { agent: "VP Engineering", limit: "150.00", spent: "134.20", warning: 80 },
    { agent: "Outbound SDR", limit: "30.00", spent: "24.80", warning: 75 },
    { agent: "Content Writer", limit: "40.00", spent: "28.50", warning: 80 },
    { agent: "Code Reviewer", limit: "80.00", spent: "71.40", warning: 85 },
    { agent: "DevOps Agent", limit: "35.00", spent: "22.10", warning: 80 },
  ];

  for (const b of budgets) {
    await sql`
      INSERT INTO agent_budgets (
        workspace_id, agent_id, monthly_limit_usd, current_spend_usd,
        warning_threshold, period_start, period_end, created_at, updated_at
      ) VALUES (
        ${WS}, ${agentMap[b.agent]}, ${b.limit}, ${b.spent},
        ${b.warning}, DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
        NOW(), NOW()
      )
    `;
  }
  console.log(`  + ${budgets.length} budgets created`);
}

async function seedApprovals(agentMap) {
  console.log("\nCreating approvals...");

  const approvals = [
    { agent: "VP Engineering", action: "Deploy v2.5.0 to production", type: "external_action", status: "pending" },
    { agent: "CEO Agent", action: "Approve $15K budget increase for marketing", type: "budget_override", status: "pending" },
    { agent: "Code Reviewer", action: "Auto-merge PR #258 after passing all checks", type: "external_action", status: "pending" },
    { agent: "VP Sales", action: "Send contract to Acme Corp legal team", type: "external_action", status: "approved" },
    { agent: "Content Writer", action: "Update system prompt to include brand voice V2", type: "prompt_change", status: "approved" },
    { agent: "Outbound SDR", action: "Increase daily email limit from 50 to 100", type: "budget_override", status: "rejected" },
    { agent: "DevOps Agent", action: "Scale Neon compute to 4 CU", type: "high_cost", status: "approved" },
  ];

  for (const a of approvals) {
    const createdAt = new Date(Date.now() - Math.random() * 86400000 * 5);
    const resolvedAt = a.status !== "pending" ? new Date(createdAt.getTime() + Math.random() * 3600000) : null;

    await sql`
      INSERT INTO approval_gates (
        workspace_id, agent_id, action, action_type, status,
        reviewed_by, reviewed_at, created_at
      ) VALUES (
        ${WS}, ${agentMap[a.agent]}, ${a.action}, ${a.type}, ${a.status},
        ${a.status !== "pending" ? USER : null},
        ${resolvedAt?.toISOString() || null},
        ${createdAt.toISOString()}
      )
    `;
  }
  console.log(`  + ${approvals.length} approvals created`);
}

async function seedHeartbeats(agentMap) {
  console.log("\nCreating heartbeats...");

  const heartbeats = [
    { agent: "Outbound SDR", freq: "30m", mins: 30, task: "Check for new leads and send follow-ups" },
    { agent: "CRM Manager", freq: "1h", mins: 60, task: "Sync CRM data and update pipeline metrics" },
    { agent: "Social Media Agent", freq: "15m", mins: 15, task: "Monitor mentions and engage with comments" },
    { agent: "Code Reviewer", freq: "5m", mins: 5, task: "Check for new PRs requiring review" },
    { agent: "QA Tester", freq: "4h", mins: 240, task: "Run smoke tests on staging" },
    { agent: "DevOps Agent", freq: "5m", mins: 5, task: "Check infrastructure health and alerts" },
    { agent: "Finance Bot", freq: "24h", mins: 1440, task: "Generate daily expense summary" },
  ];

  for (const h of heartbeats) {
    const lastTick = new Date(Date.now() - Math.random() * h.mins * 60000);
    await sql`
      INSERT INTO heartbeats (
        workspace_id, agent_id, frequency, task,
        is_enabled, last_run_at, next_run_at, total_runs,
        created_at, updated_at
      ) VALUES (
        ${WS}, ${agentMap[h.agent]}, ${h.freq}, ${h.task},
        true, ${lastTick.toISOString()},
        ${new Date(lastTick.getTime() + h.mins * 60000).toISOString()},
        ${Math.floor(Math.random() * 500) + 10},
        NOW() - INTERVAL '14 days', NOW()
      )
    `;
  }
  console.log(`  + ${heartbeats.length} heartbeats created`);
}

async function main() {
  console.log("=== Seeding Rich Demo Data ===\n");
  await cleanup();
  const agentMap = await seedAgents();
  await seedRuns(agentMap);
  await seedGoals(agentMap);
  await seedBudgets(agentMap);
  await seedApprovals(agentMap);
  await seedHeartbeats(agentMap);
  console.log("\n=== Done! 17 agents with full hierarchy ===");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
