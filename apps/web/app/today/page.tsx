import { ReminderList } from "../../components/ReminderList";

export default function TodayPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">תזכורות להיום</h1>
      <ReminderList mode="today" />
    </div>
  );
}
