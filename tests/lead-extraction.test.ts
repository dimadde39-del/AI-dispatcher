import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  type LeadExtractionResult,
  LeadExtractionResultSchema,
  type LeadExtractorPort,
} from "../src/application/voice/lead-extraction-result";
import { extractLeadWithNoiseAwareness } from "../src/application/voice/noise-aware-lead-extraction";
import { createLeadExtractor } from "../src/infrastructure/llm/lead-extractor/lead-extractor-provider";
import { MockLeadExtractor } from "../src/infrastructure/llm/lead-extractor/mock-lead-extractor";
import type { VoiceCallEndedEvent } from "../src/interfaces/voice-event";

interface LeadExtractionFixture {
  id: string;
  label: string;
  transcript: string;
}

const fixtures = JSON.parse(
  readFileSync("tests/fixtures/lead-extraction-noisy-cases.json", "utf8"),
) as LeadExtractionFixture[];

function fixture(id: string): LeadExtractionFixture {
  const item = fixtures.find((candidate) => candidate.id === id);
  assert.ok(item, `Missing fixture ${id}`);
  return item;
}

function callEndedEvent(overrides: Partial<VoiceCallEndedEvent> = {}): VoiceCallEndedEvent {
  return {
    provider: "self-host",
    type: "CALL_ENDED",
    providerCallId: "selfhost-lead-extraction-test",
    customerPhone: "+77007654321",
    aiNumber: "+77273330001",
    startedAt: "2026-05-27T10:00:00.000Z",
    endedAt: "2026-05-27T10:02:00.000Z",
    durationSeconds: 120,
    transcript: null,
    summary: null,
    recordingUrl: null,
    rawPayload: {},
    ...overrides,
  };
}

function schemaResult(overrides: Partial<LeadExtractionResult> = {}): LeadExtractionResult {
  return LeadExtractionResultSchema.parse({
    problem: "Протечка воды",
    address: null,
    district: null,
    customerName: null,
    urgency: "MEDIUM",
    safetyFlag: "WATER_LEAK",
    summaryRu: "Клиент сообщает о протечке воды.",
    transcriptQuality: "noisy",
    confidence: "medium",
    requiresCallback: true,
    missingFields: ["address", "customerName"],
    backgroundSpeechDetected: false,
    profanityDetected: false,
    rawUsefulQuotes: ["течь кран"],
    warnings: ["missing_fields"],
    ...overrides,
  });
}

test("LeadExtractionResultSchema accepts strict structured extraction results", () => {
  const parsed = schemaResult({
    problem: "Течет труба",
    address: "Шымкент, Нурсат, дом 15",
    customerName: "Дима",
    urgency: "HIGH",
    confidence: "high",
    requiresCallback: false,
    missingFields: [],
    transcriptQuality: "clear",
    warnings: [],
  });

  assert.equal(parsed.customerName, "Дима");
  assert.throws(() =>
    LeadExtractionResultSchema.parse({
      ...parsed,
      price: "15000",
    }),
  );
});

test("MockLeadExtractor extracts clean Russian lead details", async () => {
  const extractor = new MockLeadExtractor();
  const result = await extractor.extract({
    event: callEndedEvent({ transcript: fixture("clean-ru").transcript }),
    transcript: fixture("clean-ru").transcript,
    deterministicResult: schemaResult(),
  });

  assert.match(result.problem ?? "", /Протечка/u);
  assert.match(result.address ?? "", /Шымкент/u);
  assert.match(result.address ?? "", /дом 15/u);
  assert.equal(result.customerName, "Дима");
  assert.equal(result.urgency, "HIGH");
  assert.equal(result.transcriptQuality, "clear");
  assert.equal(result.confidence, "high");
  assert.equal(result.requiresCallback, false);
});

test("lead extractor provider factory uses mock locally and skips real providers without keys", () => {
  assert.ok(createLeadExtractor({ provider: "mock" }) instanceof MockLeadExtractor);
  assert.equal(createLeadExtractor({ provider: "deepseek" }), undefined);
  assert.equal(createLeadExtractor({ provider: "openai" }), undefined);
});

