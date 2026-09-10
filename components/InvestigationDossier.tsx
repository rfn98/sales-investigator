"use client";

import EvidenceDrawer from "./EvidenceDrawer";
import {
  formatDayRangeLabel,
  formatRpCompact,
  slugify,
} from "./format";
import type { Report } from "../lib/analytics/types";
import type {
  CausalStrength,
  Claim,
  EvidenceFact,
  InvestigationInput,
  InvestigationOutcome,
  InvestigationResult,
  Priority,
  Recommendation,
} from "../lib/ai";

const strengthStyle: Record<CausalStrength, string> = {
  fact: "bg-slate-100 text-slate-800 border-slate-300",
  supports: "bg-amber-100 text-amber-800 border-amber-300",
  possible: "bg-sky-100 text-sky-800 border-sky-300",
};

const priorityStyle: Record<Priority, string> = {
  high: "bg-rose-100 text-rose-800 border-rose-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low: "bg-slate-100 text-slate-700 border-slate-300",
};

const severityBadge: Record<string, { color: string; emoji: string }> = {
  critical: { color: "border-rose-400/40 bg-rose-500/10 text-rose-300", emoji: "🔴" },
  high: { color: "border-orange-400/40 bg-orange-500/10 text-orange-300", emoji: "🟠" },
  medium: { color: "border-amber-400/40 bg-amber-500/10 text-amber-200", emoji: "🟡" },
  low: { color: "border-slate-400/40 bg-slate-500/10 text-slate-300", emoji: "⚪" },
};

function StrengthBadge({ strength }: { strength: CausalStrength }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold capitalize ${strengthStyle[strength]}`}
    >
      {strength}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold capitalize ${priorityStyle[priority]}`}
    >
      {priority}
    </span>
  );
}

