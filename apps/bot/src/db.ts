import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { calculateNextDueAt, normalizeHebrewText } from "./parser";
import type { ParsedReminder, Reminder, ReminderEvent, ReminderPriority, ReminderStats, ReminderStatus, RecurrenceType } from "./types";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const db = new Database(config.databasePath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  task TEXT NOT NULL,
  due_at TEXT NOT NULL,
  recurrence_type TEXT NULL,
  recurrence_day_of_week INTEGER NULL,
  recurrence_time TEXT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  sending_at TEXT NULL,
  sent_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS reminder_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reminder_id INTEGER,
  chat_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NULL,
  created_at TEXT NOT NULL
);
`);

const requiredColumns: Record<string, string> = {
  normalized_task: "TEXT",
  category: "TEXT DEFAULT 'כללי'",
  priority: "TEXT DEFAULT 'רגיל'",
  recurrence_days_of_week: "TEXT NULL",
  recurrence_day_of_month: "INTEGER NULL",
  recurrence_month: "INTEGER NULL",
  updated_at: "TEXT",
  cancelled_at: "TEXT NULL",
  completed_at: "TEXT NULL",
  sending_at: "TEXT NULL",
  last_snoozed_at: "TEXT NULL",
  snooze_count: "INTEGER DEFAULT 0",
  next_followup_at: "TEXT NULL",
  followup_count: "INTEGER DEFAULT 0",
  last_followup_at: "TEXT NULL",
  source_text: "TEXT NULL"
};

const existingColumns = new Set(
  (db.prepare("PRAGMA table_info(reminders)").all() as Array<{ name: string }>).map((column) => column.name)
);

for (const [column, definition] of Object.entries(requiredColumns)) {
  if (!existingColumns.has(column)) {
    db.exec(`ALTER TABLE reminders ADD COLUMN ${column} ${definition}`);
  }
}

const now = new Date().toISOString();
db.prepare("UPDATE reminders SET normalized_task = ? WHERE normalized_task IS NULL OR normalized_task = ''").run("");
const rowsToNormalize = db.prepare("SELECT id, task FROM reminders WHERE normalized_task = ''").all() as Array<{
  id: number;
  task: string;
}>;
const normalizeStmt = db.prepare("UPDATE reminders SET normalized_task = ?, updated_at = COALESCE(updated_at, created_at, ?) WHERE id = ?");
for (const row of rowsToNormalize) normalizeStmt.run(normalizeHebrewText(row.task), now, row.id);
db.prepare("UPDATE reminders SET updated_at = COALESCE(updated_at, created_at, ?)").run(now);
db.prepare("UPDATE reminders SET category = COALESCE(NULLIF(category, ''), 'כללי')").run();
db.prepare("UPDATE reminders SET priority = COALESCE(NULLIF(priority, ''), 'רגיל')").run();
db.prepare("UPDATE reminders SET sending_at = COALESCE(sending_at, updated_at, created_at, ?) WHERE status = 'sending'").run(now);

db.exec(`
CREATE INDEX IF NOT EXISTS idx_reminders_due
ON reminders(status, due_at);

CREATE INDEX IF NOT EXISTS idx_reminders_followup
ON reminders(status, next_followup_at);

CREATE INDEX IF NOT EXISTS idx_reminders_chat
ON reminders(chat_id, created_at);

