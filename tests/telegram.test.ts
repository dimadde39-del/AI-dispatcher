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
import { buildTelegramLeadCardMessage } from "../src/infrastructure/telegram/telegram-message-builder";
import { normalizeKazakhstanPhoneForDisplay } from "../src/infrastructure/telegram/telegram-phone";

const timestamp = "2026-05-23T00:00:00.000Z";

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
    aiSummary: "Клиент просит перезвонить как можно скорее.",
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
      list: async () => unsupported("aiNumbers.list"),
      listAvailable: async () => unsupported("aiNumbers.listAvailable"),
      update: async () => unsupported("aiNumbers.update"),
    },
    calls: {
      create: async () => unsupported("calls.create"),
      getById: async (): Promise<Call | null> => null,
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

test("buildTelegramLeadCardMessage formats a Russian lead card with buttons", () => {
  const lead = makeLead();
  const message = buildTelegramLeadCardMessage({
    lead,
    master: makeMaster(),
  });

  assert.match(message.text, /🚨 НОВЫЙ ПРОПУЩЕННЫЙ ЗВОНОК/);
  assert.match(message.text, /👤 Клиент: Demo Client/);
  assert.match(message.text, /📞 Телефон: \+7 700 765 43 21/);
  assert.match(message.text, /📞 Позвонить: \+7 700 765 43 21/);
  assert.match(message.text, /🛠 Проблема: Течет труба под ванной/);
  assert.match(message.text, /🔥 AI-Оценка: Горячий/);
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
