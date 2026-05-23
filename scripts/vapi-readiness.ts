import { isVapiWebhookVerificationConfigured, VAPI_WEBHOOK_SECRET_HEADER } from "../src/infrastructure/voice/vapi";
import { loadEnvFiles } from "./load-env";

function isPresent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

loadEnvFiles();

const apiKeyPresent = isPresent(process.env.VAPI_API_KEY);
const webhookSecretPresent = isPresent(process.env.VAPI_WEBHOOK_SECRET);
const liveCheck = hasFlag("--live") || process.env.VAPI_LIVE_CHECKS === "1";
const requireApiKey = liveCheck || hasFlag("--require-api-key");
const requireWebhookSecret = liveCheck || hasFlag("--require-webhook-secret") || process.env.NODE_ENV === "production";

console.log("Vapi readiness:");
console.log(`- VAPI_WEBHOOK_SECRET present: ${webhookSecretPresent ? "yes" : "no"}`);
console.log(`- Webhook secret header: ${VAPI_WEBHOOK_SECRET_HEADER}`);
console.log(`- Webhook verification enabled: ${isVapiWebhookVerificationConfigured() ? "yes" : "development fallback"}`);
console.log(`- VAPI_API_KEY present: ${apiKeyPresent ? "yes" : "no"}`);

if (!webhookSecretPresent) {
  console.warn("- Warning: Vapi webhooks are allowed without a secret only outside production.");
}

if (!apiKeyPresent) {
  console.warn("- Warning: live Vapi API calls are not configured. Webhook parser/unit tests do not require this.");
}

if ((requireWebhookSecret && !webhookSecretPresent) || (requireApiKey && !apiKeyPresent)) {
  console.error("Vapi live readiness failed. Configure the missing Vapi env vars and rerun.");
  process.exitCode = 1;
}