CREATE INDEX IF NOT EXISTS idx_reminders_normalized
ON reminders(chat_id, normalized_task);
`);

type ReminderRow = {
  id: number;
  chat_id: string;
  task: string;
  normalized_task: string;
  category: string | null;
  priority: ReminderPriority | null;
  due_at: string;
  recurrence_type: RecurrenceType | null;
  recurrence_day_of_week: number | null;
  recurrence_days_of_week: string | null;
  recurrence_day_of_month: number | null;
  recurrence_month: number | null;
  recurrence_time: string | null;
  status: ReminderStatus;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  sending_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  last_snoozed_at: string | null;
  snooze_count: number | null;
  next_followup_at: string | null;
  followup_count: number | null;
  last_followup_at: string | null;
  source_text: string | null;
};

function parseDays(value: string | null): number[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((day): day is number => Number.isInteger(day)) : null;
  } catch {
    return null;
  }
}

function mapRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    chatId: row.chat_id,
    task: row.task,
    normalizedTask: row.normalized_task,
    category: row.category ?? "כללי",
    priority: row.priority ?? "רגיל",
    dueAt: row.due_at,
    recurrenceType: row.recurrence_type,
    recurrenceDayOfWeek: row.recurrence_day_of_week,
    recurrenceDaysOfWeek: parseDays(row.recurrence_days_of_week),
    recurrenceDayOfMonth: row.recurrence_day_of_month,
    recurrenceMonth: row.recurrence_month,
    recurrenceTime: row.recurrence_time,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    sendingAt: row.sending_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    lastSnoozedAt: row.last_snoozed_at,
    snoozeCount: row.snooze_count ?? 0,
    nextFollowupAt: row.next_followup_at,
    followupCount: row.followup_count ?? 0,
    lastFollowupAt: row.last_followup_at,
    sourceText: row.source_text
  };
}

const FOLLOWUP_INTERVAL_MS = 5 * 60_000;
export const MAX_FOLLOWUPS = Number(process.env.MAX_FOLLOWUPS ?? 12);

function localIso(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function nextFollowupIso(date = new Date()): string {
  return localIso(new Date(date.getTime() + FOLLOWUP_INTERVAL_MS));
}

function addEvent(reminderId: number | null, chatId: string, eventType: string, payload?: unknown): void {
  db.prepare("INSERT INTO reminder_events (reminder_id, chat_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?)").run(
    reminderId,
    chatId,
    eventType,
    payload ? JSON.stringify(payload) : null,
    new Date().toISOString()
  );
}

function mapEvent(row: {
  id: number;
  reminder_id: number | null;
  chat_id: string;
  event_type: string;
  payload: string | null;
  created_at: string;
}): ReminderEvent {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    chatId: row.chat_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at
  };
}

export function createReminder(chatId: string, parsed: ParsedReminder): Reminder {
  const timestamp = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO reminders (
        chat_id, task, normalized_task, category, priority, due_at, recurrence_type, recurrence_day_of_week,
        recurrence_days_of_week, recurrence_day_of_month, recurrence_month, recurrence_time,
        status, created_at, updated_at, source_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .run(
      chatId,
      parsed.task,
      normalizeHebrewText(parsed.task),
      parsed.category ?? "כללי",
      parsed.priority ?? "רגיל",
      parsed.dueAt,
      parsed.recurrence?.type ?? null,
      parsed.recurrence?.dayOfWeek ?? null,
      parsed.recurrence?.daysOfWeek ? JSON.stringify(parsed.recurrence.daysOfWeek) : null,
      parsed.recurrence?.dayOfMonth ?? null,
      parsed.recurrence?.month ?? null,
      parsed.recurrence?.time ?? null,
      timestamp,
      timestamp,
      parsed.sourceText ?? null
    );

  const reminder = getReminderById(Number(result.lastInsertRowid))!;
  addEvent(reminder.id, chatId, "created", reminder);
  return reminder;
}

export function getReminderById(id: number): Reminder | null {
  const row = db.prepare("SELECT * FROM reminders WHERE id = ?").get(id) as ReminderRow | undefined;
  return row ? mapRow(row) : null;
}

export function getPendingDueReminders(nowIso: string, limit = 50): Reminder[] {
  const rows = db
    .prepare("SELECT * FROM reminders WHERE status = 'pending' AND due_at <= ? ORDER BY due_at ASC LIMIT ?")
    .all(nowIso, limit) as ReminderRow[];
  return rows.map(mapRow);
}

export function claimReminderForSending(id: number): boolean {
  const timestamp = new Date().toISOString();
  const result = db
    .prepare("UPDATE reminders SET status = 'sending', sending_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
    .run(timestamp, timestamp, id);
  return result.changes > 0;
}

export function releaseReminderAfterSendFailure(id: number): void {
  db.prepare("UPDATE reminders SET status = 'pending', sending_at = NULL, updated_at = ? WHERE id = ? AND status = 'sending'").run(
    new Date().toISOString(),
    id
  );
}

export function recoverStaleSendingReminders(cutoffIso?: string): number {
  const cutoff =
    cutoffIso ??
    new Date(Date.now() - 5 * 60_000).toISOString();
  const staleDue = db
    .prepare("SELECT id, chat_id FROM reminders WHERE status = 'sending' AND sending_at IS NOT NULL AND sending_at < ?")
    .all(cutoff) as Array<{ id: number; chat_id: string }>;
  const staleFollowups = db
    .prepare("SELECT id, chat_id FROM reminders WHERE status = 'notified' AND sending_at IS NOT NULL AND sending_at < ?")
    .all(cutoff) as Array<{ id: number; chat_id: string }>;
  const stale = [...staleDue, ...staleFollowups];
  if (stale.length === 0) return 0;
  const timestamp = new Date().toISOString();
  const recover = db.prepare("UPDATE reminders SET status = 'pending', sending_at = NULL, updated_at = ? WHERE id = ? AND status = 'sending'");
  const recoverFollowup = db.prepare("UPDATE reminders SET sending_at = NULL, updated_at = ? WHERE id = ? AND status = 'notified'");
  for (const reminder of stale) {
    const result = recover.run(timestamp, reminder.id);
    const followupResult = result.changes > 0 ? result : recoverFollowup.run(timestamp, reminder.id);
    if (followupResult.changes > 0) addEvent(reminder.id, reminder.chat_id, "send_recovered", { cutoffIso: cutoff });
  }
  return stale.length;
}

export function getRemindersByChatId(chatId: string): Reminder[] {
  const rows = db
    .prepare(
      `SELECT * FROM reminders
       WHERE chat_id = ?
       ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'sending' THEN 1 WHEN 'notified' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, due_at ASC`
    )
    .all(chatId) as ReminderRow[];
  return rows.map(mapRow);
}

function rangeForDay(now: Date, offset: number): { startIso: string; endIso: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 23, 59, 59, 999);
  return { startIso: localIso(start), endIso: localIso(end) };
}

export function getRemindersInRangeByChatId(chatId: string, startIso: string, endIso: string): Reminder[] {
  const rows = db
    .prepare("SELECT * FROM reminders WHERE chat_id = ? AND due_at BETWEEN ? AND ? ORDER BY due_at ASC")
    .all(chatId, startIso, endIso) as ReminderRow[];
  return rows.map(mapRow);
}

export function getTodayRemindersByChatId(chatId: string, now = new Date()): Reminder[] {
  const range = rangeForDay(now, 0);
  return getRemindersInRangeByChatId(chatId, range.startIso, range.endIso);
}

export function getTomorrowRemindersByChatId(chatId: string, now = new Date()): Reminder[] {
  const range = rangeForDay(now, 1);
  return getRemindersInRangeByChatId(chatId, range.startIso, range.endIso);
}

export function getWeekRemindersByChatId(chatId: string, now = new Date()): Reminder[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);
  return getRemindersInRangeByChatId(chatId, localIso(start), localIso(end));
}

export function getRecurringRemindersByChatId(chatId: string): Reminder[] {
  const rows = db
    .prepare("SELECT * FROM reminders WHERE chat_id = ? AND recurrence_type IS NOT NULL ORDER BY due_at ASC")
    .all(chatId) as ReminderRow[];
  return rows.map(mapRow);
}

export function getOverdueRemindersByChatId(chatId: string, nowIso = localIso()): Reminder[] {
  const rows = db
    .prepare("SELECT * FROM reminders WHERE chat_id = ? AND status = 'pending' AND due_at < ? ORDER BY due_at ASC")
    .all(chatId, nowIso) as ReminderRow[];
  return rows.map(mapRow);
}

export function getCompletedTodayRemindersByChatId(chatId: string, now = new Date()): Reminder[] {
  const range = rangeForDay(now, 0);
  const rows = db
    .prepare("SELECT * FROM reminders WHERE chat_id = ? AND status = 'done' AND completed_at BETWEEN ? AND ? ORDER BY completed_at DESC")
    .all(chatId, range.startIso, range.endIso) as ReminderRow[];
  return rows.map(mapRow);
}

export function searchRemindersByChatId(chatId: string, query: string): Reminder[] {
  const normalizedQuery = normalizeHebrewText(query);
  const rows = db
    .prepare(
      `SELECT * FROM reminders
       WHERE chat_id = ? AND (normalized_task LIKE ? OR task LIKE ? OR category LIKE ? OR priority LIKE ?)
       ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'sending' THEN 1 WHEN 'notified' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, due_at ASC`
    )
    .all(chatId, `%${normalizedQuery}%`, `%${query}%`, `%${query}%`, `%${query}%`) as ReminderRow[];
  return rows.map(mapRow);
}

export function findMatchingReminders(chatId: string, target: string): Reminder[] {
  const normalizedTarget = normalizeHebrewText(target);
  if (!normalizedTarget) return [];
  const reminders = getRemindersByChatId(chatId).filter((reminder) => reminder.status !== "cancelled");
  return reminders
    .map((reminder) => {
      const exact = reminder.normalizedTask === normalizedTarget ? 100 : 0;
      const contains = reminder.normalizedTask.includes(normalizedTarget) || normalizedTarget.includes(reminder.normalizedTask) ? 60 : 0;
      const words = normalizedTarget.split(" ").filter(Boolean);
      const hits = words.filter((word) => reminder.normalizedTask.includes(word)).length;
      return { reminder, score: exact || contains || hits * 10 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.reminder.dueAt.localeCompare(b.reminder.dueAt))
    .map((item) => item.reminder);
}

export function markReminderDone(chatId: string, id: number): boolean {
  const timestamp = new Date().toISOString();
  const result = db
    .prepare("UPDATE reminders SET status = 'done', sending_at = NULL, next_followup_at = NULL, completed_at = ?, updated_at = ? WHERE id = ? AND chat_id = ?")
    .run(timestamp, timestamp, id, chatId);
  if (result.changes > 0) {
    addEvent(id, chatId, "completed");
    addEvent(id, chatId, "followup_stopped_done");
  }
  return result.changes > 0;
}

export function markReminderDoneById(id: number): boolean {
  const reminder = getReminderById(id);
  if (!reminder) return false;
  const timestamp = new Date().toISOString();
  const result = db
    .prepare("UPDATE reminders SET status = 'done', sent_at = COALESCE(sent_at, ?), sending_at = NULL, next_followup_at = NULL, completed_at = ?, updated_at = ? WHERE id = ?")
    .run(timestamp, timestamp, timestamp, id);
  if (result.changes > 0) {
    addEvent(id, reminder.chatId, "completed");
    addEvent(id, reminder.chatId, "followup_stopped_done");
  }
  return result.changes > 0;
}

export function cancelReminder(chatId: string, id: number): boolean {
  const timestamp = new Date().toISOString();
  const result = db
    .prepare("UPDATE reminders SET status = 'cancelled', sending_at = NULL, next_followup_at = NULL, cancelled_at = ?, updated_at = ? WHERE id = ? AND chat_id = ?")
    .run(timestamp, timestamp, id, chatId);
  if (result.changes > 0) {
    addEvent(id, chatId, "cancelled");
    addEvent(id, chatId, "followup_stopped_cancelled");
  }
  return result.changes > 0;
}

export const deleteReminder = cancelReminder;

export function snoozeReminder(chatId: string, id: number, snoozeUntil: string): Reminder | null {
  const timestamp = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE reminders
       SET due_at = ?, status = 'pending', sending_at = NULL, next_followup_at = NULL,
           last_snoozed_at = ?, snooze_count = COALESCE(snooze_count, 0) + 1, updated_at = ?
       WHERE id = ? AND chat_id = ? AND status IN ('pending', 'sending', 'notified')`
    )
    .run(snoozeUntil, timestamp, timestamp, id, chatId);
  if (result.changes === 0) return null;
  addEvent(id, chatId, "snoozed", { snoozeUntil });
  return getReminderById(id);
}

