export function normalizeKazakhstanPhoneForDisplay(input: string | null | undefined): string {
  const digits = input?.replace(/\D/g, "") ?? "";
  if (!digits) {
    return "Не указан";
  }

  const normalizedDigits = digits.length === 11 && digits.startsWith("8") ? `7${digits.slice(1)}` : digits;

  if (normalizedDigits.length === 11 && normalizedDigits.startsWith("7")) {
    return `+7 ${normalizedDigits.slice(1, 4)} ${normalizedDigits.slice(4, 7)} ${normalizedDigits.slice(
      7,
      9,
    )} ${normalizedDigits.slice(9, 11)}`;
  }

  if (input?.trim().startsWith("+")) {
    return input.trim();
  }

  return digits ? `+${digits}` : "Не указан";
}
