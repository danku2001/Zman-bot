import { NextRequest } from "next/server";
import { json } from "../../../../lib/server/api";
import { processTelegramUpdate, type TelegramUpdate } from "../../../../lib/server/telegram";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && req.headers.get("x-telegram-bot-api-secret-token") !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }
  const update = await req.json().catch(() => null) as TelegramUpdate | null;
  if (!update || typeof update.update_id !== "number") return json({ error: "Invalid Telegram update" }, 400);
  await processTelegramUpdate(update);
  return json({ ok: true });
}
