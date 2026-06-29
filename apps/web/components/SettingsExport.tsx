"use client";

import { useEffect, useState } from "react";
import { exportReminders, importReminders } from "../lib/api";
import { ChatIdField, getStoredChatId } from "./ChatIdField";

export function SettingsExport() {
  const [chatId, setChatId] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => setChatId(getStoredChatId()), []);

  async function runExport() {
    const data = await exportReminders(chatId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zmanbot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`יוצאו ${data.reminders.length} תזכורות ו-${data.events.length} אירועים.`);
  }

  async function runImport(file: File | null) {
    if (!file || !chatId) return;
    setImporting(true);
    setNotice("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const reminders = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { reminders?: unknown }).reminders)
          ? (parsed as { reminders: unknown[] }).reminders
          : null;
      if (!reminders) throw new Error("קובץ JSON חייב לכלול מערך reminders");
      const result = await importReminders(chatId, reminders);
      const errorText = result.errors.length ? ` נכשלו ${result.errors.length}: ${result.errors.slice(0, 3).join("; ")}` : "";
      setNotice(`יובאו ${result.importedCount} תזכורות.${errorText}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "יבוא נכשל");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-black">גיבוי התזכורות</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <ChatIdField chatId={chatId} onChange={setChatId} />
        <button disabled={!chatId} onClick={() => void runExport()} className="rounded-md bg-mint px-4 py-2 font-bold text-white disabled:bg-ink/25">
          יצוא JSON
        </button>
        <label className="rounded-md border border-ink/15 px-4 py-2 text-center font-bold text-ink transition hover:border-mint">
          {importing ? "מייבא..." : "יבוא JSON"}
          <input
            type="file"
            accept="application/json"
            disabled={!chatId || importing}
            onChange={(event) => void runImport(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
      </div>
      {notice ? <p className="mt-3 font-bold text-ink">{notice}</p> : null}
    </div>
  );
}
