import type { ParsedUserMessage, ParseResult, ParsedReminder, ReminderPriority, Recurrence } from "./types";

const dayNames = new Map<string, number>([
  ["ראשון", 0],
  ["שני", 1],
  ["שלישי", 2],
  ["רביעי", 3],
  ["חמישי", 4],
  ["שישי", 5],
  ["שבת", 6]
]);

const helpfulError =
  "לא הצלחתי להבין את התזכורת. נסו למשל: \"תזכיר לי מחר ב-9 לשלוח מייל\" או \"תזכיר לי עוד 10 דקות לשתות מים\".";
const defaultReminderHour = 9;
const defaultReminderMinute = 0;
const defaultCategory = "כללי";
const categories = ["כללי", "עבודה", "אישי", "בריאות", "כסף", "לימודים", "משפחה", "קניות"];
const priorities: ReminderPriority[] = ["דחוף", "חשוב", "רגיל"];

const hebrewHours = new Map<string, number>([
  ["אחת", 1],
  ["אחד", 1],
  ["שתיים", 2],
  ["שתים", 2],
  ["שניים", 2],
  ["שני", 2],
  ["שלוש", 3],
  ["שלושה", 3],
  ["ארבע", 4],
  ["ארבעה", 4],
  ["חמש", 5],
  ["חמישה", 5],
  ["שש", 6],
  ["שישה", 6],
  ["שבע", 7],
  ["שבעה", 7],
  ["שמונה", 8],
  ["תשע", 9],
  ["תשעה", 9],
  ["עשר", 10],
  ["עשרה", 10],
  ["אחת עשרה", 11],
  ["אחד עשר", 11],
  ["שתיים עשרה", 12],
  ["שתים עשרה", 12],
  ["שניים עשר", 12]
]);

const timePattern =
  "((?:\\d{1,2})(?::\\d{2})?|אחת עשרה|אחד עשר|שתיים עשרה|שתים עשרה|שניים עשר|אחת|אחד|שתיים|שתים|שניים|שני|שלוש|שלושה|ארבע|ארבעה|חמש|חמישה|שש|שישה|שבע|שבעה|שמונה|תשע|תשעה|עשר|עשרה)(?:\\s+(וחצי|ורבע))?(?:\\s+(בבוקר|בצהריים|בצהרים|אחרי הצהריים|אחר הצהריים|בערב|בלילה))?";
const timePrefix = "(?:ב\\s*-?\\s*|בשעה\\s*|שעה\\s*)?";

