import {
  cancelReminder,
  createReminder,
  deferReminderFollowup,
  getOverdueRemindersByChatId,
  getRecurringRemindersByChatId,
  getRemindersByChatId,
  getStatsByChatId,
  getTodayRemindersByChatId,
  getWeekRemindersByChatId,
  markReminderDone,
  searchRemindersByChatId,
  snoozeReminder
} from "./db";
import { parseReminderMessage, parseUserMessage } from "./parser";
import { ensureAppTimeZone, formatHebrewWallClock, nowUtcIso, wallClockDateToUtcIso, israelWallClockDate } from "./time";
import type { Reminder } from "../types";

ensureAppTimeZone();

type TelegramMessage = { message_id: number; chat: { id: number | string }; text?: string };
type TelegramCallback = { id: string; data?: string; message?: TelegramMessage };
export type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallback };

function token(): string {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
  return process.env.TELEGRAM_BOT_TOKEN;
}

async function telegram(method: string, body: unknown): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; description?: string };
  if (!response.ok || !data.ok) {
    const chatId = typeof body === "object" && body && "chat_id" in body ? String((body as { chat_id?: unknown }).chat_id) : "unknown";
    throw new Error(`Telegram ${method} failed with ${response.status}${data.description ? `: ${data.description}` : ""} (chat_id=${chatId})`);
  }
}

