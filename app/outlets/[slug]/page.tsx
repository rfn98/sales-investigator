import { notFound } from "next/navigation";
import { SeverityBadge } from "../../../components/badges";
import {
  changeColorClass,
  formatChangePct,
  formatDayLabel,
  formatDayRangeLabel,
  formatRp,
  formatRpCompact,
  slugify,
  zScoreText,
} from "../../../components/format";
import { parseEndDate } from "../../../lib/defaults";
import { getReport } from "../../../lib/report";
import { DATA_GAPS, resolveUiProvider } from "../../../lib/ai";
import type { Evidence } from "../../../lib/analytics/types";

export const dynamic = "force-dynamic";

const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-800 hover:underline";

const severityBadge: Record<string, { color: string; emoji: string }> = {
  critical: { color: "border-rose-400/40 bg-rose-500/10 text-rose-300", emoji: "🔴" },
  high: { color: "border-orange-400/40 bg-orange-500/10 text-orange-300", emoji: "🟠" },
  medium: { color: "border-amber-400/40 bg-amber-500/10 text-amber-200", emoji: "🟡" },
  low: { color: "border-slate-400/40 bg-slate-500/10 text-slate-300", emoji: "⚪" },
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <SectionHeading>{title}</SectionHeading>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  change,
  foot,
}: {
  label: string;
  value: string;
  change?: { text: string; color: string };
  foot?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums">
        {value}
        {change && (
          <span className={`ml-2 text-sm font-semibold ${change.color}`}>
            {change.text}
          </span>
        )}
      </p>
      {foot && <p className="mt-1 text-xs text-slate-500">{foot}</p>}
    </div>
  );
}

function TrendChart({
  series,
  currentStart,
  baselineEnd,
}: {
  series: { date: string; revenue: number }[];
  currentStart: string;
  baselineEnd: string;
}) {
  const n = series.length;
  if (n < 2) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No daily revenue series available.
      </p>
    );
  }

  const W = 760;
  const H = 200;
  const PL = 64;
  const PR = 16;
  const PT = 12;
  const PB = 26;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const maxV = Math.max(...series.map((p) => p.revenue), 1);
  const x = (i: number) => PL + (i / (n - 1)) * innerW;
  const y = (v: number) => PT + innerH - (v / maxV) * innerH;
  const points = series.map((p, i) => `${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`);

  const splitIndex = series.findIndex(
    (p) => p.date >= currentStart,
  );
  const splitAt = splitIndex >= 0 ? splitIndex : Math.floor(n / 2);
  const baselinePoints = points.slice(0, Math.min(splitAt + 1, n)).join(" ");
  const currentPoints = points.slice(Math.max(0, splitAt)).join(" ");
  const sepX = x(splitAt);

  const grid = [0.25, 0.5, 0.75, 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue trend">
        {grid.map((g) => {
          const gy = y(maxV * g);
          return (
            <g key={g}>
              <line
                x1={PL}
                y1={gy}
                x2={W - PR}
                y2={gy}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={PL - 8}
                y={gy + 4}
                textAnchor="end"
                fontSize={11}
                fill="#94a3b8"
              >
                {formatRpCompact(maxV * g)}
              </text>
            </g>
          );
        })}
        <polyline
          points={baselinePoints}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={2}
        />
        <polyline
          points={currentPoints}
          fill="none"
          stroke="#f43f5e"
          strokeWidth={3}
        />
        <line
          x1={sepX}
          y1={PT}
          x2={sepX}
          y2={H - PB}
          stroke="#cbd5e1"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text x={sepX} y={H - 8} textAnchor="middle" fontSize={11} fill="#64748b">
          {formatDayLabel(currentStart)}
        </text>
        {series.length > 0 && (
          <>
            <text x={PL} y={H - 8} textAnchor="start" fontSize={11} fill="#94a3b8">
              {formatDayLabel(series[0].date)}
            </text>
            <text
              x={W - PR}
              y={H - 8}
              textAnchor="end"
              fontSize={11}
              fill="#94a3b8"
            >
              {formatDayLabel(series[n - 1].date)}
            </text>
          </>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-slate-400" /> Baseline
          ({formatDayLabel(series[0].date)}–{formatDayLabel(baselineEnd)})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-rose-500" /> Current (
          {formatDayLabel(currentStart)}–{formatDayLabel(series[n - 1].date)})
        </span>
      </div>
    </div>
  );
}

