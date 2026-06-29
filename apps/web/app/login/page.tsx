"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "התחברות נכשלה");
      return;
    }
    window.location.href = new URLSearchParams(window.location.search).get("next") ?? "/";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form onSubmit={submit} className="w-full rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <h1 className="text-3xl font-black text-ink">כניסה ל-ZmanBot</h1>
        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-bold text-ink">סיסמת דשבורד</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-ink/15 px-3 py-2 outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
          />
        </label>
        {error ? <p className="mt-3 font-bold text-coral">{error}</p> : null}
        <button className="mt-5 w-full rounded-md bg-ink px-4 py-2 font-bold text-white">כניסה</button>
      </form>
    </main>
  );
}
