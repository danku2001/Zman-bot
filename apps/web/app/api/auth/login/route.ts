import { NextRequest, NextResponse } from "next/server";
import { dashboardCookieName, dashboardCookieValue } from "../../../../lib/server/auth";
import { json } from "../../../../lib/server/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { password?: string };
  if (!process.env.DASHBOARD_PASSWORD) return json({ ok: true });
  if (body.password !== process.env.DASHBOARD_PASSWORD) return json({ error: "סיסמה לא נכונה" }, 401);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(dashboardCookieName, dashboardCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}
