import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  AiNumber,
  AssistantProfile,
  AuditLog,
  Call,
  CallEvent,
  CreateAiNumberInput,
  CreateAssistantProfileInput,
  CreateAuditLogInput,
  CreateCallEventInput,
  CreateCallInput,
  CreateLeadEventInput,
  CreateLeadInput,
  CreateMasterInput,
  CreateTelegramMessageInput,
  Lead,
  LeadEvent,
  Master,
  SafetyFlag,
  TelegramMessage,
  UpdateCallInput,
  UpdateLeadInput,
} from "../src/domain";
import type { MasterInterfacePort, RepositoryContext } from "../src/application/ports";
import { extractLeadFromVoiceEvent } from "../src/application/voice/extract-lead-from-voice-event";
import { handleCallEnded } from "../src/application/voice/handleVoiceEvent";
import { resolveMasterForVoiceEvent } from "../src/application/voice/resolve-master-for-voice-event";
import { parseVapiWebhookPayload } from "../src/infrastructure/voice/vapi/vapi-webhook-parser";
import { verifyVapiWebhookSecret } from "../src/infrastructure/voice/vapi/vapi-webhook-verifier";
import type { VoiceCallEndedEvent } from "../src/interfaces/voice-event";

const timestamp = "2026-05-23T10:00:00.000Z";
const masterId = "22222222-2222-4222-8222-222222222222";
const callId = "33333333-3333-4333-8333-333333333333";
const leadId = "44444444-4444-4444-8444-444444444444";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/fixtures/${name}`, "utf8")) as unknown;
}

function makeMaster(overrides: Partial<Master> = {}): Master {
  return {
    id: masterId,
    name: "Demo Azamat",
    phone: "+77001234567",
    city: "Almaty",
    tradeType: "PLUMBING",
    telegramChatId: "123456",
    status: "TRIAL",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function makeAiNumber(overrides: Partial<AiNumber> = {}): AiNumber {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    phoneNumber: "+77273330001",
    provider: "vapi",
    providerNumberId: "vapi-number-1",
    masterId,
    status: "ASSIGNED",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function unsupported(operation: string): never {
  throw new Error(`${operation} is not implemented in this test.`);
}

interface MemoryState {
  masters: Master[];
  aiNumbers: AiNumber[];
  calls: Call[];
  callEvents: CallEvent[];
  leads: Lead[];
  leadEvents: LeadEvent[];
  telegramMessages: TelegramMessage[];
  auditLogs: AuditLog[];
}

function nextId(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(12, "0")}`;
}

