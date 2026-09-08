import { StatusBadge, SeverityBadge } from "../components/badges";
import {
  changeColorClass,
  formatChangePct,
  formatDayLabel,
  formatDayRangeLabel,
  formatRpCompact,
  formatUtcTimestamp,
  slugify,
  zScoreText,
} from "../components/format";
import { parseEndDate } from "../lib/defaults";
import { getReport } from "../lib/report";

export const dynamic = "force-dynamic";

const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-800 hover:underline";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  accentText,
  badgeLabel,
  badgeColor,
  icon,
  footnote,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  accentText?: string;
  badgeLabel?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className={`text-4xl font-bold ${accentText || "text-slate-900"}`}>
              {value}
            </p>
            {sublabel && (
              <span className="text-base font-medium text-slate-500">
                {sublabel}
              </span>
            )}
          </div>
          {footnote && <p className="mt-2 text-xs text-slate-600">{footnote}</p>}
        </div>
        {icon && <span className="text-3xl">{icon}</span>}
      </div>
      {badgeLabel && (
        <div className="mt-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${badgeColor}`}
          >
            {badgeLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ endDate?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.endDate) ? params.endDate[0] : params.endDate;
  const endDate = parseEndDate(raw);
  const report = await getReport(endDate);

  // Priority logic for "INVESTIGATE FIRST"
  const criticalOutlets = report.outlets
    .filter((o) => o.status === "ANOMALY_DECLINE" || ["critical", "high"].includes(o.severity))
    .sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
      if (severityOrder[b.severity] !== severityOrder[a.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return Math.abs(b.revenue.changePct) - Math.abs(a.revenue.changePct);
    })
    .slice(0, 2);

  // Aggregate daily revenue across ALL outlets
  const dateMap = new Map<string, number>();
  for (const outlet of report.outlets) {
    for (const point of outlet.dailyRevenue) {
      dateMap.set(point.date, (dateMap.get(point.date) || 0) + point.revenue);
    }
  }
  const aggregateSeries = Array.from(dateMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const baselineSeries = aggregateSeries.filter(
    (p) => p.date < report.window.currentStart,
  );
  const currentSeries = aggregateSeries.filter(
    (p) => p.date >= report.window.currentStart,
  );
  const baselineAvg =
    baselineSeries.reduce((sum, p) => sum + p.revenue, 0) / baselineSeries.length;

  // Find inflection points in current period
  const minPoint = currentSeries.reduce((min, p) =>
    p.revenue < min.revenue ? p : min,
  );
  const maxPoint = currentSeries.reduce((max, p) =>
    p.revenue > max.revenue ? p : max,
  );

  // Aggregate stockouts
  const allStockouts = report.outlets
    .flatMap((outlet) =>
      outlet.evidence
        .filter((e) => e.type === "stockout")
        .map((e) => ({ ...e, outletSeverity: outlet.severity })),
    )
    .sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
      return severityOrder[b.outletSeverity] - severityOrder[a.outletSeverity];
    });

  const affectedSkus = new Set(allStockouts.map((s) => s.productSku)).size;

  const growthOutlet = report.outlets.find((o) => o.status === "ANOMALY_GROWTH");

  const growthPct = growthOutlet ? growthOutlet.revenue.changePct : 0;
  const stockoutCount = growthOutlet
    ? growthOutlet.evidence.filter((e) => e.type === "stockout").length
    : 0;
  const criticalStockoutCount = allStockouts.filter((s) => s.severity === "critical").length;

  const bullets: string[] = [];
  if (stockoutCount === 0) {
    bullets.push(
      "Zero stockout incidents maintained throughout the 7-day monitoring window.",
    );
  }
  if (growthPct > 20) {
    bullets.push(
      `Revenue spike of +${growthPct.toFixed(1)}% captured during current period.`,
    );
  }
  const firstCritical = report.outlets.find(
    (o) => o.status === "ANOMALY_DECLINE" && o.severity === "critical",
  );
  if (firstCritical) {
    bullets.push(
      `Candidate for cross-outlet merchandising playbook replication to ${firstCritical.outletName} node.`,
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
                Sales Investigator
              </h1>
              <span className="rounded-full border border-teal-300 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
                Deterministic Telemetry Core
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Sales & Inventory Intelligence
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-600">
                📅 Period: {formatDayRangeLabel(report.window.currentStart, report.window.currentEnd)}
              </span>
              <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-slate-600">
                ⏱ Baseline: {formatDayRangeLabel(report.window.baselineStart, report.window.baselineEnd)}
              </span>
            </div>
          </div>
          <form method="get" className="flex flex-col items-end gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              ⚡ Re Analyze
            </button>
            <div className="flex items-center gap-2">
              <label htmlFor="endDate" className="text-xs text-slate-500">
                Period end
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                max="2026-09-07"
                defaultValue={endDate}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
              />
            </div>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1">
            Current: {report.window.currentStart} → {report.window.currentEnd} (
            {report.window.currentDays} days)
          </span>
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1">
            Baseline: {report.window.baselineStart} →{" "}
            {report.window.baselineEnd} ({report.window.baselineDays} days)
          </span>
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1">
            Thresholds: outlet change ≥±{report.thresholds.outletChangePct}%,
            product change ≥±{report.thresholds.productChangePct}%
          </span>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outlets"
          value={report.summary.totalOutlets}
          sublabel="/ monitored"
          badgeLabel="All monitored"
          badgeColor="bg-emerald-100 text-emerald-800"
          icon="🏪"
          footnote="● All monitored telemetry nodes reporting"
        />
        <StatCard
          label="Declining"
          value={report.summary.anomalyDecline}
          sublabel="/ need review"
          accentText="text-rose-600"
          badgeLabel="Needs Triage"
          badgeColor="bg-amber-100 text-amber-800"
          footnote={
            <span className="flex items-center gap-1.5 text-rose-600">
              ↘ Negative deviation &gt; 35% vs baseline
            </span>
          }
        />
        <StatCard
          label="Growing"
          value={report.summary.anomalyGrowth}
          sublabel="/ opportunity"
          accentText="text-emerald-600"
          badgeLabel="Positive Lead"
          badgeColor="bg-emerald-100 text-emerald-800"
          footnote={
            <span className="flex items-center gap-1.5 text-emerald-600">
              ↗ +{Math.max(...report.outlets.filter(o => o.status === "ANOMALY_GROWTH").map(o => o.revenue.changePct))}% revenue spike captured
            </span>
          }
        />
        <StatCard
          label="Stockouts"
          value={report.summary.stockoutEvents}
          sublabel="/ events"
          accentText="text-rose-600"
          badgeLabel="Critical Alert"
          badgeColor="bg-rose-100 text-rose-800"
          footnote={
            <span className="flex items-center gap-1.5 text-rose-600">
              ! {criticalStockoutCount} high-velocity SKUs fully depleted
            </span>
          }
        />
      </section>

      {/* Investigate First */}
      {criticalOutlets.length > 0 && (
        <section className="rounded-xl border border-rose-300 bg-rose-50/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚨</span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Investigate First
              </h2>
              <span className="text-sm text-slate-600">
                {criticalOutlets.length} critical outlet
                {criticalOutlets.length === 1 ? "" : "s"} require investigation
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-rose-600">
              Critical Incident Protocol Active
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {criticalOutlets.map((outlet) => {
              const stockoutCount = outlet.evidence.filter((e) => e.type === "stockout").length;
              const declineArrow = outlet.revenue.changePct < 0 ? "↓" : "↑";
              return (
                <div
                  key={outlet.outletName}
                  className="rounded-xl border border-rose-300 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full bg-rose-500" />
                        <h3 className="font-bold uppercase text-slate-900">
                          {outlet.outletName}
                        </h3>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold uppercase text-rose-800">
                          {outlet.status === "ANOMALY_DECLINE" ? "Anomaly Detected" : "Severest Shift"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        Revenue {declineArrow}
                        {Math.abs(outlet.revenue.changePct).toFixed(1)}%
                        <span className="ml-2 font-semibold text-slate-900">
                          {formatRpCompact(outlet.revenue.currentDailyAvg)}/day
                        </span>
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        {stockoutCount > 0 ? (
                          <>
                            🍷 Stockouts detected · {stockoutCount} affected SKU
                            {stockoutCount === 1 ? "" : "s"}
                          </>
                        ) : (
                          <>🔄 Investigation recommended</>
                        )}
                      </p>
                    </div>
                    <a
                      href={`/outlets/${slugify(outlet.outletName)}/investigate?endDate=${endDate}`}
                      className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    >
                      Investigate →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Outlet Performance Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold uppercase tracking-wide text-slate-900">
                Outlet Performance
              </h2>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {report.outlets.length} displayed
                </span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                  {report.outlets.filter((o) => o.severity === "critical").length} critical
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                  {report.outlets.filter((o) => o.severity === "high").length} high
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                  {report.summary.anomalyGrowth} growth
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="🔍 Filter outlet..."
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
              />
              <select className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
                <option>⇅ Sort: Revenue</option>
                <option>⇅ Sort: Change</option>
                <option>⇅ Sort: Severity</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Outlet</th>
                <th className="px-5 py-3">Revenue / day</th>
                <th className="px-5 py-3">Change</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.outlets
                .slice()
                .sort((a, b) => b.revenue.currentDailyAvg - a.revenue.currentDailyAvg)
                .map((finding) => {
                  const isCritical =
                    finding.severity === "critical" || finding.severity === "high";
                  const iconColor =
                    finding.status === "ANOMALY_DECLINE"
                      ? "bg-rose-500"
                      : finding.status === "ANOMALY_GROWTH"
                      ? "bg-emerald-500"
                      : "bg-slate-300";
                  return (
                    <tr
                      key={finding.outletName}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <a
                          href={`/outlets/${slugify(finding.outletName)}?endDate=${endDate}`}
                          className="flex items-center gap-2 font-medium text-slate-900 hover:text-indigo-600 hover:underline"
                        >
                          <span
                            className={`inline-block h-3 w-3 rounded-full ${iconColor} ${
                              isCritical ? "" : "border-2 border-current bg-transparent"
                            }`}
                          />
                          {finding.outletName}
                        </a>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Active lines{" "}
                          {finding.activeProductLines.baselineDailyAvg.toFixed(1)}{" "}
                          → {finding.activeProductLines.currentDailyAvg.toFixed(1)}/day
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatRpCompact(finding.revenue.currentDailyAvg)}
                      </td>
                      <td
                        className={`px-5 py-3 font-semibold ${changeColorClass(
                          finding.revenue.changePct,
                        )}`}
                      >
                        {formatChangePct(finding.revenue.changePct)}
                      </td>
                      <td className="px-5 py-3">
                        {finding.severity === "critical" && (
                          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-rose-800">
                            Critical
                          </span>
                        )}
                        {finding.severity === "high" && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-amber-800">
                            High
                          </span>
                        )}
                        {finding.status === "ANOMALY_GROWTH" && (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-emerald-800">
                            Growth
                          </span>
                        )}
                        {finding.status === "NORMAL" && (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-600">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>
              Showing {report.outlets.length} of {report.summary.totalOutlets} outlets
              in live scope
            </span>
            <a href="/" className={linkClass}>
              View all outlets →
            </a>
          </div>
        </div>
      </section>

      {/* Network Signals Chart */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold uppercase tracking-wide text-slate-900">
              Network Signals
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Revenue trend across outlets · Current period vs baseline
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-teal-600" />
              Current ({formatDayLabel(report.window.currentStart)}–
              {formatDayLabel(report.window.currentEnd)})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-slate-400" />
              Baseline ({formatDayLabel(report.window.baselineStart)}–
              {formatDayLabel(report.window.baselineEnd)})
            </span>
          </div>
        </div>
        <div className="mt-4">
          <NetworkSignalsChart
            currentSeries={currentSeries}
            baselineAvg={baselineAvg}
            baselineDays={report.window.baselineDays}
            currentStart={report.window.currentStart}
            currentEnd={report.window.currentEnd}
            minPoint={minPoint}
            maxPoint={maxPoint}
            criticalOutlets={criticalOutlets.slice(0, 2)}
          />
        </div>
      </section>

      {/* Bottom Split Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inventory Signals */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍷</span>
              <h2 className="font-semibold uppercase tracking-wide text-slate-900">
                Inventory Signals
              </h2>
            </div>
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase text-rose-800">
              Stockout Warning
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Critical Events
              </p>
              <p className="mt-1 text-2xl font-bold text-rose-600">
                {allStockouts.length} stockout events
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                High Velocity Depletion
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {affectedSkus} affected SKUs
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {allStockouts.slice(0, 3).map((stockout) => {
              const duration = stockout.days?.length || 0;
              const estimatedLoss = stockout.revenueBaselineValue || 0;
              return (
                <div
                  key={stockout.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {stockout.productSku}{" "}
                        <span className="font-normal text-slate-600">
                          {stockout.productName}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {stockout.zeroSalesVerified ? (
                          <>
                            ● Out of Stock since {duration}d · Estimated Daily
                            Revenue Loss: {formatRpCompact(estimatedLoss)}
                          </>
                        ) : (
                          <>
                            ● Intermittent zero-stock · Buffer volatility
                            detected
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        stockout.zeroSalesVerified
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {stockout.zeroSalesVerified ? "Zero Stock" : "Intermittent"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <a href="/" className={linkClass}>
              [View stockouts →]
            </a>
          </div>
        </section>

        {/* Growth Opportunities */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <h2 className="font-semibold uppercase tracking-wide text-slate-900">
                Growth Opportunities
              </h2>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase text-emerald-800">
              Positive Alpha
            </span>
          </div>

          {growthOutlet ? (
            <>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Outlet Highlight
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {growthOutlet.outletName}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Growth Metric
                </p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">
                  +{growthPct.toFixed(1)}% revenue
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm italic text-indigo-900">
                "{growthOutlet.narrative.length > 0 ? growthOutlet.narrative[0] : "Investigate what's driving this growth and whether it can be replicated."}"
              </div>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full bg-emerald-500 text-center text-xs font-bold leading-4 text-white">
                      ✓
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No growth opportunities detected in this window.
            </p>
          )}
        </section>
      </div>

      {/* Footer Methodology */}
      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span>
            <span className="font-semibold uppercase text-slate-700">Methodology:</span>{" "}
            Rolling 7-day baseline · 28-day comparison · deterministic signals
          </span>
        </div>
        <a href="/" className={linkClass}>
          [View methodology]
        </a>
      </section>
    </div>
  );
}

function NetworkSignalsChart({
  currentSeries,
  baselineAvg,
  baselineDays,
  currentStart,
  currentEnd,
  minPoint,
  maxPoint,
  criticalOutlets,
}: {
  currentSeries: { date: string; revenue: number }[];
  baselineAvg: number;
  baselineDays: number;
  currentStart: string;
  currentEnd: string;
  minPoint: { date: string; revenue: number };
  maxPoint: { date: string; revenue: number };
  criticalOutlets: Array<{ outletName: string; revenue: any }>;
}) {
  const W = 800;
  const H = 240;
  const PL = 64;
  const PR = 16;
  const PT = 20;
  const PB = 40;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const n = currentSeries.length;
  const maxV = Math.max(
    ...currentSeries.map((p) => p.revenue),
    baselineAvg * 1.2,
  );
  const minV = 0;
  const x = (i: number) => PL + (i / (n - 1)) * innerW;
  const y = (v: number) => PT + innerH - ((v - minV) / (maxV - minV)) * innerH;
  const points = currentSeries
    .map((p, i) => `${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`)
    .join(" ");
  const baselineY = y(baselineAvg);

  // Find critical outlet contributing most to min
  const criticalOnDate = criticalOutlets.slice(0, 2).map((o) => o.outletName).join("/");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Aggregate revenue trend">
        {/* Y-axis grid */}
        {[0.25, 0.5, 0.75, 1].map((g) => {
          const gy = y(minV + (maxV - minV) * g);
          return (
            <g key={g}>
              <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="#e2e8f0" strokeWidth={1} />
              <text
                x={PL - 8}
                y={gy + 4}
                textAnchor="end"
                fontSize={11}
                fill="#94a3b8"
              >
                {formatRpCompact(minV + (maxV - minV) * g)}
              </text>
            </g>
          );
        })}
        {/* Baseline dotted line */}
        <line
          x1={PL}
          y1={baselineY}
          x2={W - PR}
          y2={baselineY}
          stroke="#94a3b8"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        {/* Current solid line */}
        <polyline points={points} fill="none" stroke="#0369a1" strokeWidth={3} />
        {/* Inflection markers */}
        {[minPoint, maxPoint].map((pt, idx) => {
          const ptIdx = currentSeries.indexOf(pt);
          const cx = x(ptIdx);
          const cy = y(pt.revenue);
          const color = idx === 0 ? "#dc2626" : "#10b981";
          return (
            <g key={pt.date}>
              <circle cx={cx} cy={cy} r={5} fill={color} />
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill={color}
              >
                {formatDayLabel(pt.date)}
              </text>
            </g>
          );
        })}
        {/* X-axis labels */}
        {currentSeries.map((pt, i) => (
          <text
            key={pt.date}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill={
              pt === minPoint ? "#dc2626" : pt === maxPoint ? "#10b981" : "#64748b"
            }
            fontWeight={pt === minPoint || pt === maxPoint ? "bold" : "normal"}
          >
            {new Date(pt.date + "T00:00:00Z").toLocaleDateString("en-US", {
              weekday: "short",
              timeZone: "UTC",
            })}
          </text>
        ))}
      </svg>
      <div className="mt-4 rounded-lg border border-rose-300 bg-white p-3 text-sm shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-rose-600">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
          DIVERGENCE INFLECTION: {formatDayLabel(minPoint.date).toUpperCase()}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {(() => {
            const dropPct = ((minPoint.revenue - baselineAvg) / baselineAvg * 100).toFixed(1);
            return `${criticalOnDate} Outage: ${dropPct}% vs baseline`;
          })()}
        </p>
      </div>
    </div>
  );
}