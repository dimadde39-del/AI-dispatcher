export const DEFAULT_STT_SCENARIO_ID = "ru-urgent-plumbing";
export const DEFAULT_STT_MODE = "deepgram-ru-nova2";
export const DEFAULT_STT_TRANSCRIPT =
  "Здравствуйте, у меня труба течет под ванной. Адрес Шымкент, Нурсат, дом 15. Срочно. Меня зовут Дима.";

export interface MockExperimentPayload {
  mode: "mock";
  scenarioId: string;
  text: string;
}

export interface MockEmitPayload {
  provider: "mock";
  text: string;
}

export function flagValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

export function voiceAgentUrl(): string {
  return (process.env.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL?.trim() || "http://localhost:8001").replace(/\/+$/u, "");
}

export function buildMockExperimentPayload(input?: {
  text?: string;
  scenarioId?: string;
}): MockExperimentPayload {
  return {
    mode: "mock",
    scenarioId: input?.scenarioId ?? DEFAULT_STT_SCENARIO_ID,
    text: input?.text ?? DEFAULT_STT_TRANSCRIPT,
  };
}

export function buildMockEmitPayload(text = DEFAULT_STT_TRANSCRIPT): MockEmitPayload {
  return {
    provider: "mock",
    text,
  };
}

export function audioContentTypeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (lower.endsWith(".webm")) {
    return "audio/webm";
  }

  return "application/octet-stream";
}

export function safeBackendResults(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const record = item as Record<string, unknown>;
    return {
      ok: record.ok,
      eventType: record.eventType,
      callId: record.callId,
      leadId: record.leadId,
      telegramMessageId: record.telegramMessageId,
      ignored: record.ignored,
      reason: record.reason,
      telegramConfigured: record.telegramConfigured,
    };
  });
}