function EvidenceMeta({
  evidenceIds,
  supportProfileId,
  actionTemplateId,
}: {
  evidenceIds: string[];
  supportProfileId?: string;
  actionTemplateId?: string;
}) {
  const refs = [
    `${evidenceIds.length} evidence ${evidenceIds.length === 1 ? "id" : "ids"}`,
    supportProfileId ? `profile ${supportProfileId}` : null,
    actionTemplateId ? `action template ${actionTemplateId}` : null,
  ].filter(Boolean);
  return (
    <p className="mt-2 text-xs text-slate-500">Supports {refs.join(" · ")}</p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

function confidenceFromLevel(level: string): string {
  return level === "strong" ? "HIGH" : level === "moderate" ? "MODERATE" : "WEAK";
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <SectionHeading>{title}</SectionHeading>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function numFact(value: number | string | boolean | string[] | undefined): number {
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function valueOf(
  fact: EvidenceFact,
  key: string,
): number | string | boolean | string[] | undefined {
  return fact.measured[key];
}

function ClaimCard({ claim }: { claim: Claim }) {
  return (
    <li className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-relaxed text-slate-900">
          {claim.statement}
        </p>
        <StrengthBadge strength={claim.causalStrength} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{claim.reason}</p>
      <EvidenceMeta
        evidenceIds={claim.evidenceIds}
        supportProfileId={claim.supportProfileId}
      />
    </li>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <li className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-relaxed text-slate-900">
          {rec.action}
        </p>
        <PriorityBadge priority={rec.priority} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{rec.rationale}</p>
      <p className="mt-2 text-xs text-slate-500">
        Expected outcome: {rec.expectedOutcome}
      </p>
      <EvidenceMeta
        evidenceIds={rec.evidenceIds}
        actionTemplateId={rec.actionTemplateId}
      />
    </li>
  );
}

export default function InvestigationDossier({
  report,
  slug,
  endDate,
  outcome,
  onBack,
  onReRun,
}: {
  report: Report;
  slug: string;
  endDate: string;
  outcome: InvestigationOutcome | null;
  onBack: () => void;
  onReRun: (slug: string) => void;
}) {
  const finding = report.outlets.find(
    (outlet) => slugify(outlet.outletName) === slug,
  );
  if (!finding) {
    return (
      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Outlet not found.</p>
        <button
          onClick={onBack}
          className="mt-3 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const isDecline = finding.status === "ANOMALY_DECLINE";
  const declineArrow = isDecline ? "↓" : "↑";
  const revenueChange = finding.revenue;

  const input = outcome?.input;
  const dec = input?.signals.decomposition;
  const evidenceById = new Map(
    (input?.evidenceCatalog ?? []).map((fact) => [fact.id, fact]),
  );

  const stockoutFacts = (input?.evidenceCatalog ?? [])
    .filter((fact) => fact.type === "stockout" && fact.productSku)
    .sort(
      (a, b) => numFact(valueOf(b, "duration")) - numFact(valueOf(a, "duration")),
    )
    .slice(0, 6);

  const productChangeFacts = (input?.evidenceCatalog ?? []).filter(
    (fact) => fact.type === "product_change" && fact.productSku,
  );

  const stockoutVerified =
    stockoutFacts.length > 0 &&
    stockoutFacts.every((fact) => Boolean(valueOf(fact, "zeroSalesVerified")));

  const stockoutProfile = (input?.supportProfiles ?? []).find(
    (p) =>
      p.patternId === "stockout_partial_contribution" &&
      p.evidenceIds.some((id) => evidenceById.get(id)?.type === "stockout"),
  );
  const stockoutBasis = stockoutProfile?.basis?.join(" ") ?? null;

  const recoveryBySku = new Map<string, number>();
  for (const fact of input?.evidenceCatalog ?? []) {
    if (fact.type === "product_change" && fact.productSku) {
      const delta =
        numFact(valueOf(fact, "revenueBaselinePerDay")) -
        numFact(valueOf(fact, "revenueCurrentPerDay"));
      recoveryBySku.set(fact.productSku, Math.round(Math.max(0, delta)));
    }
  }

  const impactFor = (ids: string[]): number => {
    let total = 0;
    for (const id of ids) {
      const fact = evidenceById.get(id);
      if (fact?.productSku) total += recoveryBySku.get(fact.productSku) ?? 0;
    }
    return Math.round(total);
  };

  const impactNote = (rec: Recommendation): string | null => {
    const impact = impactFor(rec.evidenceIds);
    if (impact > 0) return `+${formatRpCompact(impact)}/day`;
    if (input && rec.evidenceIds.includes(`${input.entity.id}:decomposition`)) {
      return `${formatRpCompact(Math.abs(dec?.residualPerDay ?? 0))}/day unresolved`;
    }
    return null;
  };

  const totalRecoverable = (outcome?.result?.recommendations ?? []).reduce(
    (sum, rec) => sum + impactFor(rec.evidenceIds),
    0,
  );

  const explainedPct = Math.abs(dec?.droppedOutletShareFlaggedPct ?? 0);
  const residualPct = Math.max(0, 100 - explainedPct);
  const explainedAbs = Math.abs(dec?.explainedByFlaggedPerDay ?? 0);
  const residualAbs = Math.abs(dec?.residualPerDay ?? 0);
  const stockoutSharePct = Math.abs(dec?.droppedOutletShareStockoutsPct ?? 0);

  const nextAreas: string[] = [];
  for (const gap of input?.dataGaps ?? []) {
    switch (gap.id) {
      case "no-order-level":
        nextAreas.push("Traffic");
        break;
      case "no-promo-calendar":
        nextAreas.push("Promotions", "Pricing");
        break;
      case "no-supply-chain":
        nextAreas.push("Operations");
        break;
      case "no-exogenous":
        nextAreas.push("Competitors / external");
        break;
    }
  }
  const dedupedNextAreas = [...new Set(nextAreas)];
  if (dedupedNextAreas.length === 0) dedupedNextAreas.push("Traffic");

  const hypothesisRows: {
    key: string;
    label: string;
    status: "confirmed" | "possible" | "unverified";
    note?: string;
  }[] = [];

  if (stockoutProfile) {
    hypothesisRows.push({
      key: "inventory",
      label: "Inventory availability",
      status: "confirmed",
      note: `${confidenceFromLevel(stockoutProfile.level)} confidence basis`,
    });
  }
  const incompleteProfile = (input?.supportProfiles ?? []).find(
    (p) => p.patternId === "incomplete_explanation",
  );
  const broadProfile = (input?.supportProfiles ?? []).find(
    (p) => p.patternId === "broad_demand_hypothesis",
  );
  if (incompleteProfile || broadProfile) {
    hypothesisRows.push({
      key: "demand",
      label: "Demand / operations",
      status: "possible",
      note: incompleteProfile
        ? `${confidenceFromLevel(incompleteProfile.level)} evidence basis`
        : undefined,
    });
  }
  hypothesisRows.push({
    key: "pricing",
    label: "Pricing / promotion",
    status: "unverified",
    note: "No promo or pricing data in scope",
  });

  return (
    <div className="max-w-6xl mx-auto bg-surface-container-lowest border border-outline-variant rounded-md shadow-sm overflow-hidden">
      {/* Dossier Header */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1 text-label-md font-label-md text-primary group cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              arrow_back
            </span>
            <span>Back to dashboard</span>
          </button>

          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-red-100 text-red-700 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span>
              {finding.severity.toUpperCase()}{" "}
              {finding.status.replace("ANOMALY_", "")}
            </span>
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              AI Investigation
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {finding.outletName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-md px-3 py-1.5 text-body-md">
              <span className="text-red-700 font-bold">
                Revenue {declineArrow}{" "}
                {Math.abs(revenueChange.changePct).toFixed(1)}%
              </span>

              <span className="text-slate-400">|</span>

              <span className="text-on-surface-variant font-mono-data">
                {formatRpCompact(revenueChange.currentDailyAvg)}/day
                <span className="ml-1.5 text-[11px] text-slate-500">
                  7-day current avg
                </span>
              </span>

              <span className="text-slate-300">·</span>

              <span className="text-on-surface-variant font-mono-data">
                {formatRpCompact(revenueChange.baselineDailyAvg)}/day
                <span className="ml-1.5 text-[11px] text-slate-500">
                  28-day baseline
                </span>
              </span>
            </div>

            <div className="text-[12px] text-on-surface-variant font-medium">
              Analysis Window:{" "}
              <span className="text-on-surface font-semibold">
                {formatDayRangeLabel(
                  report.window.currentStart,
                  report.window.currentEnd
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dossier Body */}
      <div className="p-8 space-y-8">
        <section className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-md p-space-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center space-x-2">
                <span className="p-1 bg-[#DCFCE7] text-tertiary rounded">
                  <span className="material-symbols-outlined text-[18px]">
                    verified
                  </span>
                </span>

                <h2 className="font-table-header text-table-header uppercase tracking-wider text-tertiary">
                  INVESTIGATION VERDICT
                </h2>
              </div>

              <p className="font-headline-lg text-headline-lg text-on-surface font-bold leading-tight">
                "{outcome?.result?.primaryFinding.statement || "Analysis completed."}"
              </p>

              <p className="text-body-md font-body-md text-on-surface-variant">
                Verified stockouts are a confirmed contributor to the revenue decline,
                with an estimated impact of{" "}
                <span className="font-semibold text-on-surface">
                  {formatRpCompact(
                    Math.abs(dec?.explainedByStockoutsPerDay ?? 0)
                  )}
                  /day
                </span>
                .
                {isDecline && Math.abs(dec?.residualPerDay ?? 0) > 0 && (
                  <>
                    {" "}
                    However, this does not explain the full decline.{" "}
                    <span className="font-semibold text-on-surface">
                      {formatRpCompact(Math.abs(dec?.residualPerDay ?? 0))}/day
                    </span>{" "}
                    remains unexplained by the available evidence.
                  </>
                )}
              </p>
            </div>

            {/* Evidence Coverage */}
            <div className="bg-surface-container-lowest border border-[#86EFAC] rounded-md p-3 min-w-[210px] flex flex-col justify-center shadow-xs shrink-0">
              <div className="text-[11px] font-label-sm text-outline uppercase tracking-wider mb-1">
                EVIDENCE COVERAGE
              </div>

              <div className="flex items-center space-x-2">
                <span className="font-headline-md text-headline-md font-bold text-tertiary">
                  {explainedPct.toFixed(1)}%
                </span>

                <span className="text-label-sm font-label-sm px-2 py-0.5 bg-[#ECFDF5] text-tertiary font-bold border border-[#A7F3D0] rounded">
                  EXPLAINED
                </span>
              </div>

              <div className="text-[11px] text-on-surface-variant mt-1 leading-tight">
                Portion of the revenue decline supported by available evidence
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              pie_chart
            </span>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
              REVENUE ATTRIBUTION
            </h2>
          </div>

          <div className="h-6 w-full rounded bg-slate-100 p-0.5 border border-slate-200 flex overflow-hidden">
            <div
              className="h-full rounded-l bg-primary flex items-center justify-between px-2 text-white text-[11px] font-bold"
              style={{ width: `${explainedPct}%` }}
            >
              <span>{explainedPct.toFixed(1)}%</span>
              <span>{formatRpCompact(explainedAbs)}/day</span>
            </div>

            <div
              className="h-full rounded-r bg-red-500 flex items-center justify-between px-2 text-white text-[11px] font-bold"
              style={{ width: `${residualPct}%` }}
            >
              <span>{residualPct.toFixed(1)}% UNEXPLAINED</span>
              <span>{formatRpCompact(residualAbs)}/day</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg pt-1">
            {/* Card 1: Explained */}
            <div className="bg-surface-container-lowest border border-primary/30 rounded-md p-space-lg shadow-xs hover:border-primary transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-label-sm font-label-sm font-bold text-primary uppercase tracking-wider">
                  {explainedPct.toFixed(1)}% EXPLAINED
                </span>

                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                  <span className="material-symbols-outlined text-[13px]">
                    check_circle
                  </span>
                  <span>Evidence-backed</span>
                </span>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className="font-telemetry-data text-telemetry-data text-on-surface">
                  {formatRpCompact(explainedAbs)}
                </span>
                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  / day
                </span>
              </div>

              <p className="mt-2 text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
                Estimated contribution supported by verified stockout evidence and
                observed zero-sales periods for affected SKUs.
              </p>

              <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>
                  Affected SKUs:{" "}
                  <strong className="text-on-surface">
                    {stockoutFacts.length}
                  </strong>
                </span>

                <span className="text-tertiary font-semibold">
                  Deterministic evidence
                </span>
              </div>
            </div>

            {/* Card 2: Unexplained */}
            <div className="bg-surface-container-lowest border border-[#FECDD3] rounded-md p-space-lg shadow-xs hover:border-[#FDA4AF] transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-label-sm font-label-sm font-bold text-[#BE123C] uppercase tracking-wider">
                  {residualPct.toFixed(1)}% UNEXPLAINED
                </span>

                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]">
                  <span className="material-symbols-outlined text-[13px]">
                    help
                  </span>
                  <span>UNRESOLVED</span>
                </span>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className="font-telemetry-data text-telemetry-data text-[#9F1239]">
                  {formatRpCompact(residualAbs)}
                </span>

                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  / day
                </span>
              </div>

              <p className="mt-2 text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
                The available sales and inventory evidence does not explain this
                portion of the revenue decline.
              </p>

              <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>
                  Next areas:{" "}
                  <strong className="text-on-surface">
                    {dedupedNextAreas.length > 0
                      ? dedupedNextAreas.slice(0, 2).join(" · ")
                      : "Additional evidence needed"}
                  </strong>
                </span>

                <span className="text-[#BE123C] font-semibold">
                  Evidence gap
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT WE KNOW */}
        <section className="bg-surface-container-low/60 border border-outline-variant rounded-md p-space-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-space-md">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                fact_check
              </span>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
                WHAT WE KNOW
              </h2>
            </div>

            {stockoutFacts.length > 0 && (
              <div className="inline-flex items-center px-2.5 py-1 bg-surface-container-lowest border border-outline-variant rounded text-label-sm font-label-sm text-on-surface">
                Estimated stockout contribution:
                <strong className="text-primary ml-1">
                  {stockoutSharePct.toFixed(1)}% of revenue decline
                </strong>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {stockoutFacts.slice(0, 2).map((fact) => {
              const duration = numFact(valueOf(fact, "duration"));
              const runRate = numFact(valueOf(fact, "revenueBaselinePerDay"));

              return (
                <div
                  key={fact.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-md p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1 text-label-sm font-label-sm font-bold text-error">
                      <span className="w-2 h-2 rounded-full bg-error" />
                      <span>Verified stockout</span>
                    </span>

                    <span className="text-[11px] text-outline font-mono-data">
                      {fact.productSku}
                    </span>
                  </div>

                  <div className="text-body-md font-body-md font-semibold text-on-surface">
                    {fact.productName}
                  </div>

                  <div className="text-body-sm font-body-sm text-error font-medium">
                    {duration} continuous day{duration === 1 ? "" : "s"} out of stock
                  </div>

                  <div className="text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/40">
                    Baseline revenue: {formatRpCompact(runRate)}/day
                  </div>
                </div>
              );
            })}

            {stockoutFacts.length === 0 && (
              <div className="md:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-md p-3.5">
                <div className="flex items-center space-x-1 text-label-sm font-label-sm font-bold text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">
                    info
                  </span>
                  <span>NO VERIFIED STOCKOUTS</span>
                </div>

                <div className="text-body-sm font-body-sm text-on-surface-variant mt-1">
                  No stockout events were detected in this analysis window.
                </div>
              </div>
            )}

            {stockoutFacts.length > 0 && (
              <div className="bg-surface-container-lowest border border-[#A7F3D0] rounded-md p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center space-x-1 text-label-sm font-label-sm font-bold text-tertiary">
                    <span className="material-symbols-outlined text-[14px]">
                      check_circle
                    </span>
                    <span>ZERO SALES VERIFIED</span>
                  </span>

                  <span className="text-[11px] text-tertiary font-mono-data">
                    Evidence
                  </span>
                </div>

                <div className="text-body-md font-body-md font-semibold text-on-surface">
                  Affected SKUs recorded zero sales
                </div>

                <div className="text-body-sm font-body-sm text-tertiary font-medium">
                  Zero-sales periods were observed during the verified stockout events.
                </div>

                <div className="text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/40">
                  Supports inventory availability as a contributor
                </div>
              </div>
            )}
          </div>

          <div className="mt-space-md pt-space-sm flex items-center justify-end">
            {input && (
              <EvidenceDrawer
                outletName={input.entity.name}
                window={input.window}
                stockoutFacts={stockoutFacts}
                productChangeFacts={productChangeFacts}
                stockoutSharePct={stockoutSharePct}
                explainedAbs={explainedAbs}
                residualAbs={residualAbs}
                residualPct={residualPct}
                stockoutVerified={stockoutVerified}
                stockoutBasis={stockoutBasis}
              />
            )}
          </div>
        </section>

        {/* Hypotheses Matrix */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                grid_view
              </span>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
                REASONING MATRIX
              </h2>
            </div>

            <span className="text-[11px] text-slate-400">
              Evidence confidence by hypothesis
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Hypothesis</th>
                  <th className="py-3 px-4">Evidence / Basis</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {hypothesisRows.map((row) => {
                  const status = row.status?.toLowerCase();

                  const statusConfig =
                    status === "confirmed"
                      ? {
                          label: "CONFIRMED",
                          className: "bg-emerald-100 text-emerald-700",
                        }
                      : status === "possible"
                        ? {
                            label: "POSSIBLE",
                            className: "bg-amber-100 text-amber-700",
                          }
                        : {
                            label: "UNVERIFIED",
                            className: "bg-slate-100 text-slate-600",
                          };

                  return (
                    <tr
                      key={row.key}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4 align-top">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 align-top font-semibold text-slate-900">
                        {row.label}
                      </td>

                      <td className="py-3 px-4 align-top text-slate-600 leading-relaxed">
                        {row.note || "Additional evidence required"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Status reflects how strongly the available evidence supports each
            hypothesis. It does not represent statistical confidence or probability.
          </p>
        </section>
      </div>

      {/* Error handling & Results Section */}
      <div className="p-8 space-y-8">
        {outcome && !outcome.ok && (
          <div className="rounded border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-rose-800">
              Investigation failed
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The LLM output did not pass strict provenance and causality validation.
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm text-rose-700">
              {outcome.errors.map((error, index) => (
                <li key={index} className="leading-relaxed">
                  {error}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onReRun(slug)}
              className="mt-4 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Re-run investigation
            </button>
          </div>
        )}

        {outcome?.ok && input && outcome.result && (
          <InvestigationResults
            input={input}
            result={outcome.result}
            impactNote={impactNote}
            totalRecoverable={totalRecoverable}
            nextAreas={dedupedNextAreas}
          />
        )}
      </div>
    </div>
  );
}

function InvestigationResults({
  input,
  result,
  impactNote,
  totalRecoverable,
  nextAreas,
}: {
  input: InvestigationInput;
  result: InvestigationResult;
  impactNote: (rec: Recommendation) => string | null;
  totalRecoverable: number;
  nextAreas: string[];
}) {
  return (
    <div className="space-y-10">
      {/* RECOMMENDED ACTIONS */}
      <section className="space-y-space-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                checklist
              </span>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
                RECOMMENDED ACTIONS
              </h2>
            </div>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Actions prioritized from the available evidence and unresolved signals.
            </p>
          </div>

          {totalRecoverable > 0 && (
            <span className="inline-flex items-center text-[12px] text-on-surface-variant">
              Estimated recovery potential:
              <strong className="text-tertiary ml-1 font-bold">
                +{formatRpCompact(totalRecoverable)}/day
              </strong>
            </span>
          )}
        </div>

        {result.recommendations.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-body-sm font-semibold text-slate-600">
              No actionable recommendation was identified from the available evidence.
            </p>
            <p className="text-[12px] text-slate-500 mt-1">
              Additional evidence may be required before taking corrective action.
            </p>
          </div>
        ) : (
          <div className="space-y-space-md">
            {result.recommendations.map((rec) => {
              const isHigh = rec.priority === "high";
              const isMedium = rec.priority === "medium";

              const iconBg = isHigh
                ? "bg-[#FFE4E6] text-[#BE123C] border border-[#FDA4AF]"
                : isMedium
                  ? "bg-[#EFF6FF] text-primary border border-outline-variant"
                  : "bg-slate-100 text-slate-600 border border-slate-200";

              const icon = isHigh
                ? "priority_high"
                : isMedium
                  ? "troubleshoot"
                  : "info";

              const badge = isHigh
                ? "bg-[#FFE4E6] text-[#BE123C] border border-[#FDA4AF]"
                : isMedium
                  ? "bg-surface-container-low text-primary border border-outline-variant"
                  : "bg-slate-100 text-slate-600 border border-slate-200";

              const badgeLabel = isHigh
                ? "HIGH"
                : isMedium
                  ? "MEDIUM"
                  : "LOW";

              const recovery = impactNote(rec);

              return (
                <div
                  key={rec.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-xs transition-shadow"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`mt-0.5 p-2 rounded-md ${iconBg}`}>
                      <span className="material-symbols-outlined text-[20px]">
                        {icon}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-headline-md text-headline-md font-bold text-on-surface">
                          {rec.action}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge}`}
                        >
                          {badgeLabel}
                        </span>
                      </div>

                      <div className="text-body-sm font-body-sm text-on-surface-variant mt-1 flex flex-col">
                        {rec.rationale}

                        {recovery && (
                          <>
                            <span>
                              {" · "}
                              {recovery.includes("unresolved")
                                ? "Unresolved impact: "
                                : "Estimated recovery potential: "}
                              <span
                                className={
                                  recovery.includes("unresolved")
                                    ? "text-[#BE123C] font-bold"
                                    : "text-tertiary font-bold"
                                }
                              >
                                {recovery}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 06: WHAT SHOULD WE INVESTIGATE NEXT? */}
      <section className="space-y-space-md">
        <div>
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              search
            </span>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
              WHAT SHOULD WE INVESTIGATE NEXT?
            </h2>
          </div>
          <p className="text-[12px] text-on-surface-variant mt-0.5">
            Evidence gaps that could help explain the unresolved portion of the anomaly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
          {(() => {
            const vectorMeta: Record<
              string,
              { icon: string; title: string; desc: string }
            > = {
              Traffic: {
                icon: "directions_walk",
                title: "Customer Traffic",
                desc: "Check whether changes in store traffic or customer visits contributed to the decline.",
              },
              Promotions: {
                icon: "campaign",
                title: "Promotions & Marketing",
                desc: "Review active, expired, or changed promotions during the analysis window.",
              },
              Pricing: {
                icon: "price_change",
                title: "Pricing",
                desc: "Compare pricing changes and potential demand response during the affected period.",
              },
              Operations: {
                icon: "badge",
                title: "Store Operations",
                desc: "Review staffing, operating hours, service disruptions, or other operational factors.",
              },
              "Competitors / external": {
                icon: "store",
                title: "Competitor / External Factors",
                desc: "Check for competitor activity, local events, or other external demand drivers.",
              },
            };

            return nextAreas.slice(0, 5).map((area) => {
              const meta = vectorMeta[area];

              return (
                <div
                  key={area}
                  className="p-3.5 bg-surface-container-lowest border border-outline-variant rounded-md hover:border-primary transition-all group shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">
                      {meta?.icon ?? "help_outline"}
                    </span>
                  </div>

                  <h4 className="font-label-md text-label-md font-bold text-on-surface group-hover:text-primary transition-colors">
                    {meta?.title ?? area}
                  </h4>

                  <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                    {meta?.desc ?? "Additional evidence is required to evaluate this factor."}
                  </p>
                </div>
              );
            });
          })()}
        </div>
      </section>

      {/* EVIDENCE GAPS & LIMITATIONS */}
      <section className="border border-outline-variant rounded-md overflow-hidden bg-surface-container-low/40">
        <details open className="group">
          <summary className="p-4 bg-surface-container-low flex items-center justify-between cursor-pointer list-none select-none">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-outline text-[18px]">
                info
              </span>

              <span className="font-label-md font-label-md font-bold text-on-surface">
                Investigation limitations
              </span>
            </div>

            <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">
              expand_more
            </span>
          </summary>

          <div className="p-space-lg border-t border-outline-variant/60 bg-surface-container-lowest">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-body-sm font-body-sm text-on-surface-variant">
              {result.limitations.map((limitation, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2"
                >
                  <span className="text-outline mt-0.5">•</span>
                  <span className="leading-relaxed">{limitation}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}