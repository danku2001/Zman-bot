import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.TZ = "Asia/Jerusalem";
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "zmanbot-db-test-")), "reminders.db");

const dbModule = require("./db") as typeof import("./db");
const {
  claimReminderForSending,
  createReminder,
  db,
  getReminderEventsByChatId,
  getOverdueRemindersByChatId,
  getReminderById,
  markReminderDone,
  markReminderNotifiedAfterSend,
  recoverStaleSendingReminders,
  rescheduleRecurringReminder,
  snoozeReminder
} = dbModule;

function createTestReminder(overrides: Partial<Parameters<typeof createReminder>[1]> = {}) {
  return createReminder("test-chat", {
    task: "בדיקת אמינות",
    dueAt: "2026-06-29T10:00:00",
    recurrence: null,
    ...overrides
  });
}

test("one-time reminder becomes notified after send", () => {
  const reminder = createTestReminder();
  assert.equal(claimReminderForSending(reminder.id), true);

  assert.equal(markReminderNotifiedAfterSend(reminder), true);

  const updated = getReminderById(reminder.id);
  assert.equal(updated?.status, "notified");
  assert.equal(updated?.sendingAt, null);
  assert.ok(updated?.sentAt);
});

test("done changes notified reminder to done", () => {
  const reminder = createTestReminder({ task: "לסמן כבוצע" });
  assert.equal(claimReminderForSending(reminder.id), true);
  assert.equal(markReminderNotifiedAfterSend(reminder), true);

  assert.equal(markReminderDone("test-chat", reminder.id), true);

  const updated = getReminderById(reminder.id);
  assert.equal(updated?.status, "done");
  assert.equal(updated?.sendingAt, null);
  assert.ok(updated?.completedAt);
});

test("snooze changes notified reminder to pending with a new due_at", () => {
  const reminder = createTestReminder({ task: "לדחות אחרי שליחה" });
  assert.equal(claimReminderForSending(reminder.id), true);
  assert.equal(markReminderNotifiedAfterSend(reminder), true);

  const snoozed = snoozeReminder("test-chat", reminder.id, "2026-06-29T11:00:00");

  assert.equal(snoozed?.status, "pending");
  assert.equal(snoozed?.dueAt, "2026-06-29T11:00:00");
  assert.equal(snoozed?.sendingAt, null);
  assert.equal(snoozed?.snoozeCount, 1);
});

test("stale sending reminder recovers to pending", () => {
  const reminder = createTestReminder({ task: "התאוששות משליחה תקועה" });
  assert.equal(claimReminderForSending(reminder.id), true);
  db.prepare("UPDATE reminders SET sending_at = ? WHERE id = ?").run("2026-06-29T09:50:00.000Z", reminder.id);

  assert.equal(recoverStaleSendingReminders("2026-06-29T09:55:00.000Z"), 1);

  const updated = getReminderById(reminder.id);
  assert.equal(updated?.status, "pending");
  assert.equal(updated?.sendingAt, null);
  assert.equal(getReminderEventsByChatId("test-chat").some((event) => event.eventType === "send_recovered" && event.reminderId === reminder.id), true);
});

test("recurring reminder still reschedules correctly", () => {
  const reminder = createTestReminder({
    task: "תזכורת קבועה",
    recurrence: { type: "daily", time: "08:00" }
  });
  assert.equal(claimReminderForSending(reminder.id), true);

  const rescheduled = rescheduleRecurringReminder(reminder);

  assert.equal(rescheduled.status, "pending");
  assert.equal(rescheduled.sendingAt, null);
  assert.notEqual(rescheduled.dueAt, reminder.dueAt);
  assert.ok(rescheduled.sentAt);
});

test("notified reminders are not overdue after they were already sent", () => {
  const reminder = createTestReminder({ task: "נשלחה אבל לא בוצעה", dueAt: "2026-06-29T09:00:00" });
  assert.equal(claimReminderForSending(reminder.id), true);
  assert.equal(markReminderNotifiedAfterSend(reminder), true);

  const overdue = getOverdueRemindersByChatId("test-chat", "2026-06-29T12:00:00");

  assert.equal(overdue.some((item) => item.id === reminder.id), false);
});
