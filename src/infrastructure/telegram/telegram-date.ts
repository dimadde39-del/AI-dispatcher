export function formatTelegramDate(value: string | Date, timeZone = "Asia/Almaty"): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(new Date(value));

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("day")}.${part("month")}.${part("year")}, ${part("hour")}:${part("minute")}`;
}
