import { claimDueReminder, markReminderNotifiedAfterSend, recoverStaleSendingReminders, releaseReminderAfterSendFailure, rescheduleRecurringReminder } from "./db";
import { sendMessage } from "./telegram";

function nowLocalIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function sentKeyboard(id: number) {
  return {
    inline_keyboard: [
      [
        { text: "✅ בוצע", callback_data: `done:${id}` },
        { text: "🕒 עוד 10 דקות", callback_data: `snooze:${id}:10m` }
      ],
      [{ text: "🗑️ בטל", callback_data: `cancel:${id}` }]
    ]
  };
}

export async function runSchedulerOnce(limit = 25): Promise<{ ok: true; sent: number; recovered: number; failed: number }> {
  const recovered = await recoverStaleSendingReminders();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < limit; i += 1) {
    const reminder = await claimDueReminder(nowLocalIso());
    if (!reminder) break;
    try {
      const isRecurring = Boolean(reminder.recurrenceType);
      await sendMessage(reminder.chatId, isRecurring ? `⏰ תזכורת קבועה: ${reminder.task}` : `⏰ תזכורת: ${reminder.task}`, sentKeyboard(reminder.id));
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

  return { ok: true, sent, recovered, failed };
}
