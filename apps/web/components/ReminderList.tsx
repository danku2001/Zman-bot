"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteReminder,
  getRecurringReminders,
  getOverdueReminders,
  getReminders,
  getTodayReminders,
  getTomorrowReminders,
  getWeekReminders,
  markDone,
  searchReminders
} from "../lib/api";
import type { Reminder } from "../lib/types";
import { ChatIdField, getStoredChatId } from "./ChatIdField";
import { ReminderCard } from "./ReminderCard";

type ReminderListMode = "all" | "today" | "tomorrow" | "week" | "recurring" | "overdue" | "done" | "cancelled" | "search";

export function ReminderList({ mode }: { mode: ReminderListMode }) {
  const [chatId, setChatId] = useState("");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");

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
      const filtered =
        mode === "done"
          ? data.reminders.filter((reminder) => reminder.status === "done")
          : mode === "cancelled"
            ? data.reminders.filter((reminder) => reminder.status === "cancelled")
            : data.reminders;
      setReminders(
        filtered.filter((reminder) => (!category || reminder.category === category) && (!priority || reminder.priority === priority))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת התזכורות");
    } finally {
      setLoading(false);
    }
  }, [chatId, mode, query, category, priority]);

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

  return (
    <section className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:grid-cols-[1fr_auto] sm:items-end">
        <ChatIdField chatId={chatId} onChange={setChatId} />
        {mode === "search" ? (
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-ink">חיפוש</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חשבונית, אימון, אמא..."
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
            />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">קטגוריה</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-md border border-ink/15 bg-white px-3 py-2">
            <option value="">הכל</option>
            {["כללי", "עבודה", "אישי", "בריאות", "כסף", "לימודים", "משפחה", "קניות"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">עדיפות</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-md border border-ink/15 bg-white px-3 py-2">
            <option value="">הכל</option>
            {["רגיל", "חשוב", "דחוף"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => void load()}
          className="rounded-md bg-ink px-4 py-2 font-bold text-white transition hover:bg-ink/85"
        >
          רענון
        </button>
      </div>

      {loading ? <div className="rounded-lg bg-white p-6 text-center shadow-soft">טוען תזכורות...</div> : null}
      {error ? <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 font-bold text-coral">{error}</div> : null}
      {!loading && !error && reminders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/20 bg-white p-8 text-center shadow-soft">
          <h2 className="text-xl font-black">אין תזכורות להצגה</h2>
          <p className="mt-2 text-ink/65">צרו תזכורת חדשה או בדקו שה-Chat ID נכון.</p>
        </div>
      ) : null}
      <div className="grid gap-3">
        {reminders.map((reminder) => (
          <ReminderCard key={reminder.id} reminder={reminder} onDone={handleDone} onDelete={handleDelete} />
        ))}
      </div>
    </section>
  );
}
