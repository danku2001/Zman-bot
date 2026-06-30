import { neon } from "@neondatabase/serverless";
import { calculateNextDueAt, normalizeHebrewText } from "./parser";
import { ensureAppTimeZone, nowUtcIso, normalizeDatabaseTimestampToUtcIso, normalizeToUtcIso, wallClockDateToUtcIso, israelWallClockDate } from "./time";
import type { ParsedReminder, Recurrence, ReminderPriority, ReminderStatus, RecurrenceType } from "./types";
import type { Reminder, ReminderEvent, ReminderStats } from "../types";

ensureAppTimeZone();

type Sql = ReturnType<typeof neon>;

type ReminderRow = {
  id: number;
  chat_id: string;
  task: string;
  normalized_task: string;
  due_at: string;
  recurrence_type: RecurrenceType | null;
  recurrence_day_of_week: number | null;
  recurrence_days_of_week: number[] | string | null;
  recurrence_day_of_month: number | null;
  recurrence_month: number | null;
  recurrence_time: string | null;
  category: string | null;
  priority: ReminderPriority | null;
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

let sqlClient: Sql | null = null;
let migrated = false;

function sql(): Sql {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Vercel production API routes");
  sqlClient ??= neon(process.env.DATABASE_URL);
  return sqlClient;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return normalizeDatabaseTimestampToUtcIso(value instanceof Date ? value : String(value));
}

function requireUtcIso(value: string | Date | null | undefined, field: string): string {
  const utcIso = normalizeToUtcIso(value);
  if (!utcIso) throw new Error(`Invalid ${field}`);
  return utcIso;
}

function parseDays(value: ReminderRow["recurrence_days_of_week"]): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter((day): day is number => Number.isInteger(day));
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((day): day is number => Number.isInteger(day)) : null;
  } catch {
    return null;
  }
}

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    chatId: row.chat_id,
    task: row.task,
    normalizedTask: row.normalized_task,
    category: row.category ?? "כללי",
    priority: row.priority ?? "רגיל",
    dueAt: toIso(row.due_at) ?? "",
    recurrenceType: row.recurrence_type,
    recurrenceDayOfWeek: row.recurrence_day_of_week,
    recurrenceDaysOfWeek: parseDays(row.recurrence_days_of_week),
    recurrenceDayOfMonth: row.recurrence_day_of_month,
    recurrenceMonth: row.recurrence_month,
    recurrenceTime: row.recurrence_time,
    status: row.status,
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
    sentAt: toIso(row.sent_at),
    sendingAt: toIso(row.sending_at),
    cancelledAt: toIso(row.cancelled_at),
    completedAt: toIso(row.completed_at),
    lastSnoozedAt: toIso(row.last_snoozed_at),
    snoozeCount: row.snooze_count ?? 0,
    nextFollowupAt: toIso(row.next_followup_at),
    followupCount: row.followup_count ?? 0,
    lastFollowupAt: toIso(row.last_followup_at),
    sourceText: row.source_text
  };
}

const FOLLOWUP_INTERVAL_MS = 5 * 60_000;
export const MAX_FOLLOWUPS = Number(process.env.MAX_FOLLOWUPS ?? 12);

type MemoryState = {
  reminderId: number;
  eventId: number;
  reminders: Reminder[];
  events: ReminderEvent[];
  processedUpdates: Map<string, { chatId: string | null; status: "processing" | "processed" | "failed"; attempts: number; startedAt: string; error?: string }>;
};

const memoryState: MemoryState = {
  reminderId: 1,
  eventId: 1,
  reminders: [],
  events: [],
  processedUpdates: new Map()
};

function isMemoryDb(): boolean {
  return process.env.ZMANBOT_TEST_DB === "memory";
}

export function resetMemoryDb(): void {
  memoryState.reminderId = 1;
  memoryState.eventId = 1;
  memoryState.reminders = [];
  memoryState.events = [];
  memoryState.processedUpdates.clear();
}

function cloneReminder(reminder: Reminder): Reminder {
  return { ...reminder, recurrenceDaysOfWeek: reminder.recurrenceDaysOfWeek ? [...reminder.recurrenceDaysOfWeek] : null };
}

function memoryEvent(reminderId: number | null, chatId: string, eventType: string, payload?: unknown): void {
  memoryState.events.unshift({
    id: memoryState.eventId,
    reminderId,
    chatId,
    eventType,
    payload: payload ? JSON.stringify(payload) : null,
    createdAt: nowUtcIso()
  });
  memoryState.eventId += 1;
}

function memoryCreateReminder(chatId: string, parsed: ParsedReminder): Reminder {
  const timestamp = nowUtcIso();
  const dueAt = requireUtcIso(parsed.dueAt, "dueAt");
  const reminder: Reminder = {
    id: memoryState.reminderId,
    chatId,
    task: parsed.task,
    normalizedTask: normalizeHebrewText(parsed.task),
    category: parsed.category ?? "כללי",
    priority: parsed.priority ?? "רגיל",
    dueAt,
    recurrenceType: parsed.recurrence?.type ?? null,
    recurrenceDayOfWeek: parsed.recurrence?.dayOfWeek ?? null,
    recurrenceDaysOfWeek: parsed.recurrence?.daysOfWeek ?? null,
    recurrenceDayOfMonth: parsed.recurrence?.dayOfMonth ?? null,
    recurrenceMonth: parsed.recurrence?.month ?? null,
    recurrenceTime: parsed.recurrence?.time ?? null,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    sentAt: null,
    sendingAt: null,
    cancelledAt: null,
    completedAt: null,
    lastSnoozedAt: null,
    snoozeCount: 0,
    nextFollowupAt: null,
    followupCount: 0,
    lastFollowupAt: null,
    sourceText: parsed.sourceText ?? null
  };
  memoryState.reminders.push(reminder);
  memoryState.reminderId += 1;
  memoryEvent(reminder.id, chatId, "created", reminder);
  return cloneReminder(reminder);
}

