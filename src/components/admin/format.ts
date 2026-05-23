export function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatMoneyRange(min: number, max: number): string {
  return `${min.toLocaleString("ru-KZ")} - ${max.toLocaleString("ru-KZ")} KZT`;
}
