import type { Reminder, ReminderEvent, ReminderStats } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_SECRET ? { Authorization: `Bearer ${API_SECRET}` } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "בקשת API נכשלה");
  return data as T;
}

export function getReminders(chatId: string): Promise<{ reminders: Reminder[] }> {
  return request(`/api/reminders?chat_id=${encodeURIComponent(chatId)}`);
}

export function getTodayReminders(chatId: string): Promise<{ reminders: Reminder[] }> {
  return request(`/api/reminders/today?chat_id=${encodeURIComponent(chatId)}`);
}

export function getTomorrowReminders(chatId: string): Promise<{ reminders: Reminder[] }> {
  return request(`/api/reminders/tomorrow?chat_id=${encodeURIComponent(chatId)}`);
}

export function getWeekReminders(chatId: string): Promise<{ reminders: Reminder[] }> {
  return request(`/api/reminders/week?chat_id=${encodeURIComponent(chatId)}`);
}

export function getRecurringReminders(chatId: string): Promise<{ reminders: Reminder[] }> {
  return request(`/api/reminders/recurring?chat_id=${encodeURIComponent(chatId)}`);
}

export function getOverdueReminders(chatId: string): Promise<{ reminders: Reminder[] }> {
  return request(`/api/reminders/overdue?chat_id=${encodeURIComponent(chatId)}`);
}

export function searchReminders(chatId: string, query: string): Promise<{ reminders: Reminder[] }> {
  return request(`/api/reminders/search?chat_id=${encodeURIComponent(chatId)}&q=${encodeURIComponent(query)}`);
}

export function getStats(chatId: string): Promise<{ stats: ReminderStats }> {
  return request(`/api/stats?chat_id=${encodeURIComponent(chatId)}`);
}

export function getEvents(chatId: string): Promise<{ events: ReminderEvent[] }> {
  return request(`/api/events?chat_id=${encodeURIComponent(chatId)}`);
}

export function parseReminder(chatId: string, message: string): Promise<{ result: unknown }> {
  return request("/api/reminders/parse", {
    method: "POST",
    body: JSON.stringify({ chat_id: chatId, message })
  });
}

export function createReminder(chatId: string, message: string): Promise<{ reminder: Reminder }> {
  return request("/api/reminders", {
    method: "POST",
    body: JSON.stringify({ chat_id: chatId, message })
  });
}

export function markDone(chatId: string, id: number): Promise<{ ok: boolean }> {
  return request(`/api/reminders/${id}/done`, {
    method: "PATCH",
    body: JSON.stringify({ chat_id: chatId })
  });
}

export function deleteReminder(chatId: string, id: number): Promise<{ ok: boolean }> {
  return request(`/api/reminders/${id}?chat_id=${encodeURIComponent(chatId)}`, {
    method: "DELETE"
  });
}

export function snoozeReminder(chatId: string, id: number, snoozeUntil: string): Promise<{ reminder: Reminder }> {
  return request(`/api/reminders/${id}/snooze`, {
    method: "PATCH",
    body: JSON.stringify({ chat_id: chatId, snooze_until: snoozeUntil })
  });
}

export function exportReminders(chatId: string): Promise<{ exportedAt: string; reminders: Reminder[]; events: ReminderEvent[] }> {
  return request(`/api/export?chat_id=${encodeURIComponent(chatId)}`);
}

export function importReminders(
  chatId: string,
  reminders: unknown[]
): Promise<{ importedCount: number; errors: string[]; reminders: Reminder[] }> {
  return request("/api/import", {
    method: "POST",
    body: JSON.stringify({ chat_id: chatId, reminders })
  });
}
