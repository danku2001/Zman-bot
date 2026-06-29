import { ReminderList } from "../../components/ReminderList";

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-mint">מבט תאריכי</p>
        <h1 className="text-3xl font-black text-ink">לוח תזכורות</h1>
      </div>
      <ReminderList mode="week" />
    </div>
  );
}
