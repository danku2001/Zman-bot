import { Markup, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { config } from "./config";
import {
  cancelReminder,
  cancelTodayRemindersByChatId,
  clearDoneRemindersByChatId,
  createReminder,
  deferReminderFollowup,
  findMatchingReminders,
  getCompletedTodayRemindersByChatId,
  getOverdueRemindersByChatId,
  getRecurringRemindersByChatId,
  getRemindersByChatId,
  getStatsByChatId,
  getTodayRemindersByChatId,
  getTomorrowRemindersByChatId,
  getWeekRemindersByChatId,
  markReminderDone,
  searchRemindersByChatId,
  snoozeReminder
} from "./db";
import { logger } from "./logger";
import { parseReminderMessage, parseUserMessage } from "./parser";
import type { BotIntent, Reminder, Recurrence } from "./types";

export const bot = new Telegraf(config.telegramBotToken || "missing-token");
type ReplyFn = (text: string, extra?: object) => Promise<unknown>;
const pendingQuickCapture = new Map<string, { task: string; category?: string; priority?: "רגיל" | "חשוב" | "דחוף" }>();
const pendingCreateConfirmations = new Map<string, { task: string; dueAt: string; recurrence: Recurrence | null; category?: "כללי" | string; priority?: "רגיל" | "חשוב" | "דחוף"; sourceText?: string }>();
const pendingBulkConfirmations = new Map<string, { action: "clear_done" | "cancel_today" | "cancel_all" }>();

function replyFor(ctx: Context): ReplyFn {
  return (text, extra) => ctx.reply(text, extra);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "תאריך לא זמין";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "תאריך לא זמין";
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: config.timezone
  }).format(date);
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "שעה לא זמינה";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "שעה לא זמינה";
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: config.timezone }).format(date);
}

function priorityLabel(reminder: Reminder): string {
  if (reminder.priority === "דחוף") return " 🔥 דחוף";
  if (reminder.priority === "חשוב") return " ⭐ חשוב";
  return "";
}

function recurrenceLabel(reminder: Reminder): string {
  if (!reminder.recurrenceType) return "";
  if (reminder.recurrenceType === "daily") return " 🔁 יומי";
  if (reminder.recurrenceType === "weekly") return " 🔁 שבועי";
  if (reminder.recurrenceType === "monthly") return " 🔁 חודשי";
  if (reminder.recurrenceType === "yearly") return " 🔁 שנתי";
  return " 🔁 קבוע";
}

function statusLabel(reminder: Reminder): string {
  if (reminder.status === "pending") return "פתוחה";
  if (reminder.status === "sending") return "בשליחה";
  if (reminder.status === "notified") return "ממתין לאישור ביצוע";
  if (reminder.status === "done") return "בוצעה";
  return "בוטלה";
}

function formatReminder(reminder: Reminder, index?: number): string {
  const prefix = typeof index === "number" ? `${index + 1}. ` : "";
  return `${prefix}#${reminder.id} ${formatDate(reminder.dueAt)} - ${reminder.task} · ${reminder.category}${priorityLabel(reminder)}${recurrenceLabel(reminder)} · ${statusLabel(reminder)}`;
}

function reminderKeyboard(reminders: Reminder[]) {
  const reminderRows = reminders
    .filter((reminder) => reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified")
    .slice(0, 8)
    .flatMap((reminder) => [
      [
        Markup.button.callback(`✅ בוצע #${reminder.id}`, `done:${reminder.id}`),
        Markup.button.callback(`🕒 דחה #${reminder.id}`, `snooze_menu:${reminder.id}`),
        Markup.button.callback(`🗑️ בטל #${reminder.id}`, `cancel:${reminder.id}`)
      ],
      [Markup.button.callback(`✏️ ערוך #${reminder.id}`, `edit:${reminder.id}`)]
    ]);

  return Markup.inlineKeyboard([
    ...reminderRows,
    [
      Markup.button.callback("היום", "view:today"),
      Markup.button.callback("השבוע", "view:week"),
      Markup.button.callback("קבועות", "view:recurring"),
      Markup.button.callback("באיחור", "view:overdue"),
      Markup.button.callback("הכל", "view:list")
    ]
  ]);
}

function snoozeKeyboard(id: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("עוד 10 דקות", `snooze:${id}:10m`), Markup.button.callback("עוד שעה", `snooze:${id}:1h`)],
    [Markup.button.callback("מחר בבוקר", `snooze:${id}:tomorrow_morning`), Markup.button.callback("מחר ב-9", `snooze:${id}:tomorrow_9`)],
    [Markup.button.callback("שבוע הבא", `snooze:${id}:next_week`)]
  ]);
}

