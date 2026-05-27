import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyFetchError,
  classifyHttpError,
  fetchJsonWithDiagnostics,
} from "../src/app/dev/selfhost-stt/fetchDiagnostics";
import {
  audioContentTypeForPath,
  DEFAULT_STT_MODE,
  buildMockEmitPayload,
  buildMockExperimentPayload,
} from "../scripts/self-host-stt-common";
import { recommendBestModes, type ExperimentHistoryEntry } from "../src/app/dev/selfhost-stt/experimentHistory";

test("STT fetch diagnostics classify browser network or CORS failures", () => {
  const diagnostic = classifyFetchError("http://localhost:8001/health", new TypeError("Failed to fetch"));

  assert.equal(diagnostic.kind, "network-or-cors");
  assert.equal(diagnostic.targetUrl, "http://localhost:8001/health");
  assert.match(diagnostic.message, /Network\/CORS failure/u);
  assert.match(diagnostic.fix ?? "", /npm run voice-agent:dev/u);
});

test("STT fetch diagnostics classify non-2xx responses", () => {
  const response = new Response(JSON.stringify({ detail: "bad request" }), {
    status: 400,
    statusText: "Bad Request",
  });
  const diagnostic = classifyHttpError("http://localhost:8001/stt/experiment", response, { detail: "bad request" });

  assert.equal(diagnostic.kind, "http");
  assert.equal(diagnostic.status, 400);
  assert.equal(diagnostic.targetUrl, "http://localhost:8001/stt/experiment");
});

test("STT fetch diagnostics classify invalid JSON from health endpoint", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("not-json", {
      status: 200,
      statusText: "OK",
    });

  try {
    const diagnostic = await fetchJsonWithDiagnostics("http://localhost:8001/health");

    assert.equal(diagnostic.ok, false);
    assert.equal(diagnostic.kind, "invalid-json");
    assert.equal(diagnostic.targetUrl, "http://localhost:8001/health");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("STT mock experiment payload stays local and does not require Deepgram", () => {
  const payload = buildMockExperimentPayload({
    scenarioId: "ru-urgent-plumbing",
    text: "Труба течет под ванной.",
  });

  assert.deepEqual(payload, {
    mode: "mock",
    scenarioId: "ru-urgent-plumbing",
    text: "Труба течет под ванной.",
  });
});

test("default self-host STT mode is Deepgram RU nova-2", () => {
  assert.equal(DEFAULT_STT_MODE, "deepgram-ru-nova2");
});

test("STT recommendation ignores unusable modes", () => {
  const entries: ExperimentHistoryEntry[] = [
    {
      id: 1,
      timestamp: "2026-05-24T00:00:00.000Z",
      mode: "deepgram-multi-nova3",
      scenarioId: "ru-urgent-plumbing",
      scenarioLabel: "RU urgent plumbing",
      score: 99,
      confidence: "unusable",
      usable: false,
      missedKeywords: [],
      warnings: ["empty_transcript"],
      transcript: "",
    },
    {
      id: 2,
      timestamp: "2026-05-24T00:01:00.000Z",
      mode: "deepgram-ru-nova2",
      scenarioId: "ru-urgent-plumbing",
      scenarioLabel: "RU urgent plumbing",
      score: 89,
      confidence: "high",
      usable: true,
      missedKeywords: ["труба"],
      warnings: ["missed_keywords"],
      transcript: "течет в ванной",
    },
  ];

  assert.deepEqual(recommendBestModes(entries), [
    {
      scenarioId: "ru-urgent-plumbing",
      scenarioLabel: "RU urgent plumbing",
      mode: "deepgram-ru-nova2",
      score: 89,
      confidence: "high",
    },
  ]);
});

test("STT mock emit payload uses provider mock", () => {
  assert.deepEqual(buildMockEmitPayload("Тест"), {
    provider: "mock",
    text: "Тест",
  });
});

test("STT file helper maps common audio content types", () => {
  assert.equal(audioContentTypeForPath("sample.webm"), "audio/webm");
  assert.equal(audioContentTypeForPath("sample.wav"), "audio/wav");
  assert.equal(audioContentTypeForPath("sample.mp3"), "audio/mpeg");
  assert.equal(audioContentTypeForPath("sample.ogg"), "application/octet-stream");
});
