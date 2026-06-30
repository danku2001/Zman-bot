import { json } from "../../../../lib/server/api";
import { getDatabaseNowUtc } from "../../../../lib/server/db";
import { APP_TIME_ZONE, formatUtcIsoForIsrael, israelWallClockPartsToUtcIso, nowUtcIso } from "../../../../lib/server/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const serverNowUtc = nowUtcIso();
  const sampleUtc = israelWallClockPartsToUtcIso(2026, 6, 30, 18, 0);
  const databaseNow = await getDatabaseNowUtc().catch((error) => `unavailable: ${error instanceof Error ? error.message : "unknown error"}`);

  return json({
    ok: true,
    appTimeZone: APP_TIME_ZONE,
    serverNowUtc,
    serverNowIsrael: formatUtcIsoForIsrael(serverNowUtc),
    databaseNow,
    sampleConversion: {
      israelInput: "2026-06-30 18:00",
      utcStored: sampleUtc,
      israelDisplayed: formatUtcIsoForIsrael(sampleUtc)
    },
    envPresence: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasTelegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasCronSecret: Boolean(process.env.CRON_SECRET),
      hasWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)
    }
  });
}
