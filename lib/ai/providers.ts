import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { customProvider } from "ai";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const cohortisProvider = customProvider({
  languageModels: {
    "gpt-5.2": openai("gpt-4o"),
    "gpt-4o-mini": openai("gpt-4o-mini"),
    "claude-opus-4-6": anthropic("claude-opus-4-6"),
    "claude-sonnet-4-6": anthropic("claude-sonnet-4-6"),
  },
});

const VALID_MODELS = new Set([
  "gpt-5.2",
  "gpt-4o-mini",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
]);

export function safeModelId(model: string | null | undefined): string {
  if (model && VALID_MODELS.has(model)) return model;
  return "gpt-5.2";
}

export function getModel(modelId: string) {
  return cohortisProvider.languageModel(safeModelId(modelId));
}

export const MODEL_COSTS_PER_1K_TOKENS: Record<string, number> = {
  "gpt-5.2": 0.015,
  "gpt-4o-mini": 0.0003,
  "claude-opus-4-6": 0.075,
  "claude-sonnet-4-6": 0.015,
  default: 0.015,
};

export function estimateCostUsd(
  tokensUsed: number,
  modelId: string
): number {
  const rate =
    MODEL_COSTS_PER_1K_TOKENS[modelId] ??
    MODEL_COSTS_PER_1K_TOKENS["default"];
  return (tokensUsed / 1000) * rate;
}
