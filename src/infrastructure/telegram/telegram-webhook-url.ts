const TELEGRAM_WEBHOOK_PATH = "/api/webhooks/telegram";

export function buildTelegramWebhookUrl(appBaseUrl: string): string {
  const trimmedBaseUrl = appBaseUrl.trim();
  if (!trimmedBaseUrl) {
    throw new Error("APP_BASE_URL is required for Telegram webhook setup.");
  }

  let url: URL;
  try {
    url = new URL(trimmedBaseUrl);
  } catch {
    throw new Error("APP_BASE_URL must be a valid URL.");
  }

  const hostname = url.hostname.toLowerCase();
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
  if (url.protocol !== "https:" || isLocalhost) {
    throw new Error("Telegram requires a public HTTPS URL for webhooks.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}${TELEGRAM_WEBHOOK_PATH}`;
  url.search = "";
  url.hash = "";

  return url.toString();
}
