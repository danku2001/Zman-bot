"use client";

import { useEffect, useState } from "react";
import { exportReminders } from "../lib/api";
import { ChatIdField, getStoredChatId } from "./ChatIdField";

export function SettingsExport() {
  const [chatId, setChatId] = useState("");
  const [notice, setNotice] = useState("");

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

  return (
    <div className="mt-6 rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-black">גיבוי התזכורות</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <ChatIdField chatId={chatId} onChange={setChatId} />
        <button disabled={!chatId} onClick={() => void runExport()} className="rounded-md bg-mint px-4 py-2 font-bold text-white disabled:bg-ink/25">
          יצוא JSON
        </button>
      </div>
      {notice ? <p className="mt-3 font-bold text-ink">{notice}</p> : null}
    </div>
  );
}
