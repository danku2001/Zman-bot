import { NextRequest } from "next/server";
import { dashboardCookieName, isValidDashboardCookie } from "./auth";

export function isSchedulerAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (isValidDashboardCookie(req.cookies.get(dashboardCookieName)?.value)) return true;
  if (req.headers.get("user-agent") === "vercel-cron/1.0") return true;
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
