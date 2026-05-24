"use client";

import { useCallback, useMemo, useRef, useState } from "react";

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

interface EmitResponse {
  ok?: boolean;
  provider?: string;
  providerCallId?: string;
  transcript?: string;
  emittedEvents?: number;
  backendResults?: unknown;
}

const TEST_PHRASES = [
  {
    label: "RU",
    text: "Здравствуйте, у меня труба течёт под ванной. Адрес Шымкент, Нурсат, дом 15. Срочно. Меня зовут Дима.",
  },
  {
    label: "KZ",
    text: "Су ағып жатыр. Шымкент, Тұран жақта. Тезірек керек. Атым Дима.",
  },
  {
    label: "MIX",
    text: "Аға, су ағып жатыр, ваннаның астынан течь. Шымкент, Тұран жақта, 5 этаж. Тезірек керек. Атым Дима.",
  },
  {
    label: "GAS",
    text: "Үйде газ иісі шығып тұр. Пахнет газом, не знаю что делать. Шымкент, Нурсат.",
  },
] as const;

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
  const [mockText, setMockText] = useState<string>(TEST_PHRASES[0].text);
  const [lastProviderCallId, setLastProviderCallId] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

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

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const emitAudioBlob = useCallback(
    async (blob: Blob) => {
      setStatus("uploading");
      addLog("upload-start", `Sending ${Math.round(blob.size / 1024)} KB audio blob to voice-agent.`);

      const formData = new FormData();
      formData.append("file", blob, "selfhost-recording.webm");

      try {
        const response = await fetch(`${voiceAgentUrl}/stt/transcribe-and-emit`, {
          method: "POST",
          body: formData,
        });
        const body = (await response.json()) as EmitResponse;
        if (!response.ok || body.ok === false) {
          throw new Error(cleanDetail(body));
        }

        setTranscript(body.transcript ?? "");
        setLastProvider(body.provider ?? null);
        setLastProviderCallId(body.providerCallId ?? null);
        setStatus("done");
        addLog("emit-complete", {
          provider: body.provider,
          providerCallId: body.providerCallId,
          emittedEvents: body.emittedEvents,
        });
      } catch (error) {
        setStatus("error");
        addLog("emit-error", error, "error");
      } finally {
        stopTracks();
      }
    },
    [addLog, stopTracks, voiceAgentUrl],
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
        void emitAudioBlob(blob);
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
      addLog("recording-stop", "Recording stopped; uploading audio.");
      recorderRef.current.stop();
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

  const startDisabled = !enabled || status === "recording" || status === "uploading";
  const stopDisabled = !enabled || status !== "recording";
  const mockDisabled = !enabled || status === "uploading" || !mockText.trim();

  return (
    <main style={{ margin: "0 auto", maxWidth: 1120, padding: 24 }}>
      <div className="page-header">
        <div className="page-title">
          <h1>Self-host STT dev test</h1>
          <p>Upload-based microphone and mock transcript path into normalized self-host voice events.</p>
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
          <h2>Recorder</h2>
          <p>
            <strong>Voice agent:</strong> {voiceAgentUrl || "disabled"}
          </p>
          <p>
            <strong>Status:</strong> {statusLabel}
          </p>
          <div className="actions">
            <button type="button" onClick={startRecording} disabled={startDisabled}>
              Start Recording
            </button>
            <button type="button" className="button-secondary" onClick={stopRecording} disabled={stopDisabled}>
              Stop Recording
            </button>
            <button type="button" className="button-secondary" onClick={() => setLogs([])}>
              Clear log
            </button>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            Stop uploads one short browser recording to the Python STT service, which emits self-host call events.
          </p>
        </div>

        <div className="card">
          <h2>Mock transcript</h2>
          <div className="form-row">
            <label htmlFor="mock-transcript">Transcript</label>
            <textarea
              id="mock-transcript"
              rows={6}
              value={mockText}
              onChange={(event) => setMockText(event.target.value)}
            />
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={emitMockTranscript} disabled={mockDisabled}>
              Emit mock transcript
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Test phrases</h2>
        <div className="grid grid-2">
          {TEST_PHRASES.map((phrase) => (
            <button
              key={phrase.label}
              type="button"
              className="button-secondary"
              style={{ alignItems: "flex-start", justifyContent: "flex-start", minHeight: 72, textAlign: "left" }}
              onClick={() => setMockText(phrase.text)}
            >
              <strong>{phrase.label}</strong>
              <span>{phrase.text}</span>
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
            <strong>Provider call id:</strong> {lastProviderCallId ?? "none"}
          </p>
          <div className="code-block" style={{ minHeight: 140 }}>
            {transcript || "No transcript yet."}
          </div>
        </div>

        <div className="card">
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
        </div>
      </section>
    </main>
  );
}
