"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type FetchFailureDiagnostic,
  fetchJsonWithDiagnostics,
} from "./fetchDiagnostics";
import {
  type ExperimentConfidence,
  type ExperimentHistoryEntry,
  historyToJson,
  historyToMarkdown,
  recommendBestModes,
} from "./experimentHistory";

type RecordingStatus = "idle" | "recording" | "uploading" | "done" | "error";
type ServiceState = "checking" | "online" | "offline";

interface SelfHostSttClientProps {
  enabled: boolean;
  voiceAgentUrl: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  event: string;
  detail: string;
  level: "info" | "warn" | "error";
}

interface SttMode {
  id: string;
  provider: string;
  model: string | null;
  language: string | null;
  options: Record<string, unknown>;
  description: string;
}

interface SttScenario {
  id: string;
  label: string;
  expected_keywords: string[];
  expected_language: string;
  original_text: string;
}

interface HealthResponse {
  ok?: boolean;
  service?: string;
  sttProvider?: string;
  sttMode?: string;
  backendBaseUrl?: string;
}

interface ServiceStatus {
  state: ServiceState;
  url: string;
  provider?: string;
  mode?: string;
  backendBaseUrl?: string;
  error?: FetchFailureDiagnostic | string;
}

interface EmitResponse {
  ok?: boolean;
  provider?: string;
  mode?: string;
  modeConfig?: SttMode;
  providerCallId?: string;
  transcript?: string;
  emittedEvents?: number;
  backendResults?: unknown;
}

interface ExperimentResponse {
  ok?: boolean;
  mode?: string;
  modeConfig?: SttMode;
  scenario?: SttScenario;
  transcript?: string;
  score?: number;
  keyword_hits?: string[];
  keywordHits?: string[];
  missed_keywords?: string[];
  missedKeywords?: string[];
  has_russian?: boolean;
  has_kazakh_chars?: boolean;
  likely_wrong_language?: boolean;
  warnings?: string[];
  confidence?: ExperimentConfidence;
  usable?: boolean;
  requiresCallback?: boolean;
}

const VOICE_AGENT_FIX = "Run npm run voice-agent:dev and open http://localhost:8001/health";
const MEDIA_RECORDER_WARNING =
  "This browser/context does not support MediaRecorder. Use Chrome/Edge on localhost, or use file upload/mock transcript.";
const DEFAULT_STT_MODE = "deepgram-ru-nova2";

const FALLBACK_MODES: SttMode[] = [
  {
    id: "mock",
    provider: "mock",
    model: null,
    language: null,
    options: {},
    description: "Zero-cost text passthrough for local pipeline checks.",
  },
  {
    id: "deepgram-ru-nova2",
    provider: "deepgram",
    model: "nova-2",
    language: "ru",
    options: { punctuate: true, smart_format: true },
    description: "MVP default: Russian-only Deepgram nova-2.",
  },
  {
    id: "deepgram-ru-nova3",
    provider: "deepgram",
    model: "nova-3",
    language: "ru",
    options: { punctuate: true, smart_format: true },
    description: "Russian-only Deepgram nova-3 baseline.",
  },
  {
    id: "deepgram-multi-nova3",
    provider: "deepgram",
    model: "nova-3",
    language: "multi",
    options: { punctuate: true, smart_format: true },
    description: "Deepgram nova-3 with language=multi for RU/KZ research.",
  },
  {
    id: "deepgram-default",
    provider: "deepgram",
    model: null,
    language: null,
    options: { punctuate: true, smart_format: true },
    description: "Deepgram API defaults with punctuation and smart formatting.",
  },
];

