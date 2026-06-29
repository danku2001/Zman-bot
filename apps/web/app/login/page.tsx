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
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-6 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-lg bg-ink p-8 text-white shadow-soft">
        <p className="text-sm font-black text-mint">ZmanBot</p>
        <h1 className="mt-3 text-4xl font-black leading-tight">דשבורד תזכורות פרטי, מסונכרן עם Telegram.</h1>
        <p className="mt-4 leading-7 text-white/70">
          הכניסה מוגנת בסיסמת דשבורד. אחרי ההתחברות הדפדפן משתמש ב-cookie מאובטח, בלי לחשוף API secrets ל-JavaScript.
        </p>
        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md bg-white/10 p-3 font-bold">Postgres</div>
          <div className="rounded-md bg-white/10 p-3 font-bold">Webhook</div>
          <div className="rounded-md bg-white/10 p-3 font-bold">Scheduler</div>
        </div>
      </section>
      <form onSubmit={submit} className="w-full rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-black text-mint">כניסה מאובטחת</p>
        <h2 className="mt-1 text-3xl font-black text-ink">כניסה ל-ZmanBot</h2>
        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-bold text-ink">סיסמת דשבורד</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-ink/15 px-3 py-3 outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15"
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="mt-3 rounded-md bg-coral/10 p-3 font-bold text-coral">{error}</p> : null}
        <button className="mt-5 w-full rounded-md bg-ink px-4 py-3 font-black text-white transition hover:bg-ink/85">כניסה</button>
      </form>
    </main>
  );
}
