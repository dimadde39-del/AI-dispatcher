import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { VAPI_WEBHOOK_SECRET_HEADER } from "../src/infrastructure/voice/vapi";
import { loadEnvFiles } from "./load-env";

const PUBLIC_APP_URL = "https://ai-dispatcher-chi.vercel.app";
const VAPI_SERVER_URL = `${PUBLIC_APP_URL}/api/webhooks/vapi`;
const DEMO_MASTER_PHONE = "+77001234567";

function isPresent(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function isNumericTelegramChatId(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^-?\d+$/.test(trimmed));
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function main() {
  loadEnvFiles();

  const repositories = createSupabaseRepositoryContext();
  const [masters, aiNumbers] = await Promise.all([repositories.masters.list(), repositories.aiNumbers.list()]);
  const demoMaster = masters.find((master) => master.phone === DEMO_MASTER_PHONE) ?? null;
  const assignedAiNumbers = aiNumbers.filter((number) => number.status === "ASSIGNED" && number.masterId);

  const telegramTokenPresent = isPresent(process.env.TELEGRAM_BOT_TOKEN);
  const telegramWebhookSecretPresent = isPresent(process.env.TELEGRAM_WEBHOOK_SECRET);
  const vapiWebhookSecretPresent = isPresent(process.env.VAPI_WEBHOOK_SECRET);
  const appBaseUrl = process.env.APP_BASE_URL?.trim() ?? "";
  const appBaseIsPublicHttps = isPublicHttpsUrl(appBaseUrl);

  console.log("Vapi live test checklist:");
  console.log(`- Public server URL: ${PUBLIC_APP_URL}`);
  console.log(`- Vapi Server URL to paste: ${VAPI_SERVER_URL}`);
  console.log(`- APP_BASE_URL public HTTPS: ${appBaseIsPublicHttps ? "yes" : "no"}`);
  console.log(`- VAPI_WEBHOOK_SECRET present: ${vapiWebhookSecretPresent ? "yes" : "no"}`);
  console.log(`- Vapi auth header expected: ${VAPI_WEBHOOK_SECRET_HEADER}`);
  console.log(`- VAPI_API_KEY required by current webhook flow: no`);
  console.log(`- Telegram ready env: ${telegramTokenPresent && telegramWebhookSecretPresent ? "yes" : "no"}`);
  console.log(`- Demo master exists: ${demoMaster ? "yes" : "no"}`);
  console.log(`- Demo master has telegram_chat_id: ${isPresent(demoMaster?.telegramChatId) ? "yes" : "no"}`);
  console.log(`- Demo master telegram_chat_id looks live numeric: ${isNumericTelegramChatId(demoMaster?.telegramChatId) ? "yes" : "no"}`);
  console.log(`- Assigned AI number exists: ${assignedAiNumbers.length > 0 ? "yes" : "no"}`);
  console.log("");
  console.log("Expected result after one Vapi end-of-call-report test:");
  console.log("- /admin/calls shows a Vapi call row.");
  console.log("- /admin/leads shows one linked lead for that call.");
  console.log("- Telegram receives one lead card if the master chat id is configured.");
  console.log("- npm run lead:status or the admin UI shows the resulting lead status.");

  if (!vapiWebhookSecretPresent) {
    console.warn("- Warning: set VAPI_WEBHOOK_SECRET in Vercel and configure Vapi to send the matching header before live testing.");
  }

  if (!appBaseIsPublicHttps) {
    console.warn("- Warning: APP_BASE_URL should be the public HTTPS Vercel URL for live Vapi callbacks.");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Vapi checklist error";
  console.error(`Vapi live checklist failed: ${message}`);
  process.exitCode = 1;
});
