import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Business Investigator",
  description:
    "Evidence-based business anomaly detection and cause investigation for retail outlets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-surface text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded bg-indigo-600 text-sm font-bold text-white">
                AI
              </span>
              <span className="text-lg font-semibold tracking-tight">
                Business Investigator
              </span>
            </a>
            <nav className="flex items-center gap-5 text-sm text-slate-600">
              <a
                href="/"
                className="font-medium text-indigo-600 hover:underline"
              >
                Dashboard
              </a>
              <a
                href="/api/report"
                className="font-medium text-slate-600 hover:text-indigo-600 hover:underline"
              >
                API
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-500">
            Deterministic analytics engine: Next.js + Prisma + PostgreSQL.
            CLI:{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              npm run investigate 2026-09-07
            </code>{" "}
            · Invariant checks:{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              npm run analytics:audit
            </code>
          </div>
        </footer>
      </body>
    </html>
  );
}