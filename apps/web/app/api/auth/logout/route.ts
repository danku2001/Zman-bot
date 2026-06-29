import { NextResponse } from "next/server";
import { dashboardCookieName } from "../../../../lib/server/auth";

export const runtime = "nodejs";

export function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(dashboardCookieName);
  return response;
}
