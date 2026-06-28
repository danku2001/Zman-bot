import { ReminderList } from "../../components/ReminderList";

export default function RemindersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">כל התזכורות</h1>
      <ReminderList mode="all" />
    </div>
  );
}
