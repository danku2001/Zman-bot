import {
  claimDueFollowupReminder,
  claimDueReminder,
  clearMaxedFollowups,
  markFollowupSent,
  markReminderNotifiedAfterSend,
  recoverStaleSendingReminders,
  releaseFollowupAfterSendFailure,
  releaseReminderAfterSendFailure,
  rescheduleRecurringReminder,
  getSchedulerDebugSnapshot
} from "./db";
import { sendMessage } from "./telegram";
import { ensureAppTimeZone, formatHebrewWallClock, nowUtcIso } from "./time";

ensureAppTimeZone();

export type SchedulerResult = {
  ok: true;
  sent: number;
  recovered: number;
  failed: number;
  durationMs: number;
  checkedAtUtc: string;
  checkedAtIsrael: string;
  dueCountBefore: number;
  claimedIds: number[];
  telegramMessageIds: Array<{ reminderId: number; messageId: number | null; kind: "reminder" | "followup" | "recurrence_next" }>;
  failureReasons: string[];
  selectionNote: string;
};

let lastSchedulerResult: SchedulerResult | null = null;

function completionKeyboard(id: number) {
  return {
    inline_keyboard: [
      [
        { text: "✅ ביצעתי", callback_data: `done:${id}` },
        { text: "🕒 דחה", callback_data: `snooze_menu:${id}` }
      ],
      [
        { text: "❌ לא עכשיו", callback_data: `not_now:${id}` },
        { text: "🗑️ בטל", callback_data: `cancel:${id}` }
      ]
    ]
  };
}

export async function runSchedulerOnce(limit = 25): Promise<SchedulerResult> {
  const startedAt = Date.now();
  const checkedAtUtc = nowUtcIso();
  const checkedAtIsrael = formatHebrewWallClock(checkedAtUtc, checkedAtUtc, "medium");
  const dueCountBefore = (await getSchedulerDebugSnapshot(checkedAtUtc)).pendingDueCount;
  const recovered = await recoverStaleSendingReminders();
  let sent = 0;
  let failed = 0;
  const claimedIds: number[] = [];
  const telegramMessageIds: SchedulerResult["telegramMessageIds"] = [];
  const failureReasons: string[] = [];

  for (let i = 0; i < limit; i += 1) {
    const reminder = await claimDueReminder(checkedAtUtc);
    if (!reminder) break;
    claimedIds.push(reminder.id);
    try {
      const isRecurring = Boolean(reminder.recurrenceType);
      const sentReminder = await sendMessage(
        reminder.chatId,
        isRecurring ? `⏰ תזכורת קבועה: ${reminder.task}` : `⏰ תזכורת: ${reminder.task}\n\nהאם ביצעת?`,
        completionKeyboard(reminder.id)
      );
      telegramMessageIds.push({ reminderId: reminder.id, messageId: sentReminder.messageId, kind: "reminder" });
      if (reminder.recurrenceType) {
        const next = await rescheduleRecurringReminder(reminder);
        const sentNext = await sendMessage(reminder.chatId, `התזכורת הבאה נקבעה ל-${formatHebrewWallClock(next.dueAt)}`);
        telegramMessageIds.push({ reminderId: reminder.id, messageId: sentNext.messageId, kind: "recurrence_next" });
      } else {
        await markReminderNotifiedAfterSend(reminder);
      }
      sent += 1;
    } catch (error) {
      failed += 1;
      failureReasons.push(`reminder ${reminder.id}: ${error instanceof Error ? error.message : "Unknown Telegram send error"}`);
      await releaseReminderAfterSendFailure(reminder.id);
    }
  }

  await clearMaxedFollowups();

  for (let i = 0; i < limit; i += 1) {
    const reminder = await claimDueFollowupReminder(checkedAtUtc);
    if (!reminder) break;
    claimedIds.push(reminder.id);
    try {
      const sentFollowup = await sendMessage(reminder.chatId, `⏰ תזכורת חוזרת:\n${reminder.task}\n\nהאם ביצעת?`, completionKeyboard(reminder.id));
      telegramMessageIds.push({ reminderId: reminder.id, messageId: sentFollowup.messageId, kind: "followup" });
      await markFollowupSent(reminder);
      sent += 1;
    } catch (error) {
      failed += 1;
      failureReasons.push(`followup ${reminder.id}: ${error instanceof Error ? error.message : "Unknown Telegram send error"}`);
      await releaseFollowupAfterSendFailure(reminder);
    }
  }

  const selectionNote =
    dueCountBefore === 0
      ? "No pending reminders were due at checkedAtUtc."
      : claimedIds.length === 0
        ? "Due reminders existed before the run, but none were claimed. Check missing chat_id, locks, or status mismatch."
        : "Due reminders were claimed and processed.";
  lastSchedulerResult = { ok: true, sent, recovered, failed, durationMs: Date.now() - startedAt, checkedAtUtc, checkedAtIsrael, dueCountBefore, claimedIds, telegramMessageIds, failureReasons, selectionNote };
  return lastSchedulerResult;
}

export function getLastSchedulerResult(): SchedulerResult | null {
  return lastSchedulerResult;
}