function makeCall(input: CreateCallInput, id: string): Call {
  return {
    id,
    masterId: input.masterId ?? null,
    provider: input.provider,
    providerCallId: input.providerCallId,
    customerPhone: input.customerPhone ?? null,
    aiNumber: input.aiNumber ?? null,
    status: input.status ?? "STARTED",
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    durationSeconds: input.durationSeconds ?? null,
    transcript: input.transcript ?? null,
    recordingUrl: input.recordingUrl ?? null,
    rawPayload: input.rawPayload ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createMemoryRepositories(overrides: Partial<MemoryState> = {}): {
  repositories: RepositoryContext;
  state: MemoryState;
} {
  const state: MemoryState = {
    masters: [makeMaster()],
    aiNumbers: [makeAiNumber()],
    calls: [],
    callEvents: [],
    leads: [],
    leadEvents: [],
    telegramMessages: [],
    auditLogs: [],
    ...overrides,
  };

  const repositories: RepositoryContext = {
    masters: {
      create: async (input: CreateMasterInput) => {
        const master = makeMaster({
          id: nextId("66666666-6666-4666-8666", state.masters.length),
          ...input,
          telegramChatId: input.telegramChatId ?? null,
          status: "DRAFT",
        });
        state.masters.push(master);
        return master;
      },
      getById: async (id) => state.masters.find((master) => master.id === id) ?? null,
      findByPhone: async (phone) => state.masters.find((master) => master.phone === phone) ?? null,
      list: async () => state.masters,
      update: async () => unsupported("masters.update"),
    },
    assistantProfiles: {
      create: async (input: CreateAssistantProfileInput): Promise<AssistantProfile> => ({
        id: nextId("77777777-7777-4777-8777", 0),
        masterId: input.masterId,
        displayName: input.displayName,
        language: input.language,
        promptVersion: input.promptVersion,
        voiceProvider: input.voiceProvider,
        isActive: input.isActive,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      listByMaster: async () => [],
    },
    aiNumbers: {
      create: async (input: CreateAiNumberInput) => {
        const aiNumber = makeAiNumber({
          id: nextId("88888888-8888-4888-8888", state.aiNumbers.length),
          phoneNumber: input.phoneNumber,
          provider: input.provider,
          providerNumberId: input.providerNumberId ?? null,
          masterId: input.masterId ?? null,
          status: input.status ?? "AVAILABLE",
        });
        state.aiNumbers.push(aiNumber);
        return aiNumber;
      },
      getById: async (id) => state.aiNumbers.find((number) => number.id === id) ?? null,
      findByPhoneNumber: async (phoneNumber) =>
        state.aiNumbers.find((number) => number.phoneNumber === phoneNumber) ?? null,
      list: async () => state.aiNumbers,
      listAvailable: async () => state.aiNumbers.filter((number) => number.status === "AVAILABLE"),
      update: async () => unsupported("aiNumbers.update"),
    },
    calls: {
      create: async (input) => {
        const call = makeCall(input, state.calls.length === 0 ? callId : nextId("99999999-9999-4999-8999", state.calls.length));
        state.calls.push(call);
        return call;
      },
      getById: async (id) => state.calls.find((call) => call.id === id) ?? null,
      findByProviderCallId: async (provider, providerCallId) =>
        state.calls.find((call) => call.provider === provider && call.providerCallId === providerCallId) ?? null,
      list: async () => state.calls,
      listByMasterAndPeriod: async () => state.calls,
      update: async (id, input: UpdateCallInput) => {
        const index = state.calls.findIndex((call) => call.id === id);
        if (index === -1) {
          unsupported("calls.update unknown id");
        }

        state.calls[index] = {
          ...state.calls[index],
          ...input,
          updatedAt: timestamp,
        };
        return state.calls[index];
      },
    },
    callEvents: {
      create: async (input: CreateCallEventInput) => {
        const event: CallEvent = {
          id: nextId("aaaaaaaa-aaaa-4aaa-8aaa", state.callEvents.length),
          callId: input.callId,
          eventType: input.eventType,
          payload: input.payload,
          createdAt: timestamp,
        };
        state.callEvents.push(event);
        return event;
      },
      listByCall: async (id) => state.callEvents.filter((event) => event.callId === id),
    },
    leads: {
      create: async (input: CreateLeadInput) => {
        const lead: Lead = {
          id: state.leads.length === 0 ? leadId : nextId("bbbbbbbb-bbbb-4bbb-8bbb", state.leads.length),
          masterId: input.masterId,
          callId: input.callId ?? null,
          customerName: input.customerName ?? null,
          customerPhone: input.customerPhone ?? null,
          problem: input.problem,
          address: input.address ?? null,
          urgency: input.urgency,
          aiSummary: input.aiSummary,
          aiScore: input.aiScore ?? "WARM",
          safetyFlag: input.safetyFlag ?? "NONE",
          status: input.status ?? "NEW",
          acceptedAt: null,
          completedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        state.leads.push(lead);
        return lead;
      },
      getById: async (id) => state.leads.find((lead) => lead.id === id) ?? null,
      findByCallId: async (id) => state.leads.find((lead) => lead.callId === id) ?? null,
      list: async () => state.leads,
      listByMasterAndPeriod: async () => state.leads,
      update: async (id, input: UpdateLeadInput) => {
        const index = state.leads.findIndex((lead) => lead.id === id);
        if (index === -1) {
          unsupported("leads.update unknown id");
        }

        state.leads[index] = {
          ...state.leads[index],
          ...input,
          updatedAt: timestamp,
        };
        return state.leads[index];
      },
    },
    leadEvents: {
      create: async (input: CreateLeadEventInput) => {
        const event: LeadEvent = {
          id: nextId("cccccccc-cccc-4ccc-8ccc", state.leadEvents.length),
          leadId: input.leadId,
          eventType: input.eventType,
          payload: input.payload,
          createdAt: timestamp,
        };
        state.leadEvents.push(event);
        return event;
      },
      listByLead: async (id) => state.leadEvents.filter((event) => event.leadId === id),
    },
    telegramMessages: {
      create: async (input: CreateTelegramMessageInput) => {
        const message: TelegramMessage = {
          id: nextId("dddddddd-dddd-4ddd-8ddd", state.telegramMessages.length),
          leadId: input.leadId ?? null,
          masterId: input.masterId ?? null,
          chatId: input.chatId,
          messageId: input.messageId,
          messageType: input.messageType,
          createdAt: timestamp,
        };
        state.telegramMessages.push(message);
        return message;
      },
      listByLead: async (id) => state.telegramMessages.filter((message) => message.leadId === id),
    },
    subscriptions: {
      create: async () => unsupported("subscriptions.create"),
      getByMaster: async () => null,
      update: async () => unsupported("subscriptions.update"),
    },
    valueReports: {
      create: async () => unsupported("valueReports.create"),
      list: async () => [],
      listByMaster: async () => [],
    },
    auditLogs: {
      create: async (input: CreateAuditLogInput) => {
        const auditLog: AuditLog = {
          id: nextId("eeeeeeee-eeee-4eee-8eee", state.auditLogs.length),
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          eventType: input.eventType,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          payload: input.payload,
          createdAt: timestamp,
        };
        state.auditLogs.push(auditLog);
        return auditLog;
      },
      list: async () => state.auditLogs,
    },
  };

  return { repositories, state };
}

function createMasterInterfaceMock(): {
  masterInterface: MasterInterfacePort;
  sentLeadIds: string[];
} {
  const sentLeadIds: string[] = [];

  return {
    sentLeadIds,
    masterInterface: {
      sendLeadCard: async ({ lead, master }) => {
        sentLeadIds.push(lead.id);
        return {
          chatId: master.telegramChatId ?? "123456",
          messageId: "9001",
        };
      },
      editLeadCard: async () => unsupported("masterInterface.editLeadCard"),
      answerCallback: async () => unsupported("masterInterface.answerCallback"),
    },
  };
}

function callEndedEvent(overrides: Partial<VoiceCallEndedEvent> = {}): VoiceCallEndedEvent {
  return {
    provider: "vapi",
    type: "CALL_ENDED",
    providerCallId: "vapi-call-fixture-1",
    customerPhone: "+77007654321",
    aiNumber: "+77273330001",
    startedAt: "2026-05-23T10:00:00.000Z",
    endedAt: "2026-05-23T10:03:00.000Z",
    durationSeconds: 180,
    transcript: "Клиент: срочно течет труба под ванной. Адрес улица Абая 150.",
    summary: "Срочно течет труба под ванной. Адрес: улица Абая 150.",
    recordingUrl: "https://example.com/recording.mp3",
    rawPayload: {},
    ...overrides,
  };
}

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

test("Vapi parser handles call-started events", () => {
  const event = parseVapiWebhookPayload(fixture("vapi-call-started.json"));

  assert.equal(event.type, "CALL_STARTED");
  assert.equal(event.provider, "vapi");
  assert.equal(event.providerCallId, "vapi-call-fixture-1");
  assert.equal(event.customerPhone, "+77007654321");
  assert.equal(event.aiNumber, "+77273330001");
  assert.equal(event.startedAt, "2026-05-23T10:00:00.000Z");
});

test("Vapi parser handles end-of-call report events", () => {
  const event = parseVapiWebhookPayload(fixture("vapi-end-of-call-report.json"));

  assert.equal(event.type, "CALL_ENDED");
  assert.equal(event.providerCallId, "vapi-call-fixture-1");
  assert.equal(event.durationSeconds, 180);
  assert.match(event.transcript ?? "", /Срочно течет труба/);
  assert.match(event.summary ?? "", /Адрес/);
  assert.equal(event.recordingUrl, "https://example.com/recordings/vapi-call-fixture-1.mp3");
});

test("Vapi parser handles transcript update events", () => {
  const event = parseVapiWebhookPayload(fixture("vapi-transcript-update.json"));

  assert.equal(event.type, "TRANSCRIPT_UPDATED");
  assert.equal(event.providerCallId, "vapi-call-fixture-1");
  assert.equal(event.transcriptFragment, "Клиент: течет труба под ванной.");
  assert.equal(event.timestamp, "2026-05-23T10:01:00.000Z");
});

test("Vapi parser preserves unknown events without crashing", () => {
  const event = parseVapiWebhookPayload(fixture("vapi-unknown-event.json"));

  assert.equal(event.type, "UNKNOWN");
  assert.equal(event.eventType, "assistant-request");
  assert.equal(event.providerCallId, "vapi-call-fixture-1");
});

test("master resolution matches an assigned AI number", async () => {
  const { repositories, state } = createMemoryRepositories({
    aiNumbers: [makeAiNumber({ phoneNumber: "+77273330001" })],
  });
  const event = callEndedEvent({ aiNumber: "77273330001" });

  const result = await resolveMasterForVoiceEvent(repositories, event);

  assert.equal(result.reason, "AI_NUMBER_MATCH");
  assert.equal(result.master?.id, state.masters[0].id);
});

test("lead extraction marks leaking pipe as high urgency and hot", () => {
  const lead = extractLeadFromVoiceEvent(callEndedEvent());

  assert.equal(lead.urgency, "HIGH");
  assert.equal(lead.aiScore, "HOT");
  assert.equal(lead.safetyFlag, "NONE");
  assert.match(lead.problem, /течет труба/);
  assert.match(lead.address ?? "", /улица Абая 150/);
});

test("lead extraction detects gas, fire, and electric danger safety flags", () => {
  const cases: Array<[string, SafetyFlag]> = [
    ["Клиент говорит: запах газа в квартире.", "GAS"],
    ["Клиент говорит, что пожар и дым на кухне.", "FIRE"],
    ["Клиента ударило током, искрит проводка.", "ELECTRIC_DANGER"],
  ];

  for (const [text, expectedFlag] of cases) {
    const lead = extractLeadFromVoiceEvent(callEndedEvent({ summary: text, transcript: text }));
    assert.equal(lead.safetyFlag, expectedFlag);
    assert.equal(lead.urgency, "EMERGENCY");
  }
});

test("lead extraction falls back when transcript and summary are missing", () => {
  const lead = extractLeadFromVoiceEvent(callEndedEvent({ summary: null, transcript: null }));

  assert.equal(lead.problem, "Не удалось определить проблему");
  assert.equal(lead.aiSummary, "Не удалось определить проблему");
  assert.equal(lead.urgency, "MEDIUM");
  assert.equal(lead.aiScore, "WARM");
});

test("Vapi webhook verifier accepts only the configured header secret", async () => {
  await withEnv({ VAPI_WEBHOOK_SECRET: "expected-secret", NODE_ENV: "test" }, () => {
    assert.equal(verifyVapiWebhookSecret(new Headers({ "x-vapi-webhook-secret": "expected-secret" })), true);
    assert.equal(verifyVapiWebhookSecret(new Headers({ "x-vapi-webhook-secret": "wrong-secret" })), false);
    assert.equal(verifyVapiWebhookSecret(new Headers()), false);
  });
});

test("Vapi webhook verifier allows missing secret outside production only", async () => {
  await withEnv({ VAPI_WEBHOOK_SECRET: undefined, NODE_ENV: "development" }, () => {
    assert.equal(verifyVapiWebhookSecret(new Headers()), true);
  });
  await withEnv({ VAPI_WEBHOOK_SECRET: undefined, NODE_ENV: "production" }, () => {
    assert.equal(verifyVapiWebhookSecret(new Headers()), false);
  });
});

test("handleCallEnded creates a call, lead, call event, and Telegram message with mocked ports", async () => {
  const event = parseVapiWebhookPayload(fixture("vapi-end-of-call-report.json"));
  assert.equal(event.type, "CALL_ENDED");

  const { repositories, state } = createMemoryRepositories();
  const { masterInterface, sentLeadIds } = createMasterInterfaceMock();

  const result = await handleCallEnded(repositories, event as VoiceCallEndedEvent, {
    masterInterface,
  });

  assert.equal(result.callId, callId);
  assert.equal(result.leadId, leadId);
  assert.equal(result.confidence, "medium");
  assert.equal(result.requiresCallback, false);
  assert.equal(state.calls[0]?.status, "PROCESSED");
  assert.equal(state.calls[0]?.provider, "vapi");
  assert.equal(state.calls[0]?.providerCallId, "vapi-call-fixture-1");
  assert.equal(state.leads[0]?.callId, callId);
  assert.equal(state.leads[0]?.urgency, "HIGH");
  assert.equal(state.callEvents[0]?.eventType, "CALL_ENDED");
  assert.deepEqual(sentLeadIds, [leadId]);
  assert.equal(state.telegramMessages[0]?.leadId, leadId);
  assert.ok(state.auditLogs.some((log) => log.eventType === "VOICE_CALL_ENDED_LEAD_CREATED"));
});

test("handleCallEnded marks empty self-host transcript as no lead when there is no useful signal", async () => {
  const { repositories, state } = createMemoryRepositories();
  const { masterInterface, sentLeadIds } = createMasterInterfaceMock();
  const event = callEndedEvent({
    provider: "self-host",
    providerCallId: "selfhost-empty-1",
    customerPhone: null,
    transcript: null,
    summary: null,
    rawPayload: {
      confidence: "unusable",
      usable: false,
      requiresCallback: true,
      warnings: ["empty_transcript", "low_confidence"],
    },
  });

  const result = await handleCallEnded(repositories, event, {
    masterInterface,
  });

  assert.equal(result.ignored, true);
  assert.equal(result.reason, "EMPTY_TRANSCRIPT_NO_USEFUL_SIGNAL");
  assert.equal(result.confidence, "unusable");
  assert.equal(result.requiresCallback, true);
  assert.equal(state.calls[0]?.status, "NO_LEAD");
  assert.equal(state.leads.length, 0);
  assert.deepEqual(sentLeadIds, []);
  assert.ok(state.auditLogs.some((log) => log.eventType === "VOICE_CALL_ENDED_NO_LEAD"));
});

test("handleCallEnded creates callback-required lead for low-confidence self-host transcript", async () => {
  const { repositories, state } = createMemoryRepositories();
  const { masterInterface, sentLeadIds } = createMasterInterfaceMock();
  const event = callEndedEvent({
    provider: "self-host",
    providerCallId: "selfhost-low-1",
    transcript: "Течет вода, адрес плохо слышно.",
    summary: null,
    rawPayload: {
      score: 50,
      confidence: "low",
      usable: true,
      requiresCallback: true,
      warnings: ["low_confidence"],
    },
  });

  const result = await handleCallEnded(repositories, event, {
    masterInterface,
  });

  assert.equal(result.leadId, leadId);
  assert.equal(result.confidence, "low");
  assert.equal(result.requiresCallback, true);
  assert.equal(state.calls[0]?.status, "PROCESSED");
  assert.equal(state.leads[0]?.status, "CALLBACK_PENDING");
  assert.equal(state.leads[0]?.aiScore, "COLD");
  assert.deepEqual(sentLeadIds, [leadId]);
  assert.ok(state.leadEvents.some((eventRecord) => eventRecord.eventType === "VOICE_CALL_ENDED_CALLBACK_LEAD_CREATED"));
});
