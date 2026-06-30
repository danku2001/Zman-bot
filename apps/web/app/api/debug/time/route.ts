import { json } from "../../../../lib/server/api";
import { getDatabaseNowUtc } from "../../../../lib/server/db";
import { parseReminderMessage } from "../../../../lib/server/parser";
import { APP_TIME_ZONE, formatUtcIsoForIsrael, israelWallClockPartsToUtcIso, normalizeDatabaseTimestampToUtcIso, nowUtcIso } from "../../../../lib/server/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const serverNowUtc = nowUtcIso();
  const sampleUtc = israelWallClockPartsToUtcIso(2026, 6, 30, 18, 0);
  const databaseTimestampSample = normalizeDatabaseTimestampToUtcIso("2026-06-30 15:00:00");
  const databaseNow = await getDatabaseNowUtc().catch((error) => `unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  const sampleNow = new Date(Date.UTC(2026, 5, 30, 13, 0, 0, 0));
  const sampleMessages = ["עוד 10 שניות", "עוד עשר שניות", "מחרתיים ב-10", "היום ב-18:00", "מחר ב-9"];
  const sampleConversions = Object.fromEntries(sampleMessages.map((sample) => {
    const parsed = parseReminderMessage(`תזכיר לי ${sample} בדיקה`, sampleNow);
    return [
      sample,
      parsed.ok
        ? { dueAtUtc: parsed.value.dueAt, dueAtIsrael: formatUtcIsoForIsrael(parsed.value.dueAt) }
        : { error: parsed.error }
    ];
  }));

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
    databaseTimestampWithoutTimezoneSample: {
      databaseInput: "2026-06-30 15:00:00",
      parsedAsUtc: databaseTimestampSample,
      israelDisplayed: formatUtcIsoForIsrael(databaseTimestampSample)
    },
    sampleConversions,
    envPresence: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasTelegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasCronSecret: Boolean(process.env.CRON_SECRET),
      hasWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)
    }
  });
}
