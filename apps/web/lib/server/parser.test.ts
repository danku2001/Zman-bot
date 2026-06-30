import assert from "node:assert/strict";
import test from "node:test";
import { parseReminderMessage, parseUserMessage } from "./parser";
import { formatUtcIsoForIsrael } from "./time";
import { datetimeLocalFromUtcIso, utcIsoFromIsraelDatetimeLocal } from "../date";

const base = new Date(2026, 5, 29, 10, 0, 0, 0);

function dueAt(message: string): string {
  const parsed = parseReminderMessage(message, base);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value.dueAt;
}

test("parses Hebrew number words in relative time", () => {
  assert.equal(dueAt("תזכיר לי עוד חמש דקות לבדוק"), "2026-06-29T07:05:00.000Z");
  assert.equal(dueAt("תזכיר לי בעוד חמש דקות לבדוק"), "2026-06-29T07:05:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד שלוש שעות לבדוק"), "2026-06-29T10:00:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד יומיים לבדוק"), "2026-07-01T07:00:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד שבועיים לבדוק"), "2026-07-13T07:00:00.000Z");
});

test("parses required relative time expressions", () => {
  assert.equal(dueAt("תזכיר לי עוד 10 שניות לבדוק"), "2026-06-29T07:00:10.000Z");
  assert.equal(dueAt("תזכיר לי עוד עשר שניות לבדוק"), "2026-06-29T07:00:10.000Z");
  assert.equal(dueAt("תזכיר לי בעוד 10 שניות לבדוק"), "2026-06-29T07:00:10.000Z");
  assert.equal(dueAt("תזכיר לי בעוד עשר שניות לבדוק"), "2026-06-29T07:00:10.000Z");
  assert.equal(dueAt("תזכיר לי עוד דקה לבדוק"), "2026-06-29T07:01:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד 5 דקות לבדוק"), "2026-06-29T07:05:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד חצי שעה לבדוק"), "2026-06-29T07:30:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד רבע שעה לבדוק"), "2026-06-29T07:15:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד שעה לבדוק"), "2026-06-29T08:00:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד שעתיים לבדוק"), "2026-06-29T09:00:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד יום לבדוק"), "2026-06-30T07:00:00.000Z");
  assert.equal(dueAt("תזכיר לי עוד יומיים לבדוק"), "2026-07-01T07:00:00.000Z");
});

test("parses today tomorrow and day-after-tomorrow expressions", () => {
  assert.equal(dueAt("תזכיר לי מחר לבדוק"), "2026-06-30T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי מחר בבוקר לבדוק"), "2026-06-30T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי מחר ב-9 לבדוק"), "2026-06-30T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי מחר בשמונה וחצי לבדוק"), "2026-06-30T05:30:00.000Z");
  assert.equal(dueAt("תזכיר לי מחרתיים לבדוק"), "2026-07-01T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי מחרתיים ב-10 לבדוק"), "2026-07-01T07:00:00.000Z");
  assert.equal(dueAt("תזכיר לי אחרי מחר לבדוק"), "2026-07-01T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי היום ב-18:00 לבדוק"), "2026-06-29T15:00:00.000Z");
  assert.equal(dueAt("תזכיר לי היום בשש בערב לבדוק"), "2026-06-29T15:00:00.000Z");
});

test("parses weekday expressions", () => {
  assert.equal(dueAt("תזכיר לי ראשון הבא ב-10 לבדוק"), "2026-07-05T07:00:00.000Z");
  assert.equal(dueAt("תזכיר לי ביום שני ב-14:30 לבדוק"), "2026-06-29T11:30:00.000Z");
});

test("parses absolute dates", () => {
  assert.equal(dueAt("תזכיר לי ב-1/7 לבדוק"), "2026-07-01T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי ב-01.07.2026 לבדוק"), "2026-07-01T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי ב-1 ביולי לבדוק"), "2026-07-01T06:00:00.000Z");
  assert.equal(dueAt("תזכיר לי ב-15 באוגוסט ב-18:00 לבדוק"), "2026-08-15T15:00:00.000Z");
});

test("parses recurring reminders", () => {
  const daily = parseReminderMessage("תזכיר לי כל יום ב-8 לבדוק", base);
  assert.equal(daily.ok, true);
  if (daily.ok) {
    assert.equal(daily.value.dueAt, "2026-06-30T05:00:00.000Z");
    assert.equal(daily.value.recurrence?.type, "daily");
    assert.equal(daily.value.recurrence?.time, "08:00");
  }

  const weekly = parseReminderMessage("תזכיר לי כל שבוע ביום ראשון ב-10 לבדוק", base);
  assert.equal(weekly.ok, true);
  if (weekly.ok) {
    assert.equal(weekly.value.dueAt, "2026-07-05T07:00:00.000Z");
    assert.equal(weekly.value.recurrence?.type, "weekly");
    assert.equal(weekly.value.recurrence?.dayOfWeek, 0);
  }
});

test("Hebrew number relative reminder is a create intent", () => {
  const parsed = parseUserMessage("תזכיר לי עוד חמש דקות לבדוק", base);
  assert.equal(parsed.intent, "create");
  assert.equal(parsed.dueAt, "2026-06-29T07:05:00.000Z");
  assert.equal(parsed.task, "לבדוק");
});

test("relative reminders use Israel time on UTC server runtimes", () => {
  assert.equal(process.env.TZ, "Asia/Jerusalem");
  const israelFourPmAsUtcInstant = new Date(Date.UTC(2026, 5, 30, 13, 0, 0, 0));
  const parsed = parseUserMessage("תזכיר לי עוד חמש דקות לבדוק", israelFourPmAsUtcInstant);
  assert.equal(parsed.intent, "create");
  assert.equal(parsed.dueAt, "2026-06-30T13:05:00.000Z");
  assert.equal(formatUtcIsoForIsrael(parsed.dueAt), "2026-06-30T16:05:00");
});

test("Telegram-created today at 18:00 stores UTC and displays as 18:00 Israel", () => {
  const israelFourPmAsUtcInstant = new Date(Date.UTC(2026, 5, 30, 13, 0, 0, 0));
  const parsed = parseUserMessage("תזכיר לי היום ב-18:00 לבדוק משהו", israelFourPmAsUtcInstant);
  assert.equal(parsed.intent, "create");
  assert.equal(parsed.dueAt, "2026-06-30T15:00:00.000Z");
  assert.equal(formatUtcIsoForIsrael(parsed.dueAt), "2026-06-30T18:00:00");
});

test("dashboard datetime-local 18:00 saves and displays as 18:00 Israel", () => {
  const utcIso = utcIsoFromIsraelDatetimeLocal("2026-06-30T18:00");
  assert.equal(utcIso, "2026-06-30T15:00:00.000Z");
  assert.equal(datetimeLocalFromUtcIso(utcIso), "2026-06-30T18:00");
});
