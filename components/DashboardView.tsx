"use client";

import { formatDayRangeLabel, slugify } from "./format";
import { formatCompactIDR } from "../lib/ui/format";
import MethodologyBar from "./MethodologyBar";
import StockoutDrawer from "./StockoutDrawer";
import DatePicker from "./DatePicker";
import type { Report } from "../lib/analytics/types";

export default function DashboardView({
  report,
  endDate,
  maxDate,
  minDate,
  onInvestigate,
}: {
  report: Report;
  endDate: string;
  maxDate: string;
  minDate: string;
  onInvestigate: (slug: string) => void;
}) {
  // Helper function to maintain unified taxonomy
  const getBadgeStatus = (outlet: any) => {
    if (outlet.severity === 'critical') return 'CRITICAL';
    if (outlet.severity === 'high') return 'HIGH';
    if (outlet.status === 'ANOMALY_GROWTH') return 'GROWTH';
    return 'NORMAL';
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'HIGH': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'GROWTH': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  // Priority logic for "INVESTIGATE FIRST"
  const priorityOutlets = report.outlets
    .filter((o) => ["critical", "high"].includes(o.severity))
    .sort((a, b) => {
      const getPriority = (o: any) => o.severity === 'critical' ? 2 : 1;
      return getPriority(b) - getPriority(a);
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

  const minPoint = currentSeries.reduce((min, p) =>
    p.revenue < min.revenue ? p : min,
  );
  const maxPoint = currentSeries.reduce((max, p) =>
    p.revenue > max.revenue ? p : max,
  );

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

  const baselineRevenueLookup = report.outlets.flatMap((outlet) =>
    outlet.evidence
      .filter((e) => e.type === "product_quantity_change" && e.productSku)
      .map((e) => ({
        outletName: outlet.outletName,
        productSku: e.productSku as string,
        revenueBaselineValue: e.revenueBaselineValue ?? 0,
      })),
  );

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
    <div className="space-y-6">
      {/* 1. TOP HEADER BANNER */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Investigation Dashboard
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Sales &amp; Inventory Intelligence
            </h1>

            <p className="max-w-2xl text-sm text-slate-600">
              Detect anomalies, investigate root causes, and identify revenue impact
              across your outlets.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2 font-mono-data text-xs">
              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                <span className="material-symbols-outlined mr-1.5 text-[13px] text-indigo-500">
                  calendar_month
                </span>
                Current:{" "}
                <span className="ml-1 font-semibold text-slate-700">
                  {formatDayRangeLabel(
                    report.window.currentStart,
                    report.window.currentEnd
                  )}
                </span>
              </span>

              <span className="text-slate-300">vs</span>

              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                <span className="material-symbols-outlined mr-1.5 text-[13px] text-slate-500">
                  history
                </span>
                Baseline:{" "}
                <span className="ml-1 font-semibold text-slate-700">
                  {formatDayRangeLabel(
                    report.window.baselineStart,
                    report.window.baselineEnd
                  )}
                </span>
              </span>
            </div>
          </div>

          <div className="self-start lg:self-center">
            <DatePicker
              name="endDate"
              value={endDate}
              min={minDate}
              max={maxDate}
            />
          </div>
        </div>
      </section>

      {/* 2. FOUR KPI METRIC CARDS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: OUTLETS */}
        <div className="bg-white border border-slate-200 rounded p-4 hover:border-slate-300 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-caps font-label-caps text-slate-500 uppercase tracking-wider">OUTLETS</span>
            <span className="material-symbols-outlined text-slate-400 text-[16px]" data-icon="store">
              store
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-headline-xl font-headline-xl font-bold text-slate-900 font-mono-data">
              {report.summary.totalOutlets}
            </span>
            <span className="text-body-sm font-body-sm text-slate-500">/ monitored</span>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-label-caps font-label-caps text-slate-600">
            <span className="w-1.5 h-1.5 rounded bg-slate-400"></span>
            <span className="text-xs">All monitored outlets reporting data</span>
          </div>
        </div>
        {/* Card 2: DECLINING */}
        <div className="bg-white border border-slate-200 rounded p-4 hover:border-rose-300 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-caps font-label-caps text-slate-500 uppercase tracking-wider">DECLINING</span>
            <span className="px-1.5 py-0.5 text-[10px] font-label-caps font-bold uppercase rounded bg-amber-50 text-amber-700 border border-amber-200">
              Needs Triage
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-headline-xl font-headline-xl font-bold text-rose-600 font-mono-data">
              {report.summary.anomalyDecline}
            </span>
            <span className="text-body-sm font-body-sm text-rose-600">/ need review</span>
          </div>
          <div className="mt-3 flex items-center space-x-1 text-label-caps font-label-caps text-rose-600">
            <span className="material-symbols-outlined text-[14px]" data-icon="trending_down">
              trending_down
            </span>
            <span className="text-xs">Revenue decline exceeds the review threshold</span>
          </div>
        </div>
        {/* Card 3: GROWING */}
        <div className="bg-white border border-slate-200 rounded p-4 hover:border-emerald-300 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-caps font-label-caps text-slate-500 uppercase tracking-wider">GROWING</span>
            <span className="px-1.5 py-0.5 text-[10px] font-label-caps font-bold uppercase rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Positive Lead
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-headline-xl font-headline-xl font-bold text-emerald-600 font-mono-data">
              {report.summary.anomalyGrowth}
            </span>
            <span className="text-body-sm font-body-sm text-emerald-600">/ opportunity</span>
          </div>
          <div className="mt-3 flex items-center space-x-1 text-label-caps font-label-caps text-emerald-600">
            <span className="material-symbols-outlined text-[14px]" data-icon="trending_up">
              trending_up
            </span>
            <span className="text-xs">Revenue growth exceeds the +20% threshold</span>
          </div>
        </div>
        {/* Card 4: STOCKOUTS */}
        <div className="bg-white border rounded p-4 hover:border-rose-300 transition-colors shadow-sm relative border-rose-200">
          <div className="flex items-center justify-between">
            <span className="text-label-caps font-label-caps text-slate-500 uppercase tracking-wider">STOCKOUTS</span>
            <span className="px-1.5 py-0.5 text-[10px] font-label-caps font-bold uppercase rounded bg-rose-100 text-rose-700 border border-rose-200">
              Critical Alert
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-headline-xl font-headline-xl font-bold text-rose-600 font-mono-data">
              {report.summary.stockoutEvents}
            </span>
            <span className="text-body-sm font-body-sm text-rose-600">/ stockout days</span>
          </div>
          <div className="mt-3 flex items-center space-x-2 text-label-caps font-label-caps text-rose-600">
            <span className="material-symbols-outlined text-[14px]" data-icon="error_outline">
              error_outline
            </span>
            <span className="text-xs">{criticalStockoutCount} SKUs recorded verified stockouts</span>
          </div>
        </div>
      </section>

      {/* 3. INVESTIGATE FIRST SECTION */}
      {priorityOutlets.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-2">
              <h2 className="text-headline-md font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span className="material-symbols-outlined text-rose-600 text-[22px] align-middle">
                  warning
                </span>
                INVESTIGATE FIRST
              </h2>

              <span className="text-body-sm text-slate-500">
                {priorityOutlets.length} high-priority outlet
                {priorityOutlets.length === 1 ? "" : "s"} require investigation
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-base">
            {priorityOutlets.map((outlet) => {
              const stockoutCount = outlet.evidence.filter(
                (e) => e.type === "stockout"
              ).length;

              const isHighPriority =
                outlet.severity === "critical" || outlet.severity === "high";

              return (
                <div
                  key={outlet.outletName}
                  className="bg-red-50/40 border-l-4 border-l-rose-600 border border-rose-200 rounded p-space-md relative overflow-hidden shadow-sm"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-headline-sm font-bold text-slate-900 tracking-wide">
                          🔴 {outlet.outletName.toUpperCase()}
                        </h3>

                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-mono-data rounded border uppercase font-bold ${getBadgeColor(
                            getBadgeStatus(outlet)
                          )}`}
                        >
                          {getBadgeStatus(outlet)}
                        </span>
                      </div>

                      {/* Primary signal */}
                      <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                        <span className="text-headline-md text-rose-600 font-bold font-mono-data">
                          Revenue ↓
                          {Math.abs(outlet.revenue.changePct).toFixed(1)}%
                        </span>

                        <span className="text-body-md font-mono-data text-slate-600">
                          {formatCompactIDR(outlet.revenue.currentDailyAvg)}/day
                        </span>
                      </div>
                    </div>

                    {/* Investigation CTA */}
                    {isHighPriority && (
                      <button
                        onClick={() => onInvestigate(slugify(outlet.outletName))}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-label-caps font-label-caps font-bold flex items-center gap-1 shadow-sm active:scale-[0.98] transition-all shrink-0 cursor-pointer"
                      >
                        <span>Investigate</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>

                  {/* Evidence summary */}
                  <div className="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between text-body-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-rose-600 text-[15px]"
                        data-icon={stockoutCount > 0 ? "inventory" : "troubleshoot"}
                      >
                        {stockoutCount > 0 ? "inventory" : "troubleshoot"}
                      </span>

                      {stockoutCount > 0 ? (
                        <>
                          <span className="text-slate-900 font-medium">
                            Inventory evidence
                          </span>

                          <span>·</span>

                          <span className="text-rose-600 font-mono-data font-semibold">
                            {stockoutCount} affected SKU
                            {stockoutCount === 1 ? "" : "s"}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-900 font-medium">
                          Additional evidence required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. OUTLET PERFORMANCE TABLE */}
      <section className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
        <div className="p-space-md border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <h3 className="text-headline-sm font-bold text-slate-900">OUTLET PERFORMANCE</h3>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 text-label-caps font-label-caps">
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono-data">{report.outlets.length} displayed</span>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-mono-data">{report.outlets.filter(o => o.severity === 'critical').length} critical</span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono-data">{report.outlets.filter(o => o.severity === 'high').length} high</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono-data">{report.outlets.filter(o => o.status === 'ANOMALY_GROWTH').length} growth</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-body-sm">
            <thead>
              <tr className="h-9 bg-slate-100/70 text-label-caps font-label-caps text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-2 font-bold">Outlet</th>
                <th className="px-4 py-2 font-bold">Revenue/day</th>
                <th className="px-4 py-2 font-bold">Change</th>
                <th className="px-4 py-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono-data text-body-sm">
              {report.outlets
                .slice()
                .sort((a, b) => {
                  const aPriority = a.severity === 'critical' ? 4 : a.severity === 'high' ? 3 : a.status === 'ANOMALY_GROWTH' ? 2 : 1;
                  const bPriority = b.severity === 'critical' ? 4 : b.severity === 'high' ? 3 : b.status === 'ANOMALY_GROWTH' ? 2 : 1;
                  if (bPriority !== aPriority) return bPriority - aPriority;
                  return b.revenue.currentDailyAvg - a.revenue.currentDailyAvg;
                })
                .map((outlet) => {
                const badgeStatus = getBadgeStatus(outlet);
                const isCritical = outlet.severity === 'critical';
                const isHigh = outlet.severity === 'high';
                const isGrowth = outlet.status === 'ANOMALY_GROWTH';
                const borderClass = isCritical ? 'border-l-rose-600' : isHigh ? 'border-l-amber-500' : isGrowth ? 'border-l-emerald-500' : '';
                return (
                  <tr key={outlet.outletName} className={`h-10 hover:bg-slate-50 transition-colors border-l-2 ${borderClass}`}>
                    <td className="px-4 py-2 text-slate-900 font-bold flex items-center space-x-2">
                      <span>{isCritical ? '🔴' : isHigh ? '🟠' : isGrowth ? '🟢' : '⚪'}</span>
                      <span>{outlet.outletName}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-900 font-semibold">{formatCompactIDR(outlet.revenue.currentDailyAvg)}</td>
                    <td className={`px-4 py-2 font-bold ${outlet.revenue.changePct < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {outlet.revenue.changePct > 0 ? '+' : ''}{outlet.revenue.changePct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-[10px] font-label-caps uppercase rounded border font-bold ${getBadgeColor(badgeStatus)}`}>
                        {badgeStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>


      {/* Bottom Grid: Inventory Signals & Growth Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INVENTORY SIGNALS */}
        <section className="bg-white border border-slate-200 rounded p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <span
                  className="material-symbols-outlined text-amber-600"
                  data-icon="inventory_2"
                >
                  inventory_2
                </span>

                <h3 className="text-headline-sm font-bold text-slate-900">
                  INVENTORY SIGNALS
                </h3>
              </div>

              {allStockouts.length > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-data uppercase bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                  STOCKOUT DETECTED
                </span>
              )}
            </div>

            {allStockouts.length > 0 ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                    <div className="text-label-caps font-label-caps text-slate-500 uppercase">
                      Stockout Events
                    </div>

                    <div className="text-headline-md font-bold text-amber-600 font-mono-data">
                      {allStockouts.length}
                    </div>
                  </div>

                  <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                    <div className="text-label-caps font-label-caps text-slate-500 uppercase">
                      Affected SKUs
                    </div>

                    <div className="text-headline-md font-bold text-slate-900 font-mono-data">
                      {affectedSkus}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {allStockouts.slice(0, 2).map((stockout) => {
                    const duration = stockout.days?.length || 0;

                    return (
                      <div
                        key={stockout.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-body-sm font-mono-data font-bold text-primary">
                              {stockout.productSku}
                            </span>

                            <span className="text-body-sm font-body-sm text-slate-900 font-semibold">
                              {stockout.productName}
                            </span>
                          </div>

                          <p
                            className={`text-[11px] font-mono-data mt-0.5 flex items-center gap-1 font-medium ${
                              stockout.zeroSalesVerified
                                ? "text-rose-600"
                                : "text-amber-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                stockout.zeroSalesVerified
                                  ? "bg-rose-600"
                                  : "bg-amber-500"
                              }`}
                            />

                            <span>
                              {stockout.zeroSalesVerified
                                ? `Stockout · ${duration} day${duration !== 1 ? "s" : ""} · Zero sales verified`
                                : `Stockout detected · ${duration} day${duration !== 1 ? "s" : ""}`}
                            </span>
                          </p>
                        </div>

                        <span
                          className={`px-2 py-1 rounded text-[10px] font-label-caps uppercase font-bold shrink-0 ${
                            stockout.zeroSalesVerified
                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {stockout.zeroSalesVerified
                            ? "VERIFIED"
                            : "DETECTED"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <h4 className="text-headline-sm font-bold text-slate-900">
                  NO VERIFIED STOCKOUTS
                </h4>

                <p className="mt-2 text-body-sm text-slate-600">
                  No stockout events were detected in the analysis window.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <StockoutDrawer
              window={{
                currentStart: report.window.currentStart,
                currentEnd: report.window.currentEnd,
                baselineStart: report.window.baselineStart,
                baselineEnd: report.window.baselineEnd,
              }}
              stockouts={allStockouts.map((s) => ({
                id: s.id,
                outletName: s.outletName,
                productSku: s.productSku ?? "",
                productName: s.productName ?? "",
                days: s.days ?? [],
                zeroSalesVerified: Boolean(s.zeroSalesVerified),
              }))}
              baselineRevenueLookup={baselineRevenueLookup}
            />
          </div>
        </section>

        {/* GROWTH OPPORTUNITIES */}
        <section className="bg-white border border-slate-200 rounded p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <span
                  className="material-symbols-outlined text-emerald-600"
                  data-icon="auto_graph"
                >
                  auto_graph
                </span>

                <h3 className="text-headline-sm font-bold text-slate-900">
                  GROWTH OPPORTUNITIES
                </h3>
              </div>

              {growthOutlet && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-data uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                  POSITIVE SIGNAL
                </span>
              )}
            </div>

            {growthOutlet ? (
              <>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                  <div>
                    <span className="text-label-caps font-label-caps text-slate-500 uppercase">
                      Outlet Highlight
                    </span>

                    <h4 className="text-headline-md font-bold text-slate-900 mt-0.5">
                      {growthOutlet.outletName}
                    </h4>
                  </div>

                  <div className="text-right">
                    <span className="text-label-caps font-label-caps text-slate-500 uppercase">
                      Revenue Change
                    </span>

                    <div className="text-headline-md font-bold text-emerald-600 font-mono-data mt-0.5">
                      +{growthPct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-label-caps font-label-caps text-slate-500 uppercase mb-2">
                    Observed Signal
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded">
                    <p className="text-body-sm font-body-sm text-emerald-950 leading-relaxed">
                      Revenue increased{" "}
                      <strong>{growthPct.toFixed(1)}%</strong> during the
                      analysis window compared with the baseline period.
                    </p>
                  </div>
                </div>

                {bullets.length > 0 && (
                  <ul className="mt-3 space-y-2 text-body-sm font-body-sm text-slate-600">
                    {bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0 mt-0.5"
                          data-icon="check_circle"
                        >
                          check_circle
                        </span>

                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <h4 className="text-headline-sm font-bold text-slate-900">
                  NO GROWTH OPPORTUNITIES
                </h4>

                <p className="mt-2 text-body-sm text-slate-600">
                  No outlets exceeded the growth threshold in the analysis window.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Methodology Bar */}
      <MethodologyBar />
    </div>
  );
}