function memoryByChat(chatId: string): Reminder[] {
  return memoryState.reminders
    .filter((reminder) => reminder.chatId === chatId)
    .sort((a, b) => {
      const statusOrder = { pending: 0, sending: 1, notified: 2, done: 3, cancelled: 4 } satisfies Record<ReminderStatus, number>;
      return statusOrder[a.status] - statusOrder[b.status] || a.dueAt.localeCompare(b.dueAt);
    })
    .map(cloneReminder);
}

function memorySet(id: number, chatId: string, updates: Partial<Reminder>): Reminder | null {
  const reminder = memoryState.reminders.find((item) => item.id === id && item.chatId === chatId);
  if (!reminder) return null;
  Object.assign(reminder, updates, { updatedAt: nowUtcIso() });
  return cloneReminder(reminder);
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
    createdAt: toIso(row.created_at) ?? ""
  };
}

export async function migrate(): Promise<void> {
  if (isMemoryDb()) return;
  if (migrated) return;
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS reminders (
      id BIGSERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      task TEXT NOT NULL,
      normalized_task TEXT NOT NULL DEFAULT '',
      due_at TIMESTAMPTZ NOT NULL,
      recurrence_type TEXT NULL,
      recurrence_day_of_week INTEGER NULL,
      recurrence_days_of_week JSONB NULL,
      recurrence_day_of_month INTEGER NULL,
      recurrence_month INTEGER NULL,
      recurrence_time TEXT NULL,
      category TEXT DEFAULT 'כללי',
      priority TEXT DEFAULT 'רגיל',
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ NULL,
      sending_at TIMESTAMPTZ NULL,
      cancelled_at TIMESTAMPTZ NULL,
      completed_at TIMESTAMPTZ NULL,
      last_snoozed_at TIMESTAMPTZ NULL,
      snooze_count INTEGER DEFAULT 0,
      next_followup_at TIMESTAMPTZ NULL,
      followup_count INTEGER DEFAULT 0,
      last_followup_at TIMESTAMPTZ NULL,
      source_text TEXT NULL
    )
  `;
  await db`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ NULL`;
  await db`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0`;
  await db`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ NULL`;
  await db`
    CREATE TABLE IF NOT EXISTS reminder_events (
      id BIGSERIAL PRIMARY KEY,
      reminder_id BIGINT NULL,
      chat_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS processed_updates (
      update_id TEXT PRIMARY KEY,
      chat_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'processed',
      processing_started_at TIMESTAMPTZ NULL,
      processed_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    )
  `;
  await db`ALTER TABLE processed_updates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed'`;
  await db`ALTER TABLE processed_updates ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ NULL`;
  await db`ALTER TABLE processed_updates ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NULL`;
  await db`ALTER TABLE processed_updates ADD COLUMN IF NOT EXISTS last_error TEXT NULL`;
  await db`ALTER TABLE processed_updates ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`;
  await db`CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, due_at)`;
  await db`CREATE INDEX IF NOT EXISTS idx_reminders_followup ON reminders(status, next_followup_at)`;
  await db`CREATE INDEX IF NOT EXISTS idx_reminders_chat ON reminders(chat_id, created_at)`;
  await db`CREATE INDEX IF NOT EXISTS idx_reminders_normalized ON reminders(chat_id, normalized_task)`;
  await db`CREATE INDEX IF NOT EXISTS idx_processed_updates_status ON processed_updates(status, processing_started_at)`;
  migrated = true;
}

export async function getDatabaseNowUtc(): Promise<string | null> {
  if (isMemoryDb()) return nowUtcIso();
  if (!process.env.DATABASE_URL) return null;
  await migrate();
  const rows = await sql()`SELECT NOW() AS now` as Array<{ now: string | Date }>;
  return toIso(rows[0]?.now);
}

export async function claimTelegramUpdate(updateId: string, chatId?: string | null): Promise<boolean> {
  if (isMemoryDb()) {
    const existing = memoryState.processedUpdates.get(updateId);
    if (existing?.status === "processed" || existing?.status === "processing") return false;
    memoryState.processedUpdates.set(updateId, {
      chatId: chatId ?? null,
      status: "processing",
      attempts: (existing?.attempts ?? 0) + 1,
      startedAt: nowUtcIso()
    });
    return true;
  }
  await migrate();
  const rows = await sql()`
    INSERT INTO processed_updates (update_id, chat_id, status, processing_started_at, attempts)
    VALUES (${updateId}, ${chatId ?? null}, 'processing', NOW(), 1)
    ON CONFLICT (update_id) DO UPDATE
      SET status = 'processing',
          chat_id = COALESCE(EXCLUDED.chat_id, processed_updates.chat_id),
          processing_started_at = NOW(),
          attempts = processed_updates.attempts + 1,
          last_error = NULL
      WHERE processed_updates.status = 'failed'
         OR (processed_updates.status = 'processing' AND processed_updates.processing_started_at < NOW() - INTERVAL '2 minutes')
    RETURNING update_id
  ` as Array<{ update_id: string }>;
  return rows.length > 0;
}

export const claimProcessedUpdate = claimTelegramUpdate;

export async function markTelegramUpdateProcessed(updateId: string): Promise<void> {
  if (isMemoryDb()) {
    const existing = memoryState.processedUpdates.get(updateId);
    memoryState.processedUpdates.set(updateId, {
      chatId: existing?.chatId ?? null,
      status: "processed",
      attempts: existing?.attempts ?? 1,
      startedAt: existing?.startedAt ?? nowUtcIso()
    });
    return;
  }
  await migrate();
  await sql()`
    UPDATE processed_updates
    SET status = 'processed', processed_at = NOW(), last_error = NULL
    WHERE update_id = ${updateId}
  `;
}

export async function markTelegramUpdateFailed(updateId: string, error: string): Promise<void> {
  if (isMemoryDb()) {
    const existing = memoryState.processedUpdates.get(updateId);
    memoryState.processedUpdates.set(updateId, {
      chatId: existing?.chatId ?? null,
      status: "failed",
      attempts: existing?.attempts ?? 1,
      startedAt: existing?.startedAt ?? nowUtcIso(),
      error
    });
    return;
  }
  await migrate();
  await sql()`
    UPDATE processed_updates
    SET status = 'failed', last_error = ${error.slice(0, 500)}
    WHERE update_id = ${updateId}
  `;
}

async function addEvent(reminderId: number | null, chatId: string, eventType: string, payload?: unknown): Promise<void> {
  if (isMemoryDb()) {
    memoryEvent(reminderId, chatId, eventType, payload);
    return;
  }
  try {
    await migrate();
    await sql()`INSERT INTO reminder_events (reminder_id, chat_id, event_type, payload) VALUES (${reminderId}, ${chatId}, ${eventType}, ${payload ? JSON.stringify(payload) : null})`;
  } catch (error) {
    console.error("Reminder event logging failed", error instanceof Error ? error.message : "Unknown event logging error");
  }
}

export async function createReminder(chatId: string, parsed: ParsedReminder): Promise<Reminder> {
  if (isMemoryDb()) return memoryCreateReminder(chatId, parsed);
  await migrate();
  const rows = await sql()`
    INSERT INTO reminders (
      chat_id, task, normalized_task, category, priority, due_at, recurrence_type,
      recurrence_day_of_week, recurrence_days_of_week, recurrence_day_of_month,
      recurrence_month, recurrence_time, status, source_text
    ) VALUES (
      ${chatId}, ${parsed.task}, ${normalizeHebrewText(parsed.task)}, ${parsed.category ?? "כללי"},
      ${parsed.priority ?? "רגיל"}, ${requireUtcIso(parsed.dueAt, "dueAt")}::timestamptz, ${parsed.recurrence?.type ?? null},
      ${parsed.recurrence?.dayOfWeek ?? null}, ${parsed.recurrence?.daysOfWeek ? JSON.stringify(parsed.recurrence.daysOfWeek) : null},
      ${parsed.recurrence?.dayOfMonth ?? null}, ${parsed.recurrence?.month ?? null},
      ${parsed.recurrence?.time ?? null}, 'pending', ${parsed.sourceText ?? null}
    )
    RETURNING *
  ` as ReminderRow[];
  const reminder = mapReminder(rows[0]);
  await addEvent(reminder.id, chatId, "created", reminder);
  return reminder;
}

export async function getReminderById(id: number): Promise<Reminder | null> {
  if (isMemoryDb()) {
    const reminder = memoryState.reminders.find((item) => item.id === id);
    return reminder ? cloneReminder(reminder) : null;
  }
  await migrate();
  const rows = await sql()`SELECT * FROM reminders WHERE id = ${id}` as ReminderRow[];
  return rows[0] ? mapReminder(rows[0]) : null;
}

export async function getRemindersByChatId(chatId: string): Promise<Reminder[]> {
  if (isMemoryDb()) return memoryByChat(chatId);
  await migrate();
  const rows = await sql()`
    SELECT * FROM reminders
    WHERE chat_id = ${chatId}
    ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'sending' THEN 1 WHEN 'notified' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, due_at ASC
  ` as ReminderRow[];
  return rows.map(mapReminder);
}

export async function getSyncDebugByChatId(chatId: string): Promise<{
  chatId: string;
  total: number;
  countsByStatus: Record<ReminderStatus, number>;
  latest: Array<Pick<Reminder, "id" | "task" | "dueAt" | "status" | "sourceText">>;
  databaseMode: "postgres" | "memory";
}> {
  if (isMemoryDb()) {
    const reminders = memoryByChat(chatId);
    const countsByStatus: Record<ReminderStatus, number> = { pending: 0, sending: 0, notified: 0, done: 0, cancelled: 0 };
    for (const reminder of reminders) countsByStatus[reminder.status] += 1;
    return {
      chatId,
      total: reminders.length,
      countsByStatus,
      latest: reminders
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5)
        .map((reminder) => ({ id: reminder.id, task: reminder.task, dueAt: reminder.dueAt, status: reminder.status, sourceText: reminder.sourceText })),
      databaseMode: "memory"
    };
  }
  const reminders = await getRemindersByChatId(chatId);
  const countsByStatus: Record<ReminderStatus, number> = {
    pending: 0,
    sending: 0,
    notified: 0,
    done: 0,
    cancelled: 0
  };
  for (const reminder of reminders) countsByStatus[reminder.status] += 1;
  return {
    chatId,
    total: reminders.length,
    countsByStatus,
    latest: reminders
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((reminder) => ({
        id: reminder.id,
        task: reminder.task,
        dueAt: reminder.dueAt,
        status: reminder.status,
        sourceText: reminder.sourceText
      })),
    databaseMode: "postgres"
  };
}

