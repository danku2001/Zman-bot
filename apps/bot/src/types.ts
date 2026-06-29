export type ReminderStatus = "pending" | "sending" | "notified" | "done" | "cancelled";
export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly" | "custom_weekdays";
export type ReminderPriority = "רגיל" | "חשוב" | "דחוף";
export type BotIntent =
  | "create"
  | "quick_capture"
  | "list"
  | "today"
  | "tomorrow"
  | "week"
  | "morning"
  | "week_summary"
  | "overdue"
  | "recurring"
  | "delete"
  | "done"
  | "snooze"
  | "search"
  | "help"
  | "unknown";

export interface Recurrence {
  type: RecurrenceType;
  dayOfWeek?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  month?: number;
  time: string;
}

export interface ParsedReminder {
  task: string;
  dueAt: string;
  recurrence: Recurrence | null;
  sourceText?: string;
  category?: string;
  priority?: ReminderPriority;
}

export interface ParsedUserMessage {
  intent: BotIntent;
  task?: string;
  dueAt?: string;
  recurrence?: Recurrence | null;
  query?: string;
  targetText?: string;
  targetId?: number;
  snoozeUntil?: string;
  category?: string;
  priority?: ReminderPriority;
  confidence: number;
  error?: string;
}

export interface ParseSuccess {
  ok: true;
  value: ParsedReminder;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

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
  nextFollowupAt: string | null;
  followupCount: number;
  lastFollowupAt: string | null;
  sourceText: string | null;
}

export interface ReminderStats {
  totalActive: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  recurring: number;
  notified: number;
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
