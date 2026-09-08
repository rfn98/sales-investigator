import { PrismaClient } from "@prisma/client";
import { computeWindows, toDayKey, WINDOW_CONFIG } from "./windows";
import { computeMetricChange, seriesFromDayMap } from "./stats";
import {
  classifyOutlet,
  severityForOutlet,
  severityForProduct,
  severityFromMagnitude,
  severityFromStockoutDuration,
  shouldFlagProduct,
  THRESHOLDS,
} from "./anomaly";
import { findStockoutsInWindow, StockoutRecord } from "./inventory";
import {
  getOutletDailyActiveLineCount,
  getOutletDailyRevenue,
  getOutletProductDailyMetrics,
} from "./sales";
import {
  DailyRevenuePoint,
  Evidence,
  MetricChange,
  OutletFinding,
  OutletStatus,
  Report,
  Severity,
} from "./types";

export const MAX_PRODUCT_EVIDENCE = 6;

/**
 * Evidence gate: activeProductLines is only claimed as a causal step in a
 * decline cause chain when its measured relative decline is at least this
 * large. Below it the change is treated as noise.
 */
export const ACTIVE_LINES_DECLINE_GATE = -10;

interface FlaggedProduct {
  productId: string;
  sku: string;
  name: string;
  quantityChange: MetricChange;
  revenueChange: MetricChange;
  hasStockout: boolean;
}

