import type { DataGap } from "./types";

/**
 * Known limitations of the underlying dataset. Static and deterministic.
 * These are the honest "what evidence is missing / ambiguous" answers the AI
 * must surface in `limitations`.
 */
export const DATA_GAPS: DataGap[] = [
  {
    id: "no-order-level",
    text: "No order-level data: customer traffic cannot be separated from basket size.",
  },
  {
    id: "no-promo-calendar",
    text: "No promotions, pricing, or calendar/seasonal event data is available.",
  },
  {
    id: "no-supply-chain",
    text: "No supplier or lead-time data — replenishment recommendations cannot specify quantities or timelines.",
  },
  {
    id: "flagged-only",
    text: "Product-level evidence is limited to flagged SKUs; declines in other products are not individually visible.",
  },
  {
    id: "daily-granularity",
    text: "Daily granularity only; intra-day patterns are not observable.",
  },
  {
    id: "no-exogenous",
    text: "No customer or location-level exogenous data (e.g. competitor activity, weather).",
  },
];