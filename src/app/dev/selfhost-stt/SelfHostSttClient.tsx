"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RecordingStatus = "idle" | "recording" | "uploading" | "done" | "error";

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

interface EmitResponse {
  ok?: boolean;
  provider?: string;
  mode?: string;
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
  missed_keywords?: string[];
  has_russian?: boolean;
  has_kazakh_chars?: boolean;
  likely_wrong_language?: boolean;
  warnings?: string[];
}

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
    id: "deepgram-multi-nova3",
    provider: "deepgram",
    model: "nova-3",
    language: "multi",
    options: { punctuate: true, smart_format: true },
    description: "Deepgram nova-3 with language=multi for RU/KZ code-switching experiments.",
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
    id: "deepgram-ru-nova2",
    provider: "deepgram",
    model: "nova-2",
    language: "ru",
    options: { punctuate: true, smart_format: true },
    description: "Russian-only Deepgram nova-2 baseline.",
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

function preferredMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

export function SelfHostSttClient({ enabled, voiceAgentUrl }: SelfHostSttClientProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const logIdRef = useRef(0);
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [transcript, setTranscript] = useState("");
  const [mockText, setMockText] = useState<string>(FALLBACK_SCENARIOS[0].original_text);
  const [modes, setModes] = useState<SttMode[]>(FALLBACK_MODES);
  const [scenarios, setScenarios] = useState<SttScenario[]>(FALLBACK_SCENARIOS);
  const [selectedMode, setSelectedMode] = useState("deepgram-multi-nova3");
  const [selectedScenarioId, setSelectedScenarioId] = useState(FALLBACK_SCENARIOS[0].id);
  const [lastProviderCallId, setLastProviderCallId] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] = useState<ExperimentResponse | null>(null);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0] ?? FALLBACK_SCENARIOS[0],
    [scenarios, selectedScenarioId],
  );

  const selectedModeConfig = useMemo(
    () => modes.find((mode) => mode.id === selectedMode) ?? modes[0] ?? FALLBACK_MODES[0],
    [modes, selectedMode],
  );

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

  useEffect(() => {
    if (!enabled || !voiceAgentUrl) {
      return;
    }

    const controller = new AbortController();

    async function loadExperimentConfig() {
      try {
        const [modesResponse, scenariosResponse] = await Promise.all([
          fetch(`${voiceAgentUrl}/stt/modes`, { signal: controller.signal }),
          fetch(`${voiceAgentUrl}/stt/scenarios`, { signal: controller.signal }),
        ]);

        if (modesResponse.ok) {
          const body = (await modesResponse.json()) as { modes?: SttMode[] };
          if (body.modes?.length) {
            setModes(body.modes);
          }
        }

        if (scenariosResponse.ok) {
          const body = (await scenariosResponse.json()) as { scenarios?: SttScenario[] };
          if (body.scenarios?.length) {
            setScenarios(body.scenarios);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          addLog("experiment-config-fallback", error, "warn");
        }
      }
    }

    void loadExperimentConfig();

    return () => controller.abort();
  }, [addLog, enabled, voiceAgentUrl]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const applyExperimentResponse = useCallback((body: ExperimentResponse) => {
    setTranscript(body.transcript ?? "");
    setLastProvider(body.modeConfig?.provider ?? null);
    setLastProviderCallId(null);
    setLastMode(body.mode ?? null);
    setExperimentResult(body);
  }, []);

  const runExperimentAudioBlob = useCallback(
    async (blob: Blob) => {
      setStatus("uploading");
      addLog("experiment-upload-start", {
        kb: Math.round(blob.size / 1024),
        scenarioId: selectedScenario.id,
        mode: selectedMode,
      });

      const formData = new FormData();
      formData.append("file", blob, "selfhost-stt-experiment.webm");
      formData.append("scenarioId", selectedScenario.id);
      formData.append("mode", selectedMode);

      try {
        const response = await fetch(`${voiceAgentUrl}/stt/experiment`, {
          method: "POST",
          body: formData,
        });
        const body = (await response.json()) as ExperimentResponse;
        if (!response.ok || body.ok === false) {
          throw new Error(cleanDetail(body));
        }

        applyExperimentResponse(body);
        setStatus("done");
        addLog("experiment-complete", {
          mode: body.mode,
          scenario: body.scenario?.id,
          score: body.score,
          missed: body.missed_keywords,
        });
      } catch (error) {
        setStatus("error");
        addLog("experiment-error", error, "error");
      } finally {
        stopTracks();
      }
    },
    [addLog, applyExperimentResponse, selectedMode, selectedScenario.id, stopTracks, voiceAgentUrl],
  );

  async function startRecording() {
    if (!enabled || status === "recording" || status === "uploading") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error");
      addLog("recording-unavailable", "MediaRecorder is not available in this browser.", "error");
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
        void runExperimentAudioBlob(blob);
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

  async function runMockExperiment() {
    if (!enabled || status === "uploading" || !mockText.trim()) {
      return;
    }

    setStatus("uploading");
    addLog("mock-experiment-start", {
      scenarioId: selectedScenario.id,
      mode: "mock",
    });

    try {
      const response = await fetch(`${voiceAgentUrl}/stt/experiment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "mock",
          scenarioId: selectedScenario.id,
          text: mockText,
        }),
      });
      const body = (await response.json()) as ExperimentResponse;
      if (!response.ok || body.ok === false) {
        throw new Error(cleanDetail(body));
      }

      applyExperimentResponse(body);
      setStatus("done");
      addLog("mock-experiment-complete", {
        score: body.score,
        missed: body.missed_keywords,
      });
    } catch (error) {
      setStatus("error");
      addLog("mock-experiment-error", error, "error");
    }
  }

  async function emitMockTranscript() {
    if (!enabled || status === "uploading") {
      return;
    }

    setStatus("uploading");
    addLog("mock-emit-start", "Sending typed transcript through mock STT provider.");

    try {
      const response = await fetch(`${voiceAgentUrl}/stt/transcribe-and-emit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "mock",
          text: mockText,
        }),
      });
      const body = (await response.json()) as EmitResponse;
      if (!response.ok || body.ok === false) {
        throw new Error(cleanDetail(body));
      }

      setTranscript(body.transcript ?? "");
      setLastProvider(body.provider ?? null);
      setLastProviderCallId(body.providerCallId ?? null);
      setLastMode(body.mode ?? "mock");
      setExperimentResult(null);
      setStatus("done");
      addLog("mock-emit-complete", {
        provider: body.provider,
        providerCallId: body.providerCallId,
        emittedEvents: body.emittedEvents,
      });
    } catch (error) {
      setStatus("error");
      addLog("mock-emit-error", error, "error");
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

  const startDisabled = !enabled || status === "recording" || status === "uploading";
  const stopDisabled = !enabled || status !== "recording";
  const mockDisabled = !enabled || status === "uploading" || !mockText.trim();
  const experimentScore = experimentResult?.score;

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

      <section className="grid grid-2">
        <div className="card">
          <h2>Experiment</h2>
          <p>
            <strong>Voice agent:</strong> {voiceAgentUrl || "disabled"}
          </p>
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
        </div>

        <div className="card">
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
            <button type="button" className="button-secondary" onClick={runMockExperiment} disabled={mockDisabled}>
              Score mock transcript
            </button>
            <button type="button" onClick={emitMockTranscript} disabled={mockDisabled}>
              Emit mock transcript
            </button>
          </div>
        </div>
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
              <span className={experimentScore >= 80 ? "badge badge-success" : "badge badge-warning"}>
                Score {experimentScore}
              </span>
              <span className="badge badge-neutral">{selectedScenario.label}</span>
            </div>
          ) : null}
          <div className="code-block" style={{ minHeight: 140 }}>
            {transcript || "No transcript yet."}
          </div>
        </div>

        <div className="card">
          <h2>Score details</h2>
          <div className="grid" style={{ gap: 12 }}>
            <div>
              <strong>Keyword hits</strong>
              <div className="code-block" style={{ marginTop: 8 }}>
                {(experimentResult?.keyword_hits ?? []).join(", ") || "none"}
              </div>
            </div>
            <div>
              <strong>Missed keywords</strong>
              <div className="code-block" style={{ marginTop: 8 }}>
                {(experimentResult?.missed_keywords ?? []).join(", ") || "none"}
              </div>
            </div>
            <div>
              <strong>Warnings</strong>
              <div className="code-block" style={{ marginTop: 8 }}>
                {(experimentResult?.warnings ?? []).join(", ") || "none"}
              </div>
            </div>
          </div>
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
