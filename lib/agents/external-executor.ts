import {
  createAgentRun,
  updateAgentRun,
  incrementAgentTaskCount,
} from "@/lib/db/queries";
import { notificationBus } from "@/lib/notifications/event-bus";
import type { agents } from "@/lib/db/schema";

type Agent = typeof agents.$inferSelect;

const EXTERNAL_TIMEOUT_MS = 60_000;

export interface ExternalExecuteParams {
  agent: Agent;
  task: string;
  workspaceId: string;
  initiatedBy?: string;
  parentRunId?: string;
  delegationDepth?: number;
}

interface ExternalAgentResponse {
  result?: string;
  status?: "completed" | "failed";
  error?: string;
  metadata?: Record<string, unknown>;
}

export async function executeExternalAgent(params: ExternalExecuteParams) {
  const {
    agent,
    task,
    workspaceId,
    initiatedBy,
    parentRunId,
    delegationDepth = 0,
  } = params;

  const startTime = Date.now();

  if (!agent.webhookUrl) {
    return {
      runId: "",
      status: "failed" as const,
      error: "External agent has no webhook URL configured",
      durationMs: 0,
    };
  }

  const run = await createAgentRun({
    workspaceId,
    agentId: agent.id,
    initiatedBy,
    task: task.slice(0, 500),
    status: "running",
    delegationDepth,
    parentRunId,
  });

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Cohortis-Agent-Id": agent.id,
      "X-Cohortis-Run-Id": run.id,
      ...(agent.webhookHeaders || {}),
    };

    if (agent.webhookSecret) {
      headers["Authorization"] = `Bearer ${agent.webhookSecret}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      EXTERNAL_TIMEOUT_MS
    );

    const response = await fetch(agent.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task,
        agentId: agent.id,
        agentName: agent.name,
        runId: run.id,
        workspaceId,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      await updateAgentRun(run.id, {
        status: "failed",
        completedAt: new Date(),
        durationMs,
        errorMessage: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
      });
      await incrementAgentTaskCount(agent.id, false);
      notificationBus.emitNotificationUpdate(agent.userId);

      return {
        runId: run.id,
        status: "failed" as const,
        error: `External agent returned HTTP ${response.status}`,
        durationMs,
      };
    }

    const data: ExternalAgentResponse = await response.json();
    const resultText = data.result || "External agent completed (no response body)";
    const status = data.status === "failed" ? "failed" : "completed";

    await updateAgentRun(run.id, {
      status,
      completedAt: new Date(),
      durationMs,
      resultSummary: resultText.slice(0, 1000),
      resultFull: resultText,
      errorMessage: data.error || undefined,
    });

    await incrementAgentTaskCount(agent.id, status === "completed");
    notificationBus.emitNotificationUpdate(agent.userId);

    return {
      runId: run.id,
      status: status as "completed" | "failed",
      result: resultText,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.name === "AbortError"
          ? `External agent timed out after ${EXTERNAL_TIMEOUT_MS / 1000}s`
          : error.message
        : String(error);

    await updateAgentRun(run.id, {
      status: "failed",
      completedAt: new Date(),
      durationMs,
      errorMessage,
    });

    await incrementAgentTaskCount(agent.id, false);
    notificationBus.emitNotificationUpdate(agent.userId);

    return {
      runId: run.id,
      status: "failed" as const,
      error: errorMessage,
      durationMs,
    };
  }
}