export async function getKnownChats(): Promise<Array<{ chatId: string; total: number; latestActivityAt: string | null }>> {
  if (isMemoryDb()) {
    return Array.from(new Set(memoryState.reminders.map((reminder) => reminder.chatId))).map((chatId) => {
      const reminders = memoryByChat(chatId);
      return {
        chatId,
        total: reminders.length,
        latestActivityAt: reminders.map((reminder) => reminder.updatedAt).sort().at(-1) ?? null
      };
    });
  }
  await migrate();
  const rows = await sql()`
    SELECT chat_id, COUNT(*)::int AS total, MAX(updated_at) AS latest_activity_at
    FROM reminders
    GROUP BY chat_id
    ORDER BY MAX(updated_at) DESC
    LIMIT 10
  ` as Array<{ chat_id: string; total: number; latest_activity_at: string | null }>;
  return rows.map((row) => ({
    chatId: row.chat_id,
    total: row.total,
    latestActivityAt: toIso(row.latest_activity_at)
  }));
}

export async function getRange(chatId: string, startIso: string, endIso: string): Promise<Reminder[]> {
  if (isMemoryDb()) {
    return memoryByChat(chatId).filter((reminder) => reminder.dueAt >= startIso && reminder.dueAt <= endIso);
  }
  await migrate();
  const rows = await sql()`
    SELECT * FROM reminders
    WHERE chat_id = ${chatId}
      AND due_at BETWEEN ${requireUtcIso(startIso, "range start")}::timestamptz
                     AND ${requireUtcIso(endIso, "range end")}::timestamptz
    ORDER BY due_at ASC
  ` as ReminderRow[];
  return rows.map(mapReminder);
}

