import { ReminderList } from "../../components/ReminderList";

export default function CancelledPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">תזכורות שבוטלו</h1>
      <ReminderList mode="cancelled" />
    </div>
  );
}
