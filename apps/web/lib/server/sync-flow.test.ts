import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreate, handleGetReminders, handleReminderAction } from "./api";
import { resetMemoryDb } from "./db";
import { runSchedulerOnce } from "./scheduler";
import { processTelegramUpdate } from "./telegram";

const chatId = "sync-chat-1";

function apiRequest(path: string, body?: unknown): NextRequest {
  return new NextRequest(`https://zmanbot.test${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer test-api-secret", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

test("sync flow keeps Telegram, dashboard API, database, and scheduler in one source of truth", async () => {
  process.env.ZMANBOT_TEST_DB = "memory";
  process.env.API_SECRET = "test-api-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
  process.env.CRON_SECRET = "test-cron-secret";
  resetMemoryDb();

  const previousFetch = global.fetch;
  const telegramMessages: Array<{ chat_id: string; text: string; reply_markup?: unknown }> = [];
  global.fetch = (async (_url, init) => {
    telegramMessages.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ ok: true, result: { message_id: telegramMessages.length } }), { status: 200 });
  }) as typeof fetch;

  try {
    await processTelegramUpdate({
      update_id: 1,
      message: { message_id: 1, chat: { id: chatId }, text: "תזכיר לי עוד חמש דקות בדיקת סינק מטלגרם" }
    });

    const afterTelegramCreate = await json<{ reminders: Array<{ id: number; task: string; chatId: string; status: string }> }>(
      await handleGetReminders(apiRequest(`/api/reminders?chat_id=${chatId}`))
    );
    const telegramReminder = afterTelegramCreate.reminders.find((reminder) => reminder.task === "בדיקת סינק מטלגרם");
    assert.ok(telegramReminder, "Telegram-created reminder must appear through dashboard reminders API");
    assert.equal(telegramReminder.chatId, chatId);
    assert.equal(telegramReminder.status, "pending");

    const dashboardCreate = await json<{ reminder: { id: number; task: string; chatId: string; status: string } }>(
      await handleCreate(apiRequest("/api/reminders", {
        chat_id: chatId,
        task: "בדיקת סינק מהדשבורד",
        due_at: "2026-06-30T00:00:00"
      }))
    );
    assert.equal(dashboardCreate.reminder.chatId, chatId);
    assert.equal(dashboardCreate.reminder.status, "pending");

    const schedulerResult = await runSchedulerOnce(5);
    assert.equal(schedulerResult.failed, 0);
    assert.equal(schedulerResult.sent >= 1, true);
    assert.equal(telegramMessages.some((message) => message.chat_id === chatId && message.text.includes("בדיקת סינק מהדשבורד")), true);

    await processTelegramUpdate({
      update_id: 2,
      callback_query: {
        id: "callback-done-1",
        data: `done:${dashboardCreate.reminder.id}`,
        message: { message_id: 2, chat: { id: chatId } }
      }
    });
    const afterTelegramDone = await json<{ reminders: Array<{ id: number; status: string }> }>(
      await handleGetReminders(apiRequest(`/api/reminders?chat_id=${chatId}`))
    );
    assert.equal(afterTelegramDone.reminders.find((reminder) => reminder.id === dashboardCreate.reminder.id)?.status, "done");

    const dashboardDone = await handleReminderAction(
      apiRequest(`/api/reminders/${telegramReminder.id}/done`, { chat_id: chatId }),
      { id: String(telegramReminder.id) },
      "done"
    );
    assert.equal(dashboardDone.status, 200);

    await processTelegramUpdate({
      update_id: 3,
      message: { message_id: 3, chat: { id: chatId }, text: "/completed" }
    });
    const completedReply = telegramMessages.at(-1)?.text ?? "";
    assert.match(completedReply, /בדיקת סינק מטלגרם/u);
    assert.match(completedReply, /בדיקת סינק מהדשבורד/u);

    const finalDashboard = await json<{ reminders: Array<{ id: number; status: string }> }>(
      await handleGetReminders(apiRequest(`/api/reminders?chat_id=${chatId}`))
    );
    assert.equal(finalDashboard.reminders.find((reminder) => reminder.id === telegramReminder.id)?.status, "done");
  } finally {
    global.fetch = previousFetch;
    delete process.env.ZMANBOT_TEST_DB;
  }
});

test("scheduler treats Telegram ok:false as a failed send", async () => {
  process.env.ZMANBOT_TEST_DB = "memory";
  process.env.API_SECRET = "test-api-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
  resetMemoryDb();

  const previousFetch = global.fetch;
  global.fetch = (async () => {
    return new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 200 });
  }) as typeof fetch;

  try {
    await handleCreate(apiRequest("/api/reminders", {
      chat_id: chatId,
      task: "בדיקת כשל שליחה",
      due_at: "2026-06-30T00:00:00"
    }));

    const schedulerResult = await runSchedulerOnce(1);

    assert.equal(schedulerResult.sent, 0);
    assert.equal(schedulerResult.failed, 1);
    assert.match(schedulerResult.failureReasons[0] ?? "", /chat not found/u);
  } finally {
    global.fetch = previousFetch;
    delete process.env.ZMANBOT_TEST_DB;
  }
});

test("scheduler sends due reminders, skips future reminders, and prevents duplicate sends", async () => {
  process.env.ZMANBOT_TEST_DB = "memory";
  process.env.API_SECRET = "test-api-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
  resetMemoryDb();

  const previousFetch = global.fetch;
  const telegramMessages: Array<{ chat_id: string; text: string }> = [];
  global.fetch = (async (_url, init) => {
    telegramMessages.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ ok: true, result: { message_id: telegramMessages.length } }), { status: 200 });
  }) as typeof fetch;

  try {
    await handleCreate(apiRequest("/api/reminders", {
      chat_id: chatId,
      task: "תזכורת שעברה",
      due_at: "2026-06-30T00:00:00"
    }));
    await handleCreate(apiRequest("/api/reminders", {
      chat_id: chatId,
      task: "תזכורת עתידית",
      due_at: "2999-06-30T00:00:00"
    }));

    const firstRun = await runSchedulerOnce(10);
    const secondRun = await runSchedulerOnce(10);

    assert.equal(firstRun.dueCountBefore, 1);
    assert.equal(firstRun.sent, 1);
    assert.equal(firstRun.failed, 0);
    assert.equal(secondRun.sent, 0);
    assert.equal(telegramMessages.filter((message) => message.text.includes("תזכורת שעברה")).length, 1);
    assert.equal(telegramMessages.some((message) => message.text.includes("תזכורת עתידית")), false);
  } finally {
    global.fetch = previousFetch;
    delete process.env.ZMANBOT_TEST_DB;
  }
});
