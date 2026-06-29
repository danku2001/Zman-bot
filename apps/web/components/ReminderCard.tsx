"use client";

import { useState } from "react";
import type { Reminder } from "../lib/types";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatDate(value: string | null | undefined): string {
  if (!value) return "תאריך לא זמין";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "תאריך לא זמין";
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

function statusLabel(status: Reminder["status"]): string {
  if (status === "pending") return "ממתינה";
  if (status === "sending") return "בשליחה";
  if (status === "notified") return "ממתין לאישור ביצוע";
  if (status === "done") return "בוצעה";
  return "בוטלה";
}

function recurrenceLabel(reminder: Reminder): string | null {
  if (!reminder.recurrenceType) return null;
  if (reminder.recurrenceType === "daily") return `כל יום ב-${reminder.recurrenceTime}`;
  if (reminder.recurrenceType === "weekly") return `כל יום ${dayNames[reminder.recurrenceDayOfWeek ?? 0]} ב-${reminder.recurrenceTime}`;
  if (reminder.recurrenceType === "monthly") return `כל חודש ב-${reminder.recurrenceDayOfMonth}`;
  if (reminder.recurrenceType === "yearly") return `כל שנה`;
  return `ימים קבועים ב-${reminder.recurrenceTime}`;
}

function priorityLabel(reminder: Reminder): string {
  if (reminder.priority === "דחוף") return "דחוף 🔥";
  if (reminder.priority === "חשוב") return "חשוב ⭐";
  if (reminder.priority === "נמוך") return "נמוך";
  return "רגיל";
}

export function ReminderCard({
  reminder,
  onDone,
  onDelete,
  onSnooze,
  onUpdate
}: {
  reminder: Reminder;
  onDone: (id: number) => void;
  onDelete: (id: number) => void;
  onSnooze: (id: number, minutes: number) => void;
  onUpdate: (id: number, updates: { task: string; dueAt: string; category: string; priority: Reminder["priority"] }) => Promise<void>;
}) {
  const recurrence = recurrenceLabel(reminder);
  const [editing, setEditing] = useState(false);
  const [task, setTask] = useState(reminder.task);
  const [dueAt, setDueAt] = useState(reminder.dueAt.slice(0, 16));
  const [category, setCategory] = useState(reminder.category);
  const [priority, setPriority] = useState<Reminder["priority"]>(reminder.priority);
  const [saving, setSaving] = useState(false);

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onUpdate(reminder.id, {
        task,
        dueAt: dueAt.length === 16 ? `${dueAt}:00` : dueAt,
        category,
        priority
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ink px-2 py-1 text-xs font-bold text-white">#{reminder.id}</span>
            <span className="rounded-md bg-mint/15 px-2 py-1 text-xs font-bold text-ink">{statusLabel(reminder.status)}</span>
            <span className="rounded-md bg-ink/10 px-2 py-1 text-xs font-bold text-ink">{reminder.category}</span>
            <span className="rounded-md bg-coral/10 px-2 py-1 text-xs font-bold text-ink">{priorityLabel(reminder)}</span>
            {recurrence ? (
              <span className="rounded-md bg-saffron/20 px-2 py-1 text-xs font-bold text-ink">{recurrence}</span>
            ) : null}
          </div>
          {editing ? (
            <form onSubmit={(event) => void saveEdit(event)} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-bold text-ink/65">משימה</span>
                <input
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  className="w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-mint focus:ring-4 focus:ring-mint/15"
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-ink/65">זמן</span>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-mint focus:ring-4 focus:ring-mint/15"
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-ink/65">קטגוריה</span>
                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-mint focus:ring-4 focus:ring-mint/15"
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-ink/65">עדיפות</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as Reminder["priority"])}
                  className="w-full rounded-md border border-ink/15 px-3 py-2"
                >
                  {["נמוך", "רגיל", "חשוב", "דחוף"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button
                  disabled={saving}
                  className="rounded-md bg-mint px-3 py-2 text-sm font-bold text-white transition hover:bg-mint/90 disabled:bg-ink/25"
                >
                  {saving ? "שומר..." : "שמור"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-ink/15 px-3 py-2 text-sm font-bold text-ink transition hover:bg-ink/5"
                >
                  ביטול
                </button>
              </div>
            </form>
          ) : (
            <>
              <h3 className="text-lg font-black text-ink">{reminder.task}</h3>
              <p className="mt-1 text-sm text-ink/65">{formatDate(reminder.dueAt)}</p>
            </>
          )}
          {reminder.status === "notified" ? (
            <div className="mt-3 grid gap-1 text-sm text-ink/65">
              <p>תזכורות חוזרות: {reminder.followupCount}</p>
              {reminder.lastFollowupAt ? <p>אחרונה: {formatDate(reminder.lastFollowupAt)}</p> : null}
              {reminder.nextFollowupAt ? <p>הבאה: {formatDate(reminder.nextFollowupAt)}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={() => onDone(reminder.id)}
            disabled={reminder.status === "done"}
            className="rounded-md bg-mint px-3 py-2 text-sm font-bold text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:bg-ink/25"
          >
            בוצע
          </button>
          <button
            onClick={() => onSnooze(reminder.id, 10)}
            disabled={reminder.status === "done" || reminder.status === "cancelled"}
            className="rounded-md border border-mint/30 px-3 py-2 text-sm font-bold text-ink transition hover:bg-mint hover:text-white disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/30"
          >
            דחה 10 דק׳
          </button>
          <button
            onClick={() => setEditing((value) => !value)}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm font-bold text-ink transition hover:bg-ink hover:text-white"
          >
            עריכה
          </button>
          <button
            onClick={() => onDelete(reminder.id)}
            className="rounded-md border border-coral/30 px-3 py-2 text-sm font-bold text-coral transition hover:bg-coral hover:text-white"
          >
            מחיקה
          </button>
        </div>
      </div>
    </article>
  );
}
