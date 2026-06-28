"use client";

import { useEffect, useState } from "react";
import { createReminder } from "../lib/api";
import { ChatIdField, getStoredChatId } from "./ChatIdField";

export function CreateReminderForm() {
  const [chatId, setChatId] = useState("");
  const [message, setMessage] = useState("תזכיר לי מחר ב-9 לשלוח מייל");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setChatId(getStoredChatId()), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setError("");
    try {
      const data = await createReminder(chatId, message);
      setNotice(`נוצרה תזכורת #${data.reminder.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת תזכורת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <ChatIdField chatId={chatId} onChange={setChatId} />
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-ink">הודעת תזכורת</span>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
        />
      </label>
      {notice ? <div className="rounded-md bg-mint/15 p-3 font-bold text-ink">{notice}</div> : null}
      {error ? <div className="rounded-md bg-coral/10 p-3 font-bold text-coral">{error}</div> : null}
      <button
        disabled={loading || !chatId || !message}
        className="w-full rounded-md bg-mint px-4 py-3 font-black text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:bg-ink/25"
      >
        {loading ? "יוצר..." : "יצירת תזכורת"}
      </button>
    </form>
  );
}
