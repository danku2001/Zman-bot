import cors from "cors";
import express from "express";
import {
  cancelReminder,
  createReminder,
  deleteReminder,
  getRecurringRemindersByChatId,
  getOverdueRemindersByChatId,
  getReminderEventsByChatId,
  getRemindersByChatId,
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
import type { ParsedReminder } from "./types";

export function createApiApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const getChatId = (req: express.Request): string | null => {
    const value = req.query.chat_id ?? req.body?.chat_id;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "zmanbot" });
  });

  app.get("/api/stats", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ stats: getStatsByChatId(chatId) });
  });

  app.get("/api/events", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ events: getReminderEventsByChatId(chatId, 20) });
  });

  app.get("/api/reminders", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const recurring = typeof req.query.recurring === "string" ? req.query.recurring : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const priority = typeof req.query.priority === "string" ? req.query.priority : "";
    let reminders = getRemindersByChatId(chatId);
    if (status) reminders = reminders.filter((reminder) => reminder.status === status);
    if (recurring === "true") reminders = reminders.filter((reminder) => reminder.recurrenceType);
    if (recurring === "false") reminders = reminders.filter((reminder) => !reminder.recurrenceType);
    if (category) reminders = reminders.filter((reminder) => reminder.category === category);
    if (priority) reminders = reminders.filter((reminder) => reminder.priority === priority);
    res.json({ reminders });
  });

  app.get("/api/reminders/today", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ reminders: getTodayRemindersByChatId(chatId) });
  });

  app.get("/api/reminders/tomorrow", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ reminders: getTomorrowRemindersByChatId(chatId) });
  });

  app.get("/api/reminders/week", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ reminders: getWeekRemindersByChatId(chatId) });
  });

  app.get("/api/reminders/recurring", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ reminders: getRecurringRemindersByChatId(chatId) });
  });

  app.get("/api/reminders/overdue", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ reminders: getOverdueRemindersByChatId(chatId) });
  });

  app.get("/api/reminders/search", (req, res) => {
    const chatId = getChatId(req);
    const query = typeof req.query.q === "string" ? req.query.q : "";
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ reminders: searchRemindersByChatId(chatId, query) });
  });

  app.post("/api/reminders/parse", (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message : "";
    res.json({ result: parseUserMessage(message) });
  });

  app.post("/api/reminders", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });

    const message = typeof req.body?.message === "string" ? req.body.message : "";
    const manual = req.body?.task && req.body?.due_at
      ? ({
          task: String(req.body.task),
          dueAt: String(req.body.due_at),
          recurrence: req.body.recurrence ?? null,
          sourceText: message || null,
          category: typeof req.body.category === "string" ? req.body.category : undefined,
          priority: req.body.priority
        } satisfies ParsedReminder)
      : null;

    const parsed = manual ? { ok: true as const, value: manual } : parseReminderMessage(message);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    res.status(201).json({ reminder: createReminder(chatId, parsed.value) });
  });

  app.patch("/api/reminders/:id/done", (req, res) => {
    const chatId = getChatId(req);
    const id = Number(req.params.id);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid reminder id" });
    const ok = markReminderDone(chatId, id);
    res.status(ok ? 200 : 404).json({ ok });
  });

  app.patch("/api/reminders/:id/cancel", (req, res) => {
    const chatId = getChatId(req);
    const id = Number(req.params.id);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid reminder id" });
    const ok = cancelReminder(chatId, id);
    res.status(ok ? 200 : 404).json({ ok });
  });

  app.patch("/api/reminders/:id/snooze", (req, res) => {
    const chatId = getChatId(req);
    const id = Number(req.params.id);
    const snoozeUntil = typeof req.body?.snooze_until === "string" ? req.body.snooze_until : "";
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    if (!Number.isInteger(id) || !snoozeUntil) return res.status(400).json({ error: "Invalid snooze request" });
    const reminder = snoozeReminder(chatId, id, snoozeUntil);
    res.status(reminder ? 200 : 404).json({ reminder });
  });

  app.patch("/api/reminders/:id", (req, res) => {
    const chatId = getChatId(req);
    const id = Number(req.params.id);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid reminder id" });
    const reminder = updateReminder(chatId, id, {
      task: typeof req.body?.task === "string" ? req.body.task : undefined,
      dueAt: typeof req.body?.due_at === "string" ? req.body.due_at : undefined,
      status: req.body?.status,
      category: typeof req.body?.category === "string" ? req.body.category : undefined,
      priority: req.body?.priority
    });
    res.status(reminder ? 200 : 404).json({ reminder });
  });

  app.delete("/api/reminders/:id", (req, res) => {
    const chatId = getChatId(req);
    const id = Number(req.params.id);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid reminder id" });
    const ok = deleteReminder(chatId, id);
    res.status(ok ? 200 : 404).json({ ok });
  });

  app.get("/api/export", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    res.json({ exportedAt: new Date().toISOString(), reminders: getRemindersByChatId(chatId), events: getReminderEventsByChatId(chatId, 500) });
  });

  app.post("/api/import", (req, res) => {
    const chatId = getChatId(req);
    if (!chatId) return res.status(400).json({ error: "chat_id is required" });
    const reminders = Array.isArray(req.body?.reminders) ? req.body.reminders : [];
    const result = importReminders(chatId, reminders);
    res.status(201).json({ importedCount: result.imported.length, errors: result.errors, reminders: result.imported });
  });

  return app;
}
