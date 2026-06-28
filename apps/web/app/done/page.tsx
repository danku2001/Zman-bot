import { ReminderList } from "../../components/ReminderList";

export default function DonePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">תזכורות שבוצעו</h1>
      <ReminderList mode="done" />
    </div>
  );
}
