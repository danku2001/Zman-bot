import { ReminderList } from "../../components/ReminderList";

export default function SearchPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-ink">חיפוש תזכורות</h1>
      <ReminderList mode="search" />
    </div>
  );
}
