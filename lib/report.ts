import { analyze } from "./analytics/investigator";
import type { Report } from "./analytics/types";
import { prisma } from "./db";

const cache = new Map<string, Report>();
const CACHE_LIMIT = 12;

export async function getReport(endDate: string): Promise<Report> {
  const cached = cache.get(endDate);
  if (cached) return cached;

  const report = await analyze(
    prisma,
    new Date(`${endDate}T00:00:00.000Z`),
  );

  cache.set(endDate, report);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  return report;
}