function utcIso(date = new Date()): string {
  return nowUtcIso(date);
}

function nextFollowupIso(date = new Date()): string {
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  return utcIso(new Date(safeDate.getTime() + FOLLOWUP_INTERVAL_MS));
}

function rangeForDay(now: Date, offset: number): { startIso: string; endIso: string } {
  now = israelWallClockDate(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 23, 59, 59, 999);
  return { startIso: wallClockDateToUtcIso(start), endIso: wallClockDateToUtcIso(end) };
}

export async function getTodayRemindersByChatId(chatId: string, now = new Date()): Promise<Reminder[]> {
  const range = rangeForDay(now, 0);
  return getRange(chatId, range.startIso, range.endIso);
}

export async function getTomorrowRemindersByChatId(chatId: string, now = new Date()): Promise<Reminder[]> {
  const range = rangeForDay(now, 1);
  return getRange(chatId, range.startIso, range.endIso);
}

export async function getWeekRemindersByChatId(chatId: string, now = new Date()): Promise<Reminder[]> {
  now = israelWallClockDate(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);
  return getRange(chatId, wallClockDateToUtcIso(start), wallClockDateToUtcIso(end));
}

export async function getRecurringRemindersByChatId(chatId: string): Promise<Reminder[]> {
  if (isMemoryDb()) return memoryByChat(chatId).filter((reminder) => reminder.recurrenceType);
  await migrate();
  const rows = await sql()`SELECT * FROM reminders WHERE chat_id = ${chatId} AND recurrence_type IS NOT NULL ORDER BY due_at ASC` as ReminderRow[];
  return rows.map(mapReminder);
}

export async function getOverdueRemindersByChatId(chatId: string, nowIso = utcIso()): Promise<Reminder[]> {
  if (isMemoryDb()) return memoryByChat(chatId).filter((reminder) => reminder.status === "pending" && reminder.dueAt < nowIso);
  await migrate();
  const rows = await sql()`
    SELECT * FROM reminders
    WHERE chat_id = ${chatId}
      AND status = 'pending'
      AND due_at < ${requireUtcIso(nowIso, "nowIso")}::timestamptz
    ORDER BY due_at ASC
  ` as ReminderRow[];
  return rows.map(mapReminder);
}

export async function searchRemindersByChatId(chatId: string, query: string): Promise<Reminder[]> {
  if (isMemoryDb()) {
    const normalized = normalizeHebrewText(query);
    return memoryByChat(chatId).filter((reminder) =>
      reminder.normalizedTask.includes(normalized) ||
      reminder.task.includes(query) ||
      reminder.category.includes(query) ||
      reminder.priority.includes(query as ReminderPriority)
    );
  }
  await migrate();
  const normalized = `%${normalizeHebrewText(query)}%`;
  const raw = `%${query}%`;
  const rows = await sql()`
    SELECT * FROM reminders
    WHERE chat_id = ${chatId} AND (normalized_task LIKE ${normalized} OR task LIKE ${raw} OR category LIKE ${raw} OR priority LIKE ${raw})
    ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'sending' THEN 1 WHEN 'notified' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, due_at ASC
  ` as ReminderRow[];
  return rows.map(mapReminder);
}

export async function markReminderDone(chatId: string, id: number): Promise<boolean> {
  if (isMemoryDb()) {
    const updated = memorySet(id, chatId, { status: "done", sendingAt: null, nextFollowupAt: null, completedAt: nowUtcIso() });
    if (updated) {
      memoryEvent(id, chatId, "completed");
      memoryEvent(id, chatId, "followup_stopped_done");
    }
    return Boolean(updated);
  }
  await migrate();
  const rows = await sql()`
    UPDATE reminders
    SET status = 'done', sending_at = NULL, next_followup_at = NULL, completed_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND chat_id = ${chatId}
    RETURNING id, status
  ` as Array<{ id: number; status: ReminderStatus }>;
  if (rows.length) {
    await addEvent(id, chatId, "completed");
    await addEvent(id, chatId, "followup_stopped_done");
  }
  return rows.length > 0;
}

export async function cancelReminder(chatId: string, id: number): Promise<boolean> {
  if (isMemoryDb()) {
    const updated = memorySet(id, chatId, { status: "cancelled", sendingAt: null, nextFollowupAt: null, cancelledAt: nowUtcIso() });
    if (updated) {
      memoryEvent(id, chatId, "cancelled");
      memoryEvent(id, chatId, "followup_stopped_cancelled");
    }
    return Boolean(updated);
  }
  await migrate();
  const rows = await sql()`
    UPDATE reminders
    SET status = 'cancelled', sending_at = NULL, next_followup_at = NULL, cancelled_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND chat_id = ${chatId}
    RETURNING id
  ` as Array<{ id: number }>;
  if (rows.length) {
    await addEvent(id, chatId, "cancelled");
    await addEvent(id, chatId, "followup_stopped_cancelled");
  }
  return rows.length > 0;
}

export async function deleteReminder(chatId: string, id: number): Promise<boolean> {
  if (isMemoryDb()) {
    const index = memoryState.reminders.findIndex((reminder) => reminder.id === id && reminder.chatId === chatId);
    if (index < 0) return false;
    const [removed] = memoryState.reminders.splice(index, 1);
    memoryEvent(id, chatId, "deleted", { task: removed.task, previousStatus: removed.status });
    return true;
  }
  await migrate();
  const rows = await sql()`
    DELETE FROM reminders
    WHERE id = ${id} AND chat_id = ${chatId}
    RETURNING id, chat_id, task, status
  ` as Array<{ id: number; chat_id: string; task: string; status: ReminderStatus }>;
  if (rows.length) {
    await addEvent(id, chatId, "deleted", { task: rows[0].task, previousStatus: rows[0].status });
  }
  return rows.length > 0;
}

