export interface AnalysisWindow {
  currentStart: Date;
  currentEnd: Date;
  baselineStart: Date;
  baselineEnd: Date;
}

export interface MetricChange {
  baselineTotal: number;
  currentTotal: number;
  baselineDailyAvg: number;
  currentDailyAvg: number;
  changePct: number;
  zScore: number | null;
}

export type EvidenceType =
  | "outlet_revenue_change"
  | "outlet_active_lines_change"
  | "product_quantity_change"
  | "stockout";

export type Severity = "low" | "medium" | "high" | "critical";

export interface StockoutDay {
  date: string;
  inventory: number;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  severity: Severity;
  outletName: string;
  productSku?: string;
  productName?: string;
  /**
   * baselineValue/currentValue/changePct: quantity-related metric,
   * defined identically for both values (daily average of the same metric).
   */
  baselineValue?: number;
  currentValue?: number;
  changePct?: number;
  zScore?: number | null;
  days?: StockoutDay[];
  /**
   * Only present on stockout evidence:
   * true when no Sale rows exist for the exact stockout dates.
   */
  zeroSalesVerified?: boolean;
  /** Product-level business impact (revenue), daily averages of the same metric. */
  revenueBaselineValue?: number;
  revenueCurrentValue?: number;
  revenueChangePct?: number;
  description: string;
}

export type OutletStatus =
  | "ANOMALY_DECLINE"
  | "ANOMALY_GROWTH"
  | "NORMAL";

export interface DailyRevenuePoint {
  /** ISO day key, e.g. "2026-09-01". */
  date: string;
  /** Outlet daily revenue in IDR (0 on days without Sale rows). */
  revenue: number;
}

export interface OutletFinding {
  outletName: string;
  status: OutletStatus;
  severity: Severity;
  revenue: MetricChange;
  /**
   * activeProductLines = number of outlet-product combinations with
   * positive sales quantity on a day. A product-sales breadth/availability
   * proxy, NOT customer transaction count.
   */
  activeProductLines: MetricChange;
  /** Daily revenue series spanning baselineStart..currentEnd (inclusive). */
  dailyRevenue: DailyRevenuePoint[];
  causeChain: string[];
  narrative: string[];
  evidence: Evidence[];
}

export interface ReportSummary {
  totalOutlets: number;
  anomalyDecline: number;
  anomalyGrowth: number;
  normal: number;
  stockoutEvents: number;
}

export interface ReportMethodology {
  zScore: string;
  activeProductLines: string;
  severityRule: string;
}

export interface Report {
  analyzedAt: string;
  endDate: string;
  window: {
    currentStart: string;
    currentEnd: string;
    baselineStart: string;
    baselineEnd: string;
    currentDays: number;
    baselineDays: number;
  };
  thresholds: {
    outletChangePct: number;
    productChangePct: number;
  };
  methodology: ReportMethodology;
  summary: ReportSummary;
  outlets: OutletFinding[];
}