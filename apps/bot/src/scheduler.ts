import cron from "node-cron";
import type { Telegraf } from "telegraf";
import {
  claimDueFollowupReminder,
  claimReminderForSending,
  clearMaxedFollowups,
  getPendingDueReminders,
  markFollowupSent,
  markReminderNotifiedAfterSend,
  recoverStaleSendingReminders,
  releaseFollowupAfterSendFailure,
  releaseReminderAfterSendFailure,
  rescheduleRecurringReminder
} from "./db";
import { logger } from "./logger";
import { sentReminderKeyboard } from "./bot";

function nowLocalIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

export function startScheduler(bot: Telegraf): void {
  recoverStaleSendingReminders();

  cron.schedule("*/30 * * * * *", async () => {
    const recovered = recoverStaleSendingReminders();
    if (recovered > 0) logger.warn("Recovered stale sending reminders", { count: recovered });

    const due = getPendingDueReminders(nowLocalIso());

    for (const reminder of due) {
      if (!claimReminderForSending(reminder.id)) continue;
      try {
        const isRecurring = Boolean(reminder.recurrenceType);
        await bot.telegram.sendMessage(
          reminder.chatId,
          isRecurring ? `⏰ תזכורת קבועה: ${reminder.task}` : `⏰ תזכורת: ${reminder.task}\n\nהאם ביצעת?`,
          sentReminderKeyboard(reminder.id)
        );
        if (reminder.recurrenceType) {
          const next = rescheduleRecurringReminder(reminder);
          await bot.telegram.sendMessage(reminder.chatId, `התזכורת הבאה נקבעה ל-${next.dueAt.replace("T", " ")}`);
          logger.info("Recurring reminder sent and rescheduled", { id: reminder.id, nextDueAt: next.dueAt });
        } else {
          markReminderNotifiedAfterSend(reminder);
          logger.info("Reminder sent", { id: reminder.id, chatId: reminder.chatId });
        }
      } catch (error) {
        releaseReminderAfterSendFailure(reminder.id);
        logger.error("Failed to send reminder", { id: reminder.id, error });
      }
    }

    clearMaxedFollowups();

    for (let i = 0; i < 25; i += 1) {
      const reminder = claimDueFollowupReminder(nowLocalIso());
      if (!reminder) break;
      try {
        await bot.telegram.sendMessage(reminder.chatId, `⏰ תזכורת חוזרת:\n${reminder.task}\n\nהאם ביצעת?`, sentReminderKeyboard(reminder.id));
        markFollowupSent(reminder);
        logger.info("Reminder follow-up sent", { id: reminder.id, chatId: reminder.chatId });
      } catch (error) {
        releaseFollowupAfterSendFailure(reminder);
        logger.error("Failed to send reminder follow-up", { id: reminder.id, error });
      }
    }
  });

  logger.info("Scheduler started");
}
