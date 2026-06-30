export const APP_TIME_ZONE = "Asia/Jerusalem";

const israelFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

function israelParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const parts = Object.fromEntries(israelFormatter.formatToParts(safeDate).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function wallClockIsoFromParts(parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
}

export function israelWallClockPartsToUtcIso(year: number, month: number, day: number, hour: number, minute: number, second = 0): string {
  const desiredWallMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let guessMs = desiredWallMs;
  for (let i = 0; i < 4; i += 1) {
    const actual = israelParts(new Date(guessMs));
    const actualWallMs = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, 0);
    const delta = desiredWallMs - actualWallMs;
    guessMs += delta;
    if (delta === 0) break;
  }
  return new Date(guessMs).toISOString();
}

export function parseIsraelWallClockToUtcIso(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/u);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  return israelWallClockPartsToUtcIso(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
}

export function formatUtcIsoForIsrael(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?$/u.test(trimmed)
    ? new Date(parseIsraelWallClockToUtcIso(trimmed) ?? "")
    : new Date(trimmed);
  if (!Number.isFinite(date.getTime())) return null;
  return wallClockIsoFromParts(israelParts(date));
}

export function datetimeLocalFromUtcIso(value: string | null | undefined): string {
  return formatUtcIsoForIsrael(value)?.slice(0, 16) ?? "";
}

export function utcIsoFromIsraelDatetimeLocal(value: string): string {
  return parseIsraelWallClockToUtcIso(value.length === 16 ? `${value}:00` : value) ?? value;
}

export function formatHebrewWallClock(
  value: string | null | undefined,
  fallback = "תאריך לא זמין",
  dateStyle: "short" | "medium" = "medium"
): string {
  const israelIso = formatUtcIsoForIsrael(value);
  if (!israelIso) return fallback;
  const match = israelIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
  if (!match) return fallback;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle,
    timeStyle: "short"
  }).format(date);
}
