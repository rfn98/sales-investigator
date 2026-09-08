import { MetricChange } from "./types";

export const ROLLING_WINDOW_DAYS = 7;

export function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const m = mean(values);

  return Math.sqrt(
    values.reduce(
      (acc, value) => acc + (value - m) ** 2,
      0,
    ) / values.length,
  );
}

/**
 * Rolling window means over a daily series.
 *
 * For a baseline period of 28 days and a window of 7 days this produces
 * 28 - 7 + 1 = 22 overlapping 7-day windows.
 */
export function rollingWindowMeans(
  dailySeries: number[],
  windowDays = ROLLING_WINDOW_DAYS,
): number[] {
  const windows: number[] = [];

  for (let i = 0; i + windowDays <= dailySeries.length; i++) {
    windows.push(mean(dailySeries.slice(i, i + windowDays)));
  }

  return windows;
}

/**
 * Z-SCORE METHODOLOGY (deterministic)
 *
 * The z-score answers the question:
 *   "How many standard deviations is the current 7-day average from the
 *    typical baseline 7-day average?"
 *
 * Computation:
 *   1. Take the baseline-period daily series (28 observations).
 *   2. Build every contiguous 7-day window (22 overlapping windows) and
 *      compute each window's mean. These window means form the sampling
 *      distribution of a 7-day average under baseline conditions.
 *   3. Compute the mean and standard deviation of those 7-day window means.
 *   4. z = (current 7-day average − mean(window means)) / std(window means).
 *
 * This compares like with like: a 7-day average is compared against the
 * distribution of 7-day averages observed historically, rather than against
 * individual single-day observations (which would underestimate within-window
 * variance and inflate |z|).
 *
 * NOTE: Anomaly classification uses changePct (relative % change), NOT the
 * z-score. The z-score is reported as supporting statistical evidence only.
 */
export function zScoreOfRolling(
  currentMean: number,
  baselineDailySeries: number[],
  windowDays = ROLLING_WINDOW_DAYS,
): number | null {
  const windowMeans = rollingWindowMeans(
    baselineDailySeries,
    windowDays,
  );

  if (windowMeans.length < 2) return null;

  const m = mean(windowMeans);
  const sd = standardDeviation(windowMeans);

  if (sd === 0) return null;

  return (currentMean - m) / sd;
}

/**
 * Reconstructs a complete daily series for a date range.
 *
 * Days without a Sale row are filled with 0 (zero-value reconstruction).
 * This is what makes stockouts/drop-off days visible in the series instead
 * of appearing as missing dates.
 */
export function seriesFromDayMap(
  dayMap: Map<string, number>,
  start: Date,
  end: Date,
): number[] {
  const series: number[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    series.push(dayMap.get(cursor.toISOString().slice(0, 10)) ?? 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

export function computeMetricChange(
  baselineSeries: number[],
  currentSeries: number[],
): MetricChange {
  const baselineTotal = sum(baselineSeries);
  const currentTotal = sum(currentSeries);
  const baselineDailyAvg = mean(baselineSeries);
  const currentDailyAvg = mean(currentSeries);

  let changePct: number;

  if (baselineDailyAvg > 0) {
    changePct =
      ((currentDailyAvg - baselineDailyAvg) /
        baselineDailyAvg) *
      100;
  } else {
    changePct = currentDailyAvg > 0 ? 100 : 0;
  }

  const z = zScoreOfRolling(
    currentDailyAvg,
    baselineSeries,
  );

  return {
    baselineTotal,
    currentTotal,
    baselineDailyAvg,
    currentDailyAvg,
    changePct,
    zScore: z === null ? null : Number(z.toFixed(2)),
  };
}