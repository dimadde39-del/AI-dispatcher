import assert from "node:assert/strict";
import test from "node:test";
import { generateForwardingInstructions } from "../src/application/use-cases/generateForwardingInstructions";
import { acceptLeadTransition, calculateValueReportMetrics, markLeadAsSpamTransition } from "../src/domain";
import type { Call, Lead } from "../src/domain";

const timestamp = "2026-05-23T00:00:00.000Z";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    masterId: "22222222-2222-4222-8222-222222222222",
    callId: null,
    customerName: "Demo Client",
    customerPhone: "+77007654321",
    problem: "Leaking pipe",
    address: "Abaya 150",
    urgency: "HIGH",
    aiSummary: "Client reports a leaking pipe.",
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

function makeCall(id: string): Call {
  return {
    id,
    masterId: "22222222-2222-4222-8222-222222222222",
    provider: "demo",
    providerCallId: id,
    customerPhone: "+77007654321",
    aiNumber: "+77273330001",
    status: "PROCESSED",
    startedAt: timestamp,
    endedAt: timestamp,
    durationSeconds: 60,
    transcript: null,
    recordingUrl: null,
    rawPayload: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test("generateForwardingInstructions returns KZ forwarding codes", () => {
  const instructions = generateForwardingInstructions({
    phoneNumber: "+77273330001",
  });

  assert.equal(instructions.noAnswerCode, "**61*+77273330001**15#");
  assert.equal(instructions.busyCode, "**67*+77273330001#");
  assert.equal(instructions.disableAllCode, "##002#");
  assert.match(instructions.shortHumanInstructions, /переадресации/);
});

test("lead transitions accept a new lead", () => {
  const acceptedAt = "2026-05-23T01:00:00.000Z";
  const lead = acceptLeadTransition(makeLead(), acceptedAt);

  assert.equal(lead.status, "ACCEPTED");
  assert.equal(lead.acceptedAt, acceptedAt);
});

test("lead transitions block accepting spam", () => {
  assert.throws(() => acceptLeadTransition(makeLead({ status: "SPAM" }), timestamp));
});

test("lead transitions mark a new lead as spam", () => {
  const lead = markLeadAsSpamTransition(makeLead());

  assert.equal(lead.status, "SPAM");
});

test("calculateValueReportMetrics estimates saved revenue from accepted leads", () => {
  const metrics = calculateValueReportMetrics({
    tradeType: "PLUMBING",
    calls: [
      makeCall("33333333-3333-4333-8333-333333333333"),
      makeCall("44444444-4444-4444-8444-444444444444"),
    ],
    leads: [
      makeLead({ status: "ACCEPTED" }),
      makeLead({
        id: "55555555-5555-4555-8555-555555555555",
        status: "SPAM",
      }),
    ],
  });

  assert.deepEqual(metrics, {
    totalCalls: 2,
    capturedLeads: 2,
    acceptedLeads: 1,
    estimatedSavedRevenueMin: 15000,
    estimatedSavedRevenueMax: 30000,
  });
});