export function updateReminder(
  chatId: string,
  id: number,
  updates: Partial<Pick<Reminder, "task" | "dueAt" | "status" | "category" | "priority">>
): Reminder | null {
  const existing = getReminderById(id);
  if (!existing || existing.chatId !== chatId) return null;
  const task = updates.task ?? existing.task;
  const dueAt = updates.dueAt ?? existing.dueAt;
  const status = updates.status ?? existing.status;
  const category = updates.category ?? existing.category;
  const priority = updates.priority ?? existing.priority;
  const timestamp = new Date().toISOString();
  db.prepare("UPDATE reminders SET task = ?, normalized_task = ?, category = ?, priority = ?, due_at = ?, status = ?, updated_at = ? WHERE id = ? AND chat_id = ?").run(
    task,
    normalizeHebrewText(task),
    category,
    priority,
    dueAt,
    status,
    timestamp,
    id,
    chatId
  );
  addEvent(id, chatId, "edited", updates);
  return getReminderById(id);
}

export function clearDoneRemindersByChatId(chatId: string): number {
  const result = db.prepare("DELETE FROM reminders WHERE chat_id = ? AND status = 'done'").run(chatId);
  addEvent(null, chatId, "completed_cleared", { count: result.changes });
  return result.changes;
}

export function cancelTodayRemindersByChatId(chatId: string): number {
  const today = getTodayRemindersByChatId(chatId).filter((reminder) => reminder.status !== "cancelled");
  const cancel = db.prepare("UPDATE reminders SET status = 'cancelled', sending_at = NULL, cancelled_at = ?, updated_at = ? WHERE id = ?");
  const timestamp = new Date().toISOString();
  for (const reminder of today) {
    cancel.run(timestamp, timestamp, reminder.id);
    addEvent(reminder.id, chatId, "cancelled", { bulk: "today" });
  }
  return today.length;
}

