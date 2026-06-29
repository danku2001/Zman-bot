import assert from "node:assert/strict";
import test from "node:test";
import { formatReminderForTelegram, processTelegramUpdate, safeFormatDate } from "./telegram";
import type { Reminder } from "../types";

const baseReminder: Reminder = {
  id: 1,
  chatId: "chat-1",
  task: "בדיקה",
  normalizedTask: "בדיקה",
  category: "כללי",
  priority: "רגיל",
  dueAt: "2026-06-29T10:00:00",
  recurrenceType: null,
  recurrenceDayOfWeek: null,
  recurrenceDaysOfWeek: null,
  recurrenceDayOfMonth: null,
  recurrenceMonth: null,
  recurrenceTime: null,
  status: "notified",
  createdAt: "2026-06-29T09:00:00",
  updatedAt: "2026-06-29T09:00:00",
  sentAt: null,
  sendingAt: null,
  cancelledAt: null,
  completedAt: null,
  lastSnoozedAt: null,
  snoozeCount: 0,
  nextFollowupAt: null,
  followupCount: 0,
  lastFollowupAt: null,
  sourceText: null
};

test("webhook /start does not crash", async () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const previousFetch = global.fetch;
  const sent: unknown[] = [];
  global.fetch = (async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    await processTelegramUpdate({ update_id: 1, message: { message_id: 1, chat: { id: "chat-1" }, text: "/start" } });
  } finally {
    global.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  }

  assert.equal(sent.length, 1);
});

test("reminder without next_followup_at does not crash formatting", () => {
  assert.doesNotThrow(() => formatReminderForTelegram({ ...baseReminder, nextFollowupAt: null }, 0));
});

test("invalid date in reminder formatting does not crash", () => {
  const text = formatReminderForTelegram({ ...baseReminder, dueAt: "not-a-date", createdAt: "also-bad" }, 0);
  assert.match(text, /תאריך לא זמין/u);
  assert.equal(safeFormatDate("not-a-date"), "תאריך לא זמין");
});
