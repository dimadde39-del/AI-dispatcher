import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDryRunPayloadSummary,
  buildSelfHostTranscriptEmitEvents,
  MANUAL_TRANSCRIPT_SCENARIOS,
  safeWebhookResultFromResponse,
} from "../scripts/self-host-emit-transcript";
import { buildSelfHostSimulationEvents } from "../scripts/self-host-voice-simulate";
import {
  parseSelfHostVoiceEventPayload,
  verifySelfHostVoiceWebhookSecret,
} from "../src/infrastructure/voice/self-host";
import { publicEnvSchema, serverEnvSchema } from "../src/lib/env";

async function withEnv<T>(updates: Record<string, string | undefined>, callback: () => T | Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(updates)) {
    previous.set(key, process.env[key]);
    const value = updates[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("Self-host parser handles call_started events", () => {
  const event = parseSelfHostVoiceEventPayload({
    provider: "self-host",
    type: "call_started",
    providerCallId: "local-test-123",
    customerPhone: null,
    aiNumber: "web-dev",
    startedAt: "2026-05-24T10:00:00.000Z",
  });

  assert.equal(event.type, "CALL_STARTED");
  assert.equal(event.provider, "self-host");
  assert.equal(event.providerCallId, "local-test-123");
  assert.equal(event.customerPhone, null);
  assert.equal(event.aiNumber, "web-dev");
  assert.equal(event.startedAt, "2026-05-24T10:00:00.000Z");
});

test("Self-host parser handles transcript_updated events", () => {
  const event = parseSelfHostVoiceEventPayload({
    provider: "self-host",
    type: "transcript_updated",
    providerCallId: "local-test-123",
    transcript: "Здравствуйте, у меня труба течёт под ванной",
    timestamp: "2026-05-24T10:00:12.000Z",
  });

  assert.equal(event.type, "TRANSCRIPT_UPDATED");
  assert.equal(event.providerCallId, "local-test-123");
  assert.equal(event.transcriptFragment, "Здравствуйте, у меня труба течёт под ванной");
  assert.equal(event.transcript, "Здравствуйте, у меня труба течёт под ванной");
  assert.equal(event.timestamp, "2026-05-24T10:00:12.000Z");
});

test("Self-host parser handles call_ended events", () => {
  const event = parseSelfHostVoiceEventPayload({
    provider: "self-host",
    type: "call_ended",
    providerCallId: "local-test-123",
    customerPhone: null,
    aiNumber: "web-dev",
    startedAt: "2026-05-24T10:00:00.000Z",
    endedAt: "2026-05-24T10:00:45.000Z",
    durationSeconds: 45,
    transcript:
      "Здравствуйте, у меня труба течёт под ванной. Адрес Шымкент, Нурсат, дом 15. Срочно. Меня зовут Дима.",
    summary: "Клиент сообщил о протечке трубы под ванной. Адрес: Шымкент, Нурсат, дом 15. Срочно.",
    recordingUrl: null,
  });

  assert.equal(event.type, "CALL_ENDED");
  assert.equal(event.providerCallId, "local-test-123");
  assert.equal(event.durationSeconds, 45);
  assert.match(event.transcript ?? "", /труба течёт/iu);
  assert.match(event.summary ?? "", /протечке трубы/iu);
  assert.equal(event.recordingUrl, null);
});

test("Self-host parser preserves unknown events without crashing", () => {
  const event = parseSelfHostVoiceEventPayload({
    provider: "self-host",
    type: "language_route_debug",
    providerCallId: "local-test-123",
  });

  assert.equal(event.type, "UNKNOWN");
  assert.equal(event.provider, "self-host");
  assert.equal(event.eventType, "language_route_debug");
  assert.equal(event.providerCallId, "local-test-123");
});

test("Self-host simulation scenarios build normalized call-end reports", () => {
  for (const scenario of ["ru", "kz", "mix", "gas"] as const) {
    const events = buildSelfHostSimulationEvents({
      scenario,
      providerCallId: `local-test-${scenario}`,
      startedAt: "2026-05-24T10:00:00.000Z",
    });
    const parsedEndEvent = parseSelfHostVoiceEventPayload(events[2]);

    assert.equal(events.length, 3);
    assert.equal(parsedEndEvent.type, "CALL_ENDED");
    assert.equal(parsedEndEvent.providerCallId, `local-test-${scenario}`);
    assert.equal(Boolean(parsedEndEvent.transcript), true);
    assert.equal(Boolean(parsedEndEvent.summary), true);
  }
});

test("Self-host transcript emitter dry-run summary exposes payload shape only", () => {
  const events = buildSelfHostTranscriptEmitEvents({
    transcript: MANUAL_TRANSCRIPT_SCENARIOS["noisy-ru"].transcript,
    timestampMs: 1_779_912_000_000,
    startedAt: "2026-05-28T10:00:00.000Z",
    aiNumber: "+77273330001",
  });

  const summary = buildDryRunPayloadSummary(
    "http://localhost:3000/api/webhooks/self-host-voice?token=secret-value",
    "noisy-ru",
    events,
  );

  assert.equal(summary.providerCallId, "selfhost-manual-1779912000000");
  assert.equal(summary.eventCount, 3);
  assert.deepEqual(
    summary.events.map((event) => event.normalizedEventType),
    ["CALL_STARTED", "TRANSCRIPT_UPDATED", "CALL_ENDED"],
  );
  assert.deepEqual(
    summary.events.map((event) => event.payloadType),
    ["call_started", "transcript_updated", "call_ended"],
  );
  assert.equal(summary.events[0]?.hasTranscript, false);
  assert.equal(summary.events[1]?.hasTranscript, true);
  assert.equal(summary.events[2]?.hasTranscript, true);
  assert.equal(summary.events[1]?.transcriptLength, MANUAL_TRANSCRIPT_SCENARIOS["noisy-ru"].transcript.length);
  assert.doesNotMatch(JSON.stringify(summary), /secret-value/u);
  assert.doesNotMatch(JSON.stringify(summary), /здраст/u);
});

test("Self-host transcript emitter predefined noisy scenarios exist", () => {
  assert.equal(
    MANUAL_TRANSCRIPT_SCENARIOS["noisy-ru"].transcript,
    "здрастпшпшпшуйте менщщавзщвя течь да ебанный кранладыоаыд да заткни ты этого ребенка опадвпл вы меня слышыте алвл",
  );
  assert.equal(
    MANUAL_TRANSCRIPT_SCENARIOS.background.transcript,
    "Жена: алло вы сантехник можете к нам приехать? Муж под краном орет: ну ебта ты звонишь там давай по быстрее. Жена: да да говорю уже, так на чем я остановилась, адрес да?",
  );
  assert.equal(
    MANUAL_TRANSCRIPT_SCENARIOS.gas.transcript,
    "алло пахнет газом дома ребенок орет я не знаю что делать",
  );
});

test("Self-host transcript emitter printable results do not include secrets", () => {
  const result = safeWebhookResultFromResponse("CALL_ENDED", 200, {
    ok: true,
    callId: "call-123",
    leadId: "lead-456",
    confidence: "low",
    requiresCallback: true,
    SELF_HOST_VOICE_WEBHOOK_SECRET: "secret-value",
    token: "secret-value",
  });

  const printed = JSON.stringify(result);
  assert.equal(result.status, "ok");
  assert.equal(result.callId, "call-123");
  assert.equal(result.leadId, "lead-456");
  assert.equal(result.confidence, "low");
  assert.equal(result.requiresCallback, true);
  assert.doesNotMatch(printed, /secret-value/u);
  assert.doesNotMatch(printed, /SELF_HOST_VOICE_WEBHOOK_SECRET/u);
});

test("Self-host webhook verifier accepts only the configured header secret", async () => {
  await withEnv({ SELF_HOST_VOICE_WEBHOOK_SECRET: "expected-secret", NODE_ENV: "test" }, () => {
    assert.equal(verifySelfHostVoiceWebhookSecret(new Headers({ "x-self-host-voice-secret": "expected-secret" })), true);
    assert.equal(verifySelfHostVoiceWebhookSecret(new Headers({ "x-self-host-voice-secret": "wrong-secret" })), false);
    assert.equal(verifySelfHostVoiceWebhookSecret(new Headers()), false);
  });
});

test("Self-host webhook verifier allows missing secret outside production only", async () => {
  await withEnv({ SELF_HOST_VOICE_WEBHOOK_SECRET: undefined, NODE_ENV: "development" }, () => {
    assert.equal(verifySelfHostVoiceWebhookSecret(new Headers()), true);
  });
  await withEnv({ SELF_HOST_VOICE_WEBHOOK_SECRET: undefined, NODE_ENV: "production" }, () => {
    assert.equal(verifySelfHostVoiceWebhookSecret(new Headers()), false);
  });
});

test("Self-host STT env parsing defaults the voice-agent URL and validates production gate", () => {
  const publicEnv = publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  });
  assert.equal(publicEnv.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL, "http://localhost:8001");

  const serverEnv = serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    ENABLE_DEV_SELFHOST_STT: "true",
  });
  assert.equal(serverEnv.ENABLE_DEV_SELFHOST_STT, "true");
});