export function rescheduleRecurringReminder(reminder: Reminder): Reminder {
  if (!reminder.recurrenceType || !reminder.recurrenceTime) {
    throw new Error(`Reminder ${reminder.id} is not recurring`);
  }

  const nextDueAt = calculateNextDueAt(
    {
      type: reminder.recurrenceType,
      dayOfWeek: reminder.recurrenceDayOfWeek ?? undefined,
      daysOfWeek: reminder.recurrenceDaysOfWeek ?? undefined,
      dayOfMonth: reminder.recurrenceDayOfMonth ?? undefined,
      month: reminder.recurrenceMonth ?? undefined,
      time: reminder.recurrenceTime
    },
    new Date()
  );

  const timestamp = new Date().toISOString();
  db.prepare("UPDATE reminders SET due_at = ?, status = 'pending', sent_at = ?, sending_at = NULL, next_followup_at = NULL, updated_at = ? WHERE id = ?").run(
    nextDueAt,
    timestamp,
    timestamp,
    reminder.id
  );
  addEvent(reminder.id, reminder.chatId, "sent", { dueAt: reminder.dueAt });
  addEvent(reminder.id, reminder.chatId, "rescheduled", { nextDueAt });

  return getReminderById(reminder.id)!;
}

export function markReminderNotifiedAfterSend(reminder: Reminder): boolean {
  const timestamp = new Date().toISOString();
  const nextFollowupAt = nextFollowupIso();
  const result = db
    .prepare(
      `UPDATE reminders
       SET status = 'notified', sent_at = ?, sending_at = NULL, next_followup_at = ?,
           followup_count = 0, last_followup_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'sending'`
    )
    .run(timestamp, nextFollowupAt, timestamp, reminder.id);
  if (result.changes > 0) addEvent(reminder.id, reminder.chatId, "sent", { dueAt: reminder.dueAt });
  return result.changes > 0;
}

