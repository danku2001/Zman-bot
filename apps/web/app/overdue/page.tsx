import { ReminderList } from "../../components/ReminderList";

export default function OverduePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">תזכורות באיחור</h1>
      <ReminderList mode="overdue" />
    </div>
  );
}
