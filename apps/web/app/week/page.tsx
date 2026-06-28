import { ReminderList } from "../../components/ReminderList";

export default function WeekPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">השבוע הקרוב</h1>
      <ReminderList mode="week" />
    </div>
  );
}
