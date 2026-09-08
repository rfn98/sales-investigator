export function formatMoney(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatRp(value: number): string {
  return `Rp ${formatMoney(value)}`;
}

/** Compact IDR: Rp 1.59M, Rp 414K, Rp 8.5K. Rounds to <=3 significant digits. */
export function formatRpCompact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}Rp ${trimCompact(abs / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${trimCompact(abs / 1_000)}K`;
  }
  return `${sign}Rp ${Math.round(abs)}`;
}

function trimCompact(value: number): string {
  const scaled = Math.round(value * 100);
  if (scaled % 100 === 0) return String(scaled / 100);
  if (scaled % 10 === 0) return (scaled / 100).toFixed(1);
  return (scaled / 100).toFixed(2);
}

export function formatChangePct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function changeColorClass(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-500";
}

export function severityColorClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function statusColorClass(status: string): string {
  switch (status) {
    case "ANOMALY_DECLINE":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "ANOMALY_GROWTH":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export function zScoreText(z: number | null | undefined): string {
  return z == null ? "n/a" : z.toFixed(2);
}

export function formatUtcTimestamp(iso: string): string {
  return `${new Date(iso).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

/** "2026-09-01" -> "Sep 1" (explicit UTC, no local-time drift). */
export function formatDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`)
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .replace(",", "");
}

/** Two dates in the same year: "Sep 1–7, 2026". */
export function formatDayRangeLabel(start: string, end: string): string {
  const startLabel = formatDayLabel(start);
  const endLabel = formatDayLabel(end);
  const startMonth = startLabel.split(" ")[0];
  const endMonth = endLabel.split(" ")[0];
  const combined =
    startMonth === endMonth
      ? `${startLabel}–${endLabel.split(" ")[1]}`
      : `${startLabel}–${endLabel}`;
  return `${combined}, ${new Date(`${end}T00:00:00.000Z`).getUTCFullYear()}`;
}