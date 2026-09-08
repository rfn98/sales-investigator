import {
  MetricChange,
  OutletStatus,
  Severity,
} from "./types";
import { WINDOW_CONFIG } from "./windows";

export const THRESHOLDS = {
  outletChangePct: 20,
  productChangePct: 30,
};

/**
 * Deterministic severity bands.
 *
 * Magnitude bands are based on |changePct|. Impact bands are based on the
 * absolute revenue impact (IDR) over the full current window:
 *   impact = |baselineDailyAvg − currentDailyAvg| × currentDays
 */
export const OUTLET_SEVERITY_RULES = {
  magnitudeMedium: 20,
  magnitudeHigh: 30,
  magnitudeCritical: 40,
  impactMediumPerWindow: 15_000_000,
  impactHighPerWindow: 25_000_000,
  impactCriticalPerWindow: 40_000_000,
};

export const PRODUCT_SEVERITY_RULES = {
  magnitudeMedium: 30,
  magnitudeHigh: 60,
  magnitudeCritical: 90,
  impactMediumPerWindow: 1_500_000,
  impactHighPerWindow: 3_000_000,
  impactCriticalPerWindow: 6_000_000,
};

const SEVERITY_ORDER: Severity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export function worstSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[
    Math.max(SEVERITY_ORDER.indexOf(a), SEVERITY_ORDER.indexOf(b))
  ];
}

function bandSeverity(
  value: number,
  medium: number,
  high: number,
  critical: number,
): Severity {
  if (value >= critical) return "critical";
  if (value >= high) return "high";
  if (value >= medium) return "medium";
  return "low";
}

export function classifyOutlet(
  change: MetricChange,
): OutletStatus {
  if (change.changePct <= -THRESHOLDS.outletChangePct) {
    return "ANOMALY_DECLINE";
  }

  if (change.changePct >= THRESHOLDS.outletChangePct) {
    return "ANOMALY_GROWTH";
  }

  return "NORMAL";
}

/**
 * Outlet severity = max of magnitude band and absolute revenue impact band.
 */
export function severityForOutlet(
  revenueChange: MetricChange,
): Severity {
  const magnitude = bandSeverity(
    Math.abs(revenueChange.changePct),
    OUTLET_SEVERITY_RULES.magnitudeMedium,
    OUTLET_SEVERITY_RULES.magnitudeHigh,
    OUTLET_SEVERITY_RULES.magnitudeCritical,
  );

  const impact = Math.abs(
    (revenueChange.baselineDailyAvg - revenueChange.currentDailyAvg) *
      WINDOW_CONFIG.currentDays,
  );

  const impactSeverity = bandSeverity(
    impact,
    OUTLET_SEVERITY_RULES.impactMediumPerWindow,
    OUTLET_SEVERITY_RULES.impactHighPerWindow,
    OUTLET_SEVERITY_RULES.impactCriticalPerWindow,
  );

  return worstSeverity(magnitude, impactSeverity);
}

/**
 * Generic magnitude-only severity for non-revenue metrics
 * (e.g. activeProductLines).
 */
export function severityFromMagnitude(
  changePct: number,
): Severity {
  return bandSeverity(
    Math.abs(changePct),
    OUTLET_SEVERITY_RULES.magnitudeMedium,
    OUTLET_SEVERITY_RULES.magnitudeHigh,
    OUTLET_SEVERITY_RULES.magnitudeCritical,
  );
}

/**
 * Product severity = max of units-magnitude band, revenue-magnitude band, and
 * absolute revenue impact (IDR) over the current window.
 */
export function severityForProduct(
  unitsChangePct: number,
  revenueChangePct: number,
  revenueImpact: number,
): Severity {
  const magnitude = bandSeverity(
    Math.abs(unitsChangePct),
    PRODUCT_SEVERITY_RULES.magnitudeMedium,
    PRODUCT_SEVERITY_RULES.magnitudeHigh,
    PRODUCT_SEVERITY_RULES.magnitudeCritical,
  );

  const revenueMagnitude = bandSeverity(
    Math.abs(revenueChangePct),
    PRODUCT_SEVERITY_RULES.magnitudeMedium,
    PRODUCT_SEVERITY_RULES.magnitudeHigh,
    PRODUCT_SEVERITY_RULES.magnitudeCritical,
  );

  const impact = bandSeverity(
    revenueImpact,
    PRODUCT_SEVERITY_RULES.impactMediumPerWindow,
    PRODUCT_SEVERITY_RULES.impactHighPerWindow,
    PRODUCT_SEVERITY_RULES.impactCriticalPerWindow,
  );

  return worstSeverity(
    worstSeverity(magnitude, revenueMagnitude),
    impact,
  );
}

export function severityFromStockoutDuration(
  duration: number,
): Severity {
  if (duration >= 6) return "critical";
  if (duration >= 4) return "high";
  if (duration >= 2) return "medium";

  return "low";
}

export function shouldFlagProduct(
  changePct: number,
): boolean {
  return (
    changePct <= -THRESHOLDS.productChangePct ||
    changePct >= THRESHOLDS.productChangePct
  );
}