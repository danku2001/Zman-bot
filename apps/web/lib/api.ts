import type { Reminder, ReminderEvent, ReminderStats } from "./types";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.trim() || "";
}

export function getApiBaseLabel(): string {
  const baseUrl = getApiBaseUrl();
  return baseUrl || "same-origin /api";
}

export function getApiBaseError(): string | null {
  const baseUrl = getApiBaseUrl();
  if (typeof window === "undefined" || !baseUrl) return null;
  const hostname = window.location.hostname;
  const isLocalPage = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!isLocalPage && /(^https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(baseUrl)) {
    return "שגיאת סנכרון: הדשבורד מנסה לקרוא ל-localhost במקום לשרת הפרודקשן";
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseError = getApiBaseError();
  if (baseError) throw new Error(baseError);

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    credentials: "include",
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

export function getSyncDebug(chatId: string): Promise<{
  chatId: string;
  total: number;
  countsByStatus: Record<Reminder["status"], number>;
  latest: Array<Pick<Reminder, "id" | "task" | "dueAt" | "status" | "sourceText">>;
  databaseMode: "postgres" | "sqlite" | "memory";
}> {
  return request(`/api/debug/sync?chat_id=${encodeURIComponent(chatId)}`);
}

export function getKnownChats(): Promise<{ chats: Array<{ chatId: string; total: number; latestActivityAt: string | null }> }> {
  return request("/api/debug/chats");
}

export function getHealth(): Promise<{ ok: boolean; service: string; mode: string }> {
  return request("/api/health");
}

export function runScheduler(limit = 3): Promise<{
  ok: boolean;
  sent: number;
  recovered: number;
  failed: number;
  durationMs: number;
  checkedAtUtc?: string;
  checkedAtIsrael?: string;
  dueCountBefore?: number;
  claimedIds?: number[];
  telegramMessageIds?: Array<{ reminderId: number; messageId: number | null; kind: "reminder" | "followup" | "recurrence_next" }>;
  failureReasons?: string[];
}> {
  return request(`/api/scheduler/run?limit=${encodeURIComponent(String(limit))}`, {
    method: "POST"
  });
}

export function getSchedulerDebug(): Promise<{
  ok: boolean;
  nowUtc: string;
  nowIsrael: string;
  pendingDueCount: number;
  nextPendingReminder: Pick<Reminder, "id" | "chatId" | "task" | "dueAt" | "status"> | null;
  lastSchedulerEvents: Array<Pick<ReminderEvent, "id" | "reminderId" | "chatId" | "eventType" | "createdAt">>;
  cronResolution: string;
  supportsSecondLevelDelivery: boolean;
  deliveryAccuracyNote: string;
  canSendTelegram: boolean;
  telegramStatus: string;
}> {
  return request("/api/debug/scheduler");
}

export function getTelegramStatus(): Promise<{
  telegram: {
    ok: boolean;
    url: string;
    pendingUpdateCount: number;
    lastErrorDate?: number;
    lastErrorMessage?: string;
    maxConnections?: number;
    allowedUpdates?: string[];
  };
}> {
  return request("/api/telegram/status");
}

export function repairTelegramWebhook(): Promise<{ telegram: { ok: boolean; url: string; description?: string } }> {
  return request("/api/telegram/webhook/setup", {
    method: "POST"
  });
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

export function updateReminder(
  chatId: string,
  id: number,
  updates: Partial<Pick<Reminder, "task" | "dueAt" | "category" | "priority">>
): Promise<{ reminder: Reminder }> {
  return request(`/api/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      chat_id: chatId,
      task: updates.task,
      due_at: updates.dueAt,
      category: updates.category,
      priority: updates.priority
    })
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
