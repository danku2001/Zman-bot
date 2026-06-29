"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteReminder,
  getRecurringReminders,
  getOverdueReminders,
  getReminders,
  getSyncDebug,
  getTodayReminders,
  getTomorrowReminders,
  getWeekReminders,
  markDone,
  searchReminders,
  snoozeReminder,
  updateReminder
} from "../lib/api";
import type { Reminder, ReminderStatus } from "../lib/types";
import { ChatIdField, getStoredChatId } from "./ChatIdField";
import { ReminderCard } from "./ReminderCard";

type ReminderListMode = "all" | "today" | "tomorrow" | "week" | "recurring" | "overdue" | "done" | "cancelled" | "search";

function localIso(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

export function ReminderList({ mode }: { mode: ReminderListMode }) {
  const [chatId, setChatId] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [syncDebug, setSyncDebug] = useState<Awaited<ReturnType<typeof getSyncDebug>> | null>(null);

  const load = useCallback(async (nextChatId = chatId) => {
    if (!nextChatId) return;
    setLoading(true);
    setError("");
    try {
      const data =
        mode === "today"
          ? await getTodayReminders(nextChatId)
          : mode === "tomorrow"
            ? await getTomorrowReminders(nextChatId)
            : mode === "week"
              ? await getWeekReminders(nextChatId)
              : mode === "recurring"
                ? await getRecurringReminders(nextChatId)
                : mode === "overdue"
                  ? await getOverdueReminders(nextChatId)
                  : mode === "search"
                  ? await searchReminders(nextChatId, query)
                  : await getReminders(nextChatId);
      const textQuery = query.trim().toLowerCase();
      const filtered =
        mode === "done"
          ? data.reminders.filter((reminder) => reminder.status === "done")
          : mode === "cancelled"
            ? data.reminders.filter((reminder) => reminder.status === "cancelled")
            : data.reminders;
      setReminders(
        filtered
          .filter((reminder) => (!status || reminder.status === status))
          .filter((reminder) => (!category || reminder.category === category) && (!priority || reminder.priority === priority))
          .filter((reminder) => !textQuery || reminder.task.toLowerCase().includes(textQuery) || reminder.category.toLowerCase().includes(textQuery))
          .sort((a, b) => sort === "asc" ? a.dueAt.localeCompare(b.dueAt) : b.dueAt.localeCompare(a.dueAt))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת התזכורות");
    } finally {
      setLoading(false);
    }
  }, [chatId, mode, query, category, priority, status, sort]);

  useEffect(() => {
    const stored = getStoredChatId();
    setChatId(stored);
    if (stored) void load(stored);
  }, [load]);

  async function handleDone(id: number) {
    await markDone(chatId, id);
    await load();
  }

  async function handleDelete(id: number) {
    await deleteReminder(chatId, id);
    await load();
  }

  async function handleSnooze(id: number, minutes: number) {
    const dueAt = localIso(new Date(Date.now() + minutes * 60_000));
    await snoozeReminder(chatId, id, dueAt);
    await load();
  }

  async function handleUpdate(id: number, updates: { task: string; dueAt: string; category: string; priority: Reminder["priority"] }) {
    await updateReminder(chatId, id, updates);
    await load();
  }

  async function handleSyncDebug() {
    if (!chatId) return;
    setError("");
    try {
      setSyncDebug(await getSyncDebug(chatId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "בדיקת סנכרון נכשלה");
    }
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:grid-cols-[1fr_auto] sm:items-end">
        <ChatIdField chatId={chatId} onChange={setChatId} />
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">חיפוש</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חשבונית, אימון, אמא..."
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">סטטוס</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as ReminderStatus | "")} className="w-full rounded-md border border-ink/15 bg-white px-3 py-2">
            <option value="">הכל</option>
            <option value="pending">ממתינה</option>
            <option value="sending">בשליחה</option>
            <option value="notified">ממתינות לאישור ביצוע</option>
            <option value="done">בוצעה</option>
            <option value="cancelled">בוטלה</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">קטגוריה</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-md border border-ink/15 bg-white px-3 py-2">
            <option value="">הכל</option>
            {["כללי", "עבודה", "אישי", "בריאות", "כספים", "לימודים", "משפחה", "קניות"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">עדיפות</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-md border border-ink/15 bg-white px-3 py-2">
            <option value="">הכל</option>
            {["נמוך", "רגיל", "חשוב", "דחוף"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">מיון</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as "asc" | "desc")} className="w-full rounded-md border border-ink/15 bg-white px-3 py-2">
            <option value="asc">הקרובות קודם</option>
            <option value="desc">הרחוקות קודם</option>
          </select>
        </label>
        <button
          onClick={() => void load()}
          className="rounded-md bg-ink px-4 py-2 font-bold text-white transition hover:bg-ink/85"
        >
          רענון
        </button>
        <button
          onClick={() => void handleSyncDebug()}
          disabled={!chatId}
          className="rounded-md border border-mint/30 px-4 py-2 font-bold text-ink transition hover:bg-mint hover:text-white disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/30"
        >
          בדוק סנכרון
        </button>
      </div>

      {chatId ? <p className="text-sm font-bold text-ink/65">מציג תזכורות עבור Chat ID: {chatId}</p> : null}

      {syncDebug ? (
        <div className="rounded-lg border border-mint/20 bg-white p-4 shadow-soft">
          <h2 className="font-black text-ink">בדיקת סנכרון</h2>
          <p className="mt-1 text-sm text-ink/65">Database: {syncDebug.databaseMode} · סך הכל: {syncDebug.total}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {Object.entries(syncDebug.countsByStatus).map(([key, value]) => (
              <span key={key} className="rounded-md bg-ink/10 px-2 py-1 font-bold">{key}: {value}</span>
            ))}
          </div>
          {syncDebug.latest.length ? (
            <div className="mt-3 grid gap-1 text-sm text-ink/75">
              {syncDebug.latest.map((item) => (
                <div key={item.id}>#{item.id} · {item.status} · {item.task}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? <div className="rounded-lg bg-white p-6 text-center shadow-soft">טוען תזכורות...</div> : null}
      {error ? <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 font-bold text-coral">{error}</div> : null}
      {!loading && !error && reminders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/20 bg-white p-8 text-center shadow-soft">
          <h2 className="text-xl font-black">אין תזכורות להצגה</h2>
          <p className="mt-2 text-ink/65">לא נמצאו תזכורות עבור ה-Chat ID הזה. ודא שהעתקת את ה-ID מהפקודה /id בטלגרם.</p>
        </div>
      ) : null}
      <div className="grid gap-3">
        {reminders.map((reminder) => (
          <ReminderCard key={reminder.id} reminder={reminder} onDone={handleDone} onDelete={handleDelete} onSnooze={handleSnooze} onUpdate={handleUpdate} />
        ))}
      </div>
    </section>
  );
}
