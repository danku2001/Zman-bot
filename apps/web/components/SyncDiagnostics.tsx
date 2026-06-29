"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBaseError, getApiBaseLabel, getHealth, getReminders, getSyncDebug } from "../lib/api";
import type { Reminder } from "../lib/types";
import { ChatIdField, getStoredChatId } from "./ChatIdField";

type HealthResult = Awaited<ReturnType<typeof getHealth>>;
type SyncResult = Awaited<ReturnType<typeof getSyncDebug>>;

function latestFive(reminders: Reminder[]): Reminder[] {
  return reminders
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
}

export function SyncDiagnostics() {
  const [chatId, setChatId] = useState("");
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [reminderCount, setReminderCount] = useState<number | null>(null);
  const [latest, setLatest] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiBaseLabel = useMemo(() => getApiBaseLabel(), []);
  const apiBaseError = useMemo(() => getApiBaseError(), []);

  useEffect(() => setChatId(getStoredChatId()), []);

  async function runDiagnostics(nextChatId = chatId) {
    setLoading(true);
    setError("");
    setHealth(null);
    setSync(null);
    setReminderCount(null);
    setLatest([]);
    try {
      if (apiBaseError) throw new Error(apiBaseError);
      const healthResult = await getHealth();
      setHealth(healthResult);
      if (!nextChatId) throw new Error("חסר Chat ID. שלחו /id בטלגרם והזינו כאן את המספר.");
      const [syncResult, remindersResult] = await Promise.all([
        getSyncDebug(nextChatId),
        getReminders(nextChatId)
      ]);
      setSync(syncResult);
      setReminderCount(remindersResult.reminders.length);
      setLatest(latestFive(remindersResult.reminders));
    } catch (err) {
      setError(err instanceof Error ? err.message : "בדיקת הסנכרון נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black">אבחון סנכרון</h2>
          <p className="mt-1 text-sm text-ink/65">בודק לאן הדשבורד פונה ומה השרת מחזיר עבור ה-Chat ID.</p>
        </div>
        <button
          onClick={() => void runDiagnostics()}
          disabled={loading}
          className="rounded-md bg-ink px-4 py-2 font-bold text-white transition hover:bg-ink/85 disabled:bg-ink/25"
        >
          {loading ? "בודק..." : "בדוק עכשיו"}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <ChatIdField chatId={chatId} onChange={setChatId} />
        <div className="rounded-md bg-ink/5 p-3 text-sm">
          <span className="font-bold">API בשימוש: </span>
          <span dir="ltr">{apiBaseLabel}</span>
        </div>
        {apiBaseError ? <div className="rounded-md bg-coral/10 p-3 font-bold text-coral">{apiBaseError}</div> : null}
        {error ? <div className="rounded-md bg-coral/10 p-3 font-bold text-coral">{error}</div> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-ink/10 p-3">
          <p className="text-xs font-bold text-ink/50">Health</p>
          <p className="mt-1 font-black">{health ? `${health.service} / ${health.mode}` : "לא נבדק"}</p>
        </div>
        <div className="rounded-md border border-ink/10 p-3">
          <p className="text-xs font-bold text-ink/50">Database</p>
          <p className="mt-1 font-black">{sync?.databaseMode ?? "לא נבדק"}</p>
        </div>
        <div className="rounded-md border border-ink/10 p-3">
          <p className="text-xs font-bold text-ink/50">Reminders</p>
          <p className="mt-1 font-black">{reminderCount ?? "לא נבדק"}</p>
        </div>
      </div>

      {sync ? (
        <div className="mt-4 rounded-md border border-mint/20 bg-mint/5 p-3">
          <p className="font-bold">Sync debug עבור {sync.chatId}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {Object.entries(sync.countsByStatus).map(([status, count]) => (
              <span key={status} className="rounded-md bg-white px-2 py-1 font-bold">{status}: {count}</span>
            ))}
          </div>
        </div>
      ) : null}

      {latest.length ? (
        <div className="mt-4">
          <h3 className="font-black">5 התזכורות האחרונות</h3>
          <div className="mt-2 grid gap-2 text-sm">
            {latest.map((reminder) => (
              <div key={reminder.id} className="rounded-md border border-ink/10 p-2">
                <span className="font-bold">#{reminder.id}</span> · {reminder.status} · {reminder.task}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