test("MockLeadExtractor keeps noisy useful calls callback-required without hallucinating fields", async () => {
  const extractor = new MockLeadExtractor();
  const result = await extractor.extract({
    event: callEndedEvent({ transcript: fixture("very-noisy-ru").transcript }),
    transcript: fixture("very-noisy-ru").transcript,
    deterministicResult: schemaResult(),
  });

  assert.match(result.problem ?? "", /кран|Протечка/u);
  assert.equal(result.address, null);
  assert.equal(result.customerName, null);
  assert.equal(result.transcriptQuality, "very_noisy");
  assert.equal(result.confidence, "low");
  assert.equal(result.requiresCallback, true);
  assert.equal(result.profanityDetected, true);
  assert.ok(result.missingFields.includes("address"));
  assert.ok(result.missingFields.includes("customerName"));
});

test("MockLeadExtractor detects useful background speech without copying profanity into summary", async () => {
  const extractor = new MockLeadExtractor();
  const result = await extractor.extract({
    event: callEndedEvent({ transcript: fixture("background-spouse").transcript }),
    transcript: fixture("background-spouse").transcript,
    deterministicResult: schemaResult(),
  });

  assert.match(result.problem ?? "", /сантехническая|кран|Протечка/u);
  assert.equal(result.backgroundSpeechDetected, true);
  assert.equal(result.requiresCallback, true);
  assert.ok(result.missingFields.includes("address"));
  assert.doesNotMatch(result.summaryRu, /еб/iu);
});

test("MockLeadExtractor marks hello-only transcripts unusable", async () => {
  const extractor = new MockLeadExtractor();
  const result = await extractor.extract({
    event: callEndedEvent({ transcript: fixture("only-hello").transcript }),
    transcript: fixture("only-hello").transcript,
    deterministicResult: schemaResult(),
  });

  assert.equal(result.problem, null);
  assert.equal(result.confidence, "unusable");
  assert.equal(result.requiresCallback, true);
  assert.ok(result.warnings.includes("no_useful_request"));
});

test("MockLeadExtractor marks noisy gas calls as emergency safety leads", async () => {
  const extractor = new MockLeadExtractor();
  const result = await extractor.extract({
    event: callEndedEvent({ transcript: fixture("gas-noisy").transcript }),
    transcript: fixture("gas-noisy").transcript,
    deterministicResult: schemaResult(),
  });

  assert.equal(result.safetyFlag, "GAS");
  assert.equal(result.urgency, "EMERGENCY");
  assert.match(result.summaryRu, /газ/u);
  assert.equal(result.requiresCallback, true);
});

test("deterministic safety can override weaker LLM extraction and low STT lowers confidence", async () => {
  const weakExtractor: LeadExtractorPort = {
    name: "weak-test",
    extract: async () =>
      schemaResult({
        problem: "Нужен мастер, детали неясны",
        urgency: "MEDIUM",
        safetyFlag: "NONE",
        confidence: "medium",
        requiresCallback: false,
        missingFields: [],
        warnings: [],
      }),
  };

  const extraction = await extractLeadWithNoiseAwareness(
    callEndedEvent({
      transcript: "алло пахнет газом дома",
      rawPayload: {
        score: 58,
        warnings: ["low_confidence"],
      },
    }),
    weakExtractor,
  );

  assert.equal(extraction.usedLlm, true);
  assert.equal(extraction.result.safetyFlag, "GAS");
  assert.equal(extraction.result.urgency, "EMERGENCY");
  assert.equal(extraction.result.confidence, "low");
  assert.equal(extraction.result.requiresCallback, true);
  assert.ok(extraction.result.warnings.includes("safety_low_confidence"));
  assert.equal(extraction.lead.safetyFlag, "GAS");
  assert.equal(extraction.lead.aiScore, "HOT");
});

test("noise-aware merge does not turn hello-only LLM output into a hallucinated lead", async () => {
  const extraction = await extractLeadWithNoiseAwareness(
    callEndedEvent({
      customerPhone: null,
      transcript: fixture("only-hello").transcript,
    }),
    new MockLeadExtractor(),
  );

  assert.equal(extraction.result.problem, null);
  assert.equal(extraction.result.confidence, "unusable");
  assert.ok(extraction.result.warnings.includes("no_useful_request"));
  assert.equal(extraction.lead.customerName, null);
  assert.equal(extraction.lead.address, null);
});
