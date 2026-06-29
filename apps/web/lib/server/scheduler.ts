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

function nowLocalIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

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

export async function runSchedulerOnce(limit = 25): Promise<{ ok: true; sent: number; recovered: number; failed: number; durationMs: number }> {
  const startedAt = Date.now();
  const recovered = await recoverStaleSendingReminders();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < limit; i += 1) {
    const reminder = await claimDueReminder(nowLocalIso());
    if (!reminder) break;
    try {
      const isRecurring = Boolean(reminder.recurrenceType);
      await sendMessage(
        reminder.chatId,
        isRecurring ? `⏰ תזכורת קבועה: ${reminder.task}` : `⏰ תזכורת: ${reminder.task}\n\nהאם ביצעת?`,
        completionKeyboard(reminder.id)
      );
      if (reminder.recurrenceType) {
        const next = await rescheduleRecurringReminder(reminder);
        await sendMessage(reminder.chatId, `התזכורת הבאה נקבעה ל-${next.dueAt.replace("T", " ")}`);
      } else {
        await markReminderNotifiedAfterSend(reminder);
      }
      sent += 1;
    } catch {
      failed += 1;
      await releaseReminderAfterSendFailure(reminder.id);
    }
  }

  await clearMaxedFollowups();

  for (let i = 0; i < limit; i += 1) {
    const reminder = await claimDueFollowupReminder(nowLocalIso());
    if (!reminder) break;
    try {
      await sendMessage(reminder.chatId, `⏰ תזכורת חוזרת:\n${reminder.task}\n\nהאם ביצעת?`, completionKeyboard(reminder.id));
      await markFollowupSent(reminder);
      sent += 1;
    } catch {
      failed += 1;
      await releaseFollowupAfterSendFailure(reminder);
    }
  }

  return { ok: true, sent, recovered, failed, durationMs: Date.now() - startedAt };
}
