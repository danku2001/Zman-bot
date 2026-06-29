import { NextRequest, NextResponse } from "next/server";
import { dashboardCookieName, isValidDashboardCookie } from "./auth";
import {
  cancelReminder,
  createReminder,
  deleteReminder,
  getOverdueRemindersByChatId,
  getRecurringRemindersByChatId,
  getReminderEventsByChatId,
  getKnownChats,
  getRemindersByChatId,
  getSyncDebugByChatId,
  getStatsByChatId,
  getTodayRemindersByChatId,
  getTomorrowRemindersByChatId,
  getWeekRemindersByChatId,
  importReminders,
  markReminderDone,
  searchRemindersByChatId,
  snoozeReminder,
  updateReminder
} from "./db";
import { parseReminderMessage, parseUserMessage } from "./parser";
import type { ParsedReminder, Recurrence, ReminderPriority } from "./types";

type Params = Record<string, string | string[] | undefined>;

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function assertApiAccess(req: NextRequest): NextResponse | null {
  if (process.env.API_SECRET && req.headers.get("authorization") === `Bearer ${process.env.API_SECRET}`) return null;
  if (isValidDashboardCookie(req.cookies.get(dashboardCookieName)?.value)) return null;
  if (!process.env.API_SECRET && !process.env.DASHBOARD_PASSWORD) return null;
  return json({ error: "Unauthorized" }, 401);
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  return await req.json().catch(() => ({}));
}

function chatIdFrom(req: NextRequest, body?: Record<string, unknown>): string | null {
  const value = req.nextUrl.searchParams.get("chat_id") ?? body?.chat_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function handleGetReminders(req: NextRequest, mode?: "today" | "tomorrow" | "week" | "overdue" | "recurring" | "search"): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const chatId = chatIdFrom(req);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  if (mode === "today") return json({ reminders: await getTodayRemindersByChatId(chatId) });
  if (mode === "tomorrow") return json({ reminders: await getTomorrowRemindersByChatId(chatId) });
  if (mode === "week") return json({ reminders: await getWeekRemindersByChatId(chatId) });
  if (mode === "overdue") return json({ reminders: await getOverdueRemindersByChatId(chatId) });
  if (mode === "recurring") return json({ reminders: await getRecurringRemindersByChatId(chatId) });
  if (mode === "search") return json({ reminders: await searchRemindersByChatId(chatId, req.nextUrl.searchParams.get("q") ?? "") });
  let reminders = await getRemindersByChatId(chatId);
  const status = req.nextUrl.searchParams.get("status");
  const recurring = req.nextUrl.searchParams.get("recurring");
  const category = req.nextUrl.searchParams.get("category");
  const priority = req.nextUrl.searchParams.get("priority");
  if (status) reminders = reminders.filter((reminder) => reminder.status === status);
  if (recurring === "true") reminders = reminders.filter((reminder) => reminder.recurrenceType);
  if (recurring === "false") reminders = reminders.filter((reminder) => !reminder.recurrenceType);
  if (category) reminders = reminders.filter((reminder) => reminder.category === category);
  if (priority) reminders = reminders.filter((reminder) => reminder.priority === priority);
  return json({ reminders });
}

export async function handleStats(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const chatId = chatIdFrom(req);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  return json({ stats: await getStatsByChatId(chatId) });
}

export async function handleEvents(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const chatId = chatIdFrom(req);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  return json({ events: await getReminderEventsByChatId(chatId, 20) });
}

export async function handleParse(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const body = await readBody(req);
  return json({ result: parseUserMessage(typeof body.message === "string" ? body.message : "") });
}

export async function handleCreate(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const body = await readBody(req);
  const chatId = chatIdFrom(req, body);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  const message = typeof body.message === "string" ? body.message : "";
  const manual = body.task && body.due_at
    ? ({
        task: String(body.task),
        dueAt: String(body.due_at),
        recurrence: (body.recurrence as Recurrence | null | undefined) ?? null,
        sourceText: message || undefined,
        category: typeof body.category === "string" ? body.category : undefined,
        priority: body.priority as ReminderPriority | undefined
      } satisfies ParsedReminder)
    : null;
  const parsed = manual ? { ok: true as const, value: manual } : parseReminderMessage(message);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  return json({ reminder: await createReminder(chatId, parsed.value) }, 201);
}

export async function handleReminderAction(req: NextRequest, params: Params, action: "done" | "cancel" | "snooze" | "update" | "delete"): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const body = action === "delete" ? {} : await readBody(req);
  const chatId = chatIdFrom(req, body);
  const id = Number(params.id);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  if (!Number.isInteger(id)) return json({ error: "Invalid reminder id" }, 400);
  if (action === "done") {
    const ok = await markReminderDone(chatId, id);
    return json({ ok }, ok ? 200 : 404);
  }
  if (action === "cancel" || action === "delete") {
    const ok = action === "delete" ? await deleteReminder(chatId, id) : await cancelReminder(chatId, id);
    return json({ ok }, ok ? 200 : 404);
  }
  if (action === "snooze") {
    const snoozeUntil = typeof body.snooze_until === "string" ? body.snooze_until : "";
    if (!snoozeUntil) return json({ error: "Invalid snooze request" }, 400);
    const reminder = await snoozeReminder(chatId, id, snoozeUntil);
    return json({ reminder }, reminder ? 200 : 404);
  }
  const reminder = await updateReminder(chatId, id, {
    task: typeof body.task === "string" ? body.task : undefined,
    dueAt: typeof body.due_at === "string" ? body.due_at : undefined,
    status: typeof body.status === "string" ? body.status as never : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    priority: typeof body.priority === "string" ? body.priority as never : undefined
  });
  return json({ reminder }, reminder ? 200 : 404);
}

export async function handleExport(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const chatId = chatIdFrom(req);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  return json({ exportedAt: new Date().toISOString(), reminders: await getRemindersByChatId(chatId), events: await getReminderEventsByChatId(chatId, 500) });
}

export async function handleImport(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const body = await readBody(req);
  const chatId = chatIdFrom(req, body);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  const reminders = Array.isArray(body.reminders) ? body.reminders : [];
  const result = await importReminders(chatId, reminders);
  return json({ importedCount: result.imported.length, errors: result.errors, reminders: result.imported }, 201);
}

export async function handleSyncDebug(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  const chatId = chatIdFrom(req);
  if (!chatId) return json({ error: "chat_id is required" }, 400);
  return json(await getSyncDebugByChatId(chatId));
}

export async function handleKnownChats(req: NextRequest): Promise<NextResponse> {
  const blocked = assertApiAccess(req);
  if (blocked) return blocked;
  return json({ chats: await getKnownChats() });
}
