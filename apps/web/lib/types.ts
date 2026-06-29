export type ReminderStatus = "pending" | "sending" | "notified" | "done" | "cancelled";
export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly" | "custom_weekdays";
export type ReminderPriority = "רגיל" | "חשוב" | "דחוף";

export interface Reminder {
  id: number;
  chatId: string;
  task: string;
  normalizedTask: string;
  category: string;
  priority: ReminderPriority;
  dueAt: string;
  recurrenceType: RecurrenceType | null;
  recurrenceDayOfWeek: number | null;
  recurrenceDaysOfWeek: number[] | null;
  recurrenceDayOfMonth: number | null;
  recurrenceMonth: number | null;
  recurrenceTime: string | null;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  sendingAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  lastSnoozedAt: string | null;
  snoozeCount: number;
  sourceText: string | null;
}

export interface ReminderStats {
  totalActive: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  recurring: number;
  done: number;
  cancelled: number;
  overdue: number;
  categories: Record<string, number>;
  priorities: Record<ReminderPriority, number>;
}

export interface ReminderEvent {
  id: number;
  reminderId: number | null;
  chatId: string;
  eventType: string;
  payload: string | null;
  createdAt: string;
}
