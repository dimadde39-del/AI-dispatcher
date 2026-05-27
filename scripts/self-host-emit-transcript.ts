import { pathToFileURL } from "node:url";
import {
  SELF_HOST_VOICE_WEBHOOK_SECRET_HEADER,
  type SelfHostInternalEventPayload,
} from "../src/infrastructure/voice/self-host";
import { loadEnvFiles } from "./load-env";

export type ManualTranscriptScenario = "noisy-ru" | "background" | "gas";

interface ManualTranscriptScenarioDefinition {
  transcript: string;
  durationSeconds: number;
}

export const MANUAL_TRANSCRIPT_SCENARIOS: Record<ManualTranscriptScenario, ManualTranscriptScenarioDefinition> = {
  "noisy-ru": {
    transcript:
      "здрастпшпшпшуйте менщщавзщвя течь да ебанный кранладыоаыд да заткни ты этого ребенка опадвпл вы меня слышыте алвл",
    durationSeconds: 34,
  },
  background: {
    transcript:
      "Жена: алло вы сантехник можете к нам приехать? Муж под краном орет: ну ебта ты звонишь там давай по быстрее. Жена: да да говорю уже, так на чем я остановилась, адрес да?",
    durationSeconds: 42,
  },
  gas: {
    transcript: "алло пахнет газом дома ребенок орет я не знаю что делать",
    durationSeconds: 22,
  },
};

interface BuildSelfHostTranscriptEmitEventsInput {
  transcript: string;
  providerCallId?: string;
  aiNumber?: string;
  customerPhone?: string | null;
  startedAt?: string;
  durationSeconds?: number;
  timestampMs?: number;
}

interface EmitConfig {
  endpointUrl: string;
  transcript: string;
  scenario: ManualTranscriptScenario | "custom";
  dryRun: boolean;
  providerCallId?: string;
  aiNumber?: string;
  customerPhone?: string | null;
  startedAt?: string;
  durationSeconds?: number;
}

export interface DryRunPayloadSummary {
  endpointUrl: string;
  scenario: ManualTranscriptScenario | "custom";
  providerCallId: string;
  dryRun: true;
  eventCount: number;
  events: Array<{
    provider: "self-host";
    payloadType: SelfHostInternalEventPayload["type"];
    normalizedEventType: "CALL_STARTED" | "TRANSCRIPT_UPDATED" | "CALL_ENDED";
    providerCallId: string;
    hasTranscript: boolean;
    transcriptLength: number;
    hasSummary: boolean;
    hasRecordingUrl: boolean;
  }>;
}

export interface SafeWebhookResult {
  eventType: "CALL_STARTED" | "TRANSCRIPT_UPDATED" | "CALL_ENDED";
  status: "ok" | "ignored" | "error";
  httpStatus: number;
  callId?: string;
  leadId?: string;
  confidence?: string;
  requiresCallback?: boolean;
  reason?: string;
}

function flagValue(name: string): string | null {
  const args = process.argv.slice(2);
  const prefix = `${name}=`;
  const inlineValue = args.find((arg) => arg.startsWith(prefix));
  if (inlineValue) {
    return inlineValue.slice(prefix.length);
  }

  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function assertScenario(value: string): ManualTranscriptScenario {
  if (value === "noisy-ru" || value === "background" || value === "gas") {
    return value;
  }

  throw new Error(`Unknown transcript scenario: ${value}`);
}

function transcriptFromArgs(): {
  transcript: string;
  scenario: ManualTranscriptScenario | "custom";
  durationSeconds?: number;
} {
  const text = flagValue("--text");
  const scenarioArg = flagValue("--scenario");
  if (text && scenarioArg) {
    throw new Error("Use either --text or --scenario, not both.");
  }

  if (text) {
    const transcript = text.trim();
    if (!transcript) {
      throw new Error("--text must not be empty.");
    }

    return {
      transcript,
      scenario: "custom",
    };
  }

  const scenario = scenarioArg ? assertScenario(scenarioArg) : "noisy-ru";
  const definition = MANUAL_TRANSCRIPT_SCENARIOS[scenario];
  return {
    transcript: definition.transcript,
    scenario,
    durationSeconds: definition.durationSeconds,
  };
}

function optionalCleanString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numericFlagValue(name: string): number | undefined {
  const value = flagValue(name);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return Math.round(parsed);
}

function addSeconds(timestamp: string, seconds: number): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  return new Date(parsed + seconds * 1000).toISOString();
}

function defaultEndpointUrl(): string {
  const baseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return new URL("/api/webhooks/self-host-voice", baseUrl).toString();
}

function endpointUrlFromArgs(): string {
  return flagValue("--url") ?? defaultEndpointUrl();
}

function safeEndpointUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "invalid-url";
  }
}