const FALLBACK_SCENARIOS: SttScenario[] = [
  {
    id: "ru-urgent-plumbing",
    label: "RU urgent plumbing",
    expected_keywords: ["труба", "течет", "ванной", "Шымкент", "Нурсат", "срочно", "Дима"],
    expected_language: "ru",
    original_text:
      "Здравствуйте, у меня труба течет под ванной. Адрес Шымкент, Нурсат, дом 15. Срочно. Меня зовут Дима.",
  },
  {
    id: "kz-water-leak",
    label: "KZ water leak",
    expected_keywords: ["су", "ағып", "жатыр", "Шымкент", "Тұран", "тезірек", "Дима"],
    expected_language: "kk",
    original_text: "Су ағып жатыр. Шымкент, Тұран жақта. Тезірек керек. Атым Дима.",
  },
  {
    id: "mix-ru-kz-water-leak",
    label: "MIX RU/KZ water leak",
    expected_keywords: ["су", "ағып", "течь", "Шымкент", "Тұран", "этаж", "тезірек", "Дима"],
    expected_language: "mixed",
    original_text:
      "Аға, су ағып жатыр, ваннаның астынан течь. Шымкент, Тұран жақта, 5 этаж. Тезірек керек. Атым Дима.",
  },
  {
    id: "gas-emergency",
    label: "GAS emergency",
    expected_keywords: ["газ", "иісі", "пахнет", "Шымкент", "Нурсат"],
    expected_language: "mixed",
    original_text: "Үйде газ иісі шығып тұр. Пахнет газом, не знаю что делать. Шымкент, Нурсат.",
  },
  {
    id: "electric-danger",
    label: "ELECTRIC danger",
    expected_keywords: ["проводка", "искрит", "запах", "гари", "свет", "мигает", "Алматы", "срочно"],
    expected_language: "ru",
    original_text: "Проводка искрит, запах гари, свет мигает. Алматы, Бостандык, срочно.",
  },
  {
    id: "noisy-unclear-fallback",
    label: "Noisy/unclear fallback phrase",
    expected_keywords: ["плохо", "слышно", "мастер", "вода", "течет"],
    expected_language: "ru",
    original_text: "Алло, плохо слышно, связь пропадает. Нужен мастер, вода где-то течет.",
  },
];

const KAZAKH_CHAR_PATTERN = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/u;
const RUSSIAN_CHAR_PATTERN = /[а-яёА-ЯЁ]/u;
const WRONG_LANGUAGE_MARKERS = [
  "hola",
  "buenos",
  "gracias",
  "senor",
  "señor",
  "hello",
  "thank you",
  "thanks",
  "water leak",
  "plumber",
  "address",
  "my name is",
  "bathroom",
];

function cleanDetail(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown result";
  }
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase();
}

function normalizedForKeyword(value: string): string {
  return normalizeText(value).replaceAll("ё", "е").split(/\s+/u).filter(Boolean).join(" ");
}

function classifyExperimentScore(
  transcript: string,
  scenario: SttScenario,
  score: number,
  warnings: string[],
): Pick<ExperimentResponse, "confidence" | "usable" | "requiresCallback" | "warnings"> {
  if (!transcript.trim()) {
    return {
      confidence: "unusable",
      usable: false,
      requiresCallback: true,
      warnings: ["empty_transcript", "low_confidence"],
    };
  }

  const nextWarnings = [...warnings];
  if (score < 60 && !nextWarnings.includes("low_confidence")) {
    nextWarnings.push("low_confidence");
  }

  const safetyLowConfidence = ["gas-emergency", "electric-danger"].includes(scenario.id) && score < 80;
  if (safetyLowConfidence && !nextWarnings.includes("safety_low_confidence")) {
    nextWarnings.push("safety_low_confidence");
  }

  const confidence: ExperimentConfidence =
    score < 40 ? "unusable" : score < 60 ? "low" : score < 80 ? "medium" : "high";
  const usable = confidence !== "unusable";

  return {
    confidence,
    usable,
    requiresCallback: !usable || score < 60 || safetyLowConfidence,
    warnings: nextWarnings,
  };
}

