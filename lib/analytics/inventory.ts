import { PrismaClient } from "@prisma/client";
import { AnalysisWindow, StockoutDay } from "./types";
import { toDayKey } from "./windows";

export interface StockoutRecord {
  outletId: string;
  outletName: string;
  productId: string;
  productSku: string;
  productName: string;
  days: StockoutDay[];
  duration: number;
}

export async function findStockoutsInWindow(
  prisma: PrismaClient,
  window: AnalysisWindow,
): Promise<StockoutRecord[]> {
  const snapshots = await prisma.inventorySnapshot.findMany({
    where: {
      capturedAt: {
        gte: window.currentStart,
        lte: window.currentEnd,
      },
      quantity: 0,
    },
    include: {
      outlet: true,
      product: true,
    },
    orderBy: {
      capturedAt: "asc",
    },
  });

  const grouped = new Map<string, StockoutRecord>();

  for (const snapshot of snapshots) {
    const key = `${snapshot.outletId}:${snapshot.productId}`;

    let record = grouped.get(key);

    if (!record) {
      record = {
        outletId: snapshot.outletId,
        outletName: snapshot.outlet.name,
        productId: snapshot.productId,
        productSku: snapshot.product.sku,
        productName: snapshot.product.name,
        days: [],
        duration: 0,
      };

      grouped.set(key, record);
    }

    record.days.push({
      date: toDayKey(snapshot.capturedAt),
      inventory: snapshot.quantity,
    });

    record.duration++;
  }

  return [...grouped.values()];
}