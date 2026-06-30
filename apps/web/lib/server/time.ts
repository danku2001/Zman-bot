export const APP_TIME_ZONE = "Asia/Jerusalem";

export function ensureAppTimeZone(): void {
  process.env.TZ ||= APP_TIME_ZONE;
}

ensureAppTimeZone();

