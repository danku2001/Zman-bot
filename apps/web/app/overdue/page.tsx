import { ReminderList } from "../../components/ReminderList";

export default function OverduePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">תזכורות באיחור</h1>
      <p className="text-sm text-ink/65">כאן מופיעות רק תזכורות שעדיין ממתינות ולא נשלחו בזמן.</p>
      <ReminderList mode="overdue" />
    </div>
  );
}
