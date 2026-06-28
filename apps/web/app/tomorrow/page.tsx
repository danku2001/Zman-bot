import { ReminderList } from "../../components/ReminderList";

export default function TomorrowPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">תזכורות למחר</h1>
      <ReminderList mode="tomorrow" />
    </div>
  );
}
