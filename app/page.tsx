import { StatusBadge, SeverityBadge } from "../components/badges";
import {
  changeColorClass,
  formatChangePct,
  formatDayRangeLabel,
  formatRpCompact,
  formatUtcTimestamp,
  slugify,
} from "../components/format";
import { formatCompactIDR } from "../lib/ui/format";
import MethodologyBar from "../components/MethodologyBar";
import { parseEndDate } from "../lib/defaults";
import { getReport } from "../lib/report";
import { getMaxSalesDate } from "../lib/db";

export const dynamic = "force-dynamic";

const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-800 hover:underline";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ endDate?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.endDate) ? params.endDate[0] : params.endDate;
  const endDate = parseEndDate(raw);
  const report = await getReport(endDate);
  const maxDate = await getMaxSalesDate();

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
      <section className="bg-white border border-slate-200 rounded p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-headline-lg text-slate-900 tracking-tight font-headline-lg font-bold">
            SALES INVESTIGATOR
          </h1>

          <p className="text-body-md text-slate-600 font-body-md">
            AI Investigation Engine for Sales &amp; Inventory
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono-data text-body-sm">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
              <span className="material-symbols-outlined text-[13px] mr-1 text-primary">
                calendar_month
              </span>
              Period: {formatDayRangeLabel(report.window.currentStart, report.window.currentEnd)}
            </span>

            <span className="text-slate-300">·</span>

            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
              <span className="material-symbols-outlined text-[13px] mr-1 text-slate-500">
                history
              </span>
              Baseline: {formatDayRangeLabel(report.window.baselineStart, report.window.baselineEnd)}
            </span>
          </div>
        </div>

        <form
          method="get"
          className="flex flex-col sm:flex-row sm:items-end gap-2.5 self-start lg:self-center"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="endDate"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
            >
              Analysis date
            </label>

            <input
              id="endDate"
              name="endDate"
              type="date"
              max={maxDate}
              defaultValue={endDate}
              className="h-9 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            className="h-9 flex items-center justify-center gap-2 px-4 bg-primary hover:bg-primary-container text-white rounded text-label-caps font-label-caps font-bold shadow-sm active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">
              bolt
            </span>
            <span>Re-analyze</span>
          </button>
        </form>
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
          <div className="mt-3 flex items-center space-x-1 text-label-caps font-label-caps text-rose-600">
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
            <div className="flex items-baseline space-x-2">
              <h2 className="text-headline-md font-bold text-slate-900 tracking-tight">🚨 INVESTIGATE FIRST</h2>
              <span className="text-body-sm text-slate-500">{priorityOutlets.length} high-priority outlet{priorityOutlets.length === 1 ? "" : "s"} require investigation</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-base">
            {priorityOutlets.map((outlet) => {
              const stockout = outlet.evidence.find((e) => e.type === "stockout");
              const isStockout = !!stockout;
              return (
                <div key={outlet.outletName} className="bg-red-50/40 border-l-4 border-l-rose-600 border border-rose-200 rounded p-space-md relative overflow-hidden shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-headline-sm font-bold text-slate-900 tracking-wide">🔴 {outlet.outletName.toUpperCase()}</h3>
                        <span className={`px-1.5 py-0.5 text-[9px] font-mono-data rounded border uppercase font-bold ${getBadgeColor(getBadgeStatus(outlet))}`}>
                          {getBadgeStatus(outlet)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline space-x-3">
                        <span className="text-headline-md text-rose-600 font-bold font-mono-data">Revenue ↓{Math.abs(outlet.revenue.changePct).toFixed(1)}%</span>
                        <span className="text-body-md font-mono-data text-slate-600">{formatCompactIDR(outlet.revenue.currentDailyAvg)}/day</span>
                      </div>
                    </div>
                    <a href={`/outlets/${slugify(outlet.outletName)}/investigate`} className={`px-3 py-1.5 text-white rounded text-label-caps font-label-caps font-bold flex items-center space-x-1 shadow-sm active:scale-[0.98] transition-all ${
                      outlet.severity === 'critical' || outlet.severity === 'high' ? 'bg-rose-600 hover:bg-rose-700' : outlet.status === 'ANOMALY_GROWTH' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'
                    }`} style={outlet.severity !== 'critical' && outlet.severity !== 'high' && outlet.status !== 'ANOMALY_GROWTH' ? { pointerEvents: 'none' } : {}}>
                      <span>{outlet.severity === 'critical' || outlet.severity === 'high' ? 'Investigate' : outlet.status === 'ANOMALY_GROWTH' ? 'Explore' : '—'} →</span>
                    </a>
                  </div>
                  <div className="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between text-body-sm text-slate-600">
                    <div className="flex items-center space-x-2">
                      <span className="material-symbols-outlined text-rose-600 text-[15px]" data-icon={isStockout ? "inventory" : "troubleshoot"}>
                        {isStockout ? "inventory" : "troubleshoot"}
                      </span>
                      <span className="text-slate-900 font-medium">{isStockout ? "Stockouts detected" : "Investigation recommended"}</span>
                      {isStockout && (
                        <>
                          <span className="">·</span>
                          <span className="text-rose-600 font-mono-data font-semibold">{outlet.evidence.filter((e) => e.type === "stockout").length} affected SKU{outlet.evidence.filter((e) => e.type === "stockout").length === 1 ? "" : "s"}</span>
                        </>
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
                  const priorityOrder = { critical: 4, high: 3, ANOMALY_GROWTH: 2, NORMAL: 1 };
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
                <span className="material-symbols-outlined text-rose-600" data-icon="inventory_2">inventory_2</span>
                <h3 className="text-headline-sm font-bold text-slate-900">INVENTORY SIGNALS</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-data uppercase bg-rose-100 text-rose-700 border border-rose-200 font-bold">
                Stockout Warning
              </span>
            </div>

            {allStockouts.length > 0 ? (
              <>
                <div className="mt-3 flex items-center space-x-4">
                  <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                    <div className="text-label-caps font-label-caps text-slate-500 uppercase">Critical Events</div>
                    <div className="text-headline-md font-bold text-rose-600 font-mono-data">{allStockouts.length} stockout events</div>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                    <div className="text-label-caps font-label-caps text-slate-500 uppercase">High Velocity Depletion</div>
                    <div className="text-headline-md font-bold text-slate-900 font-mono-data">{affectedSkus} affected SKUs</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {allStockouts.slice(0, 2).map((stockout) => {
                    const duration = stockout.days?.length || 0;
                    return (
                      <div key={stockout.id} className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-body-sm font-mono-data font-bold text-primary">{stockout.productSku}</span>
                            <span className="text-body-sm font-body-sm text-slate-900 font-semibold">{stockout.productName}</span>
                          </div>
                          <p className={`text-[11px] font-mono-data mt-0.5 flex items-center space-x-1 font-medium ${stockout.zeroSalesVerified ? 'text-rose-600' : 'text-amber-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${stockout.zeroSalesVerified ? 'bg-rose-600' : 'bg-amber-500'}`}></span>
                            <span>
                              {stockout.zeroSalesVerified ? (
                                <>Out of Stock since {duration}d · Estimated Daily Revenue Loss: {formatCompactIDR(stockout.revenueBaselineValue || 0)}</>
                              ) : (
                                <>Intermittent zero-stock · Buffer volatility detected</>
                              )}
                            </span>
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-label-caps uppercase font-bold ${
                          stockout.zeroSalesVerified ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {stockout.zeroSalesVerified ? 'Zero Stock' : 'Intermittent'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <h4 className="text-headline-sm font-bold text-slate-900">NO VERIFIED STOCKOUTS</h4>
                <p className="mt-2 text-body-sm text-slate-600">No stockout events were detected in the analysis window.</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-label-caps font-label-caps text-primary font-bold flex items-center justify-center space-x-1 active:scale-[0.99] transition-transform">
              <span>View stockouts →</span>
            </button>
          </div>
        </section>

        {/* GROWTH OPPORTUNITIES */}
        <section className="bg-white border border-slate-200 rounded p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-emerald-600" data-icon="auto_graph">auto_graph</span>
                <h3 className="text-headline-sm font-bold text-slate-900">GROWTH OPPORTUNITIES</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-data uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                Positive Alpha
              </span>
            </div>

            {growthOutlet ? (
              <>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                  <div>
                    <span className="text-label-caps font-label-caps text-slate-500 uppercase">Outlet Highlight</span>
                    <h4 className="text-headline-md font-bold text-slate-900 mt-0.5">{growthOutlet.outletName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-label-caps font-label-caps text-slate-500 uppercase">Growth Metric</span>
                    <div className="text-headline-md font-bold text-emerald-600 font-mono-data mt-0.5">+{growthPct.toFixed(1)}% revenue</div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded">
                  <p className="text-body-md font-body-md text-emerald-950 italic font-medium">
                    "{growthOutlet.narrative.length > 0 ? growthOutlet.narrative[0] : "Investigate what's driving this growth and whether it can be replicated."}"
                  </p>
                </div>

                <ul className="mt-3 space-y-2 text-body-sm font-body-sm text-slate-600">
                  {bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0 mt-0.5" data-icon="check_circle">check_circle</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="py-6 text-center">
                <h4 className="text-headline-sm font-bold text-slate-900">NO GROWTH OPPORTUNITIES</h4>
                <p className="mt-2 text-body-sm text-slate-600">No outlets exceeded the growth threshold in the analysis window.</p>
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