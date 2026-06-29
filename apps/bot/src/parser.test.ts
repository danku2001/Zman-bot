import assert from "node:assert/strict";
import test from "node:test";
import { calculateNextDueAt, parseReminderMessage, parseUserMessage } from "./parser";

process.env.TZ = "Asia/Jerusalem";

const base = new Date(2026, 5, 29, 10, 0, 0, 0);

function parsed(message: string) {
  const result = parseReminderMessage(message, base);
  if (!result.ok) throw new Error(`${message}: ${result.error}`);
  return result.value;
}

test("parses relative reminders", () => {
  assert.equal(parsed("תזכיר לי עוד דקה לבדוק").dueAt, "2026-06-29T10:01:00");
  assert.equal(parsed("תזכיר לי עוד 5 דקות לשתות מים").dueAt, "2026-06-29T10:05:00");
  assert.equal(parsed("תזכיר לי עוד חמש דקות לבדוק").dueAt, "2026-06-29T10:05:00");
  assert.equal(parsed("תזכיר לי בעוד חמש דקות לבדוק").dueAt, "2026-06-29T10:05:00");
  assert.equal(parsed("תזכיר לי בעוד רבע שעה לצאת").dueAt, "2026-06-29T10:15:00");
  assert.equal(parsed("תזכיר לי בעוד חצי שעה להתקשר").dueAt, "2026-06-29T10:30:00");
  assert.equal(parsed("תזכיר לי עוד 10 דקות לשתות מים").dueAt, "2026-06-29T10:10:00");
  assert.equal(parsed("תזכיר לי עוד שעה להתקשר לאמא").dueAt, "2026-06-29T11:00:00");
  assert.equal(parsed("תזכיר לי עוד שלוש שעות לבדוק").dueAt, "2026-06-29T13:00:00");
  assert.equal(parsed("תזכיר לי עוד שעתיים לחזור ללקוח").dueAt, "2026-06-29T12:00:00");
  assert.equal(parsed("תזכיר לי עוד יום לבדוק משהו").dueAt, "2026-06-30T10:00:00");
  assert.equal(parsed("תזכיר לי עוד יומיים לבדוק משהו").dueAt, "2026-07-01T10:00:00");
  assert.equal(parsed("תזכיר לי עוד שבוע להתקשר").dueAt, "2026-07-06T10:00:00");
  assert.equal(parsed("תזכיר לי עוד שבועיים להתקשר").dueAt, "2026-07-13T10:00:00");
});

test("parses numeric absolute reminders", () => {
  const reminder = parsed("תזכיר לי מחר בשעה 09:30 לשלוח מייל");
  assert.equal(reminder.dueAt, "2026-06-30T09:30:00");
  assert.equal(reminder.task, "לשלוח מייל");
});

test("parses Hebrew word hours with day parts", () => {
  assert.equal(parsed("תזכיר לי היום בערב ללכת לאימון").dueAt, "2026-06-29T20:00:00");
  assert.equal(parsed("תזכיר לי מחר בבוקר לסדר תיק").dueAt, "2026-06-30T09:00:00");
  assert.equal(parsed("תזכיר לי מחר בצהריים לבדוק דוחות").dueAt, "2026-06-30T14:00:00");
  assert.equal(parsed("תזכיר לי מחר בערב להתקשר לדני").dueAt, "2026-06-30T20:00:00");
  assert.equal(parsed("תזכיר לי מחר בשעה שתיים בצהריים לעשות ככה ככה וככה").dueAt, "2026-06-30T14:00:00");
  assert.equal(parsed("תזכיר לי מחר בשעה שתיים בצהריים לעשות ככה ככה וככה").task, "לעשות ככה ככה וככה");
  assert.equal(parsed("תזכיר לי היום בשעה שמונה בערב ללכת לאימון").dueAt, "2026-06-29T20:00:00");
  assert.equal(parsed("תזכיר לי מחר בשעה תשע בבוקר לשלוח מייל").dueAt, "2026-06-30T09:00:00");
  assert.equal(parsed("תזכיר לי מחר בשעה שתיים וחצי בצהריים פגישה").dueAt, "2026-06-30T14:30:00");
  assert.equal(parsed("שני הבא ב-14:00 פגישה").dueAt, "2026-07-06T14:00:00");
});

