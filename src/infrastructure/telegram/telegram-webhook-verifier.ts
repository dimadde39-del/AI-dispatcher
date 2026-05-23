import { timingSafeEqual } from "node:crypto";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

function configuredSecret(): string | null {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.byteLength !== bBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function verifyTelegramWebhookSecret(headers: Headers): boolean {
  const secret = configuredSecret();
  if (!secret) {
    return true;
  }

  const providedSecret = headers.get(TELEGRAM_SECRET_HEADER);
  return providedSecret ? safeEqual(providedSecret, secret) : false;
}
