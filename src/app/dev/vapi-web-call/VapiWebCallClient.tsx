"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

type ConnectionStatus = "idle" | "starting" | "active" | "stopping" | "ended" | "error";
type VapiWebEvent = "call-start" | "call-end" | "speech-start" | "speech-end" | "message" | "error";
type VapiEventHandler = (...args: unknown[]) => void;

interface LogEntry {
  id: number;
  timestamp: string;
  event: string;
  detail: string;
  level: "info" | "warn" | "error";
}

interface VapiWebCallClientProps {
  assistantId: string;
  enabled: boolean;
  publicKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, maxLength: number = 180): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }

  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeMessageSummary(message: unknown): string {
  if (!isRecord(message)) {
    return cleanText(message) ?? "message received";
  }

  const type = stringField(message, "type") ?? "unknown";
  const parts = [`type=${type}`];
  const role = stringField(message, "role");
  const transcriptType = stringField(message, "transcriptType");
  const status = stringField(message, "status");
  const endedReason = stringField(message, "endedReason");

  if (role) {
    parts.push(`role=${role}`);
  }

  if (transcriptType) {
    parts.push(`transcriptType=${transcriptType}`);
  }

  if (status) {
    parts.push(`status=${status}`);
  }

  if (endedReason) {
    parts.push(`endedReason=${endedReason}`);
  }

  const transcript = cleanText(message.transcript);
  const text = cleanText(message.text);
  const summaryText = transcript ?? text;
  if (summaryText) {
    parts.push(`preview="${summaryText}"`);
  }

  return parts.join(" ");
}

function safeErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${cleanText(error.message, 220) ?? "unknown error"}`;
  }

  if (!isRecord(error)) {
    return cleanText(error, 220) ?? "unknown error";
  }

  const message = cleanText(error.message, 220) ?? cleanText(error.error, 220) ?? "unknown error";
  const code = stringField(error, "code");
  const name = stringField(error, "name");
  return [name, code, message].filter(Boolean).join(" ");
}

function safeCallSummary(call: unknown): string {
  if (!isRecord(call)) {
    return "start returned no call metadata";
  }

  const id = stringField(call, "id");
  return id ? `callId=${id}` : "call started; no call id returned";
}

function subscribe(vapi: Vapi, event: VapiWebEvent, handler: VapiEventHandler): () => void {
  const on = vapi.on as (eventName: VapiWebEvent, listener: VapiEventHandler) => Vapi;
  const removeListener = vapi.removeListener as (eventName: VapiWebEvent, listener: VapiEventHandler) => Vapi;
  on.call(vapi, event, handler);
  return () => removeListener.call(vapi, event, handler);
}

export function VapiWebCallClient({ assistantId, enabled, publicKey }: VapiWebCallClientProps) {
  const vapiRef = useRef<Vapi | null>(null);
  const logIdRef = useRef(0);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const publicKeyConfigured = publicKey.trim().length > 0;

  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
        return "Idle";
      case "starting":
        return "Starting";
      case "active":
        return "Active";
      case "stopping":
        return "Stopping";
      case "ended":
        return "Ended";
      case "error":
        return "Error";
    }
  }, [status]);

  const addLog = useCallback((event: string, detail: string, level: LogEntry["level"] = "info") => {
    const entry: LogEntry = {
      id: ++logIdRef.current,
      timestamp: new Date().toISOString(),
      event,
      detail,
      level,
    };
    setLogs((current) => [entry, ...current].slice(0, 80));
  }, []);

  useEffect(() => {
    if (!enabled || !publicKeyConfigured) {
      return;
    }

    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    const cleanup = [
      subscribe(vapi, "call-start", () => {
        setStatus("active");
        addLog("call-start", "Vapi reported call start.");
      }),
      subscribe(vapi, "call-end", () => {
        setStatus("ended");
        addLog("call-end", "Vapi reported call end.");
      }),
      subscribe(vapi, "speech-start", () => {
        addLog("speech-start", "Speech started.");
      }),
      subscribe(vapi, "speech-end", () => {
        addLog("speech-end", "Speech ended.");
      }),
      subscribe(vapi, "message", (message) => {
        addLog("message", safeMessageSummary(message));
      }),
      subscribe(vapi, "error", (error) => {
        setStatus("error");
        addLog("error", safeErrorSummary(error), "error");
      }),
    ];

    addLog("sdk-ready", "Vapi Web SDK initialized.");

    return () => {
      for (const cleanupListener of cleanup) {
        cleanupListener();
      }

      void vapi.stop().catch(() => {
        // Ignore cleanup stop errors; the page is unloading or the call is already closed.
      });
      vapiRef.current = null;
    };
  }, [addLog, enabled, publicKey, publicKeyConfigured]);

  async function startCall() {
    if (!vapiRef.current || !enabled || !publicKeyConfigured || status === "active" || status === "starting") {
      return;
    }

    setStatus("starting");
    addLog("start-requested", `Starting assistant ${assistantId}.`);

    try {
      const call = await vapiRef.current.start(assistantId);
      addLog("start-result", safeCallSummary(call));
    } catch (error) {
      setStatus("error");
      addLog("start-error", `${safeErrorSummary(error)}. Billing/payment may be required.`, "error");
    }
  }

  async function stopCall() {
    if (!vapiRef.current || status === "idle" || status === "ended" || status === "stopping") {
      return;
    }

    setStatus("stopping");
    addLog("stop-requested", "Stopping Vapi Web Call.");

    try {
      await vapiRef.current.stop();
      setStatus("ended");
      addLog("stop-complete", "Stop request completed.");
    } catch (error) {
      setStatus("error");
      addLog("stop-error", safeErrorSummary(error), "error");
    }
  }

  const startDisabled = !enabled || !publicKeyConfigured || status === "starting" || status === "active";
  const stopDisabled = !enabled || status === "idle" || status === "ended" || status === "stopping";

  return (
    <main style={{ margin: "0 auto", maxWidth: 1040, padding: 24 }}>
      <div className="page-header">
        <div className="page-title">
          <h1>Vapi Web Call dev test</h1>
          <p>Internal browser microphone test for RU/KZ assistant behavior and Vapi webhook delivery.</p>
        </div>
      </div>

      {!enabled ? (
        <section className="card" style={{ borderColor: "var(--warning)" }}>
          <h2>Disabled</h2>
          <p className="muted">Dev Vapi Web Call page is disabled in production.</p>
        </section>
      ) : null}

      {enabled && !publicKeyConfigured ? (
        <section className="card" style={{ borderColor: "var(--warning)", marginBottom: 16 }}>
          <h2>Setup needed</h2>
          <p className="muted">
            Set NEXT_PUBLIC_VAPI_PUBLIC_KEY to use browser Web Calls. The key is safe for browser use, but it is not shown here.
          </p>
        </section>
      ) : null}

      <section className="grid grid-2">
        <div className="card">
          <h2>Call controls</h2>
          <p>
            <strong>Assistant ID:</strong> {assistantId}
          </p>
          <p>
            <strong>Status:</strong> {statusLabel}
          </p>
          <div className="actions">
            <button type="button" onClick={startCall} disabled={startDisabled}>
              Start
            </button>
            <button type="button" className="button-secondary" onClick={stopCall} disabled={stopDisabled}>
              Stop
            </button>
            <button type="button" className="button-secondary" onClick={() => setLogs([])}>
              Clear log
            </button>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            This uses real microphone/audio and may require Vapi billing/payment even without a phone number.
          </p>
        </div>

        <div className="card">
          <h2>Test phrases</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Срочно течет труба под ванной, адрес Абая 150, Айгуль.</li>
            <li>Үйде су ағып жатыр, өте шұғыл, район Бостандық, Нұрлан.</li>
            <li>Ванна жақта су кетіп жатыр, Қабанбай батыр, Мадина.</li>
            <li>Пахнет газом на кухне, адрес Жандосова 45.</li>
            <li>Сколько будет стоить поменять замок?</li>
            <li>Что мне самому открутить, чтобы холодильник морозил?</li>
          </ul>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div className="page-title">
            <h2 style={{ margin: 0 }}>Event log</h2>
            <p>Safe summaries only. Secrets and raw provider payloads are not printed.</p>
          </div>
        </div>
        <div className="code-block" style={{ maxHeight: 420 }}>
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