function snoozeDateFromPreset(preset: string): string {
  const now = new Date();
  if (preset === "10m") return localIso(new Date(now.getTime() + 10 * 60_000));
  if (preset === "1h") return localIso(new Date(now.getTime() + 60 * 60_000));
  if (preset === "tomorrow_morning") return localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0));
  if (preset === "tomorrow_9") return localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0));
  return localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 9, 0, 0));
}

function localIso(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function isFarFuture(dueAt: string, now = new Date()): boolean {
  const due = new Date(dueAt);
  const sixMonths = new Date(now);
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  return due > sixMonths;
}

function afterCreateKeyboard(id: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("הצג את כל התזכורות", "view:list"), Markup.button.callback("הוסף עוד תזכורת", "quick:add")],
    [Markup.button.callback("🕒 דחה", `snooze_menu:${id}`), Markup.button.callback("🗑️ בטל", `cancel:${id}`)]
  ]);
}

function sentReminderKeyboard(id: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ ביצעתי", `done:${id}`), Markup.button.callback("🕒 דחה", `snooze_menu:${id}`)],
    [Markup.button.callback("❌ לא עכשיו", `not_now:${id}`), Markup.button.callback("🗑️ בטל", `cancel:${id}`)]
  ]);
}

export { sentReminderKeyboard };

function groupByDay(reminders: Reminder[]): Map<string, Reminder[]> {
  const formatter = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "numeric", timeZone: config.timezone });
  const groups = new Map<string, Reminder[]>();
  for (const reminder of reminders) {
    const date = new Date(reminder.dueAt);
    const key = Number.isFinite(date.getTime()) ? formatter.format(date) : "ללא תאריך תקין";
    groups.set(key, [...(groups.get(key) ?? []), reminder]);
  }
  return groups;
}

function dailyDigest(chatId: string): { text: string; reminders: Reminder[] } {
  const today = getTodayRemindersByChatId(chatId).filter((reminder) => reminder.status !== "cancelled");
  const overdue = getOverdueRemindersByChatId(chatId);
  const completed = getCompletedTodayRemindersByChatId(chatId);
  const todayLines = today.length ? today.map((reminder, index) => `${index + 1}. ${formatTime(reminder.dueAt)} - ${reminder.task} (${reminder.category})${priorityLabel(reminder)}`).join("\n") : "אין תזכורות להיום.";
  const overdueLines = overdue.length ? `\n\nבאיחור:\n${overdue.map((reminder, index) => `${index + 1}. ${formatDate(reminder.dueAt)} - ${reminder.task}`).join("\n")}` : "";
  const completedLine = completed.length ? `\n\nכבר בוצעו היום: ${completed.length}` : "";
  return {
    text: `בוקר טוב ☀️\nהיום יש לך ${today.length} תזכורות:\n\n${todayLines}${overdueLines}${completedLine}\n\nשיהיה יום מסודר 💪`,
    reminders: [...today, ...overdue]
  };
}

