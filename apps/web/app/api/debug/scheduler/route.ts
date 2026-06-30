import { NextRequest } from "next/server";
import { json } from "../../../../lib/server/api";
import { getSchedulerDebugSnapshot } from "../../../../lib/server/db";
import { isSchedulerAuthorized } from "../../../../lib/server/scheduler-auth";
import { getTelegramWebhookInfo } from "../../../../lib/server/telegram";
import { formatUtcIsoForIsrael, nowUtcIso } from "../../../../lib/server/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSchedulerAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const nowUtc = nowUtcIso();
  const snapshot = await getSchedulerDebugSnapshot(nowUtc);
  let canSendTelegram = false;
  let telegramStatus = "not_checked";
  try {
    const info = await getTelegramWebhookInfo();
    canSendTelegram = info.ok;
    telegramStatus = info.ok ? "ok" : "not_ok";
  } catch (error) {
    telegramStatus = error instanceof Error ? error.message : "unknown Telegram status error";
  }

  return json({
    ok: true,
    nowUtc,
    nowIsrael: formatUtcIsoForIsrael(nowUtc),
    pendingDueCount: snapshot.pendingDueCount,
    nextPendingReminder: snapshot.nextPendingReminder,
    lastSchedulerEvents: snapshot.lastSchedulerEvents,
    cronResolution: "one-minute external scheduler tick",
    supportsSecondLevelDelivery: false,
    deliveryAccuracyNote: "Vercel serverless + cron-job.org cannot guarantee exact second-level delivery. Due reminders are sent on the next scheduler run, usually within the next minute when cron-job.org is active.",
    canSendTelegram,
    telegramStatus
  });
}
