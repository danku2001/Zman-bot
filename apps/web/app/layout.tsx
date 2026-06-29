import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZmanBot",
  description: "דשבורד לניהול תזכורות ZmanBot"
};

const navItems = [
  { href: "/", label: "בית", group: "ראשי" },
  { href: "/create", label: "יצירה מהירה", group: "ראשי" },
  { href: "/reminders", label: "כל התזכורות", group: "תזכורות" },
  { href: "/today", label: "היום", group: "תזכורות" },
  { href: "/tomorrow", label: "מחר", group: "תזכורות" },
  { href: "/week", label: "השבוע", group: "תזכורות" },
  { href: "/calendar", label: "לוח", group: "תזכורות" },
  { href: "/recurring", label: "קבועות", group: "תזכורות" },
  { href: "/overdue", label: "באיחור", group: "סטטוס" },
  { href: "/done", label: "בוצעו", group: "סטטוס" },
  { href: "/cancelled", label: "בוטלו", group: "סטטוס" },
  { href: "/search", label: "חיפוש", group: "כלים" },
  { href: "/stats", label: "סטטיסטיקות", group: "כלים" },
  { href: "/settings", label: "הגדרות וסנכרון", group: "כלים" }
];

const navGroups = [...new Set(navItems.map((item) => item.group))];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-5 rounded-lg border border-ink/10 bg-white/90 p-4 shadow-soft backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link href="/" className="text-3xl font-black tracking-normal text-ink">
                  ZmanBot
                </Link>
                <p className="mt-1 text-sm font-semibold text-ink/55">תזכורות Telegram בעברית, מסונכרנות עם דשבורד חי.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/create" className="rounded-md bg-mint px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-mint/90">
                  יצירת תזכורת
                </Link>
                <Link href="/settings" className="rounded-md border border-ink/10 px-4 py-2 text-sm font-bold text-ink transition hover:border-mint hover:text-mint">
                  בדיקת סנכרון
                </Link>
              </div>
            </div>
            <nav className="mt-4 grid gap-3 lg:grid-cols-4">
              {navGroups.map((group) => (
                <div key={group} className="rounded-md bg-ink/[0.03] p-2">
                  <p className="px-2 pb-2 text-xs font-black uppercase tracking-normal text-ink/45">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {navItems.filter((item) => item.group === group).map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-mint hover:text-mint"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </header>
          <main className="pb-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