function scoreTranscriptLocally(transcript: string, scenario: SttScenario): ExperimentResponse {
  if (!transcript.trim()) {
    const classification = classifyExperimentScore(transcript, scenario, 0, []);

    return {
      ok: true,
      mode: "local-mock-score",
      modeConfig: FALLBACK_MODES[0],
      scenario,
      transcript,
      score: 0,
      keyword_hits: [],
      keywordHits: [],
      missed_keywords: scenario.expected_keywords,
      missedKeywords: scenario.expected_keywords,
      has_russian: false,
      has_kazakh_chars: false,
      likely_wrong_language: false,
      ...classification,
    };
  }

  const normalizedTranscript = normalizedForKeyword(transcript);
  const keywordHits: string[] = [];
  const missedKeywords: string[] = [];

  for (const keyword of scenario.expected_keywords) {
    if (normalizedTranscript.includes(normalizedForKeyword(keyword))) {
      keywordHits.push(keyword);
    } else {
      missedKeywords.push(keyword);
    }
  }

  const hasRussian = RUSSIAN_CHAR_PATTERN.test(transcript);
  const hasKazakhChars = KAZAKH_CHAR_PATTERN.test(transcript);
  const likelyWrongLanguage = WRONG_LANGUAGE_MARKERS.some((marker) => normalizedTranscript.includes(marker));
  const keywordScore =
    scenario.expected_keywords.length > 0
      ? Math.round((keywordHits.length / scenario.expected_keywords.length) * 80)
      : 80;
  const languageScore =
    scenario.expected_language === "kk"
      ? hasKazakhChars
        ? 20
        : 0
      : scenario.expected_language === "mixed"
        ? (hasRussian ? 10 : 0) + (hasKazakhChars ? 10 : 0)
        : hasRussian
          ? 20
          : 0;
  const warnings: string[] = [];
  let score = Math.max(0, Math.min(100, keywordScore + languageScore));

  if (missedKeywords.length > 0) {
    warnings.push("missed_keywords");
  }
  if (likelyWrongLanguage) {
    warnings.push("likely_wrong_language");
    score = Math.max(0, score - 40);
  }
  if (!hasRussian && !hasKazakhChars) {
    warnings.push("no_cyrillic_detected");
  }
  if (scenario.expected_language === "kk" && !hasKazakhChars) {
    warnings.push("kazakh_chars_missing");
  }
  if (scenario.expected_language === "mixed" && (!hasRussian || !hasKazakhChars)) {
    warnings.push("mixed_language_signal_missing");
  }
  const classification = classifyExperimentScore(transcript, scenario, score, warnings);

  return {
    ok: true,
    mode: "local-mock-score",
    modeConfig: FALLBACK_MODES[0],
    scenario,
    transcript,
    score,
    keyword_hits: keywordHits,
    keywordHits,
    missed_keywords: missedKeywords,
    missedKeywords,
    has_russian: hasRussian,
    has_kazakh_chars: hasKazakhChars,
    likely_wrong_language: likelyWrongLanguage,
    ...classification,
  };
}

function preferredMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function responseKeywordHits(result: ExperimentResponse): string[] {
  return result.keywordHits ?? result.keyword_hits ?? [];
}

function responseMissedKeywords(result: ExperimentResponse): string[] {
  return result.missedKeywords ?? result.missed_keywords ?? [];
}

function isMediaRecorderAvailable(): boolean {
  return Boolean(
    typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined",
  );
}