export function deferReminderFollowup(chatId: string, id: number): boolean {
  const timestamp = new Date().toISOString();
  const nextFollowupAt = nextFollowupIso();
  const result = db
    .prepare("UPDATE reminders SET next_followup_at = ?, updated_at = ? WHERE id = ? AND chat_id = ? AND status = 'notified'")
    .run(nextFollowupAt, timestamp, id, chatId);
  if (result.changes > 0) addEvent(id, chatId, "followup_skipped", { nextFollowupAt });
  return result.changes > 0;
}

export function claimDueFollowupReminder(nowIso: string, maxFollowups = MAX_FOLLOWUPS): Reminder | null {
  const row = db
    .prepare(
      `SELECT * FROM reminders
       WHERE status = 'notified'
         AND next_followup_at IS NOT NULL
         AND next_followup_at <= ?
         AND sending_at IS NULL
         AND COALESCE(followup_count, 0) < ?
       ORDER BY next_followup_at ASC
       LIMIT 1`
    )
    .get(nowIso, maxFollowups) as ReminderRow | undefined;
  if (!row) return null;
  const timestamp = new Date().toISOString();
  const result = db
    .prepare("UPDATE reminders SET sending_at = ?, updated_at = ? WHERE id = ? AND status = 'notified' AND next_followup_at IS NOT NULL AND sending_at IS NULL")
    .run(timestamp, timestamp, row.id);
  return result.changes > 0 ? mapRow({ ...row, sending_at: timestamp }) : null;
}

