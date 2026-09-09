import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function getMaxSalesDate(): Promise<string> {
  try {
    const result = await prisma.sale.aggregate({
      _max: {
        soldAt: true,
      },
    });

    if (result._max.soldAt) {
      return result._max.soldAt.toISOString().split("T")[0];
    }
  } catch (error) {
    console.error("Failed to fetch max sales date:", error);
  }

  // Fallback to default
  return "2026-09-07";
}