export function SelfHostSttClient({ enabled, voiceAgentUrl }: SelfHostSttClientProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const logIdRef = useRef(0);
  const historyIdRef = useRef(0);
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [transcript, setTranscript] = useState("");
  const [mockText, setMockText] = useState<string>(FALLBACK_SCENARIOS[0].original_text);
  const [modes, setModes] = useState<SttMode[]>(FALLBACK_MODES);
  const [scenarios, setScenarios] = useState<SttScenario[]>(FALLBACK_SCENARIOS);
  const [selectedMode, setSelectedMode] = useState(DEFAULT_STT_MODE);
  const [selectedScenarioId, setSelectedScenarioId] = useState(FALLBACK_SCENARIOS[0].id);
  const [lastProviderCallId, setLastProviderCallId] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] = useState<ExperimentResponse | null>(null);
  const [resultHistory, setResultHistory] = useState<ExperimentHistoryEntry[]>([]);
  const [mediaRecorderAvailable, setMediaRecorderAvailable] = useState<boolean | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [lastFailure, setLastFailure] = useState<FetchFailureDiagnostic | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    state: enabled ? "checking" : "offline",
    url: voiceAgentUrl,
  });

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0] ?? FALLBACK_SCENARIOS[0],
    [scenarios, selectedScenarioId],
  );

  const selectedModeConfig = useMemo(
    () => modes.find((mode) => mode.id === selectedMode) ?? modes[0] ?? FALLBACK_MODES[0],
    [modes, selectedMode],
  );

  const recommendations = useMemo(() => recommendBestModes(resultHistory), [resultHistory]);
  const voiceAgentOnline = serviceStatus.state === "online";

  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
        return "Idle";
      case "recording":
        return "Recording";
      case "uploading":
        return "Uploading";
      case "done":
        return "Done";
      case "error":
        return "Error";
    }
  }, [status]);

  const addLog = useCallback((event: string, detail: unknown, level: LogEntry["level"] = "info") => {
    const entry: LogEntry = {
      id: ++logIdRef.current,
      timestamp: new Date().toISOString(),
      event,
      detail: cleanDetail(detail),
      level,
    };
    setLogs((current) => [entry, ...current].slice(0, 80));
  }, []);

  const loadExperimentConfig = useCallback(async () => {
    const modesUrl = `${voiceAgentUrl}/stt/modes`;
    const scenariosUrl = `${voiceAgentUrl}/stt/scenarios`;
    const [modesResult, scenariosResult] = await Promise.all([
      fetchJsonWithDiagnostics<{ modes?: SttMode[] }>(modesUrl),
      fetchJsonWithDiagnostics<{ scenarios?: SttScenario[] }>(scenariosUrl),
    ]);

    if (modesResult.ok && modesResult.body.modes?.length) {
      setModes(modesResult.body.modes);
    } else if (!modesResult.ok) {
      addLog("experiment-config-modes-fallback", modesResult, "warn");
    }

    if (scenariosResult.ok && scenariosResult.body.scenarios?.length) {
      setScenarios(scenariosResult.body.scenarios);
    } else if (!scenariosResult.ok) {
      addLog("experiment-config-scenarios-fallback", scenariosResult, "warn");
    }
  }, [addLog, voiceAgentUrl]);

  const refreshVoiceAgentHealth = useCallback(async () => {
    if (!enabled || !voiceAgentUrl) {
      return;
    }

    const targetUrl = `${voiceAgentUrl}/health`;
    setServiceStatus({ state: "checking", url: voiceAgentUrl });
    const result = await fetchJsonWithDiagnostics<HealthResponse>(targetUrl, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    if (!result.ok) {
      setLastFailure(result);
      setServiceStatus({
        state: "offline",
        url: voiceAgentUrl,
        error: result,
      });
      addLog("voice-agent-health-offline", result, "error");
      return;
    }

    if (
      result.body.ok !== true ||
      result.body.service !== "voice-agent" ||
      !result.body.sttMode ||
      !result.body.backendBaseUrl
    ) {
      const diagnostic: FetchFailureDiagnostic = {
        ok: false,
        targetUrl,
        kind: "unknown",
        message: `Unexpected or stale health response from ${targetUrl}. Restart the voice-agent so /health includes sttMode and backendBaseUrl.`,
        fix: VOICE_AGENT_FIX,
      };
      setLastFailure(diagnostic);
      setServiceStatus({ state: "offline", url: voiceAgentUrl, error: diagnostic });
      addLog("voice-agent-health-invalid", diagnostic, "error");
      return;
    }

    setLastFailure(null);
    setServiceStatus({
      state: "online",
      url: voiceAgentUrl,
      provider: result.body.sttProvider,
      mode: result.body.sttMode,
      backendBaseUrl: result.body.backendBaseUrl,
    });
    addLog("voice-agent-health-online", {
      targetUrl,
      provider: result.body.sttProvider,
      mode: result.body.sttMode,
      backendBaseUrl: result.body.backendBaseUrl,
    });
    await loadExperimentConfig();
  }, [addLog, enabled, loadExperimentConfig, voiceAgentUrl]);

  useEffect(() => {
    setMediaRecorderAvailable(isMediaRecorderAvailable());
  }, []);

  useEffect(() => {
    void refreshVoiceAgentHealth();
  }, [refreshVoiceAgentHealth]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const applyExperimentResponse = useCallback(
    (body: ExperimentResponse) => {
      const resolvedScenario = body.scenario ?? selectedScenario;
      const score = body.score ?? 0;
      const confidence = body.confidence ?? (score < 40 ? "unusable" : score < 60 ? "low" : score < 80 ? "medium" : "high");
      const usable = body.usable ?? confidence !== "unusable";
      const nextTranscript = body.transcript ?? "";
      const entry: ExperimentHistoryEntry = {
        id: ++historyIdRef.current,
        timestamp: new Date().toISOString(),
        mode: body.mode ?? selectedMode,
        scenarioId: resolvedScenario.id,
        scenarioLabel: resolvedScenario.label,
        score,
        confidence,
        usable,
        missedKeywords: responseMissedKeywords(body),
        warnings: body.warnings ?? [],
        transcript: nextTranscript,
      };

      setTranscript(nextTranscript);
      setLastProvider(body.modeConfig?.provider ?? null);
      setLastProviderCallId(null);
      setLastMode(body.mode ?? null);
      setExperimentResult(body);
      setResultHistory((current) => [entry, ...current].slice(0, 80));
    },
    [selectedMode, selectedScenario],
  );

  const runExperimentAudioBlob = useCallback(
    async (blob: Blob, fileName: string) => {
      const targetUrl = `${voiceAgentUrl}/stt/experiment`;
      setStatus("uploading");
      addLog("experiment-upload-start", {
        targetUrl,
        fileName,
        kb: Math.round(blob.size / 1024),
        scenarioId: selectedScenario.id,
        mode: selectedMode,
      });

      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("scenarioId", selectedScenario.id);
      formData.append("mode", selectedMode);

      const result = await fetchJsonWithDiagnostics<ExperimentResponse>(targetUrl, {
        method: "POST",
        body: formData,
      });

      if (!result.ok) {
        setLastFailure(result);
        setStatus("error");
        addLog("experiment-error", result, "error");
        stopTracks();
        return;
      }

      const body = result.body;
      if (body.ok === false) {
        const diagnostic: FetchFailureDiagnostic = {
          ok: false,
          targetUrl,
          kind: "unknown",
          message: `Voice-agent returned ok=false from ${targetUrl}.`,
        };
        setLastFailure(diagnostic);
        setStatus("error");
        addLog("experiment-error", diagnostic, "error");
        stopTracks();
        return;
      }

      setLastFailure(null);
      applyExperimentResponse(body);
      setStatus("done");
      addLog("experiment-complete", {
        targetUrl,
        mode: body.mode,
        scenario: body.scenario?.id,
        score: body.score,
        confidence: body.confidence,
        usable: body.usable,
        missed: responseMissedKeywords(body),
        warnings: body.warnings,
      });
      stopTracks();
    },
    [addLog, applyExperimentResponse, selectedMode, selectedScenario.id, stopTracks, voiceAgentUrl],
  );

  async function startRecording() {
    if (!enabled || status === "recording" || status === "uploading") {
      return;
    }

    if (!voiceAgentOnline) {
      addLog("recording-disabled-offline", `${VOICE_AGENT_FIX}. URL used: ${voiceAgentUrl}/health`, "warn");
      return;
    }

    if (!isMediaRecorderAvailable()) {
      setMediaRecorderAvailable(false);
      addLog("recording-unavailable", MEDIA_RECORDER_WARNING, "warn");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        void runExperimentAudioBlob(blob, "selfhost-stt-experiment.webm");
      };

      recorder.start();
      setStatus("recording");
      addLog("recording-start", `Recording started${mimeType ? ` with ${mimeType}` : ""}.`);
    } catch (error) {
      setStatus("error");
      stopTracks();
      addLog("recording-error", error, "error");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      addLog("recording-stop", "Recording stopped; scoring audio.");
      recorderRef.current.stop();
    }
  }

  async function uploadSelectedAudioFile() {
    if (!selectedAudioFile) {
      return;
    }

    await runExperimentAudioBlob(selectedAudioFile, selectedAudioFile.name);
  }

  function scoreMockTranscriptLocally() {
    if (!enabled || !mockText.trim()) {
      return;
    }

    const result = scoreTranscriptLocally(mockText, selectedScenario);
    setLastFailure(null);
    applyExperimentResponse(result);
    setLastProvider("local");
    setLastMode("local-mock-score");
    setStatus("done");
    addLog("mock-local-score-complete", {
      scenarioId: selectedScenario.id,
      score: result.score,
      confidence: result.confidence,
      usable: result.usable,
      missed: responseMissedKeywords(result),
    });
  }

  async function emitMockTranscript() {
    if (!enabled || status === "uploading") {
      return;
    }

    const targetUrl = `${voiceAgentUrl}/stt/transcribe-and-emit`;
    setStatus("uploading");
    addLog("mock-emit-start", { targetUrl, provider: "mock" });

    const result = await fetchJsonWithDiagnostics<EmitResponse>(targetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "mock",
        text: mockText,
      }),
    });

    if (!result.ok) {
      setLastFailure(result);
      setStatus("error");
      addLog("mock-emit-error", result, "error");
      return;
    }

    const body = result.body;
    if (body.ok === false) {
      const diagnostic: FetchFailureDiagnostic = {
        ok: false,
        targetUrl,
        kind: "unknown",
        message: `Voice-agent returned ok=false from ${targetUrl}.`,
      };
      setLastFailure(diagnostic);
      setStatus("error");
      addLog("mock-emit-error", diagnostic, "error");
      return;
    }

    setLastFailure(null);
    setTranscript(body.transcript ?? "");
    setLastProvider(body.provider ?? null);
    setLastProviderCallId(body.providerCallId ?? null);
    setLastMode(body.mode ?? "mock");
    setExperimentResult(null);
    setStatus("done");
    addLog("mock-emit-complete", {
      targetUrl,
      provider: body.provider,
      providerCallId: body.providerCallId,
      emittedEvents: body.emittedEvents,
    });
  }

  async function copyHistory(format: "markdown" | "json") {
    if (resultHistory.length === 0) {
      addLog("history-copy-empty", "No STT experiment history to copy.", "warn");
      return;
    }

    const value = format === "markdown" ? historyToMarkdown(resultHistory) : historyToJson(resultHistory);
    try {
      await navigator.clipboard.writeText(value);
      addLog("history-copied", { format, rows: resultHistory.length });
    } catch (error) {
      addLog("history-copy-error", error, "error");
    }
  }

  function chooseScenario(scenarioId: string) {
    const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) {
      return;
    }

    setSelectedScenarioId(scenario.id);
    setMockText(scenario.original_text);
  }

  const startDisabled =
    !enabled || !voiceAgentOnline || mediaRecorderAvailable !== true || status === "recording" || status === "uploading";
  const stopDisabled = !enabled || status !== "recording";
  const fileUploadDisabled = !enabled || !voiceAgentOnline || status === "uploading" || !selectedAudioFile;
  const localMockDisabled = !enabled || status === "uploading" || !mockText.trim();
  const mockEmitDisabled = !enabled || !voiceAgentOnline || status === "uploading" || !mockText.trim();
  const experimentScore = experimentResult?.score;
  const experimentConfidence = experimentResult?.confidence;
  const experimentUsable = experimentResult?.usable;
  const serviceBadgeClass = serviceStatus.state === "online" ? "badge badge-success" : "badge badge-warning";
  const serviceStatusLabel =
    serviceStatus.state === "checking" ? "checking" : serviceStatus.state === "online" ? "online" : "offline";

  return (
    <main style={{ margin: "0 auto", maxWidth: 1120, padding: 24 }}>
      <div className="page-header">
        <div className="page-title">
          <h1>Self-host STT experiment</h1>
          <p>RU/KZ transcription comparison for the Python voice-agent spike.</p>
        </div>
      </div>

      {!enabled ? (
        <section className="card" style={{ borderColor: "var(--warning)" }}>
          <h2>Disabled</h2>
          <p className="muted">Self-host STT dev page is disabled in production.</p>
        </section>
      ) : null}

      <section className="card" style={{ marginBottom: 16, borderColor: serviceStatus.state === "offline" ? "var(--warning)" : "var(--border)" }}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Voice-agent status</h2>
          </div>
          <div className="actions">
            <span className={serviceBadgeClass}>{serviceStatusLabel}</span>
            <button type="button" className="button-secondary" onClick={() => void refreshVoiceAgentHealth()}>
              Retry health
            </button>
          </div>
        </div>
        <p>
          <strong>URL:</strong> {voiceAgentUrl || "disabled"}
        </p>
        <p>
          <strong>Health:</strong> {voiceAgentUrl ? `${voiceAgentUrl}/health` : "disabled"}
        </p>
        {serviceStatus.provider || serviceStatus.mode ? (
          <p>
            <strong>Provider/mode:</strong> {serviceStatus.provider ?? "unknown"} / {serviceStatus.mode ?? "unknown"}
          </p>
        ) : null}
        {serviceStatus.backendBaseUrl ? (
          <p>
            <strong>Backend:</strong> {serviceStatus.backendBaseUrl}
          </p>
        ) : null}
        {serviceStatus.state === "offline" ? (
          <div className="code-block" style={{ marginTop: 12 }}>
            {typeof serviceStatus.error === "string" ? serviceStatus.error : serviceStatus.error?.message}
            {"\n"}
            {VOICE_AGENT_FIX}
          </div>
        ) : null}
        {lastFailure ? (
          <div className="code-block" style={{ marginTop: 12 }}>
            Last failure: {lastFailure.kind}
            {"\n"}
            Target: {lastFailure.targetUrl}
            {"\n"}
            {lastFailure.message}
          </div>
        ) : null}
      </section>

      {mediaRecorderAvailable === false ? (
        <section className="card" style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
          <h2>Recorder unavailable</h2>
          <p className="muted">{MEDIA_RECORDER_WARNING}</p>
        </section>
      ) : null}

      <section className="grid grid-2">
        <div className="card">
          <h2>Experiment</h2>
          <p>
            <strong>Status:</strong> {statusLabel}
          </p>
          <div className="grid grid-2" style={{ marginBottom: 14 }}>
            <div className="form-row">
              <label htmlFor="scenario">Scenario</label>
              <select id="scenario" value={selectedScenario.id} onChange={(event) => chooseScenario(event.target.value)}>
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="stt-mode">STT mode</label>
              <select id="stt-mode" value={selectedMode} onChange={(event) => setSelectedMode(event.target.value)}>
                {modes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            {selectedModeConfig.provider}
            {selectedModeConfig.model ? ` / ${selectedModeConfig.model}` : ""}
            {selectedModeConfig.language ? ` / ${selectedModeConfig.language}` : ""}
          </p>
          <div className="actions">
            <button type="button" onClick={startRecording} disabled={startDisabled}>
              Start Recording
            </button>
            <button type="button" className="button-secondary" onClick={stopRecording} disabled={stopDisabled}>
              Stop and Score
            </button>
            <button type="button" className="button-secondary" onClick={() => setLogs([])}>
              Clear log
            </button>
          </div>
          {!voiceAgentOnline ? (
            <p className="muted" style={{ marginTop: 12 }}>
              Voice-agent is offline. Recording and file STT are disabled until it is reachable.
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2>Audio file</h2>
          <div className="form-row">
            <label htmlFor="audio-file">Upload .webm/.wav/.mp3</label>
            <input
              id="audio-file"
              type="file"
              accept="audio/webm,audio/wav,audio/wave,audio/mpeg,audio/mp3,.webm,.wav,.mp3"
              onChange={(event) => setSelectedAudioFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={uploadSelectedAudioFile} disabled={fileUploadDisabled}>
              Upload and Score File
            </button>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            {selectedAudioFile ? `${selectedAudioFile.name} (${Math.round(selectedAudioFile.size / 1024)} KB)` : "No file selected."}
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Mock transcript</h2>
        <div className="form-row">
          <label htmlFor="mock-transcript">Transcript</label>
          <textarea
            id="mock-transcript"
            rows={7}
            value={mockText}
            onChange={(event) => setMockText(event.target.value)}
          />
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button type="button" className="button-secondary" onClick={scoreMockTranscriptLocally} disabled={localMockDisabled}>
            Score mock locally
          </button>
          <button type="button" onClick={emitMockTranscript} disabled={mockEmitDisabled}>
            Emit mock transcript
          </button>
        </div>
        {!voiceAgentOnline ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Local scoring works offline. Mock emit needs the voice-agent because it posts to `/stt/transcribe-and-emit`.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Scenario phrases</h2>
        <div className="grid grid-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className="button-secondary"
              style={{
                alignItems: "flex-start",
                flexDirection: "column",
                justifyContent: "flex-start",
                minHeight: 86,
                textAlign: "left",
              }}
              onClick={() => chooseScenario(scenario.id)}
            >
              <strong>{scenario.label}</strong>
              <span>{scenario.original_text}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Transcript result</h2>
          <p>
            <strong>Provider:</strong> {lastProvider ?? "none"}
          </p>
          <p>
            <strong>Mode:</strong> {lastMode ?? "none"}
          </p>
          <p>
            <strong>Provider call id:</strong> {lastProviderCallId ?? "none"}
          </p>
          {experimentScore !== undefined ? (
            <div className="actions" style={{ marginBottom: 12 }}>
              <span className={experimentUsable === false ? "badge badge-danger" : experimentScore >= 80 ? "badge badge-success" : "badge badge-warning"}>
                Score {experimentScore}
              </span>
              {experimentConfidence ? (
                <span className={experimentConfidence === "high" ? "badge badge-success" : experimentConfidence === "unusable" ? "badge badge-danger" : "badge badge-warning"}>
                  {experimentConfidence}
                </span>
              ) : null}
              <span className={experimentUsable ? "badge badge-success" : "badge badge-danger"}>
                {experimentUsable ? "usable" : "not usable"}
              </span>
              <span className="badge badge-neutral">{selectedScenario.label}</span>
            </div>
          ) : null}
          <div className="code-block" style={{ minHeight: 140 }}>
            {transcript || (experimentResult ? "Empty transcript." : "No transcript yet.")}
          </div>
        </div>

        <div className="card">
          <h2>Score details</h2>
          <div className="grid" style={{ gap: 12 }}>
            <div>
              <strong>Keyword hits</strong>
              <div className="code-block" style={{ marginTop: 8 }}>
                {experimentResult ? responseKeywordHits(experimentResult).join(", ") || "none" : "none"}
              </div>
            </div>
            <div>
              <strong>Missed keywords</strong>
              <div className="code-block" style={{ marginTop: 8 }}>
                {experimentResult ? responseMissedKeywords(experimentResult).join(", ") || "none" : "none"}
              </div>
            </div>
            <div>
              <strong>Warnings</strong>
              <div className="code-block" style={{ marginTop: 8 }}>
                {(experimentResult?.warnings ?? []).join(", ") || "none"}
              </div>
            </div>
            <div>
              <strong>Callback required</strong>
              <div className="code-block" style={{ marginTop: 8 }}>
                {experimentResult ? (experimentResult.requiresCallback ? "yes" : "no") : "none"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Result history</h2>
          </div>
          <div className="actions">
            <button type="button" className="button-secondary" onClick={() => void copyHistory("markdown")} disabled={resultHistory.length === 0}>
              Copy markdown
            </button>
            <button type="button" className="button-secondary" onClick={() => void copyHistory("json")} disabled={resultHistory.length === 0}>
              Copy JSON
            </button>
            <button type="button" className="button-secondary" onClick={() => setResultHistory([])} disabled={resultHistory.length === 0}>
              Clear history
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Scenario</th>
                <th>Mode</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Usable</th>
                <th>Missed keywords</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {resultHistory.length === 0 ? (
                <tr>
                  <td colSpan={8}>No results yet.</td>
                </tr>
              ) : (
                resultHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.timestamp}</td>
                    <td>{entry.scenarioLabel}</td>
                    <td>{entry.mode}</td>
                    <td>{entry.score}</td>
                    <td>{entry.confidence}</td>
                    <td>{entry.usable ? "yes" : "no"}</td>
                    <td>{entry.missedKeywords.join(", ") || "none"}</td>
                    <td>{entry.warnings.join(", ") || "none"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 16 }}>
          <h3>Best usable mode by scenario</h3>
          {recommendations.length === 0 ? (
            <p className="muted">No usable results yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Mode</th>
                    <th>Score</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((recommendation) => (
                    <tr key={recommendation.scenarioId}>
                      <td>{recommendation.scenarioLabel}</td>
                      <td>{recommendation.mode}</td>
                      <td>{recommendation.score}</td>
                      <td>{recommendation.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Event log</h2>
        <div className="code-block" style={{ maxHeight: 360 }}>
          {logs.length === 0 ? (
            <span>No events yet.</span>
          ) : (
            logs.map((entry) => (
              <div key={entry.id}>
                <span className="muted">{entry.timestamp}</span> [{entry.level}] {entry.event}: {entry.detail}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
