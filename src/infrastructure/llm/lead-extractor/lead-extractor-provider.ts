import type { ServerEnv } from "@/lib/env";
import type { LeadExtractorPort } from "@/application/voice/lead-extraction-result";
import { DeepSeekLeadExtractor } from "./deepseek-lead-extractor";
import { MockLeadExtractor } from "./mock-lead-extractor";
import { OpenAiLeadExtractor } from "./openai-lead-extractor";

export type LeadExtractorProviderName = "mock" | "deepseek" | "openai";

export interface LeadExtractorConfig {
  provider?: string;
  model?: string;
  deepseekApiKey?: string;
  openaiApiKey?: string;
}

function normalizeProvider(value: string | undefined): LeadExtractorProviderName | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "mock" || normalized === "deepseek" || normalized === "openai") {
    return normalized;
  }
  return null;
}

export function createLeadExtractor(config: LeadExtractorConfig): LeadExtractorPort | undefined {
  const provider = normalizeProvider(config.provider);
  if (!provider) {
    return undefined;
  }

  if (provider === "mock") {
    return new MockLeadExtractor();
  }

  if (provider === "deepseek") {
    return config.deepseekApiKey
      ? new DeepSeekLeadExtractor({
          apiKey: config.deepseekApiKey,
          model: config.model || "deepseek-chat",
        })
      : undefined;
  }

  return config.openaiApiKey
    ? new OpenAiLeadExtractor({
        apiKey: config.openaiApiKey,
        model: config.model || "gpt-4o-mini",
      })
    : undefined;
}

export function createLeadExtractorFromEnv(env: ServerEnv): LeadExtractorPort | undefined {
  return createLeadExtractor({
    provider: env.LEAD_EXTRACTOR_PROVIDER,
    model: env.LEAD_EXTRACTOR_MODEL,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
  });
}
