import { CreateReminderForm } from "../../components/CreateReminderForm";

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-black text-ink">יצירת תזכורת</h1>
      <CreateReminderForm />
    </div>
  );
}
