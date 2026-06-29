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
  category?: ReminderPriority | string;
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
