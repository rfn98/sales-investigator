import { AnalysisWindow } from "./types";

export const WINDOW_CONFIG = {
  currentDays: 7,
  baselineDays: 28,
};

export function toUtcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeWindows(
  endDate: Date,
  currentDays = WINDOW_CONFIG.currentDays,
  baselineDays = WINDOW_CONFIG.baselineDays,
): AnalysisWindow {
  const endDay = toUtcDayStart(endDate);

  const currentEnd = new Date(endDay.getTime() + 86_399_999);
  const currentStart = new Date(endDay);
  currentStart.setUTCDate(
    currentStart.getUTCDate() - (currentDays - 1),
  );

  const baselineEnd = new Date(currentStart);
  baselineEnd.setUTCDate(
    baselineEnd.getUTCDate() - 1,
  );
  baselineEnd.setTime(
    baselineEnd.getTime() + 86_399_999,
  );

  const baselineStart = new Date(baselineEnd);
  baselineStart.setUTCDate(
    baselineStart.getUTCDate() - (baselineDays - 1),
  );
  baselineStart.setUTCHours(0, 0, 0, 0);

  return {
    currentStart,
    currentEnd,
    baselineStart,
    baselineEnd,
  };
}