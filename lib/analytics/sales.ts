import { PrismaClient } from "@prisma/client";
import { AnalysisWindow } from "./types";
import { toDayKey } from "./windows";

export async function getOutletDailyRevenue(
  prisma: PrismaClient,
  outletId: string,
  window: AnalysisWindow,
): Promise<Map<string, number>> {
  const rows = await prisma.sale.groupBy({
    by: ["soldAt"],
    where: {
      outletId,
      soldAt: {
        gte: window.baselineStart,
        lte: window.currentEnd,
      },
    },
    _sum: { revenue: true },
  });

  const dayMap = new Map<string, number>();

  for (const row of rows) {
    dayMap.set(
      toDayKey(row.soldAt),
      Number(row._sum.revenue ?? 0),
    );
  }

  return dayMap;
}

/**
 * activeProductLines per day = number of outlet-product combinations with
 * positive sales quantity on that day (Sale rows exist only when quantity > 0).
 *
 * This is a product-sales breadth / availability proxy. It is NOT a customer
 * transaction count — the dataset contains no order-level data.
 */
export async function getOutletDailyActiveLineCount(
  prisma: PrismaClient,
  outletId: string,
  window: AnalysisWindow,
): Promise<Map<string, number>> {
  const rows = await prisma.sale.groupBy({
    by: ["soldAt"],
    where: {
      outletId,
      soldAt: {
        gte: window.baselineStart,
        lte: window.currentEnd,
      },
    },
    _count: { _all: true },
  });

  const dayMap = new Map<string, number>();

  for (const row of rows) {
    dayMap.set(toDayKey(row.soldAt), row._count._all);
  }

  return dayMap;
}

export interface ProductDailyMetrics {
  quantity: Map<string, number>;
  revenue: Map<string, number>;
}

/**
 * Per-product daily quantity AND revenue series for an outlet,
 * covering the full baseline + current window.
 */
export async function getOutletProductDailyMetrics(
  prisma: PrismaClient,
  outletId: string,
  window: AnalysisWindow,
): Promise<Map<string, ProductDailyMetrics>> {
  const rows = await prisma.sale.groupBy({
    by: ["productId", "soldAt"],
    where: {
      outletId,
      soldAt: {
        gte: window.baselineStart,
        lte: window.currentEnd,
      },
    },
    _sum: { quantity: true, revenue: true },
  });

  const byProduct = new Map<string, ProductDailyMetrics>();

  for (const row of rows) {
    const metrics = byProduct.get(row.productId) ?? {
      quantity: new Map<string, number>(),
      revenue: new Map<string, number>(),
    };

    const dayKey = toDayKey(row.soldAt);

    metrics.quantity.set(
      dayKey,
      Number(row._sum.quantity ?? 0),
    );
    metrics.revenue.set(
      dayKey,
      Number(row._sum.revenue ?? 0),
    );

    byProduct.set(row.productId, metrics);
  }

  return byProduct;
}