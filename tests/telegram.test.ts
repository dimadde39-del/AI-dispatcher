import assert from "node:assert/strict";
import test from "node:test";
import type {
  AuditLog,
  Call,
  CreateAuditLogInput,
  CreateLeadEventInput,
  Lead,
  LeadEvent,
  Master,
} from "../src/domain";
import type {
  EditLeadCardInput,
  MasterInterfacePort,
  RepositoryContext,
  AnswerMasterCallbackInput,
} from "../src/application/ports";
import { handleTelegramLeadCallback } from "../src/application/use-cases/handleTelegramLeadCallback";
import {
  buildTelegramLeadCallbackData,
  parseTelegramLeadCallbackData,
} from "../src/infrastructure/telegram/telegram-callback-parser";
import { sanitizeTelegramChatId } from "../src/infrastructure/telegram/telegram-chat-id";
import { formatTelegramDate } from "../src/infrastructure/telegram/telegram-date";
import { buildTelegramLeadCardMessage } from "../src/infrastructure/telegram/telegram-message-builder";
import { normalizeKazakhstanPhoneForDisplay } from "../src/infrastructure/telegram/telegram-phone";
import { buildTelegramWebhookUrl } from "../src/infrastructure/telegram/telegram-webhook-url";
import { verifyTelegramWebhookSecret } from "../src/infrastructure/telegram/telegram-webhook-verifier";
import { POST as telegramWebhookPOST } from "../src/app/api/webhooks/telegram/route";
import { buildDemoTimestampRefresh, findDemoLead } from "../scripts/telegram-demo-data";
import type { NextRequest } from "next/server";

const timestamp = "2026-05-23T00:00:00.000Z";
const russianDemoSummary = "Клиент сообщил о протечке трубы возле Абая 150. Мастеру нужно перезвонить.";

