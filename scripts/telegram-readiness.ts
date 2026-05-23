import { loadEnvFiles } from "./load-env";

function isPresent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

loadEnvFiles();

const botTokenPresent = isPresent(process.env.TELEGRAM_BOT_TOKEN);
const webhookSecretPresent = isPresent(process.env.TELEGRAM_WEBHOOK_SECRET);

console.log("Telegram readiness:");
console.log(`- TELEGRAM_BOT_TOKEN present: ${botTokenPresent ? "yes" : "no"}`);
console.log(`- TELEGRAM_WEBHOOK_SECRET present: ${webhookSecretPresent ? "yes" : "no"}`);

if (!botTokenPresent || !webhookSecretPresent) {
  process.exitCode = 1;
}
