import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  json,
  pgEnum,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───

export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const agentTypeEnum = pgEnum("agent_type", [
  "general",
  "email",
  "calendar",
  "documents",
  "data",
  "social",
  "custom",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const abOutcomeEnum = pgEnum("ab_outcome", [
  "success",
  "failure",
  "partial",
]);

export const agentMessageTypeEnum = pgEnum("agent_message_type", [
  "delegation",
  "report",
  "prompt_update",
  "broadcast",
]);

// ─── Auth Tables (NextAuth.js) ───

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionToken: text("session_token").unique().notNull(),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

// ─── Workspaces ───

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  ownerId: uuid("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  plan: text("plan").default("starter"),
  sharedMemory: json("shared_memory").$type<{
    mission: string;
    teamContext: string;
    orgContext: string;
  }>(),
  settings: json("settings").$type<{
    maxAgents: number;
    maxDepth: number;
    allowMemberExecution: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: workspaceMemberRoleEnum("role").default("member").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id),
    invitedAt: timestamp("invited_at").defaultNow(),
    joinedAt: timestamp("joined_at"),
  },
  (table) => [
    uniqueIndex("workspace_members_unique").on(
      table.workspaceId,
      table.userId
    ),
  ]
);

// ─── Agents ───

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  name: text("name").notNull(),
  description: text("description"),
  type: agentTypeEnum("type").default("general"),
  icon: text("icon"),

  // Hierarchy
  role: text("role"),
  parentAgentId: uuid("parent_agent_id").references((): any => agents.id, {
    onDelete: "set null",
  }),

  // Configuration
  systemPrompt: text("system_prompt"),
  capabilities: json("capabilities").$type<string[]>(),
  model: text("model").default("gpt-5.2"),
  provider: text("provider").default("openai"),

  // Custom skills
  customSkills: json("custom_skills").$type<
    Array<{
      id: string;
      name: string;
      description: string;
      instructions: string;
      category?: string;
    }>
  >(),

  // Knowledge files
  knowledgeFiles: json("knowledge_files").$type<
    Array<{
      id: string;
      name: string;
      content: string;
      addedAt: string;
    }>
  >(),

  // Conversation starters
  conversationStarters: json("conversation_starters").$type<string[]>(),

  // Prompt history (auto-modifications by manager agents)
  promptHistory: json("prompt_history").$type<
    Array<{
      previousPrompt: string | null;
      newPrompt: string;
      modifiedBy: string;
      reason: string;
      timestamp: string;
    }>
  >(),

  // A/B testing
  activeVariantId: uuid("active_variant_id"),

  // Status
  isActive: boolean("is_active").default(true),
  lastActiveAt: timestamp("last_active_at"),

  // Metrics
  totalTasksCompleted: integer("total_tasks_completed").default(0),
  totalTasksFailed: integer("total_tasks_failed").default(0),
  averageExecutionTime: integer("average_execution_time"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Agent Runs ───

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  initiatedBy: uuid("initiated_by").references(() => users.id, {
    onDelete: "set null",
  }),

  task: text("task").notNull(),
  status: agentRunStatusEnum("status").default("pending").notNull(),

  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),

  resultSummary: text("result_summary"),
  resultFull: text("result_full"),
  toolCalls: json("tool_calls").$type<
    Array<{
      id: string;
      name: string;
      arguments: unknown;
      startedAt: string;
    }>
  >(),

  tokensUsed: integer("tokens_used"),
  estimatedCostUsd: numeric("estimated_cost_usd", {
    precision: 10,
    scale: 6,
  }),
  errorMessage: text("error_message"),

  delegationDepth: integer("delegation_depth").default(0),
  parentRunId: uuid("parent_run_id").references((): any => agentRuns.id, {
    onDelete: "set null",
  }),
  variantId: uuid("variant_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Prompt Variants (A/B Testing) ───

export const promptVariants = pgTable("prompt_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),

  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  isControl: boolean("is_control").default(false),
  isActive: boolean("is_active").default(true),
  weight: integer("weight").default(50),

  // Stats
  totalRuns: integer("total_runs").default(0),
  successRuns: integer("success_runs").default(0),
  avgDurationMs: integer("avg_duration_ms"),
  avgTokensUsed: integer("avg_tokens_used"),
  score: numeric("score", { precision: 5, scale: 2 }),

  deployedAt: timestamp("deployed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── A/B Test Runs ───

export const abTestRuns = pgTable("ab_test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id")
    .references(() => promptVariants.id, { onDelete: "cascade" })
    .notNull(),
  runId: uuid("run_id")
    .references(() => agentRuns.id, { onDelete: "cascade" })
    .notNull(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),

  outcome: abOutcomeEnum("outcome").notNull(),
  durationMs: integer("duration_ms"),
  tokensUsed: integer("tokens_used"),
  scoreDelta: numeric("score_delta", { precision: 5, scale: 2 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Agent Messages (Inter-agent communication) ───

export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  senderAgentId: uuid("sender_agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),
  receiverAgentId: uuid("receiver_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  type: agentMessageTypeEnum("type").notNull(),
  content: text("content").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Integrations ───

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name"),
  isConnected: boolean("is_connected").default(false),
  connectedAt: timestamp("connected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ───

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  workspaces: many(workspaces),
  workspaceMembers: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  agents: many(agents),
  runs: many(agentRuns),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  })
);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [agents.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  runs: many(agentRuns),
  variants: many(promptVariants),
  sentMessages: many(agentMessages),
}));

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agentRuns.workspaceId],
    references: [workspaces.id],
  }),
  agent: one(agents, {
    fields: [agentRuns.agentId],
    references: [agents.id],
  }),
  initiator: one(users, {
    fields: [agentRuns.initiatedBy],
    references: [users.id],
  }),
}));

export const promptVariantsRelations = relations(
  promptVariants,
  ({ one, many }) => ({
    agent: one(agents, {
      fields: [promptVariants.agentId],
      references: [agents.id],
    }),
    testRuns: many(abTestRuns),
  })
);

export const abTestRunsRelations = relations(abTestRuns, ({ one }) => ({
  variant: one(promptVariants, {
    fields: [abTestRuns.variantId],
    references: [promptVariants.id],
  }),
  run: one(agentRuns, {
    fields: [abTestRuns.runId],
    references: [agentRuns.id],
  }),
  agent: one(agents, {
    fields: [abTestRuns.agentId],
    references: [agents.id],
  }),
}));

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agentMessages.workspaceId],
    references: [workspaces.id],
  }),
  sender: one(agents, {
    fields: [agentMessages.senderAgentId],
    references: [agents.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [integrations.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
}));
