import { ReminderList } from "../../components/ReminderList";

export default function RecurringPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">תזכורות קבועות</h1>
      <ReminderList mode="recurring" />
    </div>
  );
}
