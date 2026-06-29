"use client";

import type { Reminder } from "../lib/types";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem"
  }).format(new Date(value));
}

function statusLabel(status: Reminder["status"]): string {
  if (status === "pending") return "ממתינה";
  if (status === "sending") return "בשליחה";
  if (status === "notified") return "נשלחה, ממתינה לאישור";
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
  return "רגיל";
}

export function ReminderCard({
  reminder,
  onDone,
  onDelete
}: {
  reminder: Reminder;
  onDone: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const recurrence = recurrenceLabel(reminder);

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
          <h3 className="text-lg font-black text-ink">{reminder.task}</h3>
          <p className="mt-1 text-sm text-ink/65">{formatDate(reminder.dueAt)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onDone(reminder.id)}
            disabled={reminder.status === "done"}
            className="rounded-md bg-mint px-3 py-2 text-sm font-bold text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:bg-ink/25"
          >
            בוצע
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
