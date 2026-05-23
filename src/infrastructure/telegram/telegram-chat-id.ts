const CHAT_ID_PATTERN = /^-?\d{5,20}$/;

export function sanitizeTelegramChatId(input: string): string {
  const trimmed = input.trim();
  const withoutOptionalAngleBrackets =
    trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed.slice(1, -1).trim() : trimmed;

  if (!CHAT_ID_PATTERN.test(withoutOptionalAngleBrackets)) {
    throw new Error("Telegram chat id must be a numeric id, for example 7436474652.");
  }

  return withoutOptionalAngleBrackets;
}