export async function snoozeReminder(chatId: string, id: number, snoozeUntil: string): Promise<Reminder | null> {
  if (isMemoryDb()) {
    const existing = memoryState.reminders.find((reminder) => reminder.id === id && reminder.chatId === chatId && ["pending", "sending", "notified"].includes(reminder.status));
    if (!existing) return null;
    const updated = memorySet(id, chatId, {
      dueAt: snoozeUntil,
      status: "pending",
      sendingAt: null,
      nextFollowupAt: null,
      lastSnoozedAt: nowUtcIso(),
      snoozeCount: existing.snoozeCount + 1
    });
    memoryEvent(id, chatId, "snoozed", { snoozeUntil });
    return updated;
  }
  await migrate();
  const rows = await sql()`
    UPDATE reminders
    SET due_at = ${requireUtcIso(snoozeUntil, "snoozeUntil")}::timestamptz, status = 'pending', sending_at = NULL, next_followup_at = NULL,
        last_snoozed_at = NOW(), snooze_count = COALESCE(snooze_count, 0) + 1, updated_at = NOW()
    WHERE id = ${id} AND chat_id = ${chatId} AND status IN ('pending', 'sending', 'notified')
    RETURNING *
  ` as ReminderRow[];
  if (!rows[0]) return null;
  await addEvent(id, chatId, "snoozed", { snoozeUntil });
  return mapReminder(rows[0]);
}

export async function updateReminder(chatId: string, id: number, updates: Partial<Pick<Reminder, "task" | "dueAt" | "status" | "category" | "priority">>): Promise<Reminder | null> {
  if (isMemoryDb()) {
    const existing = memoryState.reminders.find((reminder) => reminder.id === id && reminder.chatId === chatId);
    if (!existing) return null;
    const task = updates.task ?? existing.task;
    const updated = memorySet(id, chatId, {
      task,
      normalizedTask: normalizeHebrewText(task),
      category: updates.category ?? existing.category,
      priority: updates.priority ?? existing.priority,
      dueAt: updates.dueAt ?? existing.dueAt,
      status: updates.status ?? existing.status
    });
    memoryEvent(id, chatId, "edited", updates);
    return updated;
  }
  const existing = await getReminderById(id);
  if (!existing || existing.chatId !== chatId) return null;
  const task = updates.task ?? existing.task;
  const rows = await sql()`
    UPDATE reminders
    SET task = ${task}, normalized_task = ${normalizeHebrewText(task)}, category = ${updates.category ?? existing.category},
        priority = ${updates.priority ?? existing.priority}, due_at = ${requireUtcIso(updates.dueAt ?? existing.dueAt, "dueAt")}::timestamptz,
        status = ${updates.status ?? existing.status}, updated_at = NOW()
    WHERE id = ${id} AND chat_id = ${chatId}
    RETURNING *
  ` as ReminderRow[];
  if (!rows[0]) return null;
  await addEvent(id, chatId, "edited", updates);
  return mapReminder(rows[0]);
}

export async function getReminderEventsByChatId(chatId: string, limit = 100): Promise<ReminderEvent[]> {
  if (isMemoryDb()) return memoryState.events.filter((event) => event.chatId === chatId).slice(0, limit).map((event) => ({ ...event }));
  await migrate();
  const rows = await sql()`SELECT * FROM reminder_events WHERE chat_id = ${chatId} ORDER BY created_at DESC LIMIT ${limit}` as Array<{
    id: number;
    reminder_id: number | null;
    chat_id: string;
    event_type: string;
    payload: string | null;
    created_at: string;
  }>;
  return rows.map(mapEvent);
}

export async function getSchedulerDebugSnapshot(nowIso = nowUtcIso()): Promise<{
  nowUtc: string;
  pendingDueCount: number;
  nextPendingReminder: Pick<Reminder, "id" | "chatId" | "task" | "dueAt" | "status"> | null;
  lastSchedulerEvents: Array<Pick<ReminderEvent, "id" | "reminderId" | "chatId" | "eventType" | "createdAt">>;
}> {
  const normalizedNow = requireUtcIso(nowIso, "nowIso");
  if (isMemoryDb()) {
    const pending = memoryState.reminders
      .filter((reminder) => reminder.status === "pending")
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const next = pending[0] ?? null;
    return {
      nowUtc: normalizedNow,
      pendingDueCount: pending.filter((reminder) => reminder.dueAt <= normalizedNow).length,
      nextPendingReminder: next ? { id: next.id, chatId: next.chatId, task: next.task, dueAt: next.dueAt, status: next.status } : null,
      lastSchedulerEvents: memoryState.events
        .filter((event) => ["sent", "send_recovered", "followup_sent", "followup_skipped"].includes(event.eventType))
        .slice(0, 10)
        .map((event) => ({ id: event.id, reminderId: event.reminderId, chatId: event.chatId, eventType: event.eventType, createdAt: event.createdAt }))
    };
  }
  await migrate();
  const countRows = await sql()`SELECT COUNT(*)::int AS count FROM reminders WHERE status = 'pending' AND due_at <= ${normalizedNow}::timestamptz` as Array<{ count: number }>;
  const nextRows = await sql()`SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_at ASC LIMIT 1` as ReminderRow[];
  const eventRows = await sql()`
    SELECT id, reminder_id, chat_id, event_type, payload, created_at
    FROM reminder_events
    WHERE event_type IN ('sent', 'send_recovered', 'followup_sent', 'followup_skipped')
    ORDER BY created_at DESC
    LIMIT 10
  ` as Array<{ id: number; reminder_id: number | null; chat_id: string; event_type: string; payload: string | null; created_at: string }>;
  const next = nextRows[0] ? mapReminder(nextRows[0]) : null;
  return {
    nowUtc: normalizedNow,
    pendingDueCount: countRows[0]?.count ?? 0,
    nextPendingReminder: next ? { id: next.id, chatId: next.chatId, task: next.task, dueAt: next.dueAt, status: next.status } : null,
    lastSchedulerEvents: eventRows.map(mapEvent).map((event) => ({
      id: event.id,
      reminderId: event.reminderId,
      chatId: event.chatId,
      eventType: event.eventType,
      createdAt: event.createdAt
    }))
  };
}

