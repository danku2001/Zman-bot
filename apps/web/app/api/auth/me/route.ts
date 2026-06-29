import { NextRequest } from "next/server";
import { dashboardCookieName, dashboardEnabled, isValidDashboardCookie } from "../../../../lib/server/auth";
import { json } from "../../../../lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const authenticated = !dashboardEnabled() || isValidDashboardCookie(req.cookies.get(dashboardCookieName)?.value);
  return json({
    authenticated,
    dashboardAuthEnabled: dashboardEnabled()
  }, authenticated ? 200 : 401);
}