function weeklyDigest(chatId: string): { text: string; reminders: Reminder[] } {
  const week = getWeekRemindersByChatId(chatId).filter((reminder) => reminder.status !== "cancelled");
  const recurring = getRecurringRemindersByChatId(chatId).filter((reminder) => reminder.status === "pending");
  const groups = groupByDay(week);
  const sections = Array.from(groups.entries()).map(([day, reminders]) => `${day}:\n${reminders.map((reminder) => `* ${formatTime(reminder.dueAt)} - ${reminder.task}`).join("\n")}`);
  const recurringSection = recurring.length ? `\n\nקבועות:\n${recurring.slice(0, 8).map((reminder) => `* ${reminder.recurrenceTime ?? ""} - ${reminder.task}`).join("\n")}` : "";
  return {
    text: `השבוע שלך:\n\n${sections.length ? sections.join("\n\n") : "אין תזכורות לשבוע הקרוב."}${recurringSection}`,
    reminders: [...week, ...recurring]
  };
}

async function sendReminderList(chatId: string, reply: ReplyFn, title: string, reminders: Reminder[]) {
  if (!reminders.length) {
    await reply(`${title}\nאין תזכורות להצגה.`);
    return;
  }
  const open = reminders.filter((reminder) => reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified");
  const lines = reminders.slice(0, 12).map(formatReminder).join("\n");
  await reply(`${title}\nיש לך ${open.length} תזכורות פתוחות:\n\n${lines}\n\nאפשר לבטל לפי מספר או טקסט. למשל: בטל את #2`, reminderKeyboard(reminders));
}

async function handleTargetAction(
  chatId: string,
  targetId: number | undefined,
  targetText: string | undefined,
  action: "delete" | "done",
  reply: ReplyFn
) {
  if (targetText === "__done__") {
    pendingBulkConfirmations.set(chatId, { action: "clear_done" });
    await reply("למחוק את כל התזכורות שבוצעו?", Markup.inlineKeyboard([[Markup.button.callback("כן, בטל", "confirm_bulk:yes"), Markup.button.callback("לא", "confirm_bulk:no")]]));
    return;
  }
  if (targetText === "__today__") {
    pendingBulkConfirmations.set(chatId, { action: "cancel_today" });
    await reply("לבטל את כל התזכורות של היום?", Markup.inlineKeyboard([[Markup.button.callback("כן, בטל", "confirm_bulk:yes"), Markup.button.callback("לא", "confirm_bulk:no")]]));
    return;
  }
  if (targetText === "__all__") {
    pendingBulkConfirmations.set(chatId, { action: "cancel_all" });
    await reply("לבטל את כל התזכורות הפתוחות?", Markup.inlineKeyboard([[Markup.button.callback("כן, בטל", "confirm_bulk:yes"), Markup.button.callback("לא", "confirm_bulk:no")]]));
    return;
  }
  if (targetId) {
    const ok = action === "delete" ? cancelReminder(chatId, targetId) : markReminderDone(chatId, targetId);
    await reply(ok ? (action === "delete" ? "ביטלתי ✅" : "סימנתי כבוצע ✅") : "לא מצאתי תזכורת מתאימה.");
    return;
  }
  if (!targetText) {
    await reply("לא הבנתי איזו תזכורת לעדכן. אפשר לכתוב /list כדי לראות את כולן.");
    return;
  }
  const matches = findMatchingReminders(chatId, targetText);
  if (matches.length === 0) {
    await reply("לא מצאתי תזכורת שמתאימה לזה. אפשר לכתוב /list כדי לראות את כל התזכורות.");
    return;
  }
  if (matches.length === 1) {
    const reminder = matches[0];
    const ok = action === "delete" ? cancelReminder(chatId, reminder.id) : markReminderDone(chatId, reminder.id);
    await reply(ok ? (action === "delete" ? `ביטלתי ✅\n${reminder.task}` : `סימנתי כבוצע ✅\n${reminder.task}`) : "לא הצלחתי לעדכן את התזכורת.");
    return;
  }
  await reply(
    "מצאתי כמה תזכורות שמתאימות. איזו לעדכן?",
    Markup.inlineKeyboard(
      matches.slice(0, 8).map((reminder) => [
        Markup.button.callback(`${action === "delete" ? "בטל" : "בוצע"} #${reminder.id} - ${reminder.task}`, `${action === "delete" ? "cancel" : "done"}:${reminder.id}`)
      ])
    )
  );
}

function helpText(): string {
  return [
    "אני ZmanBot, עוזר תזכורות בעברית.",
    "",
    "דוגמאות:",
    "תזכיר לי עוד שעה להתקשר לאמא",
    "מחר ב-9 תזכיר לי לשלוח חשבונית",
    "כל יום ראשון ב-10 תזכיר לי לבדוק דוחות",
    "כל חודש ב-1 לחודש ב-10 לשלם שכירות",
    "מה יש לי השבוע?",
    "בטל את התזכורת להתקשר לאמא",
    "",
    "פקודות: /id, /morning, /list, /today, /week, /week_summary, /recurring, /overdue, /search <טקסט>, /done <id>, /delete <id>, /snooze <id> <זמן>, /stats"
  ].join("\n");
}

bot.start((ctx) => void ctx.reply("שלום! שלחו לי תזכורת בעברית טבעית, למשל: מחר ב-9 תזכיר לי לשלוח מייל"));
bot.help((ctx) => void ctx.reply(helpText()));
bot.command("id", (ctx) => void ctx.reply(`ה-Chat ID שלך הוא:\n${ctx.chat.id}`));

bot.command("list", (ctx) => void sendReminderList(String(ctx.chat.id), replyFor(ctx), "כל התזכורות שלך:", getRemindersByChatId(String(ctx.chat.id))));
bot.command("today", (ctx) => void sendReminderList(String(ctx.chat.id), replyFor(ctx), "מה יש לך היום:", getTodayRemindersByChatId(String(ctx.chat.id))));
bot.command("morning", (ctx) => {
  const digest = dailyDigest(String(ctx.chat.id));
  void ctx.reply(digest.text, reminderKeyboard(digest.reminders));
});
bot.command("tomorrow", (ctx) => void sendReminderList(String(ctx.chat.id), replyFor(ctx), "מה יש לך מחר:", getTomorrowRemindersByChatId(String(ctx.chat.id))));
bot.command("week", (ctx) => void sendReminderList(String(ctx.chat.id), replyFor(ctx), "מה יש לך השבוע:", getWeekRemindersByChatId(String(ctx.chat.id))));
bot.command("week_summary", (ctx) => {
  const digest = weeklyDigest(String(ctx.chat.id));
  void ctx.reply(digest.text, reminderKeyboard(digest.reminders));
});
bot.command("recurring", (ctx) => void sendReminderList(String(ctx.chat.id), replyFor(ctx), "התזכורות הקבועות שלך:", getRecurringRemindersByChatId(String(ctx.chat.id))));
bot.command("overdue", (ctx) => void sendReminderList(String(ctx.chat.id), replyFor(ctx), "תזכורות באיחור:", getOverdueRemindersByChatId(String(ctx.chat.id))));

bot.command("search", (ctx) => {
  const query = ctx.message.text.replace(/^\/search\s*/u, "").trim();
  if (!query) return void ctx.reply("שימוש: /search <טקסט>");
  void sendReminderList(String(ctx.chat.id), replyFor(ctx), `תוצאות חיפוש עבור "${query}":`, searchRemindersByChatId(String(ctx.chat.id), query));
});

bot.command("stats", (ctx) => {
  const stats = getStatsByChatId(String(ctx.chat.id));
  void ctx.reply(
    [
      "סטטיסטיקות:",
      `פתוחות: ${stats.totalActive}`,
      `היום: ${stats.dueToday}`,
      `מחר: ${stats.dueTomorrow}`,
      `השבוע: ${stats.dueThisWeek}`,
      `קבועות: ${stats.recurring}`,
      `בוצעו: ${stats.done}`,
      `בוטלו: ${stats.cancelled}`
    ].join("\n")
  );
});

bot.command("done", (ctx) => {
  const id = Number(ctx.message.text.split(/\s+/)[1]);
  if (!Number.isInteger(id)) return void ctx.reply("שימוש: /done <id>");
  void handleTargetAction(String(ctx.chat.id), id, undefined, "done", replyFor(ctx));
});

bot.command("delete", (ctx) => {
  const id = Number(ctx.message.text.split(/\s+/)[1]);
  if (!Number.isInteger(id)) return void ctx.reply("שימוש: /delete <id>");
  void handleTargetAction(String(ctx.chat.id), id, undefined, "delete", replyFor(ctx));
});

bot.command("cancel", (ctx) => {
  const id = Number(ctx.message.text.split(/\s+/)[1]);
  if (!Number.isInteger(id)) return void ctx.reply("שימוש: /cancel <id>");
  void handleTargetAction(String(ctx.chat.id), id, undefined, "delete", replyFor(ctx));
});

bot.command("snooze", (ctx) => {
  const [, idText, ...timeParts] = ctx.message.text.split(/\s+/);
  const id = Number(idText);
  if (!Number.isInteger(id) || timeParts.length === 0) return void ctx.reply("שימוש: /snooze <id> <זמן>");
  const parsed = parseReminderMessage(`תזכיר לי ${timeParts.join(" ")} זמני`);
  if (!parsed.ok) return void ctx.reply(parsed.error);
  const reminder = snoozeReminder(String(ctx.chat.id), id, parsed.value.dueAt);
  void ctx.reply(reminder ? `דחיתי ✅\n${reminder.task}\n${formatDate(reminder.dueAt)}` : "לא מצאתי תזכורת מתאימה.");
});

bot.command("clear_done", (ctx) => {
  pendingBulkConfirmations.set(String(ctx.chat.id), { action: "clear_done" });
  void ctx.reply("למחוק את כל התזכורות שבוצעו?", Markup.inlineKeyboard([[Markup.button.callback("כן, בטל", "confirm_bulk:yes"), Markup.button.callback("לא", "confirm_bulk:no")]]));
});

bot.action(/^view:(list|today|week|recurring|overdue)$/, async (ctx) => {
  const chatId = String(ctx.chat?.id);
  const view = ctx.match[1] as BotIntent;
  const reminders =
    view === "today"
      ? getTodayRemindersByChatId(chatId)
      : view === "week"
        ? getWeekRemindersByChatId(chatId)
        : view === "recurring"
          ? getRecurringRemindersByChatId(chatId)
          : view === "overdue"
            ? getOverdueRemindersByChatId(chatId)
          : getRemindersByChatId(chatId);
  await ctx.answerCbQuery();
  await sendReminderList(chatId, replyFor(ctx), "רשימת תזכורות:", reminders);
});

bot.action(/^done:(\d+)$/, async (ctx) => {
  const ok = markReminderDone(String(ctx.chat?.id), Number(ctx.match[1]));
  await ctx.answerCbQuery(ok ? "סומן כבוצע" : "לא נמצא");
  await ctx.reply(ok ? "מעולה ✅ סימנתי כבוצע" : "לא מצאתי תזכורת מתאימה.");
});

bot.action(/^not_now:(\d+)$/, async (ctx) => {
  const ok = deferReminderFollowup(String(ctx.chat?.id), Number(ctx.match[1]));
  await ctx.answerCbQuery(ok ? "אזכיר שוב" : "לא נמצא");
  await ctx.reply(ok ? "סבבה, אזכיר לך שוב בעוד 5 דקות." : "לא מצאתי תזכורת מתאימה.");
});

bot.action(/^cancel:(\d+)$/, async (ctx) => {
  const ok = cancelReminder(String(ctx.chat?.id), Number(ctx.match[1]));
  await ctx.answerCbQuery(ok ? "בוטל" : "לא נמצא");
  await ctx.reply(ok ? "ביטלתי ✅" : "לא מצאתי תזכורת מתאימה.");
});

bot.action(/^snooze_menu:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("לכמה זמן לדחות?", snoozeKeyboard(Number(ctx.match[1])));
});

