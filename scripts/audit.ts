import { computeWindows, toDayKey, WINDOW_CONFIG } from "../lib/analytics/windows";
import { analyze } from "../lib/analytics/investigator";
import { computeMetricChange, seriesFromDayMap } from "../lib/analytics/stats";
import { getOutletProductDailyMetrics } from "../lib/analytics/sales";
import type { Report } from "../lib/analytics/types";
import { prisma } from "../lib/db";

const END_DATE = new Date("2026-09-07T00:00:00.000Z");

let failures = 0;
const assertions: string[] = [];

function assert(condition: boolean, label: string): void {
  if (condition) {
    assertions.push(`[PASS] ${label}`);
  } else {
    failures++;
    assertions.push(`[FAIL] ${label}`);
    console.error(`  Assertion violated: ${label}`);
  }
}

function requireAssertions(): void {
  if (failures > 0) {
    console.error("");
    console.error(`========================================`);
    console.error(` AUDIT FAILED: ${failures} assertion(s) violated`);
    console.error(`========================================`);
    process.exit(1);
  }
}

interface ExpectedStockout {
  outlet: string;
  sku: string;
  days: string[];
}

const EXPECTED_STOCKOUTS: ExpectedStockout[] = [
  { outlet: "Outlet Bekasi", sku: "DM-001", days: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"] },
  { outlet: "Outlet Bekasi", sku: "DM-002", days: ["2026-09-02", "2026-09-03"] },
  { outlet: "Outlet Depok", sku: "DM-001", days: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"] },
  { outlet: "Outlet Depok", sku: "RB-001", days: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"] },
  { outlet: "Outlet Depok", sku: "BV-003", days: ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"] },
  { outlet: "Outlet Cikarang", sku: "RB-001", days: ["2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"] },
  { outlet: "Outlet Cikarang", sku: "MC-005", days: ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"] },
];

const TOTAL_STOCKOUT_DAY_ROWS = EXPECTED_STOCKOUTS.reduce(
  (total, stockout) => total + stockout.days.length,
  0,
);

const EXPECTED_CLASSIFICATION: Record<string, string> = {
  "Outlet Bekasi": "ANOMALY_DECLINE",
  "Outlet Depok": "ANOMALY_DECLINE",
  "Outlet Cikarang": "ANOMALY_DECLINE",
  "Outlet Karawang": "ANOMALY_GROWTH",
  "Outlet Bogor": "NORMAL",
  "Outlet Bandung": "NORMAL",
  "Outlet Jakarta Selatan": "NORMAL",
  "Outlet Jakarta Timur": "NORMAL",
  "Outlet Tangerang": "NORMAL",
  "Outlet Bogor Barat": "NORMAL",
};

async function checkZeroInventoryCausalConsistency(): Promise<void> {
  const window = computeWindows(END_DATE);

  const zeroInventory = await prisma.inventorySnapshot.findMany({
    where: {
      quantity: 0,
      capturedAt: { gte: window.currentStart, lte: window.currentEnd },
    },
    select: { outletId: true, productId: true, capturedAt: true },
  });

  for (const snapshot of zeroInventory) {
    const dayStart = new Date(snapshot.capturedAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const saleCount = await prisma.sale.count({
      where: {
        outletId: snapshot.outletId,
        productId: snapshot.productId,
        soldAt: { gte: dayStart, lte: dayEnd },
      },
    });

    assert(
      saleCount === 0,
      `No Sale row for inventory=0 (${snapshot.outletId}:${snapshot.productId} @ ${toDayKey(snapshot.capturedAt)})`,
    );
  }

  assert(
    zeroInventory.length === TOTAL_STOCKOUT_DAY_ROWS,
    `Zero-inventory rows in current window == ${TOTAL_STOCKOUT_DAY_ROWS} (found ${zeroInventory.length})`,
  );
}

async function checkReportedChangePct(report: Report): Promise<void> {
  const window = computeWindows(END_DATE);

  function utcDayStart(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );
  }

  function dayCountBetween(start: Date, end: Date): number {
    return (
      Math.floor(
        (utcDayStart(end).getTime() - utcDayStart(start).getTime()) /
          86_400_000,
      ) + 1
    );
  }

  const baselineDayCount = dayCountBetween(
    window.baselineStart,
    window.baselineEnd,
  );
  const currentDayCount = dayCountBetween(
    window.currentStart,
    window.currentEnd,
  );

  const outlets = await prisma.outlet.findMany({ orderBy: { name: "asc" } });

  for (const outlet of outlets) {
    const [baselineAgg, currentAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: { outletId: outlet.id, soldAt: { gte: window.baselineStart, lte: window.baselineEnd } },
        _sum: { revenue: true },
      }),
      prisma.sale.aggregate({
        where: { outletId: outlet.id, soldAt: { gte: window.currentStart, lte: window.currentEnd } },
        _sum: { revenue: true },
      }),
    ]);

    const baselineAvg = Number(baselineAgg._sum.revenue ?? 0) / baselineDayCount;
    const currentAvg = Number(currentAgg._sum.revenue ?? 0) / currentDayCount;
    const recomputed =
      baselineAvg > 0
        ? ((currentAvg - baselineAvg) / baselineAvg) * 100
        : 0;

    const finding = report.outlets.find(
      (f) => f.outletName === outlet.name,
    );

    assert(
      finding !== undefined,
      `Report contains finding for ${outlet.name}`,
    );

    if (!finding) continue;

    const delta = Math.abs(recomputed - finding.revenue.changePct);
    assert(
      delta < 1e-6,
      `${outlet.name} changePct recomputed independently matches report (recomputed=${recomputed.toFixed(4)}, reported=${finding.revenue.changePct.toFixed(4)})`,
    );
  }
}

async function checkZeroSalesReconstruction(report: Report): Promise<void> {
  const window = computeWindows(END_DATE);

  const depok = await prisma.outlet.findUnique({
    where: { name: "Outlet Depok" },
  });
  const rb001 = await prisma.product.findUnique({
    where: { sku: "RB-001" },
  });

  assert(depok !== null && rb001 !== null, "Depok & RB-001 exist");

  if (!depok || !rb001) return;

  const productDaily = await getOutletProductDailyMetrics(
    prisma,
    depok.id,
    window,
  );

  const metrics = productDaily.get(rb001.id);
  assert(metrics !== undefined, "RB-001 series present for Depok");

  if (!metrics) return;

  const currentSeries = seriesFromDayMap(
    metrics.quantity,
    window.currentStart,
    window.currentEnd,
  );
  const baselineSeries = seriesFromDayMap(
    metrics.quantity,
    window.baselineStart,
    window.baselineEnd,
  );

  assert(
    currentSeries.length === 7,
    `RB-001 current series has exactly 7 entries (got ${currentSeries.length})`,
  );
  assert(
    baselineSeries.length === 28,
    `RB-001 baseline series has exactly 28 entries (got ${baselineSeries.length})`,
  );

  const stockoutDays = EXPECTED_STOCKOUTS.find(
    (s) => s.outlet === "Outlet Depok" && s.sku === "RB-001",
  )!.days;

  for (const day of stockoutDays) {
    assert(
      (metrics.quantity.get(day) ?? 0) === 0,
      `RB-001 Depok zero-filled on stockout day ${day}`,
    );
  }

  assert(
    metrics.quantity.get("2026-08-15")! > 0,
    "RB-001 Depok has positive baseline quantity on 2026-08-15",
  );
}

async function checkStockoutEvidence(report: Report): Promise<void> {
  const found = new Map<string, string[]>();

  for (const finding of report.outlets) {
    for (const evidence of finding.evidence) {
      if (evidence.type !== "stockout" || !evidence.productSku) continue;

      const key = `${finding.outletName}|${evidence.productSku}`;
      found.set(
        key,
        evidence.days?.map((d) => d.date) ?? [],
      );

      assert(
        evidence.zeroSalesVerified === true,
        `${finding.outletName} ${evidence.productSku} stockout zero-sales verified`,
      );
    }
  }

  for (const expected of EXPECTED_STOCKOUTS) {
    const key = `${expected.outlet}|${expected.sku}`;
    const foundDays = found.get(key) ?? [];
    assert(
      foundDays.length === expected.days.length &&
        foundDays.every((d, i) => d === expected.days[i]),
      `Stockout event ${key} detected with exact dates (found ${foundDays.join(", ")}; expected ${expected.days.join(", ")})`,
    );
  }

  assert(
    found.size === EXPECTED_STOCKOUTS.length,
    `Exactly ${EXPECTED_STOCKOUTS.length} stockout events detected (found ${found.size})`,
  );
}

async function checkCauseChains(report: Report): Promise<void> {
  for (const finding of report.outlets) {
    for (const step of finding.causeChain) {
      assert(
        !/transaction\b/i.test(step),
        `No transaction-count claim in ${finding.outletName} cause chain`,
      );
    }
  }
}

async function main(): Promise<void> {
  const window = computeWindows(END_DATE);

  assert(
    toDayKey(window.currentStart) === "2026-09-01" &&
      toDayKey(window.currentEnd) === "2026-09-07" &&
      toDayKey(window.baselineStart) === "2026-08-04" &&
      toDayKey(window.baselineEnd) === "2026-08-31",
    "Analytics windows correct for endDate 2026-09-07",
  );

  const report = await analyze(prisma, END_DATE);

  assert(
    report.summary.anomalyDecline === 3,
    `summary.anomalyDecline == 3 (found ${report.summary.anomalyDecline})`,
  );
  assert(
    report.summary.anomalyGrowth === 1,
    `summary.anomalyGrowth == 1 (found ${report.summary.anomalyGrowth})`,
  );
  assert(
    report.summary.normal === 6,
    `summary.normal == 6 (found ${report.summary.normal})`,
  );
  assert(
    report.summary.stockoutEvents === EXPECTED_STOCKOUTS.length,
    `summary.stockoutEvents == ${EXPECTED_STOCKOUTS.length} (found ${report.summary.stockoutEvents})`,
  );

  for (const [name, expected] of Object.entries(EXPECTED_CLASSIFICATION)) {
    const finding = report.outlets.find((f) => f.outletName === name);
    assert(
      finding?.status === expected,
      `${name} classified ${expected} (found ${finding?.status})`,
    );
  }

  assert(
    report.window.currentDays === WINDOW_CONFIG.currentDays &&
      report.window.baselineDays === WINDOW_CONFIG.baselineDays,
    "Report window days match configuration",
  );

  await checkStockoutEvidence(report);
  await checkZeroInventoryCausalConsistency();
  await checkReportedChangePct(report);
  await checkZeroSalesReconstruction(report);
  await checkCauseChains(report);

  console.log("============================================================");
  console.log("ANALYTICS AUDIT");
  console.log("============================================================");

  for (const line of assertions) {
    console.log(line);
  }

  console.log("");

  if (failures > 0) {
    console.error(`========================================`);
    console.error(` AUDIT FAILED: ${failures} assertion(s) violated`);
    console.error(`========================================`);
    process.exit(1);
  }

  console.log("============================================================");
  console.log("ALL ANALYTICS AUDIT CHECKS PASSED");
  console.log("============================================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });