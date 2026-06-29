import { SettingsExport } from "../../components/SettingsExport";
import { SyncDiagnostics } from "../../components/SyncDiagnostics";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <h1 className="text-3xl font-black text-ink">הגדרות</h1>
        <div className="mt-5 grid gap-4 text-ink/75">
          <p>בפרודקשן הדשבורד משתמש ב-API מאותו הדומיין, דרך cookie מאובטח אחרי התחברות.</p>
          <p>אזור הזמן של המערכת: Asia/Jerusalem.</p>
          <p>ה-Chat ID נשמר בדפדפן המקומי לאחר הזנה במסכי התזכורות.</p>
        </div>
      </section>
      <SyncDiagnostics />
      <SettingsExport />
    </div>
  );
}
