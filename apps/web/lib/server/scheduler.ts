import {
  claimDueFollowupReminder,
  claimDueReminder,
  clearMaxedFollowups,
  markFollowupSent,
  markReminderNotifiedAfterSend,
  recoverStaleSendingReminders,
  releaseFollowupAfterSendFailure,
  releaseReminderAfterSendFailure,
  rescheduleRecurringReminder
} from "./db";
import { sendMessage } from "./telegram";
import { ensureAppTimeZone, formatHebrewWallClock, nowUtcIso } from "./time";

ensureAppTimeZone();

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

export async function runSchedulerOnce(limit = 25): Promise<{
  ok: true;
  sent: number;
  recovered: number;
  failed: number;
  durationMs: number;
  checkedAtUtc: string;
  checkedAtIsrael: string;
  claimedIds: number[];
  failureReasons: string[];
}> {
  const startedAt = Date.now();
  const checkedAtUtc = nowUtcIso();
  const checkedAtIsrael = formatHebrewWallClock(checkedAtUtc, checkedAtUtc, "medium");
  const recovered = await recoverStaleSendingReminders();
  let sent = 0;
  let failed = 0;
  const claimedIds: number[] = [];
  const failureReasons: string[] = [];

  for (let i = 0; i < limit; i += 1) {
    const reminder = await claimDueReminder(checkedAtUtc);
    if (!reminder) break;
    claimedIds.push(reminder.id);
    try {
      const isRecurring = Boolean(reminder.recurrenceType);
      await sendMessage(
        reminder.chatId,
        isRecurring ? `⏰ תזכורת קבועה: ${reminder.task}` : `⏰ תזכורת: ${reminder.task}\n\nהאם ביצעת?`,
        completionKeyboard(reminder.id)
      );
      if (reminder.recurrenceType) {
        const next = await rescheduleRecurringReminder(reminder);
        await sendMessage(reminder.chatId, `התזכורת הבאה נקבעה ל-${formatHebrewWallClock(next.dueAt)}`);
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
      await sendMessage(reminder.chatId, `⏰ תזכורת חוזרת:\n${reminder.task}\n\nהאם ביצעת?`, completionKeyboard(reminder.id));
      await markFollowupSent(reminder);
      sent += 1;
    } catch (error) {
      failed += 1;
      failureReasons.push(`followup ${reminder.id}: ${error instanceof Error ? error.message : "Unknown Telegram send error"}`);
      await releaseFollowupAfterSendFailure(reminder);
    }
  }

  return { ok: true, sent, recovered, failed, durationMs: Date.now() - startedAt, checkedAtUtc, checkedAtIsrael, claimedIds, failureReasons };
}
