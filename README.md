<p align="center">
  <img src="https://cohortis.ai/og-image.png" alt="Cohortis AI" width="600" />
</p>

<h1 align="center">Cohortis AI</h1>

<p align="center">
  <strong>Deploy AI agent teams that organize, collaborate, and improve themselves.</strong>
</p>

<p align="center">
  <a href="https://cohortis.ai">Website</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#quickstart">Quickstart</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="LICENSE">MIT License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/AI_SDK-v4-purple" alt="Vercel AI SDK" />
</p>

---

## What is Cohortis AI?

Cohortis AI is an open-source platform for building **hierarchical AI agent teams** that self-organize, collaborate, and continuously improve. Unlike static prompt files or single-agent frameworks, Cohortis gives you living agent teams that learn from every execution.

**Used in production by [Fleece AI](https://fleeceai.app)** — an AI assistant platform serving thousands of users with 2,500+ app integrations. Fleece AI's autonomous agent teams are powered by the Cohortis engine.

### The Problem

Today's AI agent tools fall into two categories:

- **Static config files** — Define agents in YAML/JSON. No learning, no collaboration, no self-improvement.
- **Code frameworks** — Write Python/JS to orchestrate agents. Powerful but requires developers for every change.

Neither gives you **agent teams that get better over time**.

### The Cohortis Approach

```
Lead Agent (Strategic)
  ├── Manager Agent (Coordination)
  │     ├── Executor Agent (Email)
  │     └── Executor Agent (Calendar)
  └── Manager Agent (Analysis)
        ├── Executor Agent (Data)
        └── Executor Agent (Reports)
```

Agents are organized in a **hierarchy with real authority**. Lead agents supervise managers. Managers delegate to executors. Parent agents can modify child agent prompts based on performance. The entire system learns from every run.

---

## Features

### Dynamic Agent Hierarchy
Create multi-level agent teams that mirror your org structure. Lead agents supervise and correct child agents. Delegation follows the chain of command.

### Self-Optimizing Prompts (A/B Testing)
Every agent execution is evaluated. The system A/B tests prompt variants, tracks success rates, and auto-deploys the best-performing version. Your agents literally get better at their jobs.

### Shared Memory System
- **Mission context** — What the team is trying to achieve
- **Team context** — Shared knowledge across agents
- **Org context** — Company-wide information all agents can access

### Deep Observability
Full reasoning traces (not just logs), per-agent KPIs, execution timelines, token usage, and cost tracking. Know exactly what every agent is doing and why.

### OKR-Style Goals
Hierarchical goal trees with parent-child relationships. Assign goals to agents, track progress, and cascade objectives through your agent org.

### Heartbeat Scheduling
Agents wake up on configurable intervals (5min to 24h) to autonomously check for work. No cron jobs to manage — just set a task and frequency.

### Per-Agent Budgets
Set monthly USD spending limits per agent. Automatic throttling at 100%, configurable warning thresholds. Never get surprised by AI costs.

### Approval Gates
Critical actions require human review before execution. Budget overrides, prompt changes, external actions — you stay in control.

### Bring Your Own Agent (BYOA)
Connect external agents via HTTP webhook. Your custom agents participate in the Cohortis hierarchy alongside internal ones. Full interoperability.

### Multi-Model Support
GPT-5.2, Claude Opus 4.6, Claude Sonnet 4.6, GPT-4o Mini — choose the right model for each agent's role and budget.

---

## Quickstart

### Prerequisites

- Node.js 20+
- PostgreSQL (we recommend [Neon](https://neon.tech) for serverless)
- OpenAI and/or Anthropic API keys

### Setup

```bash
# Clone the repo
git clone https://github.com/Onthelolow/cohortis-ai.git
cd cohortis-ai

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your database URL and API keys

# Push schema to database
pnpm db:push

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | Yes | Neon/PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth.js secret (generate with `openssl rand -base64 32`) |
| `AUTH_URL` | Yes | Your app URL (e.g., `http://localhost:3000`) |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (for Claude models) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth (for login) |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth secret |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth (for login) |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth secret |
| `CRON_SECRET` | No | Secret for heartbeat cron endpoint |

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| AI | Vercel AI SDK v4 (multi-provider) |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Drizzle ORM |
| Auth | NextAuth.js v5 |
| UI | Tailwind CSS, Lucide Icons |
| State | SWR (client), Server Components |

### Key Modules

```
lib/
  agents/
    executor.ts          # Main agent execution loop (internal LLM)
    external-executor.ts # BYOA webhook executor
    hierarchy-tools.ts   # Delegation & reporting tools
    ab-selector.ts       # A/B variant selection
    ab-deploy.ts         # Auto-deploy winning variants
    budget.ts            # Budget check & spend recording
  db/
    schema.ts            # Drizzle schema (16 tables)
    queries.ts           # All database operations
  workspace/
    context.ts           # Shared memory system
  notifications/
    event-bus.ts         # Real-time notification system
```

### Database Schema

16 tables covering:
- **Auth**: users, accounts, sessions, verification_tokens
- **Workspaces**: workspaces, workspace_members
- **Agents**: agents, agent_runs, agent_messages
- **Optimization**: prompt_variants, ab_test_runs
- **Operations**: goals, heartbeats, agent_budgets, approval_gates
- **Integrations**: integrations

---

## Who Uses Cohortis?

<table>
  <tr>
    <td align="center" width="300">
      <a href="https://fleeceai.app">
        <strong>Fleece AI</strong>
      </a>
      <br />
      AI assistant platform with 2,500+ app integrations. Uses Cohortis for autonomous agent teams that handle email, calendar, data analysis, and more.
    </td>
  </tr>
</table>

*Using Cohortis AI? [Open a PR](https://github.com/Onthelolow/cohortis-ai/pulls) to add your project here.*

---

## Roadmap

- [ ] Visual workflow builder (drag & drop agent hierarchies)
- [ ] Agent marketplace (share & import agent templates)
- [ ] Multi-tenant SaaS mode
- [ ] Webhooks for external event triggers
- [ ] Advanced analytics dashboard with anomaly detection
- [ ] Plugin system for custom tools
- [ ] Mobile app for approvals & monitoring

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

```bash
# Run the dev server
pnpm dev

# Type-check
pnpm tsc --noEmit

# Lint
pnpm lint

# Build
pnpm build
```

---

## License

[MIT](LICENSE) — use it for anything.

---

<p align="center">
  <strong>Cohortis AI</strong> — from Latin <em>cohortis</em> (cohort, organized unit)
  <br />
  Built with conviction that AI agents work better as teams.
</p>