export async function getStatsByChatId(chatId: string, now = new Date()): Promise<ReminderStats> {
  if (isMemoryDb()) {
    const reminders = memoryByChat(chatId);
    const todayIds = new Set((await getTodayRemindersByChatId(chatId, now)).map((reminder) => reminder.id));
    const tomorrowIds = new Set((await getTomorrowRemindersByChatId(chatId, now)).map((reminder) => reminder.id));
    const weekIds = new Set((await getWeekRemindersByChatId(chatId, now)).map((reminder) => reminder.id));
    const active = reminders.filter((reminder) => reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified");
    return {
      totalActive: active.length,
      dueToday: reminders.filter((reminder) => todayIds.has(reminder.id)).length,
      dueTomorrow: reminders.filter((reminder) => tomorrowIds.has(reminder.id)).length,
      dueThisWeek: reminders.filter((reminder) => weekIds.has(reminder.id)).length,
      recurring: reminders.filter((reminder) => reminder.recurrenceType).length,
      notified: reminders.filter((reminder) => reminder.status === "notified").length,
      done: reminders.filter((reminder) => reminder.status === "done").length,
      cancelled: reminders.filter((reminder) => reminder.status === "cancelled").length,
      overdue: (await getOverdueRemindersByChatId(chatId, utcIso(now))).length,
      categories: active.reduce<Record<string, number>>((acc, reminder) => {
        acc[reminder.category] = (acc[reminder.category] ?? 0) + 1;
        return acc;
      }, {}),
      priorities: active.reduce<Record<ReminderPriority, number>>((acc, reminder) => {
        acc[reminder.priority] += 1;
        return acc;
      }, { נמוך: 0, רגיל: 0, חשוב: 0, דחוף: 0 })
    };
  }
  const reminders = await getRemindersByChatId(chatId);
  const todayIds = new Set((await getTodayRemindersByChatId(chatId, now)).map((reminder) => reminder.id));
  const tomorrowIds = new Set((await getTomorrowRemindersByChatId(chatId, now)).map((reminder) => reminder.id));
  const weekIds = new Set((await getWeekRemindersByChatId(chatId, now)).map((reminder) => reminder.id));
  const active = reminders.filter((reminder) => reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified");
  return {
    totalActive: active.length,
    dueToday: reminders.filter((reminder) => todayIds.has(reminder.id)).length,
    dueTomorrow: reminders.filter((reminder) => tomorrowIds.has(reminder.id)).length,
    dueThisWeek: reminders.filter((reminder) => weekIds.has(reminder.id)).length,
    recurring: reminders.filter((reminder) => reminder.recurrenceType).length,
    notified: reminders.filter((reminder) => reminder.status === "notified").length,
    done: reminders.filter((reminder) => reminder.status === "done").length,
    cancelled: reminders.filter((reminder) => reminder.status === "cancelled").length,
    overdue: (await getOverdueRemindersByChatId(chatId, utcIso(now))).length,
    categories: active.reduce<Record<string, number>>((acc, reminder) => {
      acc[reminder.category] = (acc[reminder.category] ?? 0) + 1;
      return acc;
    }, {}),
    priorities: active.reduce<Record<ReminderPriority, number>>(
      (acc, reminder) => {
        acc[reminder.priority] += 1;
        return acc;
      },
      { נמוך: 0, רגיל: 0, חשוב: 0, דחוף: 0 }
    )
  };
}

export async function importReminders(chatId: string, reminders: unknown[]): Promise<{ imported: Reminder[]; errors: string[] }> {
  if (isMemoryDb()) {
    const imported: Reminder[] = [];
    const errors: string[] = [];
    for (const [index, item] of reminders.entries()) {
      const reminder = item as Partial<ParsedReminder>;
      if (!reminder || typeof reminder.task !== "string" || typeof reminder.dueAt !== "string") {
        errors.push(`פריט ${index + 1}: חסרים task או dueAt`);
        continue;
      }
      imported.push(memoryCreateReminder(chatId, {
        task: reminder.task,
        dueAt: reminder.dueAt,
        recurrence: (reminder.recurrence as Recurrence | null | undefined) ?? null,
        sourceText: reminder.sourceText,
        category: typeof reminder.category === "string" ? reminder.category : undefined,
        priority: reminder.priority
      }));
    }
    memoryEvent(null, chatId, "imported", { imported: imported.length, errors: errors.length });
    return { imported, errors };
  }
  const imported: Reminder[] = [];
  const errors: string[] = [];
  for (const [index, item] of reminders.entries()) {
    const reminder = item as Partial<ParsedReminder>;
    if (!reminder || typeof reminder.task !== "string" || typeof reminder.dueAt !== "string") {
      errors.push(`פריט ${index + 1}: חסרים task או dueAt`);
      continue;
    }
    if (!reminder.task.trim()) {
      errors.push(`פריט ${index + 1}: task ריק`);
      continue;
    }
    if (Number.isNaN(Date.parse(reminder.dueAt))) {
      errors.push(`פריט ${index + 1}: dueAt לא תקין`);
      continue;
    }
    if (reminder.recurrence !== undefined && reminder.recurrence !== null && typeof reminder.recurrence !== "object") {
      errors.push(`פריט ${index + 1}: recurrence לא תקין`);
      continue;
    }
    imported.push(await createReminder(chatId, {
      task: reminder.task,
      dueAt: reminder.dueAt,
      recurrence: (reminder.recurrence as Recurrence | null | undefined) ?? null,
      sourceText: reminder.sourceText,
      category: typeof reminder.category === "string" ? reminder.category : undefined,
      priority: reminder.priority
    }));
  }
  await addEvent(null, chatId, "imported", { imported: imported.length, errors: errors.length });
  return { imported, errors };
}

export async function claimDueReminder(nowIso: string): Promise<Reminder | null> {
  if (isMemoryDb()) {
    const reminder = memoryState.reminders
      .filter((item) => item.status === "pending" && item.dueAt <= nowIso)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    if (!reminder) return null;
    return memorySet(reminder.id, reminder.chatId, { status: "sending", sendingAt: nowUtcIso() });
  }
  await migrate();
  const rows = await sql()`
    UPDATE reminders
    SET status = 'sending', sending_at = NOW(), updated_at = NOW()
    WHERE id = (
      SELECT id FROM reminders
      WHERE status = 'pending'
        AND due_at <= ${requireUtcIso(nowIso, "nowIso")}::timestamptz
      ORDER BY due_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  ` as ReminderRow[];
  return rows[0] ? mapReminder(rows[0]) : null;
}

export async function releaseReminderAfterSendFailure(id: number): Promise<void> {
  if (isMemoryDb()) {
    const reminder = memoryState.reminders.find((item) => item.id === id && item.status === "sending");
    if (reminder) memorySet(reminder.id, reminder.chatId, { status: "pending", sendingAt: null });
    return;
  }
  await migrate();
  await sql()`UPDATE reminders SET status = 'pending', sending_at = NULL, updated_at = NOW() WHERE id = ${id} AND status = 'sending'`;
}

export async function markReminderNotifiedAfterSend(reminder: Reminder): Promise<boolean> {
  if (isMemoryDb()) {
    const nextFollowupAt = nextFollowupIso();
    const updated = memorySet(reminder.id, reminder.chatId, {
      status: "notified",
      sentAt: nowUtcIso(),
      sendingAt: null,
      nextFollowupAt,
      followupCount: 0,
      lastFollowupAt: null
    });
    if (updated) memoryEvent(reminder.id, reminder.chatId, "sent", { dueAt: reminder.dueAt });
    return Boolean(updated);
  }
  await migrate();
  const nextFollowupAt = nextFollowupIso();
  const rows = await sql()`
    UPDATE reminders
    SET status = 'notified', sent_at = NOW(), sending_at = NULL,
        next_followup_at = ${requireUtcIso(nextFollowupAt, "nextFollowupAt")}::timestamptz,
        followup_count = 0, last_followup_at = NULL, updated_at = NOW()
    WHERE id = ${reminder.id} AND status = 'sending'
    RETURNING id
  ` as Array<{ id: number }>;
  if (rows.length) await addEvent(reminder.id, reminder.chatId, "sent", { dueAt: reminder.dueAt });
  return rows.length > 0;
}

export async function deferReminderFollowup(chatId: string, id: number): Promise<boolean> {
  if (isMemoryDb()) {
    const nextFollowupAt = nextFollowupIso();
    const existing = memoryState.reminders.find((reminder) => reminder.id === id && reminder.chatId === chatId && reminder.status === "notified");
    if (!existing) return false;
    memorySet(id, chatId, { nextFollowupAt });
    memoryEvent(id, chatId, "followup_skipped", { nextFollowupAt });
    return true;
  }
  await migrate();
  const nextFollowupAt = nextFollowupIso();
  const rows = await sql()`
    UPDATE reminders
    SET next_followup_at = ${requireUtcIso(nextFollowupAt, "nextFollowupAt")}::timestamptz, updated_at = NOW()
    WHERE id = ${id} AND chat_id = ${chatId} AND status = 'notified'
    RETURNING id
  ` as Array<{ id: number }>;
  if (rows.length) await addEvent(id, chatId, "followup_skipped", { nextFollowupAt });
  return rows.length > 0;
}

export async function claimDueFollowupReminder(nowIso: string, maxFollowups = MAX_FOLLOWUPS): Promise<Reminder | null> {
  if (isMemoryDb()) {
    const reminder = memoryState.reminders
      .filter((item) => item.status === "notified" && item.nextFollowupAt && item.nextFollowupAt <= nowIso && !item.sendingAt && item.followupCount < maxFollowups)
      .sort((a, b) => (a.nextFollowupAt ?? "").localeCompare(b.nextFollowupAt ?? ""))[0];
    if (!reminder) return null;
    return memorySet(reminder.id, reminder.chatId, { sendingAt: nowUtcIso() });
  }
  await migrate();
  const rows = await sql()`
    UPDATE reminders
    SET sending_at = NOW(), updated_at = NOW()
    WHERE id = (
      SELECT id FROM reminders
      WHERE status = 'notified'
        AND next_followup_at IS NOT NULL
        AND next_followup_at <= ${requireUtcIso(nowIso, "nowIso")}::timestamptz
        AND sending_at IS NULL
        AND COALESCE(followup_count, 0) < ${maxFollowups}
      ORDER BY next_followup_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  ` as ReminderRow[];
  return rows[0] ? mapReminder(rows[0]) : null;
}

export async function releaseFollowupAfterSendFailure(reminder: Reminder): Promise<void> {
  if (isMemoryDb()) {
    memorySet(reminder.id, reminder.chatId, { sendingAt: null });
    return;
  }
  await migrate();
  await sql()`
    UPDATE reminders
    SET sending_at = NULL, updated_at = NOW()
    WHERE id = ${reminder.id} AND status = 'notified'
  `;
}

export async function markFollowupSent(reminder: Reminder, maxFollowups = MAX_FOLLOWUPS): Promise<boolean> {
  if (isMemoryDb()) {
    const nextCount = reminder.followupCount + 1;
    const nextFollowupAt = nextCount >= maxFollowups ? null : nextFollowupIso();
    const updated = memorySet(reminder.id, reminder.chatId, {
      followupCount: nextCount,
      lastFollowupAt: nowUtcIso(),
      nextFollowupAt,
      sendingAt: null
    });
    if (updated) memoryEvent(reminder.id, reminder.chatId, "followup_sent", { followupCount: nextCount, nextFollowupAt });
    if (updated && !nextFollowupAt) memoryEvent(reminder.id, reminder.chatId, "followup_skipped", { reason: "max_followups", maxFollowups });
    return Boolean(updated);
  }
  await migrate();
  const nextCount = reminder.followupCount + 1;
  const nextFollowupAt = nextCount >= maxFollowups ? null : nextFollowupIso();
  const rows = await sql()`
    UPDATE reminders
    SET followup_count = ${nextCount}, last_followup_at = NOW(),
        next_followup_at = ${nextFollowupAt ? requireUtcIso(nextFollowupAt, "nextFollowupAt") : null}::timestamptz,
        sending_at = NULL, updated_at = NOW()
    WHERE id = ${reminder.id} AND status = 'notified'
    RETURNING id
  ` as Array<{ id: number }>;
  if (rows.length) await addEvent(reminder.id, reminder.chatId, "followup_sent", { followupCount: nextCount, nextFollowupAt });
  if (rows.length && !nextFollowupAt) await addEvent(reminder.id, reminder.chatId, "followup_skipped", { reason: "max_followups", maxFollowups });
  return rows.length > 0;
}

export async function clearMaxedFollowups(maxFollowups = MAX_FOLLOWUPS): Promise<number> {
  if (isMemoryDb()) {
    const rows = memoryState.reminders.filter((reminder) => reminder.status === "notified" && reminder.nextFollowupAt && reminder.followupCount >= maxFollowups);
    for (const reminder of rows) {
      memorySet(reminder.id, reminder.chatId, { nextFollowupAt: null });
      memoryEvent(reminder.id, reminder.chatId, "followup_skipped", { reason: "max_followups", maxFollowups });
    }
    return rows.length;
  }
  await migrate();
  const rows = await sql()`
    UPDATE reminders
    SET next_followup_at = NULL, updated_at = NOW()
    WHERE status = 'notified' AND next_followup_at IS NOT NULL AND COALESCE(followup_count, 0) >= ${maxFollowups}
    RETURNING id, chat_id
  ` as Array<{ id: number; chat_id: string }>;
  for (const reminder of rows) await addEvent(reminder.id, reminder.chat_id, "followup_skipped", { reason: "max_followups", maxFollowups });
  return rows.length;
}

export async function rescheduleRecurringReminder(reminder: Reminder): Promise<Reminder> {
  if (!reminder.recurrenceType || !reminder.recurrenceTime) throw new Error(`Reminder ${reminder.id} is not recurring`);
  const nextDueAt = calculateNextDueAt({
    type: reminder.recurrenceType,
    dayOfWeek: reminder.recurrenceDayOfWeek ?? undefined,
    daysOfWeek: reminder.recurrenceDaysOfWeek ?? undefined,
    dayOfMonth: reminder.recurrenceDayOfMonth ?? undefined,
    month: reminder.recurrenceMonth ?? undefined,
    time: reminder.recurrenceTime
  });
  if (isMemoryDb()) {
    const updated = memorySet(reminder.id, reminder.chatId, {
      dueAt: nextDueAt,
      status: "pending",
      sentAt: nowUtcIso(),
      sendingAt: null,
      nextFollowupAt: null
    });
    memoryEvent(reminder.id, reminder.chatId, "sent", { dueAt: reminder.dueAt });
    memoryEvent(reminder.id, reminder.chatId, "rescheduled", { nextDueAt });
    if (!updated) throw new Error(`Reminder ${reminder.id} was not found`);
    return updated;
  }
  await migrate();
  const rows = await sql()`
    UPDATE reminders
    SET due_at = ${requireUtcIso(nextDueAt, "nextDueAt")}::timestamptz, status = 'pending', sent_at = NOW(), sending_at = NULL,
        next_followup_at = NULL, updated_at = NOW()
    WHERE id = ${reminder.id}
    RETURNING *
  ` as ReminderRow[];
  await addEvent(reminder.id, reminder.chatId, "sent", { dueAt: reminder.dueAt });
  await addEvent(reminder.id, reminder.chatId, "rescheduled", { nextDueAt });
  return mapReminder(rows[0]);
}

export async function recoverStaleSendingReminders(cutoffIso?: string): Promise<number> {
  if (isMemoryDb()) {
    const cutoff = cutoffIso ?? nowUtcIso(new Date(Date.now() - 5 * 60_000));
    const rows = memoryState.reminders.filter((reminder) =>
      (reminder.status === "sending" || reminder.status === "notified") && reminder.sendingAt && reminder.sendingAt < cutoff
    );
    for (const reminder of rows) {
      memorySet(reminder.id, reminder.chatId, reminder.status === "sending" ? { status: "pending", sendingAt: null } : { sendingAt: null });
      memoryEvent(reminder.id, reminder.chatId, "send_recovered", { cutoffIso: cutoff });
    }
    return rows.length;
  }
  await migrate();
  const cutoff = cutoffIso ?? new Date(Date.now() - 5 * 60_000).toISOString();
  const dueRows = await sql()`UPDATE reminders SET status = 'pending', sending_at = NULL, updated_at = NOW() WHERE status = 'sending' AND sending_at < ${cutoff} RETURNING id, chat_id` as Array<{ id: number; chat_id: string }>;
  const followupRows = await sql()`UPDATE reminders SET sending_at = NULL, updated_at = NOW() WHERE status = 'notified' AND sending_at < ${cutoff} RETURNING id, chat_id` as Array<{ id: number; chat_id: string }>;
  const rows = [...dueRows, ...followupRows];
  for (const reminder of rows) await addEvent(reminder.id, reminder.chat_id, "send_recovered", { cutoffIso: cutoff });
  return rows.length;
}
