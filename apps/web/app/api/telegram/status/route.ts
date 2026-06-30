import { NextRequest } from "next/server";
import { assertApiAccess, json } from "../../../../lib/server/api";
import { getTelegramWebhookInfo } from "../../../../lib/server/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const info = await getTelegramWebhookInfo();
  return json({ telegram: info });
}
