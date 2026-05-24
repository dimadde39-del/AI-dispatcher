import { isVapiWebhookVerificationConfigured, VAPI_WEBHOOK_SECRET_HEADER } from "../src/infrastructure/voice/vapi";
import { loadEnvFiles } from "./load-env";

const PUBLIC_APP_URL = "https://ai-dispatcher-chi.vercel.app";
const VAPI_WEBHOOK_PATH = "/api/webhooks/vapi";
const VAPI_SERVER_URL = `${PUBLIC_APP_URL}${VAPI_WEBHOOK_PATH}`;
const CURRENT_SCRIPTS_CALL_VAPI_API = false;

function isPresent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function parseUrl(value: string | null): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalhost(url: URL): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
}

loadEnvFiles();

const appBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL);
const appUrl = parseUrl(appBaseUrl);
const derivedWebhookUrl = appUrl ? new URL(VAPI_WEBHOOK_PATH, appUrl).toString() : null;
const webhookSecretPresent = isPresent(process.env.VAPI_WEBHOOK_SECRET);

console.log("Vapi live readiness:");
console.log(`- Public app URL: ${PUBLIC_APP_URL}`);
console.log(`- Vapi Server URL to paste: ${VAPI_SERVER_URL}`);
console.log(`- APP_BASE_URL present: ${appBaseUrl ? "yes" : "no"}`);
console.log(`- APP_BASE_URL public HTTPS: ${appUrl?.protocol === "https:" && !isLocalhost(appUrl) ? "yes" : "no"}`);
console.log(`- Derived webhook path is ${VAPI_WEBHOOK_PATH}: ${derivedWebhookUrl?.endsWith(VAPI_WEBHOOK_PATH) ? "yes" : "no"}`);
console.log(`- Derived webhook URL: ${derivedWebhookUrl ?? "unavailable"}`);
console.log(`- Webhook secret header: ${VAPI_WEBHOOK_SECRET_HEADER}`);
console.log(`- VAPI_WEBHOOK_SECRET present: ${webhookSecretPresent ? "yes" : "no"}`);
console.log(`- Webhook verification configured: ${isVapiWebhookVerificationConfigured() ? "yes" : "no"}`);
console.log(`- Current scripts call Vapi API directly: ${CURRENT_SCRIPTS_CALL_VAPI_API ? "yes" : "no"}`);

if (CURRENT_SCRIPTS_CALL_VAPI_API) {
  console.log(`- VAPI_API_KEY present: ${isPresent(process.env.VAPI_API_KEY) ? "yes" : "no"}`);
} else {
  console.log("- VAPI_API_KEY required for these local live-test scripts: no");
}

if (!appUrl) {
  console.warn("- Warning: APP_BASE_URL is missing or invalid. Set it to the public deployed URL before a live Vapi test.");
} else if (isLocalhost(appUrl)) {
  console.warn("- Warning: APP_BASE_URL is localhost. Vapi needs a public HTTPS server URL for live webhooks.");
} else if (appUrl.protocol !== "https:") {
  console.warn("- Warning: APP_BASE_URL is not HTTPS. Vapi live webhooks should use public HTTPS.");
}

if (derivedWebhookUrl !== VAPI_SERVER_URL) {
  console.warn(`- Warning: APP_BASE_URL does not derive the current public Vapi Server URL: ${VAPI_SERVER_URL}`);
}

if (!webhookSecretPresent) {
  console.warn(
    "- Warning: VAPI_WEBHOOK_SECRET is missing. Production Vapi webhooks fail closed without it in the current verifier.",
  );
}

console.warn(
  `- Auth reminder: configure Vapi to send ${VAPI_WEBHOOK_SECRET_HEADER}; if the dashboard cannot send it, use a documented protected fallback before live production traffic.`,
);