export function releaseFollowupAfterSendFailure(reminder: Reminder): void {
  db.prepare("UPDATE reminders SET sending_at = NULL, updated_at = ? WHERE id = ? AND status = 'notified'").run(
    new Date().toISOString(),
    reminder.id
  );
}

export function markFollowupSent(reminder: Reminder, maxFollowups = MAX_FOLLOWUPS): boolean {
  const timestamp = new Date().toISOString();
  const nextCount = reminder.followupCount + 1;
  const nextFollowupAt = nextCount >= maxFollowups ? null : nextFollowupIso();
  const result = db
    .prepare("UPDATE reminders SET followup_count = ?, last_followup_at = ?, next_followup_at = ?, sending_at = NULL, updated_at = ? WHERE id = ? AND status = 'notified'")
    .run(nextCount, timestamp, nextFollowupAt, timestamp, reminder.id);
  if (result.changes > 0) addEvent(reminder.id, reminder.chatId, "followup_sent", { followupCount: nextCount, nextFollowupAt });
  if (result.changes > 0 && !nextFollowupAt) addEvent(reminder.id, reminder.chatId, "followup_skipped", { reason: "max_followups", maxFollowups });
  return result.changes > 0;
}

export function clearMaxedFollowups(maxFollowups = MAX_FOLLOWUPS): number {
  const rows = db
    .prepare(
      `SELECT id, chat_id FROM reminders
       WHERE status = 'notified' AND next_followup_at IS NOT NULL AND COALESCE(followup_count, 0) >= ?`
    )
    .all(maxFollowups) as Array<{ id: number; chat_id: string }>;
  if (!rows.length) return 0;
  const timestamp = new Date().toISOString();
  const update = db.prepare("UPDATE reminders SET next_followup_at = NULL, updated_at = ? WHERE id = ? AND status = 'notified'");
  for (const reminder of rows) {
    const result = update.run(timestamp, reminder.id);
    if (result.changes > 0) addEvent(reminder.id, reminder.chat_id, "followup_skipped", { reason: "max_followups", maxFollowups });
  }
  return rows.length;
}