const monthNames = new Map<string, number>([
  ["ינואר", 0],
  ["פברואר", 1],
  ["מרץ", 2],
  ["אפריל", 3],
  ["מאי", 4],
  ["יוני", 5],
  ["יולי", 6],
  ["אוגוסט", 7],
  ["ספטמבר", 8],
  ["אוקטובר", 9],
  ["נובמבר", 10],
  ["דצמבר", 11]
]);
const monthPattern = Array.from(monthNames.keys()).join("|");

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoLocal(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

export function normalizeHebrewText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[״"׳'`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(?:את|של|לי|ל|ה)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

function addMonths(base: Date, months: number, hour = defaultReminderHour, minute = defaultReminderMinute): Date {
  const target = new Date(base);
  const originalDay = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, lastDay));
  target.setHours(hour, minute, 0, 0);
  return target;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function applyDayPart(hour: number, dayPart?: string): number {
  if (!dayPart) return hour;
  if (dayPart === "בבוקר") return hour === 12 ? 0 : hour;
  if (dayPart === "בלילה") {
    if (hour === 12) return 0;
    return hour >= 6 && hour <= 11 ? hour + 12 : hour;
  }
  if (["בצהריים", "בצהרים", "אחרי הצהריים", "אחר הצהריים", "בערב"].includes(dayPart)) {
    return hour >= 1 && hour <= 11 ? hour + 12 : hour;
  }
  return hour;
}

function parseTime(token: string, minuteText?: string, modifier?: string, dayPart?: string): { hour: number; minute: number } | null {
  const numeric = token.match(/^(\d{1,2})(?::(\d{2}))?$/u);
  const hour = numeric ? Number(numeric[1]) : hebrewHours.get(token);
  const minuteFromToken = numeric?.[2];
  let minute = minuteText ?? minuteFromToken ? Number(minuteText ?? minuteFromToken) : 0;
  if (modifier === "וחצי") minute = 30;
  if (modifier === "ורבע") minute = 15;
  if (typeof hour !== "number") return null;
  const adjustedHour = applyDayPart(hour, dayPart);
  if (
    !Number.isInteger(adjustedHour) ||
    !Number.isInteger(minute) ||
    adjustedHour < 0 ||
    adjustedHour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour: adjustedHour, minute };
}

function buildDate(base: Date, dayOffset: number, hour: number, minute: number): Date {
  const date = startOfDay(base);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function buildCalendarDate(base: Date, day: number, month: number, yearText?: string, hour = defaultReminderHour, minute = defaultReminderMinute): Date | null {
  const year = yearText ? Number(yearText) : base.getFullYear();
  if (!Number.isInteger(day) || !Number.isInteger(year) || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  let date = new Date(year, month, day, hour, minute, 0, 0);
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  if (!yearText && date <= base) {
    date = new Date(year + 1, month, day, hour, minute, 0, 0);
  }
  return date;
}

function nextWeeklyDate(base: Date, dayOfWeek: number, hour: number, minute: number): Date {
  const candidate = buildDate(base, (dayOfWeek - base.getDay() + 7) % 7, hour, minute);
  if (candidate <= base) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

function nextMonthlyDate(base: Date, dayOfMonth: number, hour: number, minute: number): Date {
  let candidate = buildCalendarDate(base, dayOfMonth, base.getMonth(), String(base.getFullYear()), hour, minute);
  if (!candidate || candidate <= base) {
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    candidate = buildCalendarDate(nextMonth, dayOfMonth, nextMonth.getMonth(), String(nextMonth.getFullYear()), hour, minute);
  }
  if (!candidate) {
    const fallback = new Date(base.getFullYear(), base.getMonth() + 1, 0, hour, minute, 0, 0);
    return fallback <= base ? new Date(base.getFullYear(), base.getMonth() + 2, 0, hour, minute, 0, 0) : fallback;
  }
  return candidate;
}

function nextYearlyDate(base: Date, month: number, dayOfMonth: number, hour: number, minute: number): Date {
  let candidate = buildCalendarDate(base, dayOfMonth, month, String(base.getFullYear()), hour, minute);
  if (!candidate || candidate <= base) candidate = buildCalendarDate(base, dayOfMonth, month, String(base.getFullYear() + 1), hour, minute);
  if (!candidate) throw new Error("Invalid yearly recurrence date");
  return candidate;
}

function normalizeTask(task: string): string {
  return task
    .replace(/^[-–—\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^את\s+/, "")
    .replace(/(?:^|\s)תזכירי?\s+לי(?:\s|$)/g, " ")
    .replace(/(?:^|\s)תזכורת(?:\s|$)/g, " ")
    .trim();
}

function extractMetadata(task: string): { task: string; category: string; priority: ReminderPriority } {
  let cleanTask = task.trim();
  let category = defaultCategory;
  const categoryMatch = cleanTask.match(/(?:^|\s)קטגוריה\s+([^\s]+)(?:\s|$)/u);
  if (categoryMatch) {
    category = categories.includes(categoryMatch[1]) ? categoryMatch[1] : categoryMatch[1];
    cleanTask = cleanTask.replace(categoryMatch[0], " ");
  }

  let priority: ReminderPriority = "רגיל";
  for (const candidate of priorities) {
    const pattern = new RegExp(`(?:^|\\s)${candidate}(?:\\s|$)`, "u");
    if (pattern.test(cleanTask)) {
      priority = candidate;
      cleanTask = cleanTask.replace(pattern, " ");
      break;
    }
  }

  return { task: normalizeTask(cleanTask), category, priority };
}

function cleanPrefix(text: string): string {
  return text
    .trim()
    .replace(/^תזכירי?\s+לי\s+/, "")
    .replace(/^תזכורת\s+/, "")
    .trim();
}

function parseFlexibleTime(text: string): { hour: number; minute: number } | null {
  const match = text.trim().match(new RegExp(`^${timePrefix}${timePattern}$`, "u"));
  if (!match) return null;
  return parseTime(match[1], undefined, match[2], match[3]);
}

function stripReminderWords(text: string): string {
  return normalizeTask(text.replace(/תזכירי?\s+לי/g, " ").replace(/תזכורת/g, " "));
}

function success(value: ParsedReminder): ParseResult {
  const meta = extractMetadata(value.task);
  return { ok: true, value: { ...value, task: meta.task, category: value.category ?? meta.category, priority: value.priority ?? meta.priority } };
}

export function parseReminderMessage(message: string, now = new Date()): ParseResult {
  const text = cleanPrefix(message);

  const relativeMatch = text.match(/^עוד\s+(?:(\d+)|דקה|שעה|שעתיים)\s*(דקות?|שעות?)?\s+(.+)$/u);
  if (relativeMatch) {
    const [, amountText, unitText, rawTask] = relativeMatch;
    let minutes = 0;
    if (text.startsWith("עוד דקה")) minutes = 1;
    else if (text.startsWith("עוד שעה")) minutes = 60;
    else if (text.startsWith("עוד שעתיים")) minutes = 120;
    else {
      const amount = Number(amountText);
      const unit = unitText ?? "דקות";
      minutes = unit.startsWith("שע") ? amount * 60 : amount;
    }

    const task = normalizeTask(rawTask);
    if (!task || minutes <= 0) return { ok: false, error: helpfulError };
    return success({ task, dueAt: toIsoLocal(addMinutes(now, minutes)), recurrence: null, sourceText: message });
  }

  const relativeCalendarMatch = text.match(
    new RegExp(
      `(?:^|\\s)(?:בעוד|לעוד|עוד)\\s+(חודשיים|חודש|שנתיים|שנה|(\\d+)\\s+(חודשים|חודש|שנים|שנה))(?:\\s+${timePrefix}${timePattern})?(?:\\s|$)`,
      "u"
    )
  );
  if (relativeCalendarMatch) {
    const expression = relativeCalendarMatch[0];
    const amount = relativeCalendarMatch[1] === "חודשיים" || relativeCalendarMatch[1] === "שנתיים" ? 2 : relativeCalendarMatch[1] === "חודש" || relativeCalendarMatch[1] === "שנה" ? 1 : Number(relativeCalendarMatch[2]);
    const unit = relativeCalendarMatch[1].includes("שנ") || relativeCalendarMatch[3]?.includes("שנ") ? "years" : "months";
    const months = unit === "years" ? amount * 12 : amount;
    const parsedTime = relativeCalendarMatch[4]
      ? parseTime(relativeCalendarMatch[4], undefined, relativeCalendarMatch[5], relativeCalendarMatch[6])
      : { hour: defaultReminderHour, minute: defaultReminderMinute };
    const task = normalizeTask(text.replace(expression, " "));
    if (!task || !parsedTime || !Number.isInteger(months) || months <= 0) return { ok: false, error: helpfulError };
    return success({ task, dueAt: toIsoLocal(addMonths(now, months, parsedTime.hour, parsedTime.minute)), recurrence: null });
  }

  const dailyMatch = text.match(new RegExp(`^כל\\s+יום\\s+${timePrefix}${timePattern}\\s+(.+)$`, "u"));
  if (dailyMatch) {
    const parsed = parseTime(dailyMatch[1], undefined, dailyMatch[2], dailyMatch[3]);
    const task = normalizeTask(dailyMatch[4]);
    if (!parsed || !task) return { ok: false, error: helpfulError };
    let due = buildDate(now, 0, parsed.hour, parsed.minute);
    if (due <= now) due = buildDate(now, 1, parsed.hour, parsed.minute);
    const recurrence: Recurrence = { type: "daily", time: `${pad(parsed.hour)}:${pad(parsed.minute)}` };
    return success({ task, dueAt: toIsoLocal(due), recurrence, sourceText: message });
  }

  const weeklyRecurringMatch = text.match(
    new RegExp(`^כל\\s+יום\\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\\s+${timePrefix}${timePattern}\\s+(.+)$`, "u")
  );
  if (weeklyRecurringMatch) {
    const dayOfWeek = dayNames.get(weeklyRecurringMatch[1]);
    const parsed = parseTime(weeklyRecurringMatch[2], undefined, weeklyRecurringMatch[3], weeklyRecurringMatch[4]);
    const task = normalizeTask(weeklyRecurringMatch[5]);
    if (dayOfWeek === undefined || !parsed || !task) return { ok: false, error: helpfulError };
    const recurrence: Recurrence = { type: "weekly", dayOfWeek, time: `${pad(parsed.hour)}:${pad(parsed.minute)}` };
    return success({ task, dueAt: toIsoLocal(nextWeeklyDate(now, dayOfWeek, parsed.hour, parsed.minute)), recurrence, sourceText: message });
  }

  const monthlyMatch = text.match(new RegExp(`^כל\\s+חודש\\s+(?:ב-?|ב)?\\s*(\\d{1,2})(?:\\s+לחודש)?(?:\\s+${timePrefix}${timePattern})?\\s+(.+)$`, "u"));
  if (monthlyMatch) {
    const dayOfMonth = Number(monthlyMatch[1]);
    const parsed = monthlyMatch[2]
      ? parseTime(monthlyMatch[2], undefined, monthlyMatch[3], monthlyMatch[4])
      : { hour: defaultReminderHour, minute: defaultReminderMinute };
    const task = normalizeTask(monthlyMatch[5]);
    if (!parsed || !task || dayOfMonth < 1 || dayOfMonth > 31) return { ok: false, error: helpfulError };
    const recurrence: Recurrence = { type: "monthly", dayOfMonth, time: `${pad(parsed.hour)}:${pad(parsed.minute)}` };
    return success({ task, dueAt: toIsoLocal(nextMonthlyDate(now, dayOfMonth, parsed.hour, parsed.minute)), recurrence, sourceText: message });
  }

  const yearlyMatch = text.match(
    new RegExp(`^כל\\s+שנה\\s+(?:ב-?|ב)?\\s*(\\d{1,2})(?:\\s*(?:ל|ב)\\s*|\\s+)(${monthPattern})(?:\\s+${timePrefix}${timePattern})?\\s*(.*)$`, "u")
  );
  if (yearlyMatch) {
    const dayOfMonth = Number(yearlyMatch[1]);
    const month = monthNames.get(yearlyMatch[2]);
    const parsed = yearlyMatch[3]
      ? parseTime(yearlyMatch[3], undefined, yearlyMatch[4], yearlyMatch[5])
      : { hour: defaultReminderHour, minute: defaultReminderMinute };
    const task = normalizeTask(yearlyMatch[6] || `תזכורת שנתית ${dayOfMonth} ${yearlyMatch[2]}`);
    if (!parsed || month === undefined || !task) return { ok: false, error: helpfulError };
    const recurrence: Recurrence = { type: "yearly", dayOfMonth, month, time: `${pad(parsed.hour)}:${pad(parsed.minute)}` };
    return success({ task, dueAt: toIsoLocal(nextYearlyDate(now, month, dayOfMonth, parsed.hour, parsed.minute)), recurrence, sourceText: message });
  }

  const customWeekdaysMatch = text.match(
    new RegExp(`^בכל\\s+(.+?)\\s+${timePrefix}${timePattern}\\s+(.+)$`, "u")
  );
  if (customWeekdaysMatch) {
    const days = Array.from(dayNames.entries())
      .filter(([name]) => customWeekdaysMatch[1].includes(name))
      .map(([, day]) => day);
    const parsed = parseTime(customWeekdaysMatch[2], undefined, customWeekdaysMatch[3], customWeekdaysMatch[4]);
    const task = normalizeTask(customWeekdaysMatch[5]);
    if (!parsed || days.length === 0 || !task) return { ok: false, error: helpfulError };
    const next = days.map((day) => nextWeeklyDate(now, day, parsed.hour, parsed.minute)).sort((a, b) => a.getTime() - b.getTime())[0];
    const recurrence: Recurrence = { type: "custom_weekdays", daysOfWeek: days, time: `${pad(parsed.hour)}:${pad(parsed.minute)}` };
    return success({ task, dueAt: toIsoLocal(next), recurrence, sourceText: message });
  }

  const dayMatch = text.match(
    new RegExp(`^(היום|מחר|ביום\\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת))\\s+${timePrefix}${timePattern}\\s+(.+)$`, "u")
  );
  if (dayMatch) {
    const [, dayText, dayName, hourText, modifier, dayPart, rawTask] = dayMatch;
    const parsed = parseTime(hourText, undefined, modifier, dayPart);
    const task = normalizeTask(rawTask);
    if (!parsed || !task) return { ok: false, error: helpfulError };

    let due: Date;
    if (dayText === "היום") {
      due = buildDate(now, 0, parsed.hour, parsed.minute);
      if (due <= now) due = buildDate(now, 1, parsed.hour, parsed.minute);
    } else if (dayText === "מחר") {
      due = buildDate(now, 1, parsed.hour, parsed.minute);
    } else {
      const dayOfWeek = dayNames.get(dayName);
      if (dayOfWeek === undefined) return { ok: false, error: helpfulError };
      due = nextWeeklyDate(now, dayOfWeek, parsed.hour, parsed.minute);
    }
    return success({ task, dueAt: toIsoLocal(due), recurrence: null, sourceText: message });
  }

  const numericDateMatch = text.match(
    new RegExp(`(?:^|\\s)(?:בתאריך\\s+|ב\\s*-?\\s*)?(\\d{1,2})[./-](\\d{1,2})(?:[./-](\\d{2,4}))?(?:\\s+${timePrefix}${timePattern})?(?:\\s|$)`, "u")
  );
  if (numericDateMatch?.index !== undefined) {
    const [expression, dayText, monthText, yearText, hourText, modifier, dayPart] = numericDateMatch;
    const year = yearText && yearText.length === 2 ? `20${yearText}` : yearText;
    const parsedTime = hourText ? parseTime(hourText, undefined, modifier, dayPart) : { hour: defaultReminderHour, minute: defaultReminderMinute };
    if (!parsedTime) return { ok: false, error: helpfulError };
    const due = buildCalendarDate(now, Number(dayText), Number(monthText) - 1, year, parsedTime.hour, parsedTime.minute);
    const task = normalizeTask(text.replace(expression, " "));
    if (!due || !task) return { ok: false, error: helpfulError };
    return success({ task, dueAt: toIsoLocal(due), recurrence: null, sourceText: message });
  }

  const calendarDateMatch = text.match(
    new RegExp(
      `(?:^|\\s)(?:בתאריך\\s+|ב\\s*-?\\s*)?(\\d{1,2})(?:\\s*(?:ל|ב)\\s*|\\s+)(${monthPattern})(?:\\s+(\\d{4}))?(?:\\s+${timePrefix}${timePattern})?(?:\\s|$)`,
      "u"
    )
  );
  if (calendarDateMatch?.index !== undefined) {
    const [expression, dayText, monthText, yearText, hourText, modifier, dayPart] = calendarDateMatch;
    const month = monthNames.get(monthText);
    const parsedTime = hourText ? parseTime(hourText, undefined, modifier, dayPart) : { hour: defaultReminderHour, minute: defaultReminderMinute };
    if (month === undefined || !parsedTime) return { ok: false, error: helpfulError };
    const due = buildCalendarDate(now, Number(dayText), month, yearText, parsedTime.hour, parsedTime.minute);
    const task = normalizeTask(text.replace(expression, " "));
    if (!due || !task) return { ok: false, error: helpfulError };
    return success({ task, dueAt: toIsoLocal(due), recurrence: null, sourceText: message });
  }

  const naturalOrderPatterns = [
    new RegExp(`^(היום|מחר)\\s+${timePrefix}${timePattern}\\s+תזכירי?\\s+לי\\s+(.+)$`, "u"),
    new RegExp(`^(.+?)\\s+(היום|מחר)\\s+${timePrefix}${timePattern}$`, "u")
  ];
  for (const pattern of naturalOrderPatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    if (match[1] === "היום" || match[1] === "מחר") {
      return parseReminderMessage(`תזכיר לי ${match[1]} ${match[2]} ${match[5]}`, now);
    }
    return parseReminderMessage(`תזכיר לי ${match[2]} ${match[3]} ${match[1]}`, now);
  }

  return { ok: false, error: helpfulError };
}

export function calculateNextDueAt(recurrence: Recurrence, from = new Date()): string {
  const [hourText, minuteText] = recurrence.time.split(":");
  const parsed = parseTime(hourText, minuteText);
  if (!parsed) throw new Error(`Invalid recurrence time: ${recurrence.time}`);

  if (recurrence.type === "daily") {
    let next = buildDate(from, 0, parsed.hour, parsed.minute);
    if (next <= from) next = buildDate(from, 1, parsed.hour, parsed.minute);
    return toIsoLocal(next);
  }

  if (recurrence.type === "weekly") {
    if (typeof recurrence.dayOfWeek !== "number") throw new Error("Weekly recurrence is missing dayOfWeek");
    return toIsoLocal(nextWeeklyDate(from, recurrence.dayOfWeek, parsed.hour, parsed.minute));
  }

  if (recurrence.type === "custom_weekdays") {
    if (!recurrence.daysOfWeek?.length) throw new Error("Custom weekday recurrence is missing daysOfWeek");
    const next = recurrence.daysOfWeek
      .map((day) => nextWeeklyDate(from, day, parsed.hour, parsed.minute))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return toIsoLocal(next);
  }

  if (recurrence.type === "monthly") {
    if (!recurrence.dayOfMonth) throw new Error("Monthly recurrence is missing dayOfMonth");
    return toIsoLocal(nextMonthlyDate(from, recurrence.dayOfMonth, parsed.hour, parsed.minute));
  }

  if (recurrence.type === "yearly") {
    if (!recurrence.dayOfMonth || typeof recurrence.month !== "number") throw new Error("Yearly recurrence is missing date");
    return toIsoLocal(nextYearlyDate(from, recurrence.month, recurrence.dayOfMonth, parsed.hour, parsed.minute));
  }

  throw new Error(`Unsupported recurrence type: ${recurrence.type}`);
}

export function parseUserMessage(message: string, now = new Date()): ParsedUserMessage {
  const raw = message.trim();
  const text = cleanPrefix(raw);
  const normalized = normalizeHebrewText(raw);

  if (/^(\/?help|עזרה|מה אפשר לעשות)/u.test(raw)) return { intent: "help", confidence: 1 };
  if (/^(בוקר טוב|תן לי סיכום יומי)/u.test(normalized)) return { intent: "morning", confidence: 0.95 };
  if (/מה\s+כל\s+התזכורות|כל\s+התזכורות|תראה\s+לי\s+.*תזכורות|איזה\s+תזכורות/u.test(normalized)) {
    return { intent: "list", confidence: 0.95 };
  }
  if (/מה\s+יש\s+לי\s+היום|תזכורות\s+היום/u.test(normalized)) return { intent: "morning", confidence: 0.95 };
  if (/מה\s+יש\s+לי\s+מחר|תזכורות\s+מחר/u.test(normalized)) return { intent: "tomorrow", confidence: 0.95 };
  if (/סכם\s+לי\s+את\s+השבוע/u.test(normalized)) return { intent: "week_summary", confidence: 0.95 };
  if (/מה\s+יש\s+לי\s+השבוע|תזכורות\s+השבוע/u.test(normalized)) return { intent: "week_summary", confidence: 0.95 };
  if (/מה\s+באיחור|איזה\s+תזכורות\s+פספסתי|תזכורות\s+באיחור/u.test(normalized)) return { intent: "overdue", confidence: 0.95 };
  if (/תזכורות\s+קבועות|קבועות\s+שלי/u.test(normalized)) return { intent: "recurring", confidence: 0.95 };

  const searchMatch = raw.match(/(?:חפש|חפשי|מצא|מצאי)\s+תזכורות\s+(?:על|של|ל)?\s*(.+)$/u);
  if (searchMatch) return { intent: "search", query: searchMatch[1].trim(), confidence: 0.9 };

  const bulkDone = normalized.includes("מחק כל התזכורות שבוצעו") || normalized.includes("נקה תזכורות שבוצעו");
  if (bulkDone) return { intent: "delete", targetText: "__done__", confidence: 0.9 };

  const cancelToday = normalized.includes("בטל כל התזכורות של היום") || normalized.includes("מחק כל התזכורות של היום");
  if (cancelToday) return { intent: "delete", targetText: "__today__", confidence: 0.9 };
  const cancelAll = normalized.includes("בטל כל התזכורות") || normalized.includes("מחק כל התזכורות");
  if (cancelAll) return { intent: "delete", targetText: "__all__", confidence: 0.9 };

  const deleteIdMatch = raw.match(/(?:בטל|מחק).{0,12}#?(\d+)/u);
  if (deleteIdMatch) return { intent: "delete", targetId: Number(deleteIdMatch[1]), confidence: 0.95 };

  const doneIdMatch = raw.match(/(?:בוצע|כבוצעה|סמן).{0,12}#?(\d+)/u);
  if (doneIdMatch) return { intent: "done", targetId: Number(doneIdMatch[1]), confidence: 0.95 };

  const snoozeIdMatch = raw.match(/(?:דחה|תדחה).{0,12}#?(\d+)\s+(.+)$/u);
  if (snoozeIdMatch) {
    const parsed = parseReminderMessage(`תזכיר לי ${snoozeIdMatch[2]} זמני`, now);
    return {
      intent: "snooze",
      targetId: Number(snoozeIdMatch[1]),
      snoozeUntil: parsed.ok ? parsed.value.dueAt : undefined,
      confidence: parsed.ok ? 0.9 : 0.5,
      error: parsed.ok ? undefined : parsed.error
    };
  }

  const deleteTextMatch = raw.match(/(?:בטל|מחק)\s+(?:את\s+)?(?:התזכורת\s+)?(.+)$/u);
  if (deleteTextMatch) return { intent: "delete", targetText: stripReminderWords(deleteTextMatch[1]), confidence: 0.85 };

  const doneTextMatch = raw.match(/(?:סמן\s+(?:כבוצע|כבוצעה)\s+(?:את\s+)?|סיימתי\s+את\s+)(.+)$/u);
  if (doneTextMatch) return { intent: "done", targetText: stripReminderWords(doneTextMatch[1]), confidence: 0.85 };

  const snoozeTextMatch = raw.match(/(?:דחה|תדחה)\s+(?:את\s+)?(?:התזכורת\s+)?(?:של|ל)?\s*(.+?)\s+(?:ל|ב|בעוד|עוד)\s+(.+)$/u);
  if (snoozeTextMatch) {
    const parsed = parseReminderMessage(`תזכיר לי ${snoozeTextMatch[2]} זמני`, now);
    return {
      intent: "snooze",
      targetText: stripReminderWords(snoozeTextMatch[1]),
      snoozeUntil: parsed.ok ? parsed.value.dueAt : undefined,
      confidence: parsed.ok ? 0.8 : 0.45,
      error: parsed.ok ? undefined : parsed.error
    };
  }

  const parsed = parseReminderMessage(raw, now);
  if (parsed.ok) return { intent: "create", ...parsed.value, confidence: 0.9 };

  if (text.includes("תזכיר") || text.includes("קבעתי") || text.includes("פגישה")) {
    return { intent: "unknown", confidence: 0.2, error: parsed.error };
  }
  if (raw.length >= 3 && !raw.startsWith("/")) {
    const meta = extractMetadata(raw);
    return { intent: "quick_capture", task: meta.task, category: meta.category, priority: meta.priority, confidence: 0.65 };
  }
  return { intent: "unknown", confidence: 0.1, error: parsed.error };
}
