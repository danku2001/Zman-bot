"use client";

import { useEffect, useState } from "react";
import { getKnownChats } from "../lib/api";

export function getStoredChatId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("zmanbot:chatId") ?? "";
}

export function saveChatId(chatId: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem("zmanbot:chatId", chatId);
}

export function ChatIdField({
  chatId,
  onChange
}: {
  chatId: string;
  onChange: (value: string) => void;
}) {
  const [knownChats, setKnownChats] = useState<Array<{ chatId: string; total: number; latestActivityAt: string | null }>>([]);

  useEffect(() => {
    let active = true;
    getKnownChats()
      .then((data) => {
        if (active) setKnownChats(data.chats);
      })
      .catch(() => {
        if (active) setKnownChats([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateChatId(value: string) {
    onChange(value);
    saveChatId(value);
  }

  return (
    <div className="block">
      <label>
        <span className="mb-2 block text-sm font-bold text-ink">Chat ID</span>
        <input
          value={chatId}
          onChange={(event) => updateChatId(event.target.value)}
          placeholder="לדוגמה: 123456789"
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
        />
      </label>
      {!chatId && knownChats.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {knownChats.map((chat) => (
            <button
              key={chat.chatId}
              type="button"
              onClick={() => updateChatId(chat.chatId)}
              className="rounded-md border border-mint/30 bg-mint/10 px-2 py-1 text-xs font-bold text-ink transition hover:bg-mint hover:text-white"
            >
              השתמש ב-{chat.chatId} ({chat.total})
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