export default async function OutletDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ endDate?: string | string[] }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const endDate = parseEndDate(rawParam(sp.endDate));
  const report = await getReport(endDate);

  const finding = report.outlets.find(
    (outlet) => slugify(outlet.outletName) === slug,
  );
  if (!finding) notFound();

  const { configError } = resolveUiProvider(process.env);

  const isDecline = finding.status === "ANOMALY_DECLINE";
  const declineArrow = isDecline ? "↓" : "↑";
  const revenueChange = finding.revenue;
  const changeColor = changeColorClass(revenueChange.changePct);

  const productEvidence = finding.evidence.filter(
    (e) => e.type === "product_quantity_change",
  );
  const stockoutEvidence = finding.evidence.filter((e) => e.type === "stockout");
  const stockoutDaysBySku = new Map<string, number>();
  for (const item of stockoutEvidence) {
    if (item.productSku) {
      stockoutDaysBySku.set(item.productSku, item.days?.length ?? 0);
    }
  }
  const stockoutVerifiedBySku = new Map<string, boolean>();
  for (const item of stockoutEvidence) {
    if (item.productSku) {
      stockoutVerifiedBySku.set(item.productSku, item.zeroSalesVerified === true);
    }
  }

  const totalStockoutDays = stockoutEvidence.reduce(
    (acc, item) => acc + (item.days?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-white shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Sales Investigator
        </p>
        <a
          href={`/outlets/${slug}/investigate?endDate=${endDate}`}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Run Investigation
        </a>
      </div>

      <section>
        <a href={`/?endDate=${endDate}`} className={linkClass}>
          ← Back to Outlets
        </a>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {report.window.currentStart} → {report.window.currentEnd} (current) ·{" "}
            {report.window.baselineStart} → {report.window.baselineEnd} (baseline)
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight uppercase">
              {finding.outletName}
            </h1>
            {finding.status !== "NORMAL" && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-bold uppercase ${severityBadge[finding.severity].color}`}
              >
                <span>{severityBadge[finding.severity].emoji}</span>
                {finding.severity}
                {isDecline ? " decline" : finding.status === "ANOMALY_GROWTH" ? " growth" : ""}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {isDecline
              ? "Revenue decline investigation"
              : finding.status === "ANOMALY_GROWTH"
                ? "Revenue growth investigation"
                : "Revenue investigation"}
            {" · "}
            {formatDayRangeLabel(
              report.window.currentStart,
              report.window.currentEnd,
            )}{" "}
            vs{" "}
            {formatDayRangeLabel(
              report.window.baselineStart,
              report.window.baselineEnd,
            )}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Revenue / day
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {formatRp(revenueChange.currentDailyAvg)}
                <span
                  className={`ml-3 text-lg font-semibold ${changeColor}`}
                >
                  {declineArrow}
                  {Math.abs(revenueChange.changePct).toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>
                Baseline <span className="font-semibold text-slate-700">
                  {formatRp(revenueChange.baselineDailyAvg)}
                </span>
                /day
              </p>
              <p className="mt-0.5 text-xs">
                z-score {zScoreText(revenueChange.zScore)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">AI Investigation</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              LLM verdict, hypotheses, and recommended actions for{" "}
              {finding.outletName} — provenance-validated claims, explicit
              causality guardrails, and deterministic numbers from the audit
              engine.
            </p>
          </div>
          <a
            href={`/outlets/${slug}/investigate?endDate=${endDate}`}
            className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Run AI investigation →
          </a>
        </div>
      </section>

      {configError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {configError}
        </div>
      )}

      <section className="space-y-6">
        <div>
          <SectionHeading>What happened?</SectionHeading>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <StatCard
              label="Revenue"
              value={formatRpCompact(revenueChange.currentDailyAvg) + "/day"}
              change={{ text: `${declineArrow}${Math.abs(revenueChange.changePct).toFixed(1)}%`, color: changeColor }}
              foot={`Baseline ${formatRpCompact(revenueChange.baselineDailyAvg)}/day`}
            />
            <StatCard
              label="Active Product Lines"
              value={`${finding.activeProductLines.currentDailyAvg.toFixed(1)}/day`}
              change={{
                text: formatChangePct(finding.activeProductLines.changePct),
                color: changeColorClass(finding.activeProductLines.changePct),
              }}
              foot={`Baseline ${finding.activeProductLines.baselineDailyAvg.toFixed(1)}/day`}
            />
            <StatCard
              label="Stockout Events"
              value={String(totalStockoutDays)}
              change={
                stockoutEvidence.length > 0
                  ? { text: `${stockoutEvidence.length} affected SKU${stockoutEvidence.length === 1 ? "" : "s"}`, color: "text-slate-500" }
                  : undefined
              }
              foot={totalStockoutDays === 0 ? "No stockouts in window" : "Total stockout days"}
            />
          </div>
        </div>

        <SectionCard title="Revenue trend">
          <TrendChart
            series={finding.dailyRevenue}
            currentStart={report.window.currentStart}
            baselineEnd={report.window.baselineEnd}
          />
        </SectionCard>
      </section>

      <SectionCard title="Product evidence">
        {productEvidence.length === 0 ? (
          <p className="text-sm text-slate-500">
            No flagged product declines were detected for this outlet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2 font-semibold">Product</th>
                    <th className="py-2 pr-2 font-semibold">Revenue/day</th>
                    <th className="py-2 pr-2 font-semibold">Change</th>
                    <th className="py-2 pr-2 font-semibold">Stockout</th>
                    <th className="py-2 font-semibold">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {productEvidence.map((item) => {
                    const days = stockoutDaysBySku.get(item.productSku ?? "") ?? 0;
                    const verified = stockoutVerifiedBySku.get(item.productSku ?? "") === true;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="py-2.5 pr-2 font-medium text-slate-900">
                          {item.productSku}
                          <span className="block text-xs font-normal text-slate-500">
                            {item.productName}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 tabular-nums">
                          {formatRpCompact(item.revenueCurrentValue ?? 0)}
                        </td>
                        <td
                          className={`py-2.5 pr-2 tabular-nums font-semibold ${changeColorClass(item.revenueChangePct ?? 0)}`}
                        >
                          {formatChangePct(item.revenueChangePct ?? 0)}
                        </td>
                        <td className="py-2.5 pr-2 text-slate-600">
                          {days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "—"}
                        </td>
                        <td className="py-2.5">
                          {days > 0 && verified ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              ✓ Confirmed
                            </span>
                          ) : days > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Unverified
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              Observed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              <a href="#evidence" className={linkClass}>
                View all products →
              </a>
            </p>
          </>
        )}
      </SectionCard>

      <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
          <span>Evidence gaps &amp; limitations · {DATA_GAPS.length} gaps</span>
          <span className="text-slate-400">▼</span>
        </summary>
        <ul className="mt-3 space-y-1.5">
          {DATA_GAPS.map((gap) => (
            <li key={gap.id} className="text-sm leading-relaxed text-slate-600">
              {gap.text}
            </li>
          ))}
        </ul>
      </details>

      <SectionCard title="Cause chain">
        <ol className="list-decimal space-y-2 pl-5">
          {finding.causeChain.map((step, index) => (
            <li key={index} className="text-sm leading-relaxed text-slate-700">
              {step}
            </li>
          ))}
        </ol>
      </SectionCard>

      {finding.narrative.length > 0 && (
        <SectionCard title="Narrative">
          <p className="text-sm leading-relaxed text-slate-700">
            {finding.narrative.join(" ")}
          </p>
        </SectionCard>
      )}

      <section
        id="evidence"
        className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <SectionHeading>Evidence</SectionHeading>
        <div className="mt-2">
          {productEvidence.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product declines
              </p>
              {productEvidence.map((evidence) => (
                <ProductEvidenceRow key={evidence.id} evidence={evidence} />
              ))}
            </div>
          )}
          {stockoutEvidence.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stockouts
              </p>
              {stockoutEvidence.map((evidence) => (
                <StockoutCard key={evidence.id} evidence={evidence} />
              ))}
            </div>
          )}
          {productEvidence.length === 0 && stockoutEvidence.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">
              No additional evidence was generated for this outlet.
            </p>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Machine-readable:{" "}
        <a href={`/api/report?endDate=${endDate}`} className={linkClass}>
          /api/report?endDate={endDate}
        </a>
      </p>
    </div>
  );
}

function rawParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ProductEvidenceRow({ evidence }: { evidence: Evidence }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-slate-100 py-3 first:border-t-0">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {evidence.productSku} · {evidence.productName}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Units/day {evidence.baselineValue?.toFixed(1)} →{" "}
          {evidence.currentValue?.toFixed(1)} (
          {formatChangePct(evidence.changePct ?? 0)})
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums text-slate-700">
          Revenue/day {formatRp(evidence.revenueBaselineValue ?? 0)}
        </p>
        <p
          className={`text-xs font-semibold tabular-nums ${changeColorClass(evidence.revenueChangePct ?? 0)}`}
        >
          {formatChangePct(evidence.revenueChangePct ?? 0)} →{" "}
          {formatRp(evidence.revenueCurrentValue ?? 0)}
        </p>
        <div className="mt-1 flex justify-end">
          <SeverityBadge severity={evidence.severity} />
        </div>
      </div>
    </div>
  );
}

function StockoutCard({ evidence }: { evidence: Evidence }) {
  return (
    <div className="border-t border-slate-100 py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-900">
          {evidence.productSku} · {evidence.productName}
        </p>
        <div className="flex items-center gap-2">
          {evidence.zeroSalesVerified && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              Zero sales verified
            </span>
          )}
          <SeverityBadge severity={evidence.severity} />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">{evidence.description}</p>
      {evidence.days && evidence.days.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Affected dates: {evidence.days.map((day) => day.date).join(", ")}
        </p>
      )}
    </div>
  );
}