"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getEvents, getReminders, getStats } from "../lib/api";
import { formatHebrewWallClock } from "../lib/date";
import type { Reminder, ReminderEvent, ReminderStats } from "../lib/types";
import { ChatIdField, getStoredChatId } from "./ChatIdField";

function formatDate(value: string | null | undefined): string {
  return formatHebrewWallClock(value, "לא זמין", "short");
}

function statusLabel(status: Reminder["status"]): string {
  if (status === "pending") return "ממתינה";
  if (status === "sending") return "בשליחה";
  if (status === "notified") return "ממתין לאישור";
  if (status === "done") return "בוצעה";
  return "בוטלה";
}

export function HomeDashboard() {
  const [chatId, setChatId] = useState("");
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [latestReminders, setLatestReminders] = useState<Reminder[]>([]);
  const [focusReminders, setFocusReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextChatId = chatId) => {
    if (!nextChatId) return;
    setLoading(true);
    setError("");
    try {
      const [data, activity, reminderData] = await Promise.all([
        getStats(nextChatId),
        getEvents(nextChatId),
        getReminders(nextChatId)
      ]);
      const ordered = reminderData.reminders.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      setStats(data.stats);
      setEvents(activity.events);
      setLatestReminders(reminderData.reminders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5));
      setFocusReminders(
        ordered
          .filter((reminder) => reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified")
          .slice(0, 5)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    const stored = getStoredChatId();
    setChatId(stored);
    if (stored) void load(stored);
  }, [load]);

  const cards = stats
    ? [
        ["פתוחות", stats.totalActive, "/reminders", "כל מה שעדיין דורש פעולה"],
        ["היום", stats.dueToday, "/today", "תזכורות ליום הנוכחי"],
        ["באיחור", stats.overdue, "/overdue", "ממתינות שעבר זמנן"],
        ["ממתינות לאישור", stats.notified, "/reminders", "נשלחו ומחכות לסימון ביצוע"],
        ["השבוע", stats.dueThisWeek, "/week", "שבעת הימים הקרובים"],
        ["קבועות", stats.recurring, "/recurring", "תזכורות חוזרות"],
        ["בוצעו", stats.done, "/done", "היסטוריית השלמות"],
        ["בוטלו", stats.cancelled, "/cancelled", "תזכורות שנסגרו"]
      ]
    : [];

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="grid gap-0 lg:grid-cols-[1.5fr_1fr]">
          <div className="p-6 sm:p-8">
            <p className="mb-3 text-sm font-black text-mint">מרכז הבקרה</p>
            <h1 className="max-w-2xl text-4xl font-black leading-tight text-ink sm:text-5xl">ZmanBot מנהל לך את היום בעברית</h1>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-ink/65">
              כל תזכורת מטלגרם ומהדשבורד נשמרת באותו Postgres, נשלחת בזמן, ומתעדכנת מיד אחרי ביצוע, דחייה או ביטול.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <ChatIdField chatId={chatId} onChange={setChatId} />
              <button
                onClick={() => void load()}
                className="rounded-md bg-ink px-5 py-3 font-black text-white transition hover:bg-ink/85"
              >
                {loading ? "מרענן..." : "רענון"}
              </button>
            </div>
            {error ? <p className="mt-3 font-bold text-coral">{error}</p> : null}
          </div>
          <div className="border-t border-ink/10 bg-ink p-6 text-white lg:border-r lg:border-t-0">
            <p className="text-sm font-bold text-white/60">סטטוס מערכת</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-md bg-white/10 p-4">
                <p className="text-3xl font-black">{stats ? stats.totalActive : "..."}</p>
                <p className="mt-1 text-sm text-white/70">תזכורות פעילות</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/today" className="rounded-md bg-white/10 p-4 transition hover:bg-white/15">
                  <p className="text-2xl font-black">{stats ? stats.dueToday : "..."}</p>
                  <p className="text-sm text-white/70">היום</p>
                </Link>
                <Link href="/overdue" className="rounded-md bg-white/10 p-4 transition hover:bg-white/15">
                  <p className="text-2xl font-black">{stats ? stats.overdue : "..."}</p>
                  <p className="text-sm text-white/70">באיחור</p>
                </Link>
              </div>
              <Link href="/create" className="rounded-md bg-mint px-4 py-3 text-center font-black text-white transition hover:bg-mint/90">
                הוסף תזכורת חדשה
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([title, value, href, description]) => (
          <Link key={title} href={String(href)} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-mint">
            <p className="text-sm font-bold text-ink/60">{title}</p>
            <p className="mt-2 text-4xl font-black text-ink">{value}</p>
            <p className="mt-2 text-sm text-ink/55">{description}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">דורש תשומת לב</h2>
            <Link href="/reminders" className="text-sm font-bold text-mint hover:text-ink">לכל התזכורות</Link>
          </div>
          {focusReminders.length ? (
            <div className="mt-3 grid gap-2">
              {focusReminders.map((reminder) => (
                <Link key={reminder.id} href="/reminders" className="rounded-md border border-ink/10 p-3 transition hover:border-mint">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-black">#{reminder.id} · {reminder.task}</span>
                    <span className="rounded-md bg-mint/15 px-2 py-1 text-xs font-bold text-ink">{statusLabel(reminder.status)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{formatDate(reminder.dueAt)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-ink/20 p-4 text-ink/60">אין כרגע תזכורות פעילות להצגה.</p>
          )}
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-black">פעולות מהירות</h2>
          <div className="mt-3 grid gap-2">
            <Link href="/create" className="rounded-md bg-mint px-4 py-3 text-center font-black text-white transition hover:bg-mint/90">יצירת תזכורת</Link>
            <Link href="/settings" className="rounded-md border border-ink/10 px-4 py-3 text-center font-bold text-ink transition hover:border-mint hover:text-mint">אבחון סנכרון</Link>
            <Link href="/search" className="rounded-md border border-ink/10 px-4 py-3 text-center font-bold text-ink transition hover:border-mint hover:text-mint">חיפוש מתקדם</Link>
          </div>
        </div>
      </div>

      {stats ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-black">קטגוריות</h2>
            <div className="mt-3 grid gap-2">
              {Object.entries(stats.categories).length ? Object.entries(stats.categories).map(([category, count]) => (
                <div key={category} className="flex justify-between border-b border-ink/10 py-2"><span>{category}</span><strong>{count}</strong></div>
              )) : <p className="text-ink/60">אין עדיין קטגוריות פעילות.</p>}
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
                <span className="text-ink/60">{formatDate(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {latestReminders.length ? (
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-black">תזכורות אחרונות</h2>
          <div className="mt-3 grid gap-2">
            {latestReminders.map((reminder) => (
              <div key={reminder.id} className="flex flex-col border-b border-ink/10 py-2 text-sm sm:flex-row sm:justify-between">
                <span className="font-bold">#{reminder.id} · {reminder.task}</span>
                <span className="text-ink/60">{statusLabel(reminder.status)} · {formatDate(reminder.dueAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