function makeMaster(overrides: Partial<Master> = {}): Master {
  return {
    id: "22222222-2222-4222-8222-222222222222",
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

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    masterId: "22222222-2222-4222-8222-222222222222",
    callId: null,
    customerName: "Demo Client",
    customerPhone: "+7 (700) 765-43-21",
    problem: "Течет труба под ванной",
    address: "Абая 150",
    urgency: "HIGH",
    aiSummary: russianDemoSummary,
    aiScore: "HOT",
    safetyFlag: "NONE",
    status: "NEW",
    acceptedAt: null,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function makeCall(overrides: Partial<Call> = {}): Call {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    masterId: "22222222-2222-4222-8222-222222222222",
    provider: "demo",
    providerCallId: "demo-call-1",
    customerPhone: "+77007654321",
    aiNumber: "+77273330001",
    status: "PROCESSED",
    startedAt: "2026-05-23T01:00:00.000Z",
    endedAt: null,
    durationSeconds: 60,
    transcript: null,
    recordingUrl: null,
    rawPayload: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

interface RepositoryState {
  lead: Lead;
  master: Master;
  leadEvents: LeadEvent[];
  auditLogs: AuditLog[];
}

function unsupported(operation: string): never {
  throw new Error(`${operation} is not implemented in this test.`);
}

function createRepositoryContext(lead: Lead, master: Master = makeMaster()): {
  repositories: RepositoryContext;
  state: RepositoryState;
} {
  const state: RepositoryState = {
    lead,
    master,
    leadEvents: [],
    auditLogs: [],
  };

  const repositories: RepositoryContext = {
    masters: {
      create: async () => unsupported("masters.create"),
      getById: async (id) => (id === state.master.id ? state.master : null),
      findByPhone: async () => unsupported("masters.findByPhone"),
      list: async () => unsupported("masters.list"),
      update: async () => unsupported("masters.update"),
    },
    assistantProfiles: {
      create: async () => unsupported("assistantProfiles.create"),
      listByMaster: async () => unsupported("assistantProfiles.listByMaster"),
    },
    aiNumbers: {
      create: async () => unsupported("aiNumbers.create"),
      getById: async () => unsupported("aiNumbers.getById"),
      findByPhoneNumber: async () => unsupported("aiNumbers.findByPhoneNumber"),
      list: async () => unsupported("aiNumbers.list"),
      listAvailable: async () => unsupported("aiNumbers.listAvailable"),
      update: async () => unsupported("aiNumbers.update"),
    },
    calls: {
      create: async () => unsupported("calls.create"),
      getById: async (): Promise<Call | null> => null,
      findByProviderCallId: async () => unsupported("calls.findByProviderCallId"),
      list: async () => unsupported("calls.list"),
      listByMasterAndPeriod: async () => unsupported("calls.listByMasterAndPeriod"),
      update: async () => unsupported("calls.update"),
    },
    callEvents: {
      create: async () => unsupported("callEvents.create"),
      listByCall: async () => unsupported("callEvents.listByCall"),
    },
    leads: {
      create: async () => unsupported("leads.create"),
      getById: async (id) => (id === state.lead.id ? state.lead : null),
      findByCallId: async () => unsupported("leads.findByCallId"),
      list: async () => unsupported("leads.list"),
      listByMasterAndPeriod: async () => unsupported("leads.listByMasterAndPeriod"),
      update: async (id, input) => {
        if (id !== state.lead.id) {
          unsupported("leads.update unknown id");
        }

        state.lead = {
          ...state.lead,
          ...input,
          updatedAt: new Date().toISOString(),
        };

        return state.lead;
      },
    },
    leadEvents: {
      create: async (input: CreateLeadEventInput) => {
        const event: LeadEvent = {
          id: `33333333-3333-4333-8333-${String(state.leadEvents.length + 1).padStart(12, "0")}`,
          leadId: input.leadId,
          eventType: input.eventType,
          payload: input.payload,
          createdAt: timestamp,
        };
        state.leadEvents.push(event);
        return event;
      },
      listByLead: async () => unsupported("leadEvents.listByLead"),
    },
    telegramMessages: {
      create: async () => unsupported("telegramMessages.create"),
      listByLead: async () => unsupported("telegramMessages.listByLead"),
    },
    subscriptions: {
      create: async () => unsupported("subscriptions.create"),
      getByMaster: async () => unsupported("subscriptions.getByMaster"),
      update: async () => unsupported("subscriptions.update"),
    },
    valueReports: {
      create: async () => unsupported("valueReports.create"),
      list: async () => unsupported("valueReports.list"),
      listByMaster: async () => unsupported("valueReports.listByMaster"),
    },
    auditLogs: {
      create: async (input: CreateAuditLogInput) => {
        const auditLog: AuditLog = {
          id: `44444444-4444-4444-8444-${String(state.auditLogs.length + 1).padStart(12, "0")}`,
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
      list: async () => unsupported("auditLogs.list"),
    },
  };

  return {
    repositories,
    state,
  };
}

function createMasterInterfaceMock(): {
  masterInterface: MasterInterfacePort;
  edits: EditLeadCardInput[];
  answers: AnswerMasterCallbackInput[];
} {
  const edits: EditLeadCardInput[] = [];
  const answers: AnswerMasterCallbackInput[] = [];

  return {
    edits,
    answers,
    masterInterface: {
      sendLeadCard: async () => unsupported("masterInterface.sendLeadCard"),
      editLeadCard: async (input) => {
        edits.push(input);
      },
      answerCallback: async (input) => {
        answers.push(input);
      },
    },
  };
}

async function withTelegramWebhookSecret<T>(secret: string | undefined, callback: () => T | Promise<T>): Promise<T> {
  const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret === undefined) {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  } else {
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  }

  try {
    return await callback();
  } finally {
    if (previousSecret === undefined) {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
    } else {
      process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret;
    }
  }
}

function makeTelegramWebhookRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost/api/webhooks/telegram", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  }) as NextRequest;
}

test("buildTelegramLeadCardMessage formats a Russian lead card with buttons", () => {
  const lead = makeLead();
  const message = buildTelegramLeadCardMessage({
    lead,
    master: makeMaster(),
  });

  assert.match(message.text, /🚨 НОВЫЙ ПРОПУЩЕННЫЙ ЗВОНОК/);
  assert.match(message.text, /👤 Клиент: Demo Client/);
  assert.match(message.text, /📞 Телефон: \+7 700 765 43 21/);
  assert.match(message.text, /🛠 Проблема: Течет труба под ванной/);
  assert.match(message.text, /⏰ Время звонка: 23\.05\.2026, 05:00/);
  assert.doesNotMatch(message.text, /⏰ Время:/);
  assert.match(message.text, /🔥 AI-Оценка: Горячий/);
  assert.match(message.text, new RegExp(russianDemoSummary));
  assert.doesNotMatch(message.text, /Client reports/);
  assert.doesNotMatch(message.text, /Позвонить:/);
  assert.equal((message.text.match(/\+7 700 765 43 21/g) ?? []).length, 1);
  assert.equal(message.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data, `lead:accept:${lead.id}`);
  assert.equal(message.replyMarkup?.inline_keyboard[0]?.[1]?.callback_data, `lead:spam:${lead.id}`);
  assert.equal(message.replyMarkup?.inline_keyboard.flat().some((button) => Boolean(button.url)), false);
});

test("buildTelegramLeadCardMessage uses fallbacks and safety warning", () => {
  const message = buildTelegramLeadCardMessage({
    lead: makeLead({
      customerName: null,
      customerPhone: null,
      address: null,
      safetyFlag: "GAS",
    }),
    master: makeMaster(),
  });

  assert.match(message.text, /👤 Клиент: Не указано/);
  assert.match(message.text, /📞 Телефон: Не указан/);
  assert.match(message.text, /📍 Адрес: Не указан/);
  assert.match(message.text, /⚠️ ВАЖНО: возможная опасная ситуация/);
  assert.equal(message.replyMarkup?.inline_keyboard.length, 1);
});

test("buildTelegramLeadCardMessage warns on callback-required low-confidence leads", () => {
  const message = buildTelegramLeadCardMessage({
    lead: makeLead({
      customerName: null,
      address: null,
      problem: "Распознавание слабое. Нужно перезвонить клиенту.",
      status: "CALLBACK_PENDING",
    }),
    master: makeMaster(),
    call: makeCall({
      rawPayload: {
        warnings: ["low_confidence", "safety_low_confidence"],
      },
    }),
  });

  assert.match(message.text, /⚠️ Распознавание слабое\. Нужно перезвонить клиенту\./u);
  assert.match(message.text, /problem unclear/u);
  assert.match(message.text, /address missing/u);
  assert.match(message.text, /name missing/u);
  assert.match(message.text, /safety unclear if relevant/u);
});

test("buildTelegramLeadCardMessage prefers call started time over lead created time", () => {
  const message = buildTelegramLeadCardMessage({
    lead: makeLead({
      createdAt: "2026-05-23T00:00:00.000Z",
    }),
    master: makeMaster(),
    call: makeCall({
      startedAt: "2026-05-23T01:00:00.000Z",
    }),
  });

  assert.match(message.text, /⏰ Время звонка: 23\.05\.2026, 06:00/);
});

test("buildTelegramLeadCardMessage falls back to lead created time when call time is missing", () => {
  const message = buildTelegramLeadCardMessage({
    lead: makeLead({
      createdAt: "2026-05-23T00:00:00.000Z",
    }),
    master: makeMaster(),
    call: makeCall({
      startedAt: null,
    }),
  });

  assert.match(message.text, /⏰ Время звонка: 23\.05\.2026, 05:00/);
});

test("parseTelegramLeadCallbackData handles compact lead callback data", () => {
  const leadId = "11111111-1111-4111-8111-111111111111";

  assert.deepEqual(parseTelegramLeadCallbackData(buildTelegramLeadCallbackData("accept", leadId)), {
    action: "accept",
    leadId,
  });
  assert.deepEqual(parseTelegramLeadCallbackData(buildTelegramLeadCallbackData("spam", leadId)), {
    action: "spam",
    leadId,
  });
  assert.equal(parseTelegramLeadCallbackData("lead:accept:not-a-uuid"), null);
  assert.equal(parseTelegramLeadCallbackData(`other:accept:${leadId}`), null);
});

test("handleTelegramLeadCallback accepts a lead and edits the card", async () => {
  const { repositories, state } = createRepositoryContext(makeLead());
  const { masterInterface, edits, answers } = createMasterInterfaceMock();

  const result = await handleTelegramLeadCallback(repositories, masterInterface, {
    callbackQueryId: "callback-1",
    action: "accept",
    leadId: state.lead.id,
    chatId: "123456",
    messageId: "99",
  });

  assert.equal(result.status, "ACCEPTED");
  assert.equal(edits[0]?.status, "ACCEPTED");
  assert.equal(answers[0]?.text, "Заказ взят.");
  assert.ok(state.leadEvents.some((event) => event.eventType === "LEAD_ACCEPTED"));
  assert.ok(state.leadEvents.some((event) => event.eventType === "TELEGRAM_LEAD_CALLBACK_HANDLED"));
});

test("handleTelegramLeadCallback marks a lead as spam and edits the card", async () => {
  const { repositories, state } = createRepositoryContext(makeLead());
  const { masterInterface, edits, answers } = createMasterInterfaceMock();

  const result = await handleTelegramLeadCallback(repositories, masterInterface, {
    callbackQueryId: "callback-2",
    action: "spam",
    leadId: state.lead.id,
    chatId: "123456",
    messageId: "99",
  });

  assert.equal(result.status, "SPAM");
  assert.equal(edits[0]?.status, "SPAM");
  assert.equal(answers[0]?.text, "Лид отмечен как спам.");
  assert.ok(state.leadEvents.some((event) => event.eventType === "LEAD_MARKED_SPAM"));
});

test("handleTelegramLeadCallback is idempotent for an already accepted lead", async () => {
  const { repositories, state } = createRepositoryContext(makeLead({ status: "ACCEPTED" }));
  const { masterInterface, edits, answers } = createMasterInterfaceMock();

  const result = await handleTelegramLeadCallback(repositories, masterInterface, {
    callbackQueryId: "callback-3",
    action: "accept",
    leadId: state.lead.id,
    chatId: "123456",
    messageId: "99",
  });

  assert.equal(result.status, "ACCEPTED");
  assert.equal(edits[0]?.status, "ACCEPTED");
  assert.equal(answers[0]?.text, "Заказ уже взят.");
  assert.equal(state.leadEvents.length, 0);
  assert.equal(state.auditLogs.length, 0);
});

test("sanitizeTelegramChatId accepts plain and accidental angle-bracket input", () => {
  assert.equal(sanitizeTelegramChatId("7436474652"), "7436474652");
  assert.equal(sanitizeTelegramChatId("<7436474652>"), "7436474652");
  assert.equal(sanitizeTelegramChatId(" <7436474652> "), "7436474652");
});

test("sanitizeTelegramChatId rejects invalid input", () => {
  assert.throws(() => sanitizeTelegramChatId("chat-7436474652"));
  assert.throws(() => sanitizeTelegramChatId("<7436474652"));
  assert.throws(() => sanitizeTelegramChatId("7436 474652"));
});

test("normalizeKazakhstanPhoneForDisplay formats simple Kazakhstan numbers", () => {
  assert.equal(normalizeKazakhstanPhoneForDisplay("+77007654321"), "+7 700 765 43 21");
  assert.equal(normalizeKazakhstanPhoneForDisplay("77007654321"), "+7 700 765 43 21");
  assert.equal(normalizeKazakhstanPhoneForDisplay(null), "Не указан");
});

test("formatTelegramDate uses Asia/Almaty deterministically", () => {
  assert.equal(formatTelegramDate("2026-05-23T00:00:00.000Z"), "23.05.2026, 05:00");
});

test("telegram test-card helpers refresh demo timestamps without creating a new lead", () => {
  const now = new Date("2026-05-23T17:21:00.000Z");
  const timestamps = buildDemoTimestampRefresh(now);
  const demoLead = makeLead({ customerPhone: "+77007654321" });

  assert.equal(findDemoLead([makeLead({ customerPhone: "+77000000000" }), demoLead])?.id, demoLead.id);
  assert.deepEqual(timestamps, {
    callStartedAt: "2026-05-23T17:21:00.000Z",
    callCreatedAt: "2026-05-23T17:21:00.000Z",
    leadCreatedAt: "2026-05-23T17:21:00.000Z",
    leadUpdatedAt: "2026-05-23T17:21:00.000Z",
  });
});

test("buildTelegramWebhookUrl rejects localhost and non-HTTPS URLs", () => {
  assert.throws(() => buildTelegramWebhookUrl("http://localhost:3000"));
  assert.throws(() => buildTelegramWebhookUrl("http://example.com"));
  assert.throws(() => buildTelegramWebhookUrl("https://localhost:3000"));
});

test("buildTelegramWebhookUrl accepts public HTTPS URLs", () => {
  assert.equal(
    buildTelegramWebhookUrl("https://ai-dispatcher-demo.vercel.app"),
    "https://ai-dispatcher-demo.vercel.app/api/webhooks/telegram",
  );
});

test("verifyTelegramWebhookSecret accepts only the configured secret", async () => {
  await withTelegramWebhookSecret("expected-secret", () => {
    assert.equal(
      verifyTelegramWebhookSecret(new Headers({ "x-telegram-bot-api-secret-token": "expected-secret" })),
      true,
    );
    assert.equal(
      verifyTelegramWebhookSecret(new Headers({ "x-telegram-bot-api-secret-token": "wrong-secret" })),
      false,
    );
  });
});

test("telegram webhook route rejects invalid secret", async () => {
  await withTelegramWebhookSecret("expected-secret", async () => {
    const response = await telegramWebhookPOST(
      makeTelegramWebhookRequest(
        {
          update_id: 1,
        },
        { "x-telegram-bot-api-secret-token": "wrong-secret" },
      ),
    );

    assert.equal(response.status, 401);
  });
});

test("telegram webhook route safely ignores unsupported updates", async () => {
  await withTelegramWebhookSecret(undefined, async () => {
    const response = await telegramWebhookPOST(
      makeTelegramWebhookRequest({
        update_id: 2,
        message: {
          message_id: 10,
          text: "/start",
          chat: {
            id: 123,
          },
        },
      }),
    );
    const body = (await response.json()) as { ok: boolean; ignored: boolean };

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, ignored: true });
  });
});
