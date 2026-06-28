import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZmanBot",
  description: "דשבורד לניהול תזכורות ZmanBot"
};

const navItems = [
  { href: "/", label: "בית" },
  { href: "/reminders", label: "כל התזכורות" },
  { href: "/today", label: "היום" },
  { href: "/tomorrow", label: "מחר" },
  { href: "/week", label: "השבוע" },
  { href: "/recurring", label: "קבועות" },
  { href: "/overdue", label: "באיחור" },
  { href: "/search", label: "חיפוש" },
  { href: "/create", label: "יצירה" },
  { href: "/settings", label: "הגדרות" }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-2xl font-black tracking-normal text-ink">
              ZmanBot
            </Link>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-mint hover:text-mint"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