export async function sendMessage(chatId: string, text: string, replyMarkup?: unknown): Promise<void> {
  await telegram("sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup });
}

async function sendBestEffort(chatId: string, text: string, replyMarkup?: unknown): Promise<boolean> {
  try {
    await sendMessage(chatId, text, replyMarkup);
    return true;
  } catch (error) {
    console.error("Telegram sendMessage failed after durable reminder change", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}

export async function getTelegramWebhookInfo(): Promise<{
  ok: boolean;
  url: string;
  hasCustomCertificate: boolean;
  pendingUpdateCount: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
  maxConnections?: number;
  allowedUpdates?: string[];
}> {
  const response = await fetch(`https://api.telegram.org/bot${token()}/getWebhookInfo`, { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as {
    ok?: boolean;
    result?: {
      url?: string;
      has_custom_certificate?: boolean;
      pending_update_count?: number;
      last_error_date?: number;
      last_error_message?: string;
      max_connections?: number;
      allowed_updates?: string[];
    };
  };
  if (!response.ok || !data.ok || !data.result) throw new Error(`Telegram getWebhookInfo failed with ${response.status}`);
  return {
    ok: true,
    url: data.result.url ?? "",
    hasCustomCertificate: Boolean(data.result.has_custom_certificate),
    pendingUpdateCount: data.result.pending_update_count ?? 0,
    lastErrorDate: data.result.last_error_date,
    lastErrorMessage: data.result.last_error_message,
    maxConnections: data.result.max_connections,
    allowedUpdates: data.result.allowed_updates
  };
}

export async function setTelegramWebhook(appUrl: string): Promise<{
  ok: boolean;
  url: string;
  description?: string;
}> {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secretToken) throw new Error("TELEGRAM_WEBHOOK_SECRET is required");
  const baseUrl = appUrl.replace(/\/$/, "");
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const response = await fetch(`https://api.telegram.org/bot${token()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false
    })
  });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; description?: string };
  if (!response.ok || !data.ok) throw new Error(data.description ?? `Telegram setWebhook failed with ${response.status}`);
  return { ok: true, url: webhookUrl, description: data.description };
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await telegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

function keyboard(reminders: Reminder[]) {
  const rows = reminders
    .filter((reminder) => reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified")
    .slice(0, 8)
    .flatMap((reminder) => [
      [
        { text: `✅ בוצע #${reminder.id}`, callback_data: `done:${reminder.id}` },
        { text: `🕒 דחה #${reminder.id}`, callback_data: `snooze_menu:${reminder.id}` },
        { text: `🗑️ בטל #${reminder.id}`, callback_data: `cancel:${reminder.id}` }
      ]
    ]);
  return {
    inline_keyboard: [
      ...rows,
      [
        { text: "פתוחות", callback_data: "view:list" },
        { text: "השבוע", callback_data: "view:week" },
        { text: "בוצעו", callback_data: "view:done" }
      ]
    ]
  };
}

function isActiveReminder(reminder: Reminder): boolean {
  return reminder.status === "pending" || reminder.status === "sending" || reminder.status === "notified";
}

function activeReminders(reminders: Reminder[]): Reminder[] {
  return reminders.filter(isActiveReminder);
}

function doneReminders(reminders: Reminder[]): Reminder[] {
  return reminders.filter((reminder) => reminder.status === "done");
}

export function safeFormatDate(value: string | null | undefined, fallback = "תאריך לא זמין"): string {
  return formatHebrewWallClock(value, fallback, "medium");
}

function statusLabel(reminder: Reminder): string {
  if (reminder.status === "pending") return "פתוחה";
  if (reminder.status === "sending") return "בשליחה";
  if (reminder.status === "notified") return "נשלחה";
  if (reminder.status === "done") return "בוצעה";
  return "בוטלה";
}

export function formatReminderForTelegram(reminder: Reminder, index: number): string {
  return `${index + 1}. #${reminder.id} ${safeFormatDate(reminder.dueAt)} - ${reminder.task} · ${statusLabel(reminder)}`;
}

async function sendList(chatId: string, title: string, reminders: Reminder[]): Promise<void> {
  const visible = activeReminders(reminders);
  if (!visible.length) {
    await sendMessage(chatId, `${title}\nאין תזכורות להצגה.`);
    return;
  }
  await sendMessage(chatId, `${title}\nיש לך ${visible.length} תזכורות פתוחות:\n\n${visible.slice(0, 12).map(formatReminderForTelegram).join("\n")}`, keyboard(visible));
}

async function sendDoneList(chatId: string, title: string): Promise<void> {
  const reminders = doneReminders(await getRemindersByChatId(chatId));
  if (!reminders.length) {
    await sendMessage(chatId, `${title}\nאין משימות שבוצעו להצגה.`);
    return;
  }
  await sendMessage(chatId, `${title}\n${reminders.slice(0, 12).map(formatReminderForTelegram).join("\n")}`, keyboard(reminders));
}

function snoozeDateFromPreset(preset: string): string {
  const now = new Date();
  if (preset === "10m") return nowUtcIso(new Date(now.getTime() + 10 * 60_000));
  if (preset === "30m") return nowUtcIso(new Date(now.getTime() + 30 * 60_000));
  if (preset === "tomorrow_9") {
    const tomorrow = israelWallClockDate(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return wallClockDateToUtcIso(tomorrow);
  }
  return nowUtcIso(new Date(now.getTime() + 60 * 60_000));
}

function snoozeKeyboard(id: number) {
  return {
    inline_keyboard: [
      [
        { text: "10 דקות", callback_data: `snooze:${id}:10m` },
        { text: "30 דקות", callback_data: `snooze:${id}:30m` }
      ],
      [
        { text: "שעה", callback_data: `snooze:${id}:1h` },
        { text: "מחר 09:00", callback_data: `snooze:${id}:tomorrow_9` }
      ]
    ]
  };
}

async function handleText(chatId: string, text: string): Promise<void> {
  if (text === "/start") {
    await sendMessage(chatId, "שלום! שלחו לי תזכורת בעברית טבעית, למשל: מחר ב-9 תזכיר לי לשלוח מייל");
    return;
  }
  if (text === "/help") {
    await sendMessage(chatId, "פקודות: /id, /list, /today, /week, /completed, /recurring, /overdue, /search <טקסט>, /done <id>, /cancel <id>, /snooze <id> <זמן>, /stats");
    return;
  }
  if (text === "/id") {
    await sendMessage(chatId, `ה-Chat ID שלך הוא:\n${chatId}`);
    return;
  }
  if (text === "/list") return sendList(chatId, "כל התזכורות שלך:", await getRemindersByChatId(chatId));
  if (text === "/today") return sendList(chatId, "מה יש לך היום:", await getTodayRemindersByChatId(chatId));
  if (text === "/week") return sendList(chatId, "מה יש לך השבוע:", await getWeekRemindersByChatId(chatId));
  if (text === "/completed" || text === "/done_list") return sendDoneList(chatId, "משימות שכבר ביצעת:");
  if (text === "/recurring") return sendList(chatId, "התזכורות הקבועות שלך:", await getRecurringRemindersByChatId(chatId));
  if (text === "/overdue") return sendList(chatId, "תזכורות באיחור:", await getOverdueRemindersByChatId(chatId));
  if (text.startsWith("/search")) return sendList(chatId, "תוצאות חיפוש:", await searchRemindersByChatId(chatId, text.replace(/^\/search\s*/u, "")));
  if (text === "/stats") {
    const stats = await getStatsByChatId(chatId);
    await sendMessage(chatId, `סטטיסטיקות:\nפתוחות: ${stats.totalActive}\nהיום: ${stats.dueToday}\nהשבוע: ${stats.dueThisWeek}\nנשלחו: ${stats.notified}\nבוצעו: ${stats.done}\nבוטלו: ${stats.cancelled}`);
    return;
  }

  const commandId = text.match(/^\/(done|cancel|delete)\s+(\d+)/u);
  if (commandId) {
    const id = Number(commandId[2]);
    const ok = commandId[1] === "done" ? await markReminderDone(chatId, id) : await cancelReminder(chatId, id);
    await sendMessage(chatId, ok ? (commandId[1] === "done" ? "מעולה ✅ סימנתי כבוצע" : "בוטל ✅") : "לא מצאתי תזכורת מתאימה.");
    return;
  }

  const snoozeId = text.match(/^\/snooze\s+(\d+)\s+(.+)$/u);
  if (snoozeId) {
    const parsed = parseReminderMessage(`תזכיר לי ${snoozeId[2]} זמני`);
    const reminder = parsed.ok ? await snoozeReminder(chatId, Number(snoozeId[1]), parsed.value.dueAt) : null;
    await sendMessage(chatId, reminder ? `דחיתי ✅\n${reminder.task}\n${safeFormatDate(reminder.dueAt)}` : "לא הצלחתי לדחות את התזכורת.");
    return;
  }

  if (/(?:מה|הצג|תראה).*(?:ביצעתי|בוצעו|הושלמו)|משימות\s+ש(?:כבר\s+)?ביצעתי/u.test(text)) return sendDoneList(chatId, "משימות שכבר ביצעת:");

  const parsed = parseUserMessage(text);
  if (parsed.intent === "create" && parsed.task && parsed.dueAt) {
    const reminder = await createReminder(chatId, { task: parsed.task, dueAt: parsed.dueAt, recurrence: parsed.recurrence ?? null, category: parsed.category, priority: parsed.priority, sourceText: text });
    await sendBestEffort(chatId, `קבעתי ✅\n${safeFormatDate(reminder.dueAt)}\n${reminder.task}`);
    return;
  }
  if (parsed.intent === "list") return sendList(chatId, "כל התזכורות שלך:", await getRemindersByChatId(chatId));
  if (parsed.intent === "search") return sendList(chatId, "תוצאות חיפוש:", await searchRemindersByChatId(chatId, parsed.query ?? ""));
  await sendMessage(chatId, parsed.error ?? "לא הצלחתי להבין. נסו: תזכיר לי מחר ב-9 לשלוח מייל");
}

async function handleCallback(callback: TelegramCallback): Promise<void> {
  const chatId = callback.message?.chat.id ? String(callback.message.chat.id) : "";
  if (!chatId || !callback.data) return;
  const [action, idText, preset] = callback.data.split(":");
  const id = Number(idText);
  let ok = false;
  if (action === "view") {
    await answerCallbackQuery(callback.id);
    if (idText === "done") return sendDoneList(chatId, "משימות שכבר ביצעת:");
    if (idText === "week") return sendList(chatId, "מה יש לך השבוע:", await getWeekRemindersByChatId(chatId));
    return sendList(chatId, "כל התזכורות שלך:", await getRemindersByChatId(chatId));
  }
  if (action === "done") ok = await markReminderDone(chatId, id);
  if (action === "cancel") ok = await cancelReminder(chatId, id);
  if (action === "not_now") ok = await deferReminderFollowup(chatId, id);
  if (action === "snooze_menu") {
    await answerCallbackQuery(callback.id);
    await sendMessage(chatId, "לכמה זמן לדחות?", snoozeKeyboard(id));
    return;
  }
  if (action === "snooze") ok = Boolean(await snoozeReminder(chatId, id, snoozeDateFromPreset(preset)));
  await answerCallbackQuery(callback.id, ok ? "בוצע" : "לא נמצא");
  const successText =
    action === "done"
      ? "מעולה ✅ סימנתי כבוצע"
      : action === "not_now"
        ? "סבבה, אזכיר לך שוב בעוד 5 דקות."
        : action === "cancel"
          ? "ביטלתי ✅"
          : "דחיתי ✅";
  await sendMessage(chatId, ok ? successText : "לא מצאתי תזכורת מתאימה.");
}

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const message = update.message;
  if (!message?.text) return;
  await handleText(String(message.chat.id), message.text.trim());
}
