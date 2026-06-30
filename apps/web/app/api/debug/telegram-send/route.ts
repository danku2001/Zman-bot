import { NextRequest } from "next/server";
import { json } from "../../../../lib/server/api";
import { isCronSecretAuthorized } from "../../../../lib/server/scheduler-auth";
import { getLatestTelegramFailure, sendMessage } from "../../../../lib/server/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isCronSecretAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as { chat_id?: unknown };
  const chatId = typeof body.chat_id === "string" ? body.chat_id.trim() : "";
  if (!chatId) return json({ ok: false, error: "chat_id is required" }, 400);

  try {
    const sent = await sendMessage(chatId, "בדיקת שליחה מ-ZmanBot ✅");
    return json({ ok: true, chat_id: chatId, telegramStatus: "sent", messageId: sent.messageId });
  } catch (error) {
    return json({
      ok: false,
      chat_id: chatId,
      telegramStatus: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown Telegram send error",
      latestTelegramFailure: getLatestTelegramFailure()
    }, 502);
  }
}