test("parses flexible numeric time writing styles", () => {
  assert.equal(parsed("תזכיר לי מחר ב2 בצהריים לעשות משהו").dueAt, "2026-06-30T14:00:00");
  assert.equal(parsed("תזכיר לי מחר ב 2 בצהריים לעשות משהו").dueAt, "2026-06-30T14:00:00");
  assert.equal(parsed("תזכיר לי מחר 2 בצהריים לעשות משהו").dueAt, "2026-06-30T14:00:00");
  assert.equal(parsed("תזכיר לי מחר ב-2 בצהריים לעשות משהו").dueAt, "2026-06-30T14:00:00");
  assert.equal(parsed("תזכיר לי מחר 14:00 בצהריים לעשות משהו").dueAt, "2026-06-30T14:00:00");
  assert.equal(parsed("תזכיר לי מחר ב2 בלילה לעשות משהו").dueAt, "2026-06-30T02:00:00");
  assert.equal(parsed("תזכיר לי מחר ב10 בלילה לעשות משהו").dueAt, "2026-06-30T22:00:00");
  assert.equal(parsed("תזכיר לי מחר ב12 בלילה לעשות משהו").dueAt, "2026-06-30T00:00:00");
  assert.equal(parsed("תזכיר לי מחר ב2 לעשות משהו").dueAt, "2026-06-30T02:00:00");
});

test("parses calendar dates up to a year ahead", () => {
  const birthday = parsed("ב11 למאי תזכיר לי לשלוח מזל טוב לדני");
  assert.equal(birthday.dueAt, "2027-05-11T09:00:00");
  assert.equal(birthday.task, "לשלוח מזל טוב לדני");

  assert.equal(parsed("תזכיר לי לשלוח מזל טוב לדני ב11 למאי").dueAt, "2027-05-11T09:00:00");
  assert.equal(parsed("תזכיר לי בתאריך 11 לאוגוסט ב2 בצהריים להתקשר לרופא").dueAt, "2026-08-11T14:00:00");
  assert.equal(parsed("תזכיר לי 11 לדצמבר 2027 בשעה שמונה בערב אירוע").dueAt, "2027-12-11T20:00:00");
  assert.equal(parsed("תזכיר לי ב-11 למאי לשלוח מזל טוב").dueAt, "2027-05-11T09:00:00");
  assert.equal(parsed("תזכיר לי 11/5 לשלוח מזל טוב").dueAt, "2027-05-11T09:00:00");
  assert.equal(parsed("תזכיר לי בתאריך 11.8 ב2 בצהריים להתקשר לרופא").dueAt, "2026-08-11T14:00:00");
  assert.equal(parsed("תזכיר לי 11/12/27 בשמונה בערב אירוע").dueAt, "2027-12-11T20:00:00");
});

test("parses long relative calendar reminders", () => {
  const meeting = parsed("קבעתי פגישה לעוד חודשיים עם רוני תזכיר לי");
  assert.equal(meeting.dueAt, "2026-08-29T09:00:00");
  assert.equal(meeting.task, "קבעתי פגישה עם רוני");

  assert.equal(parsed("תזכיר לי עוד חודש לבדוק ביטוח").dueAt, "2026-07-29T09:00:00");
  assert.equal(parsed("תזכיר לי עוד חודשיים ב2 בצהריים לבדוק משהו").dueAt, "2026-08-29T14:00:00");
  assert.equal(parsed("תזכיר לי בעוד 3 חודשים לחדש מנוי").dueAt, "2026-09-29T09:00:00");
  assert.equal(parsed("תזכיר לי בעוד שנה לבדוק דרכון").dueAt, "2027-06-29T09:00:00");
});

