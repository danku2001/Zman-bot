import { NextRequest } from "next/server";
import { json } from "../../../../lib/server/api";
import { getDeliveryDebugSnapshot } from "../../../../lib/server/db";
import { getLastSchedulerResult } from "../../../../lib/server/scheduler";
import { isCronSecretAuthorized } from "../../../../lib/server/scheduler-auth";
import { getLatestTelegramFailure } from "../../../../lib/server/telegram";
import { formatUtcIsoForIsrael, nowUtcIso } from "../../../../lib/server/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronSecretAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const nowUtc = nowUtcIso();
  const snapshot = await getDeliveryDebugSnapshot(nowUtc);

  return json({
    ok: true,
    nowUtc,
    nowIsrael: formatUtcIsoForIsrael(nowUtc),
    envPresence: {
      hasTelegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasCronSecret: Boolean(process.env.CRON_SECRET)
    },
    pendingCount: snapshot.pendingCount,
    duePendingCount: snapshot.duePendingCount,
    duePendingMissingChatIdCount: snapshot.duePendingMissingChatIdCount,
    sendingStuckCount: snapshot.sendingStuckCount,
    latestPendingReminders: snapshot.latestPendingReminders,
    latestReminderEvents: snapshot.latestReminderEvents,
    lastSchedulerResult: getLastSchedulerResult(),
    latestTelegramFailure: getLatestTelegramFailure()
  });
}
