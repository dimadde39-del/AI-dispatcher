import { timingSafeEqual } from "node:crypto";

export const VAPI_WEBHOOK_SECRET_HEADER = "x-vapi-webhook-secret";

function configuredSecret(): string | null {
  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim();
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

export function isVapiWebhookVerificationConfigured(): boolean {
  return Boolean(configuredSecret());
}

export function verifyVapiWebhookSecret(
  headers: Headers,
  headerName: string = VAPI_WEBHOOK_SECRET_HEADER,
): boolean {
  const secret = configuredSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const providedSecret = headers.get(headerName);
  return providedSecret ? safeEqual(providedSecret, secret) : false;
}