test("parses recurring reminders with natural time", () => {
  const dailyShort = parsed("תזכיר לי כל יום ב-8 לשתות מים");
  assert.deepEqual(dailyShort.recurrence, { type: "daily", time: "08:00" });

  const daily = parsed("תזכיר לי כל יום בשעה שמונה בבוקר לקחת תיק");
  assert.deepEqual(daily.recurrence, { type: "daily", time: "08:00" });

  const morning = parsed("תזכיר לי כל בוקר לשתות מים");
  assert.deepEqual(morning.recurrence, { type: "daily", time: "09:00" });

  const evening = parsed("תזכיר לי כל ערב לבדוק מיילים");
  assert.deepEqual(evening.recurrence, { type: "daily", time: "20:00" });

  const weekly = parsed("תזכיר לי כל יום ראשון בשעה תשע בבוקר ישיבת צוות");
  assert.deepEqual(weekly.recurrence, { type: "weekly", dayOfWeek: 0, time: "09:00" });

  const weeklyEveryWeek = parsed("תזכיר לי כל שבוע ביום ראשון ב-9 לבדוק דוחות");
  assert.deepEqual(weeklyEveryWeek.recurrence, { type: "weekly", dayOfWeek: 0, time: "09:00" });

  const flexibleWeekly = parsed("תזכיר לי כל יום ראשון 9 בבוקר ישיבת צוות");
  assert.deepEqual(flexibleWeekly.recurrence, { type: "weekly", dayOfWeek: 0, time: "09:00" });

  const monthly = parsed("תזכיר לי כל חודש ב-1 לחודש ב-10 לשלם שכירות");
  assert.deepEqual(monthly.recurrence, { type: "monthly", dayOfMonth: 1, time: "10:00" });

  const yearly = parsed("תזכיר לי כל שנה ב-1 בינואר לשלוח ברכה");
  assert.deepEqual(yearly.recurrence, { type: "yearly", dayOfMonth: 1, month: 0, time: "09:00" });

  const custom = parsed("תזכיר לי בכל ראשון ורביעי ב-18:00 לרוץ");
  assert.deepEqual(custom.recurrence, { type: "custom_weekdays", daysOfWeek: [0, 3], time: "18:00" });
});

test("calculates next recurrence", () => {
  assert.equal(calculateNextDueAt({ type: "daily", time: "08:00" }, base), "2026-06-30T08:00:00");
  assert.equal(calculateNextDueAt({ type: "weekly", dayOfWeek: 0, time: "09:00" }, base), "2026-07-05T09:00:00");
  assert.equal(calculateNextDueAt({ type: "monthly", dayOfMonth: 1, time: "10:00" }, base), "2026-07-01T10:00:00");
  assert.equal(calculateNextDueAt({ type: "yearly", dayOfMonth: 1, month: 0, time: "09:00" }, base), "2027-01-01T09:00:00");
});

test("parses conversational intents", () => {
  assert.equal(parseUserMessage("מה כל התזכורות שלי?").intent, "list");
  assert.equal(parseUserMessage("מה יש לי השבוע?").intent, "week_summary");
  assert.equal(parseUserMessage("סכם לי את השבוע").intent, "week_summary");
  assert.equal(parseUserMessage("בוקר טוב").intent, "morning");
  assert.equal(parseUserMessage("מה באיחור?").intent, "overdue");
  assert.equal(parseUserMessage("מה התזכורות הקבועות שלי?").intent, "recurring");
  assert.deepEqual(
    { intent: parseUserMessage("בטל את התזכורת להתקשר לאמא").intent, targetText: parseUserMessage("בטל את התזכורת להתקשר לאמא").targetText },
    { intent: "delete", targetText: "להתקשר לאמא" }
  );
  assert.equal(parseUserMessage("חפש תזכורות על חשבונית").intent, "search");
});

test("extracts categories, priorities, and quick capture", () => {
  const categorized = parsed("תזכיר לי מחר ב-9 לשלוח מייל קטגוריה עבודה חשוב");
  assert.equal(categorized.category, "עבודה");
  assert.equal(categorized.priority, "חשוב");
  assert.equal(categorized.task, "לשלוח מייל");

  const urgent = parsed("תזכיר לי עוד שעה לשלוח חוזה דחוף");
  assert.equal(urgent.priority, "דחוף");

  const quick = parseUserMessage("לשלוח חשבונית");
  assert.equal(quick.intent, "quick_capture");
  assert.equal(quick.task, "לשלוח חשבונית");
});

test("detects far future reminders for confirmation scenarios", () => {
  const passport = parseUserMessage("תזכיר לי בעוד שנה לחדש דרכון", base);
  assert.equal(passport.intent, "create");
  assert.equal(passport.dueAt, "2027-06-29T09:00:00");
});
