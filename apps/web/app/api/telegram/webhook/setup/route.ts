import { NextRequest } from "next/server";
import { assertApiAccess, json } from "../../../../../lib/server/api";
import { setTelegramWebhook } from "../../../../../lib/server/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const appUrl = process.env.APP_URL?.trim() || req.nextUrl.origin;
  return json({ telegram: await setTelegramWebhook(appUrl) });
}