function normalizedEventType(
  type: SelfHostInternalEventPayload["type"],
): DryRunPayloadSummary["events"][number]["normalizedEventType"] {
  switch (type) {
    case "call_started":
      return "CALL_STARTED";
    case "transcript_updated":
      return "TRANSCRIPT_UPDATED";
    case "call_ended":
      return "CALL_ENDED";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalStringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalBooleanField(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function buildSelfHostTranscriptEmitEvents(
  input: BuildSelfHostTranscriptEmitEventsInput,
): SelfHostInternalEventPayload[] {
  const timestampMs = input.timestampMs ?? Date.now();
  const startedAt = input.startedAt ?? new Date(timestampMs).toISOString();
  const durationSeconds = input.durationSeconds ?? 30;
  const endedAt = addSeconds(startedAt, durationSeconds);
  const providerCallId = input.providerCallId ?? `selfhost-manual-${timestampMs}`;
  const aiNumber = input.aiNumber ?? "web-dev";
  const customerPhone = input.customerPhone ?? null;

  return [
    {
      provider: "self-host",
      type: "call_started",
      providerCallId,
      customerPhone,
      aiNumber,
      startedAt,
    },
    {
      provider: "self-host",
      type: "transcript_updated",
      providerCallId,
      transcript: input.transcript,
      timestamp: addSeconds(startedAt, Math.min(10, durationSeconds)),
    },
    {
      provider: "self-host",
      type: "call_ended",
      providerCallId,
      customerPhone,
      aiNumber,
      startedAt,
      endedAt,
      durationSeconds,
      transcript: input.transcript,
      summary: null,
      recordingUrl: null,
    },
  ];
}

export function buildDryRunPayloadSummary(
  endpointUrl: string,
  scenario: ManualTranscriptScenario | "custom",
  events: SelfHostInternalEventPayload[],
): DryRunPayloadSummary {
  const providerCallId = events[0]?.providerCallId ?? "unknown";

  return {
    endpointUrl: safeEndpointUrl(endpointUrl),
    scenario,
    providerCallId,
    dryRun: true,
    eventCount: events.length,
    events: events.map((event) => {
      const transcript = "transcript" in event ? event.transcript : null;
      return {
        provider: "self-host",
        payloadType: event.type,
        normalizedEventType: normalizedEventType(event.type),
        providerCallId: event.providerCallId,
        hasTranscript: Boolean(transcript),
        transcriptLength: typeof transcript === "string" ? transcript.length : 0,
        hasSummary: "summary" in event ? Boolean(event.summary) : false,
        hasRecordingUrl: "recordingUrl" in event ? Boolean(event.recordingUrl) : false,
      };
    }),
  };
}

export function safeWebhookResultFromResponse(
  eventType: SafeWebhookResult["eventType"],
  httpStatus: number,
  body: unknown,
): SafeWebhookResult {
  const record = isRecord(body) ? body : {};
  const ok = record.ok === true;
  const ignored = record.ignored === true;
  const status = ok ? (ignored ? "ignored" : "ok") : "error";
  const result: SafeWebhookResult = {
    eventType,
    status,
    httpStatus,
  };

  const callId = optionalStringField(record.callId);
  if (callId) {
    result.callId = callId;
  }

  const leadId = optionalStringField(record.leadId);
  if (leadId) {
    result.leadId = leadId;
  }

  const confidence = optionalStringField(record.confidence);
  if (confidence) {
    result.confidence = confidence;
  }

  const requiresCallback = optionalBooleanField(record.requiresCallback);
  if (requiresCallback !== undefined) {
    result.requiresCallback = requiresCallback;
  }

  const reason = optionalStringField(record.reason);
  if (reason) {
    result.reason = reason;
  }

  return result;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const secret = process.env.SELF_HOST_VOICE_WEBHOOK_SECRET?.trim();
  if (secret) {
    headers[SELF_HOST_VOICE_WEBHOOK_SECRET_HEADER] = secret;
  }

  return headers;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      error: "NON_JSON_RESPONSE",
    };
  }
}

async function postEvent(endpointUrl: string, event: SelfHostInternalEventPayload): Promise<SafeWebhookResult> {
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(event),
  });
  const body = await readJsonResponse(response);
  return safeWebhookResultFromResponse(normalizedEventType(event.type), response.status, body);
}

function buildConfig(): EmitConfig {
  const transcriptConfig = transcriptFromArgs();
  return {
    endpointUrl: endpointUrlFromArgs(),
    transcript: transcriptConfig.transcript,
    scenario: transcriptConfig.scenario,
    dryRun: hasFlag("--dry-run"),
    providerCallId: flagValue("--provider-call-id") ?? undefined,
    aiNumber: flagValue("--ai-number") ?? undefined,
    customerPhone: optionalCleanString(flagValue("--customer-phone")),
    startedAt: flagValue("--started-at") ?? undefined,
    durationSeconds: numericFlagValue("--duration-seconds") ?? transcriptConfig.durationSeconds,
  };
}

export async function runSelfHostTranscriptEmit(): Promise<void> {
  loadEnvFiles();

  const config = buildConfig();
  const events = buildSelfHostTranscriptEmitEvents({
    transcript: config.transcript,
    providerCallId: config.providerCallId,
    aiNumber: config.aiNumber,
    customerPhone: config.customerPhone,
    startedAt: config.startedAt,
    durationSeconds: config.durationSeconds,
  });

  if (config.dryRun) {
    console.log(JSON.stringify(buildDryRunPayloadSummary(config.endpointUrl, config.scenario, events), null, 2));
    return;
  }

  console.warn("This may create a lead and send a Telegram card.");
  console.log(
    JSON.stringify(
      {
        endpointUrl: safeEndpointUrl(config.endpointUrl),
        scenario: config.scenario,
        providerCallId: events[0]?.providerCallId,
        eventCount: events.length,
        dryRun: false,
      },
      null,
      2,
    ),
  );

  for (const event of events) {
    const result = await postEvent(config.endpointUrl, event);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "error") {
      throw new Error(`Self-host webhook returned HTTP ${result.httpStatus} for ${result.eventType}.`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSelfHostTranscriptEmit().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown self-host transcript emit error";
    console.error(`Self-host transcript emit failed: ${message}`);
    process.exitCode = 1;
  });
}
