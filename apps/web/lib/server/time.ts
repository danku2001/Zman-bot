export const APP_TIME_ZONE = "Asia/Jerusalem";

export function ensureAppTimeZone(): void {
  process.env.TZ ||= APP_TIME_ZONE;
}

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

export function israelWallClockDate(date = new Date()): Date {
  const parts = israelParts(date);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
}

export function formatIsraelLocalIso(date = new Date()): string {
  const parts = israelParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
}

export function formatWallClockIso(date: Date): string {
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, "0")}-${String(safeDate.getDate()).padStart(2, "0")}T${String(safeDate.getHours()).padStart(2, "0")}:${String(safeDate.getMinutes()).padStart(2, "0")}:${String(safeDate.getSeconds()).padStart(2, "0")}`;
}

ensureAppTimeZone();