bot.action(/^snooze:(\d+):(.+)$/, async (ctx) => {
  const reminder = snoozeReminder(String(ctx.chat?.id), Number(ctx.match[1]), snoozeDateFromPreset(ctx.match[2]));
  await ctx.answerCbQuery(reminder ? "נדחה" : "לא נמצא");
  await ctx.reply(reminder ? `דחיתי ✅\n${reminder.task}\n${formatDate(reminder.dueAt)}` : "לא מצאתי תזכורת מתאימה.");
});

bot.action(/^edit:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(`עריכה מלאה דרך כפתור עדיין פשוטה: כתוב "דחה את #${ctx.match[1]} למחר ב-9" או "בטל את #${ctx.match[1]}".`);
});

bot.action("quick:add", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("מעולה. כתוב את התזכורת הבאה.");
});

bot.action(/^confirm_create:(yes|no)$/, async (ctx) => {
  const chatId = String(ctx.chat?.id);
  const pending = pendingCreateConfirmations.get(chatId);
  await ctx.answerCbQuery();
  if (!pending || ctx.match[1] === "no") {
    pendingCreateConfirmations.delete(chatId);
    await ctx.reply("ביטלתי. לא קבעתי את התזכורת.");
    return;
  }
  pendingCreateConfirmations.delete(chatId);
  const reminder = createReminder(chatId, { task: pending.task, dueAt: pending.dueAt, recurrence: pending.recurrence, category: pending.category, priority: pending.priority, sourceText: pending.sourceText });
  await ctx.reply(`סגור ✅\nשמתי לך תזכורת ל-${formatDate(reminder.dueAt)}:\n${reminder.task}`, afterCreateKeyboard(reminder.id));
});

bot.action(/^confirm_bulk:(yes|no)$/, async (ctx) => {
  const chatId = String(ctx.chat?.id);
  const pending = pendingBulkConfirmations.get(chatId);
  await ctx.answerCbQuery();
  if (!pending || ctx.match[1] === "no") {
    pendingBulkConfirmations.delete(chatId);
    await ctx.reply("ביטלתי את הפעולה.");
    return;
  }
  pendingBulkConfirmations.delete(chatId);
  const count =
    pending.action === "clear_done"
      ? clearDoneRemindersByChatId(chatId)
      : pending.action === "cancel_today"
        ? cancelTodayRemindersByChatId(chatId)
        : getRemindersByChatId(chatId)
            .filter((reminder) => reminder.status !== "cancelled")
            .reduce((total, reminder) => total + (cancelReminder(chatId, reminder.id) ? 1 : 0), 0);
  await ctx.reply(`בוצע ✅\nעודכנו ${count} תזכורות.`);
});

bot.on("text", (ctx) => {
  try {
    const chatId = String(ctx.chat.id);
    const pendingTask = pendingQuickCapture.get(chatId);
    if (pendingTask) {
      const parsedTime = parseReminderMessage(`תזכיר לי ${ctx.message.text} ${pendingTask.task}`);
      if (parsedTime.ok) {
        pendingQuickCapture.delete(chatId);
        const reminder = createReminder(chatId, {
          ...parsedTime.value,
          task: pendingTask.task,
          category: pendingTask.category,
          priority: pendingTask.priority,
          sourceText: `${pendingTask.task} | ${ctx.message.text}`
        });
        return void ctx.reply(`סגור ✅\nשמתי לך תזכורת ל-${formatDate(reminder.dueAt)}:\n${reminder.task}`, afterCreateKeyboard(reminder.id));
      }
    }
    const parsed = parseUserMessage(ctx.message.text);

    if (parsed.intent === "help") return void ctx.reply(helpText());
    if (parsed.intent === "morning") {
      const digest = dailyDigest(chatId);
      return void ctx.reply(digest.text, reminderKeyboard(digest.reminders));
    }
    if (parsed.intent === "list") return void sendReminderList(chatId, replyFor(ctx), "כל התזכורות שלך:", getRemindersByChatId(chatId));
    if (parsed.intent === "today") return void sendReminderList(chatId, replyFor(ctx), "מה יש לך היום:", getTodayRemindersByChatId(chatId));
    if (parsed.intent === "tomorrow") return void sendReminderList(chatId, replyFor(ctx), "מה יש לך מחר:", getTomorrowRemindersByChatId(chatId));
    if (parsed.intent === "week" || parsed.intent === "week_summary") {
      const digest = weeklyDigest(chatId);
      return void ctx.reply(digest.text, reminderKeyboard(digest.reminders));
    }
    if (parsed.intent === "overdue") return void sendReminderList(chatId, replyFor(ctx), "תזכורות באיחור:", getOverdueRemindersByChatId(chatId));
    if (parsed.intent === "recurring") return void sendReminderList(chatId, replyFor(ctx), "התזכורות הקבועות שלך:", getRecurringRemindersByChatId(chatId));
    if (parsed.intent === "search") return void sendReminderList(chatId, replyFor(ctx), `תוצאות חיפוש עבור "${parsed.query}":`, searchRemindersByChatId(chatId, parsed.query ?? ""));
    if (parsed.intent === "delete") return void handleTargetAction(chatId, parsed.targetId, parsed.targetText, "delete", replyFor(ctx));
    if (parsed.intent === "done") return void handleTargetAction(chatId, parsed.targetId, parsed.targetText, "done", replyFor(ctx));
    if (parsed.intent === "snooze") {
      if (!parsed.snoozeUntil) return void ctx.reply(parsed.error ?? "לא הצלחתי להבין לאיזה זמן לדחות.");
      if (parsed.targetId) {
        const reminder = snoozeReminder(chatId, parsed.targetId, parsed.snoozeUntil);
        return void ctx.reply(reminder ? `דחיתי ✅\n${reminder.task}\n${formatDate(reminder.dueAt)}` : "לא מצאתי תזכורת מתאימה.");
      }
      const matches = findMatchingReminders(chatId, parsed.targetText ?? "");
      if (matches.length === 1) {
        const reminder = snoozeReminder(chatId, matches[0].id, parsed.snoozeUntil);
        return void ctx.reply(reminder ? `דחיתי ✅\n${reminder.task}\n${formatDate(reminder.dueAt)}` : "לא מצאתי תזכורת מתאימה.");
      }
      return void ctx.reply("מצאתי כמה אפשרויות או שלא מצאתי התאמה. כתוב /list ובחר תזכורת.");
    }
    if (parsed.intent === "create" && parsed.task && parsed.dueAt) {
      if (isFarFuture(parsed.dueAt)) {
        pendingCreateConfirmations.set(chatId, {
          task: parsed.task,
          dueAt: parsed.dueAt,
          recurrence: parsed.recurrence ?? null,
          category: parsed.category,
          priority: parsed.priority,
          sourceText: ctx.message.text
        });
        return void ctx.reply(`רק לוודא ✅\nלקבוע תזכורת ל-${formatDate(parsed.dueAt)}?\n${parsed.task}`, Markup.inlineKeyboard([[Markup.button.callback("כן, קבע", "confirm_create:yes"), Markup.button.callback("לא, בטל", "confirm_create:no")]]));
      }
      const reminder = createReminder(chatId, {
        task: parsed.task,
        dueAt: parsed.dueAt,
        recurrence: parsed.recurrence ?? null,
        category: parsed.category,
        priority: parsed.priority,
        sourceText: ctx.message.text
      });
      return void ctx.reply(`סגור ✅\nשמתי לך תזכורת ל-${formatDate(reminder.dueAt)}:\n${reminder.task}`, afterCreateKeyboard(reminder.id));
    }
    if (parsed.intent === "quick_capture" && parsed.task) {
      pendingQuickCapture.set(chatId, { task: parsed.task, category: parsed.category, priority: parsed.priority });
      return void ctx.reply("מתי להזכיר לך?");
    }

    void ctx.reply(parsed.error ?? "לא הצלחתי להבין. אפשר לכתוב /help לדוגמאות.");
  } catch (error) {
    logger.error("Failed to handle text message", { error });
    void ctx.reply("משהו השתבש. נסו שוב עוד רגע.");
  }
});
