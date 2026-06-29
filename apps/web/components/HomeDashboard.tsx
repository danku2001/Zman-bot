"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getEvents, getStats } from "../lib/api";
import type { ReminderEvent, ReminderStats } from "../lib/types";
import { ChatIdField, getStoredChatId } from "./ChatIdField";

export function HomeDashboard() {
  const [chatId, setChatId] = useState("");
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async (nextChatId = chatId) => {
    if (!nextChatId) return;
    setError("");
    try {
      const data = await getStats(nextChatId);
      const activity = await getEvents(nextChatId);
      setStats(data.stats);
      setEvents(activity.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הנתונים");
    }
  }, [chatId]);

  useEffect(() => {
    const stored = getStoredChatId();
    setChatId(stored);
    if (stored) void load(stored);
  }, [load]);

  const cards = stats
    ? [
        ["פתוחות", stats.totalActive, "/reminders"],
        ["היום", stats.dueToday, "/today"],
        ["באיחור", stats.overdue, "/overdue"],
        ["השבוע", stats.dueThisWeek, "/week"],
        ["קבועות", stats.recurring, "/recurring"],
        ["נשלחו", stats.notified, "/reminders"],
        ["בוטלו", stats.cancelled, "/cancelled"],
        ["בוצעו", stats.done, "/done"]
      ]
    : [];

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="mb-3 text-sm font-bold text-mint">מרכז הבקרה</p>
        <h1 className="text-4xl font-black leading-tight text-ink">ZmanBot מנהל לך את היום בעברית</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <ChatIdField chatId={chatId} onChange={setChatId} />
          <button onClick={() => void load()} className="rounded-md bg-ink px-4 py-2 font-bold text-white">רענון</button>
        </div>
        {error ? <p className="mt-3 font-bold text-coral">{error}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([title, value, href]) => (
          <Link key={title} href={String(href)} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft transition hover:border-mint">
            <p className="text-sm font-bold text-ink/60">{title}</p>
            <p className="mt-2 text-4xl font-black text-ink">{value}</p>
          </Link>
        ))}
      </div>

      {stats ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black">קטגוריות</h2>
            <div className="mt-3 grid gap-2">
              {Object.entries(stats.categories).map(([category, count]) => (
                <div key={category} className="flex justify-between border-b border-ink/10 py-2"><span>{category}</span><strong>{count}</strong></div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black">עדיפויות</h2>
            <div className="mt-3 grid gap-2">
              {Object.entries(stats.priorities).map(([priority, count]) => (
                <div key={priority} className="flex justify-between border-b border-ink/10 py-2"><span>{priority}</span><strong>{count}</strong></div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {events.length ? (
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-black">פעילות אחרונה</h2>
          <div className="mt-3 grid gap-2">
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="flex flex-col border-b border-ink/10 py-2 text-sm sm:flex-row sm:justify-between">
                <span className="font-bold">{event.eventType}</span>
                <span className="text-ink/60">{new Date(event.createdAt).toLocaleString("he-IL")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
