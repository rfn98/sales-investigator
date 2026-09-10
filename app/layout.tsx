import type { Metadata } from "next";
import Link from "next/link";
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
            {/* Brand */}
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/signal-trace-logo.png"
                alt="SignalTrace logo"
                className="h-11 w-auto"
              />

              <div className="leading-none">
                <div className="text-[15px] font-bold tracking-tight text-slate-900">
                  SignalTrace
                </div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  AI Investigation Engine
                </div>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-indigo-600"
              >
                Dashboard
              </Link>

              <a
                href="/api/report"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
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