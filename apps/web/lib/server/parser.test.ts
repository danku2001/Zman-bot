import assert from "node:assert/strict";
import test from "node:test";
import { parseReminderMessage, parseUserMessage } from "./parser";

const base = new Date(2026, 5, 29, 10, 0, 0, 0);

function dueAt(message: string): string {
  const parsed = parseReminderMessage(message, base);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value.dueAt;
}

test("parses Hebrew number words in relative time", () => {
  assert.equal(dueAt("תזכיר לי עוד חמש דקות לבדוק"), "2026-06-29T10:05:00");
  assert.equal(dueAt("תזכיר לי בעוד חמש דקות לבדוק"), "2026-06-29T10:05:00");
  assert.equal(dueAt("תזכיר לי עוד שלוש שעות לבדוק"), "2026-06-29T13:00:00");
  assert.equal(dueAt("תזכיר לי עוד יומיים לבדוק"), "2026-07-01T10:00:00");
  assert.equal(dueAt("תזכיר לי עוד שבועיים לבדוק"), "2026-07-13T10:00:00");
});

test("Hebrew number relative reminder is a create intent", () => {
  const parsed = parseUserMessage("תזכיר לי עוד חמש דקות לבדוק", base);
  assert.equal(parsed.intent, "create");
  assert.equal(parsed.dueAt, "2026-06-29T10:05:00");
  assert.equal(parsed.task, "לבדוק");
});

test("relative reminders use Israel time on UTC server runtimes", () => {
  assert.equal(process.env.TZ, "Asia/Jerusalem");
  const israelFourPmAsUtcInstant = new Date(Date.UTC(2026, 5, 30, 13, 0, 0, 0));
  const parsed = parseUserMessage("תזכיר לי עוד חמש דקות לבדוק", israelFourPmAsUtcInstant);
  assert.equal(parsed.intent, "create");
  assert.equal(parsed.dueAt, "2026-06-30T16:05:00");
});
