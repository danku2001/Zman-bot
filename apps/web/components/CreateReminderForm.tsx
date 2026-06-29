"use client";

import { useEffect, useState } from "react";
import { createReminder, parseReminder } from "../lib/api";
import { ChatIdField, getStoredChatId } from "./ChatIdField";

type ParsePreview = {
  intent?: string;
  task?: string;
  dueAt?: string;
  category?: string;
  priority?: string;
  confidence?: number;
  error?: string;
};

function formatDate(value: string | undefined): string {
  if (!value) return "לא זוהה";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "לא זוהה";
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem"
  }).format(date);
}

function previewFrom(value: unknown): ParsePreview {
  if (!value || typeof value !== "object") return {};
  const item = value as Record<string, unknown>;
  return {
    intent: typeof item.intent === "string" ? item.intent : undefined,
    task: typeof item.task === "string" ? item.task : undefined,
    dueAt: typeof item.dueAt === "string" ? item.dueAt : undefined,
    category: typeof item.category === "string" ? item.category : undefined,
    priority: typeof item.priority === "string" ? item.priority : undefined,
    confidence: typeof item.confidence === "number" ? item.confidence : undefined,
    error: typeof item.error === "string" ? item.error : undefined
  };
}

export function CreateReminderForm() {
  const [chatId, setChatId] = useState("");
  const [message, setMessage] = useState("תזכיר לי מחר ב-9 לשלוח מייל");
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setChatId(getStoredChatId()), []);

  async function runPreview() {
    if (!chatId || !message.trim()) return;
    setPreviewLoading(true);
    setError("");
    try {
      const data = await parseReminder(chatId, message);
      setPreview(previewFrom(data.result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בפענוח התזכורת");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setError("");
    try {
      const data = await createReminder(chatId, message);
      setNotice(`נוצרה תזכורת #${data.reminder.id}`);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת תזכורת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="border-b border-ink/10 p-5">
        <p className="text-sm font-black text-mint">Quick Add</p>
        <h1 className="mt-1 text-3xl font-black text-ink">יצירת תזכורת חכמה</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">כתבו בעברית רגילה. ZmanBot יזהה זמן, משימה, קטגוריה ועדיפות כשאפשר.</p>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <ChatIdField chatId={chatId} onChange={setChatId} />
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-ink">הודעת תזכורת</span>
            <textarea
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setPreview(null);
              }}
              rows={5}
              className="w-full resize-none rounded-md border border-ink/15 bg-white px-3 py-3 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={previewLoading || !chatId || !message.trim()}
              className="rounded-md border border-mint/30 px-4 py-3 font-black text-ink transition hover:bg-mint hover:text-white disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/30"
            >
              {previewLoading ? "מפענח..." : "הצג פענוח"}
            </button>
            <button
              disabled={loading || !chatId || !message.trim()}
              className="rounded-md bg-mint px-4 py-3 font-black text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:bg-ink/25"
            >
              {loading ? "יוצר..." : "יצירת תזכורת"}
            </button>
          </div>
          {notice ? <div className="rounded-md bg-mint/15 p-3 font-bold text-ink">{notice}</div> : null}
          {error ? <div className="rounded-md bg-coral/10 p-3 font-bold text-coral">{error}</div> : null}
        </div>
        <aside className="rounded-md bg-ink/[0.03] p-4">
          <h2 className="font-black text-ink">תצוגה מקדימה</h2>
          {preview ? (
            <div className="mt-3 grid gap-2 text-sm">
              <div className="rounded-md bg-white p-3"><strong>כוונה:</strong> {preview.intent ?? "לא זוהה"}</div>
              <div className="rounded-md bg-white p-3"><strong>משימה:</strong> {preview.task ?? "לא זוהתה"}</div>
              <div className="rounded-md bg-white p-3"><strong>זמן:</strong> {formatDate(preview.dueAt)}</div>
              <div className="rounded-md bg-white p-3"><strong>קטגוריה:</strong> {preview.category ?? "כללי"}</div>
              <div className="rounded-md bg-white p-3"><strong>עדיפות:</strong> {preview.priority ?? "רגיל"}</div>
              {preview.error ? <div className="rounded-md bg-coral/10 p-3 font-bold text-coral">{preview.error}</div> : null}
            </div>
          ) : (
            <div className="mt-3 grid gap-2 text-sm text-ink/65">
              <p className="rounded-md bg-white p-3">לדוגמה: בעוד שעה להתקשר לאמא חשוב קטגוריה משפחה</p>
              <p className="rounded-md bg-white p-3">לדוגמה: כל יום ב-8 לקחת תרופה</p>
              <p className="rounded-md bg-white p-3">לדוגמה: ב-11 למאי לשלוח מזל טוב</p>
            </div>
          )}
        </aside>
      </div>
    </form>
  );
}
