export type FetchFailureKind = "network-or-cors" | "http" | "invalid-json" | "unknown";

export interface FetchFailureDiagnostic {
  ok: false;
  targetUrl: string;
  kind: FetchFailureKind;
  status?: number;
  statusText?: string;
  message: string;
  fix?: string;
}

export interface FetchSuccess<T> {
  ok: true;
  targetUrl: string;
  status: number;
  body: T;
}

export type FetchJsonResult<T> = FetchSuccess<T> | FetchFailureDiagnostic;

const VOICE_AGENT_FIX = "Run npm run voice-agent:dev and open http://localhost:8001/health";

export function classifyFetchError(targetUrl: string, error: unknown): FetchFailureDiagnostic {
  const message = error instanceof Error ? error.message : "Unknown fetch error";
  const networkOrCors =
    error instanceof TypeError ||
    message.toLowerCase().includes("failed to fetch") ||
    message.toLowerCase().includes("networkerror");

  return {
    ok: false,
    targetUrl,
    kind: networkOrCors ? "network-or-cors" : "unknown",
    message: networkOrCors
      ? `Network/CORS failure while calling ${targetUrl}: ${message}`
      : `Fetch failed while calling ${targetUrl}: ${message}`,
    fix: VOICE_AGENT_FIX,
  };
}

export function classifyHttpError(targetUrl: string, response: Response, body: unknown): FetchFailureDiagnostic {
  return {
    ok: false,
    targetUrl,
    kind: "http",
    status: response.status,
    statusText: response.statusText,
    message: `Non-2xx response from ${targetUrl}: HTTP ${response.status} ${response.statusText}`.trim(),
    fix: typeof body === "object" && body !== null ? JSON.stringify(body) : undefined,
  };
}

export function classifyInvalidJson(targetUrl: string, response: Response): FetchFailureDiagnostic {
  return {
    ok: false,
    targetUrl,
    kind: "invalid-json",
    status: response.status,
    statusText: response.statusText,
    message: `Invalid JSON response from ${targetUrl}: HTTP ${response.status} ${response.statusText}`.trim(),
    fix: VOICE_AGENT_FIX,
  };
}

export async function fetchJsonWithDiagnostics<T>(
  targetUrl: string,
  init?: RequestInit,
): Promise<FetchJsonResult<T>> {
  try {
    const response = await fetch(targetUrl, init);
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      if (response.ok) {
        return classifyInvalidJson(targetUrl, response);
      }
    }
    if (!response.ok) {
      return classifyHttpError(targetUrl, response, body);
    }

    return {
      ok: true,
      targetUrl,
      status: response.status,
      body: body as T,
    };
  } catch (error) {
    return classifyFetchError(targetUrl, error);
  }
}
