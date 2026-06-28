"use client";

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
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-ink">Chat ID</span>
      <input
        value={chatId}
        onChange={(event) => {
          onChange(event.target.value);
          saveChatId(event.target.value);
        }}
        placeholder="לדוגמה: 123456789"
        className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
      />
    </label>
  );
}