export function getStatsByChatId(chatId: string, now = new Date()): ReminderStats {
  const reminders = getRemindersByChatId(chatId);
  const todayIds = new Set(getTodayRemindersByChatId(chatId, now).map((reminder) => reminder.id));
  const tomorrowIds = new Set(getTomorrowRemindersByChatId(chatId, now).map((reminder) => reminder.id));
  const weekIds = new Set(getWeekRemindersByChatId(chatId, now).map((reminder) => reminder.id));
  const active = reminders.filter((reminder) => reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified");
  const categories = active.reduce<Record<string, number>>((acc, reminder) => {
    acc[reminder.category] = (acc[reminder.category] ?? 0) + 1;
    return acc;
  }, {});
  const priorities = active.reduce<Record<ReminderPriority, number>>(
    (acc, reminder) => {
      acc[reminder.priority] += 1;
      return acc;
    },
    { רגיל: 0, חשוב: 0, דחוף: 0 }
  );
  return {
    totalActive: active.length,
    dueToday: reminders.filter((reminder) => todayIds.has(reminder.id)).length,
    dueTomorrow: reminders.filter((reminder) => tomorrowIds.has(reminder.id)).length,
    dueThisWeek: reminders.filter((reminder) => weekIds.has(reminder.id)).length,
    recurring: reminders.filter((reminder) => reminder.recurrenceType).length,
    notified: reminders.filter((reminder) => reminder.status === "notified").length,
    done: reminders.filter((reminder) => reminder.status === "done").length,
    cancelled: reminders.filter((reminder) => reminder.status === "cancelled").length,
    overdue: getOverdueRemindersByChatId(chatId, localIso(now)).length,
    categories,
    priorities
  };
}

export function getReminderEventsByChatId(chatId: string, limit = 100): ReminderEvent[] {
  const rows = db
    .prepare("SELECT * FROM reminder_events WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(chatId, limit) as Array<{
      id: number;
      reminder_id: number | null;
      chat_id: string;
      event_type: string;
      payload: string | null;
      created_at: string;
    }>;
  return rows.map(mapEvent);
}

export function importReminders(chatId: string, reminders: unknown[]): { imported: Reminder[]; errors: string[] } {
  const imported: Reminder[] = [];
  const errors: string[] = [];
  reminders.forEach((item, index) => {
    const reminder = item as Partial<ParsedReminder>;
    if (!reminder || typeof reminder.task !== "string" || typeof reminder.dueAt !== "string") {
      errors.push(`פריט ${index + 1}: חסרים task או dueAt`);
      return;
    }
    if (!reminder.task.trim()) {
      errors.push(`פריט ${index + 1}: task ריק`);
      return;
    }
    if (Number.isNaN(Date.parse(reminder.dueAt))) {
      errors.push(`פריט ${index + 1}: dueAt לא תקין`);
      return;
    }
    if (reminder.recurrence !== undefined && reminder.recurrence !== null && typeof reminder.recurrence !== "object") {
      errors.push(`פריט ${index + 1}: recurrence לא תקין`);
      return;
    }
    imported.push(
      createReminder(chatId, {
        task: reminder.task,
        dueAt: reminder.dueAt,
        recurrence: reminder.recurrence ?? null,
        sourceText: reminder.sourceText,
        category: reminder.category,
        priority: reminder.priority
      })
    );
  });
  addEvent(null, chatId, "imported", { imported: imported.length, errors: errors.length });
  return { imported, errors };
}

export { db };