interface CauseChainInput {
  status: OutletStatus;
  flagged: FlaggedProduct[];
  outletStockouts: StockoutRecord[];
  revenueChange: MetricChange;
  activeLinesChange: MetricChange;
  stockoutsVerified: boolean;
}

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatChange(changePct: number): string {
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(1)}%`;
}

function stockoutRangeText(record: StockoutRecord): string {
  const first = record.days[0].date;
  const last = record.days[record.days.length - 1].date;
  const range = first === last ? first : `${first} .. ${last}`;
  return `${record.duration} day(s) (${range})`;
}

function topDeclineText(flagged: FlaggedProduct[], limit = 3): string {
  const items = flagged
    .slice()
    .sort(
      (a, b) =>
        a.quantityChange.changePct - b.quantityChange.changePct,
    )
    .slice(0, limit);

  if (items.length === 0) return "none";

  return items
    .map(
      (item) =>
        `${item.sku} ${item.quantityChange.baselineDailyAvg.toFixed(1)}→${item.quantityChange.currentDailyAvg.toFixed(1)} (${formatChange(item.quantityChange.changePct)})`,
    )
    .join(", ");
}

function toUtcDateFromKey(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/**
 * For every stockout event, verify against Sale rows that the affected
 * outlet-product sold nothing on the exact stockout dates.
 */
async function verifyStockoutZeroSales(
  prisma: PrismaClient,
  stockouts: StockoutRecord[],
): Promise<Map<string, boolean>> {
  const verified = new Map<string, boolean>();

  if (stockouts.length === 0) return verified;

  const dates = [
    ...new Set(
      stockouts.flatMap((record) =>
        record.days.map((day) => toUtcDateFromKey(day.date)),
      ),
    ),
  ];

  const rows = await prisma.sale.groupBy({
    by: ["outletId", "productId", "soldAt"],
    where: {
      soldAt: { in: dates },
      OR: stockouts.map((record) => ({
        outletId: record.outletId,
        productId: record.productId,
      })),
    },
    _count: { _all: true },
  });

  const soldOn = new Set<string>();

  for (const row of rows) {
    if (row._count._all > 0) {
      soldOn.add(
        `${row.outletId}:${row.productId}:${toDayKey(row.soldAt)}`,
      );
    }
  }

  for (const record of stockouts) {
    const key = `${record.outletId}:${record.productId}`;
    const allZero = record.days.every(
      (day) =>
        !soldOn.has(`${key}:${day.date}`),
    );

    verified.set(key, allZero);
  }

  return verified;
}

export async function analyze(
  prisma: PrismaClient,
  endDate: Date,
): Promise<Report> {
  const window = computeWindows(endDate);
  const currentDays = WINDOW_CONFIG.currentDays;

  const outlets = await prisma.outlet.findMany({
    orderBy: { name: "asc" },
  });

  const products = await prisma.product.findMany();
  const productById = new Map(
    products.map((product) => [product.id, product]),
  );

  const stockouts = await findStockoutsInWindow(prisma, window);
  const stockoutByOutlet = new Map<string, StockoutRecord[]>();

  for (const record of stockouts) {
    const list = stockoutByOutlet.get(record.outletId) ?? [];
    list.push(record);
    stockoutByOutlet.set(record.outletId, list);
  }

  const stockoutVerified = await verifyStockoutZeroSales(
    prisma,
    stockouts,
  );

  const findings: OutletFinding[] = [];
  let evidenceCounter = 0;
  const nextEvidenceId = () => `E${++evidenceCounter}`;

  for (const outlet of outlets) {
    const revenueDaily = await getOutletDailyRevenue(
      prisma,
      outlet.id,
      window,
    );
    const activeLinesDaily = await getOutletDailyActiveLineCount(
      prisma,
      outlet.id,
      window,
    );

    const revenueChange = computeMetricChange(
      seriesFromDayMap(revenueDaily, window.baselineStart, window.baselineEnd),
      seriesFromDayMap(revenueDaily, window.currentStart, window.currentEnd),
    );

    const dailyRevenue: DailyRevenuePoint[] = [];
    {
      const dayCursor = new Date(window.baselineStart);
      while (dayCursor <= window.currentEnd) {
        const key = toDayKey(dayCursor);
        dailyRevenue.push({
          date: key,
          revenue: revenueDaily.get(key) ?? 0,
        });
        dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
      }
    }

    const activeLinesChange = computeMetricChange(
      seriesFromDayMap(activeLinesDaily, window.baselineStart, window.baselineEnd),
      seriesFromDayMap(activeLinesDaily, window.currentStart, window.currentEnd),
    );

    const status = classifyOutlet(revenueChange);
    const severity = severityForOutlet(revenueChange);
    const outletStockouts = stockoutByOutlet.get(outlet.id) ?? [];

    const evidence: Evidence[] = [];

    evidence.push({
      id: nextEvidenceId(),
      type: "outlet_revenue_change",
      severity,
      outletName: outlet.name,
      baselineValue: revenueChange.baselineDailyAvg,
      currentValue: revenueChange.currentDailyAvg,
      changePct: revenueChange.changePct,
      zScore: revenueChange.zScore,
      description:
        `Daily revenue ${formatMoney(revenueChange.baselineDailyAvg)} → ` +
        `${formatMoney(revenueChange.currentDailyAvg)} (${formatChange(revenueChange.changePct)}, z=${revenueChange.zScore ?? "n/a"})`,
    });

    evidence.push({
      id: nextEvidenceId(),
      type: "outlet_active_lines_change",
      severity: severityFromMagnitude(activeLinesChange.changePct),
      outletName: outlet.name,
      baselineValue: activeLinesChange.baselineDailyAvg,
      currentValue: activeLinesChange.currentDailyAvg,
      changePct: activeLinesChange.changePct,
      zScore: activeLinesChange.zScore,
      description:
        `Active product lines/day ${activeLinesChange.baselineDailyAvg.toFixed(1)} → ` +
        `${activeLinesChange.currentDailyAvg.toFixed(1)} (${formatChange(activeLinesChange.changePct)})`,
    });

    const flagged: FlaggedProduct[] = [];

    if (status !== "NORMAL") {
      const productDaily = await getOutletProductDailyMetrics(
        prisma,
        outlet.id,
        window,
      );

      for (const [productId, metrics] of productDaily) {
        const quantityChange = computeMetricChange(
          seriesFromDayMap(metrics.quantity, window.baselineStart, window.baselineEnd),
          seriesFromDayMap(metrics.quantity, window.currentStart, window.currentEnd),
        );

        const productRevenueChange = computeMetricChange(
          seriesFromDayMap(metrics.revenue, window.baselineStart, window.baselineEnd),
          seriesFromDayMap(metrics.revenue, window.currentStart, window.currentEnd),
        );

        const product = productById.get(productId);
        if (!product) continue;

        const hasStockout = outletStockouts.some(
          (record) => record.productId === productId,
        );

        if (
          shouldFlagProduct(quantityChange.changePct) ||
          shouldFlagProduct(productRevenueChange.changePct) ||
          hasStockout
        ) {
          flagged.push({
            productId,
            sku: product.sku,
            name: product.name,
            quantityChange,
            revenueChange: productRevenueChange,
            hasStockout,
          });
        }
      }

      flagged.sort((a, b) => {
        if (a.hasStockout !== b.hasStockout) {
          return a.hasStockout ? -1 : 1;
        }
        return (
          Math.max(
            Math.abs(b.quantityChange.changePct),
            Math.abs(b.revenueChange.changePct),
          ) -
          Math.max(
            Math.abs(a.quantityChange.changePct),
            Math.abs(a.revenueChange.changePct),
          )
        );
      });
    }

    const topFlagged = flagged.slice(0, MAX_PRODUCT_EVIDENCE);

    for (const item of topFlagged) {
      const revenueImpact = Math.abs(
        (item.revenueChange.baselineDailyAvg -
          item.revenueChange.currentDailyAvg) *
          currentDays,
      );

      const productSeverity = severityForProduct(
        item.quantityChange.changePct,
        item.revenueChange.changePct,
        revenueImpact,
      );

      evidence.push({
        id: nextEvidenceId(),
        type: "product_quantity_change",
        severity: productSeverity,
        outletName: outlet.name,
        productSku: item.sku,
        productName: item.name,
        baselineValue: item.quantityChange.baselineDailyAvg,
        currentValue: item.quantityChange.currentDailyAvg,
        changePct: item.quantityChange.changePct,
        zScore: item.quantityChange.zScore,
        revenueBaselineValue: item.revenueChange.baselineDailyAvg,
        revenueCurrentValue: item.revenueChange.currentDailyAvg,
        revenueChangePct: item.revenueChange.changePct,
        description:
          `${item.sku} (${item.name}) units/day ` +
          `${item.quantityChange.baselineDailyAvg.toFixed(1)} → ${item.quantityChange.currentDailyAvg.toFixed(1)} ` +
          `(${formatChange(item.quantityChange.changePct)}); revenue/day ` +
          `${formatMoney(item.revenueChange.baselineDailyAvg)} → ${formatMoney(item.revenueChange.currentDailyAvg)} ` +
          `(${formatChange(item.revenueChange.changePct)})`,
      });
    }

    for (const record of outletStockouts) {
      const verified =
        stockoutVerified.get(
          `${record.outletId}:${record.productId}`,
        ) ?? false;

      const stockoutSeverity = severityFromStockoutDuration(
        record.duration,
      );

      evidence.push({
        id: nextEvidenceId(),
        type: "stockout",
        severity: stockoutSeverity,
        outletName: outlet.name,
        productSku: record.productSku,
        productName: record.productName,
        days: record.days,
        zeroSalesVerified: verified,
        description:
          `${record.productSku} (${record.productName}) stockout ${stockoutRangeText(record)}` +
          `${verified ? " (zero sales verified)" : " (zero sales NOT verified)"}`,
      });
    }

    const stockoutsVerified =
      outletStockouts.length > 0 &&
      outletStockouts.every(
        (record) =>
          stockoutVerified.get(
            `${record.outletId}:${record.productId}`,
          ) === true,
      );

    const causeChain = buildCauseChain({
      status,
      flagged: topFlagged,
      outletStockouts,
      revenueChange,
      activeLinesChange,
      stockoutsVerified,
    });

    const narrative = buildNarrative(
      outlet.name,
      status,
      revenueChange,
      evidence,
    );

    findings.push({
      outletName: outlet.name,
      status,
      severity,
      revenue: revenueChange,
      activeProductLines: activeLinesChange,
      dailyRevenue,
      causeChain,
      narrative,
      evidence,
    });
  }

  const summary = {
    totalOutlets: findings.length,
    anomalyDecline: findings.filter(
      (finding) => finding.status === "ANOMALY_DECLINE",
    ).length,
    anomalyGrowth: findings.filter(
      (finding) => finding.status === "ANOMALY_GROWTH",
    ).length,
    normal: findings.filter(
      (finding) => finding.status === "NORMAL",
    ).length,
    stockoutEvents: stockouts.length,
  };

  return {
    analyzedAt: new Date().toISOString(),
    endDate: toDayKey(endDate),
    window: {
      currentStart: toDayKey(window.currentStart),
      currentEnd: toDayKey(window.currentEnd),
      baselineStart: toDayKey(window.baselineStart),
      baselineEnd: toDayKey(window.baselineEnd),
      currentDays: WINDOW_CONFIG.currentDays,
      baselineDays: WINDOW_CONFIG.baselineDays,
    },
    thresholds: {
      outletChangePct: THRESHOLDS.outletChangePct,
      productChangePct: THRESHOLDS.productChangePct,
    },
    methodology: {
      zScore:
        `Rolling ${WINDOW_CONFIG.currentDays}-day baseline windows within the ${WINDOW_CONFIG.baselineDays}-day baseline period; ` +
        `z = (current ${WINDOW_CONFIG.currentDays}-day average − mean(baseline window means)) / std(baseline window means).`,
      activeProductLines:
        `Number of outlet-product combinations with positive sales quantity on a day. ` +
        `A product-sales breadth/availability proxy, NOT customer transaction count. ` +
        `Daily series are zero-filled for days without Sale rows.`,
      severityRule:
        `Deterministic severity = max(magnitude band of |changePct|, absolute revenue impact band over the current window). ` +
        `Outlet magnitude: <20 low, 20-29 medium, 30-39 high, >=40 critical. ` +
        `Outlet impact (IDR): <15M low, 15-25M medium, 25-40M high, >=40M critical.`,
    },
    summary,
    outlets: findings,
  };
}

function buildCauseChain(input: CauseChainInput): string[] {
  const {
    status,
    flagged,
    outletStockouts,
    revenueChange,
    activeLinesChange,
    stockoutsVerified,
  } = input;

  if (status === "NORMAL") {
    return [
      "No material change detected across revenue, products, or inventory.",
    ];
  }

  if (status === "ANOMALY_GROWTH") {
    return [
      `Outlet daily revenue grew (baseline ${formatMoney(revenueChange.baselineDailyAvg)}/day → current ${formatMoney(revenueChange.currentDailyAvg)}/day, ${formatChange(revenueChange.changePct)}).`,
      "Growth is broad-based across multiple products rather than a product-specific or stockout event.",
    ];
  }

  const chain: string[] = [];

  if (outletStockouts.length > 0) {
    const causeSkus = flagged
      .filter((item) => item.hasStockout)
      .map((item) => item.sku);

    chain.push(
      `Stockout of ${causeSkus.join(", ")}: InventorySnapshot quantity = 0 on ` +
        `${outletStockouts.map((r) => `${r.productSku} ${stockoutRangeText(r)}`).join(", ")} during the current period.`,
    );

    if (stockoutsVerified) {
      chain.push(
        `Zero sales verified: no Sale records exist for ${causeSkus.join(", ")} on their stockout dates.`,
      );
      chain.push(
        `Units declined for affected products (${topDeclineText(flagged)}).`,
      );
    } else {
      chain.push(
        "Zero sales on stockout dates NOT fully verified — no direct stockout→zero-sales causal claim can be made.",
      );
      chain.push(
        `Units declined across products during the same period (${topDeclineText(flagged)}).`,
      );
    }

    chain.push(
      `Outlet daily revenue fell (baseline ${formatMoney(revenueChange.baselineDailyAvg)}/day → current ${formatMoney(revenueChange.currentDailyAvg)}/day, ${formatChange(revenueChange.changePct)}).`,
    );
  } else {
    chain.push(
      `Broad demand reduction lowered units/day across products (top declines: ${topDeclineText(flagged)}).`,
    );
    chain.push(
      `Outlet daily revenue fell (baseline ${formatMoney(revenueChange.baselineDailyAvg)}/day → current ${formatMoney(revenueChange.currentDailyAvg)}/day, ${formatChange(revenueChange.changePct)}).`,
    );
  }

  if (activeLinesChange.changePct <= ACTIVE_LINES_DECLINE_GATE) {
    chain.push(
      `Product-line breadth declined: activeProductLines/day ${activeLinesChange.baselineDailyAvg.toFixed(1)} → ${activeLinesChange.currentDailyAvg.toFixed(1)} (${formatChange(activeLinesChange.changePct)}).`,
    );
  }

  return chain;
}

function buildNarrative(
  outletName: string,
  status: OutletStatus,
  revenueChange: MetricChange,
  evidence: Evidence[],
): string[] {
  const lines: string[] = [];

  lines.push(
    `${outletName} classified as ${status} (revenue change ${formatChange(revenueChange.changePct)}, severity ${evidence[0]?.severity ?? "low"}).`,
  );

  if (status === "NORMAL") {
    lines.push(
      "Metrics are consistent with the baseline period within accepted thresholds.",
    );
  } else {
    for (const item of evidence.slice(2)) {
      lines.push(`- ${item.description}`);
    }
  }

  return lines;
}