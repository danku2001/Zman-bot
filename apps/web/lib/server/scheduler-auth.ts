import { NextRequest } from "next/server";
import { dashboardCookieName, isValidDashboardCookie } from "./auth";

function isKnownSchedulerUserAgent(userAgent: string | null): boolean {
  const normalized = userAgent?.toLowerCase() ?? "";
  return normalized === "vercel-cron/1.0" || normalized.includes("cron-job.org");
}

export function isSchedulerAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (isValidDashboardCookie(req.cookies.get(dashboardCookieName)?.value)) return true;
  if (isKnownSchedulerUserAgent(req.headers.get("user-agent"))) return true;
  if (!expected) return false;
  const authorization = req.headers.get("authorization");
  return (
    req.nextUrl.searchParams.get("secret") === expected ||
    req.nextUrl.searchParams.get("cron_secret") === expected ||
    req.nextUrl.searchParams.get("token") === expected ||
    req.headers.get("x-cron-secret") === expected ||
    authorization === `Bearer ${expected}` ||
    authorization === expected
  );
}
