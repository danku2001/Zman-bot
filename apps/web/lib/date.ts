export function formatHebrewWallClock(
  value: string | null | undefined,
  fallback = "תאריך לא זמין",
  dateStyle: "short" | "medium" = "medium"
): string {
  if (!value) return fallback;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/u);
  if (!match) return fallback;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle,
    timeStyle: "short"
  }).format(date);
}

