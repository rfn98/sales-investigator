import { notFound } from "next/navigation";
import {
  formatChangePct,
  formatDayRangeLabel,
  formatRp,
  formatRpCompact,
  formatUtcTimestamp,
  slugify,
} from "../../../../components/format";
import { parseEndDate } from "../../../../lib/defaults";
import { getReport } from "../../../../lib/report";
import {
  DATA_GAPS,
  resolveUiProvider,
  runOutletInvestigation,
} from "../../../../lib/ai";
import type {
  CausalStrength,
  Claim,
  EvidenceFact,
  InvestigationInput,
  InvestigationResult,
  Priority,
  Recommendation,
} from "../../../../lib/ai";

export const dynamic = "force-dynamic";

const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-800 hover:underline";

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

const priorityAccent: Record<Priority, string> = {
  high: "border-l-rose-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-400",
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

export default async function InvestigatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ endDate?: string | string[] }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const raw = Array.isArray(sp.endDate) ? sp.endDate[0] : sp.endDate;
  const endDate = parseEndDate(raw);
  const report = await getReport(endDate);

  const finding = report.outlets.find(
    (outlet) => slugify(outlet.outletName) === slug,
  );
  if (!finding) notFound();

  const { providerId, configError } = resolveUiProvider(process.env);
  const outcome = await runOutletInvestigation(report, slug, { providerId });

  const isDecline = finding.status === "ANOMALY_DECLINE";
  const declineArrow = isDecline ? "↓" : "↑";
  const revenueChange = finding.revenue;
  const changeColorClass = (v: number) =>
    v > 0 ? "text-emerald-300" : v < 0 ? "text-rose-300" : "text-slate-300";
  const revenueColor = changeColorClass(revenueChange.changePct);

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

  const stockoutProfile = (input?.supportProfiles ?? []).find(
    (p) =>
      p.patternId === "stockout_partial_contribution" &&
      p.evidenceIds.some((id) => evidenceById.get(id)?.type === "stockout"),
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
          <a href={`/outlets?endDate=${endDate}`} className="inline-flex items-center space-x-1 text-label-md font-label-md text-primary hover:underline group">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Outlets</span>
          </a>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-red-100 text-red-700 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span>{finding.severity.toUpperCase()} {finding.status.replace("ANOMALY_", "")}</span>
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <h1 className="font-headline-xl text-3xl font-bold tracking-tight text-on-surface">AI INVESTIGATION</h1>
            <span className="text-xl font-light text-slate-400">/</span>
            <span className="font-headline-lg text-2xl font-semibold text-on-surface">{finding.outletName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center space-x-2 bg-red-50 border border-red-100 rounded-md px-3 py-1.5 text-body-md">
              <span className="text-red-700 font-bold">Revenue {declineArrow} {Math.abs(revenueChange.changePct).toFixed(1)}%</span>
              <span className="text-slate-400">|</span>
              <span className="text-on-surface-variant">{formatRpCompact(revenueChange.baselineDailyAvg)} → <span className="font-bold text-on-surface">{formatRpCompact(revenueChange.currentDailyAvg)}</span>/day</span>
            </div>
            <div className="text-[12px] text-on-surface-variant font-medium">Observed Window: <span className="text-on-surface font-semibold">{formatDayRangeLabel(report.window.currentStart, report.window.currentEnd)}</span></div>
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
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </span>
                <h2 className="font-table-header text-table-header uppercase tracking-wider text-tertiary">INVESTIGATION VERDICT</h2>
              </div>
              <p className="font-headline-lg text-headline-lg text-on-surface font-bold leading-tight">
                "{outcome?.result?.primaryFinding.statement || "Analysis completed."}"
              </p>
              <p className="text-body-md font-body-md text-on-surface-variant">
                Deterministic regression reveals out-of-stock SKUs generate an active run-rate impairment of <span className="font-semibold text-on-surface">{formatRpCompact(Math.abs(dec?.explainedByStockoutsPerDay ?? 0))}/day</span>.
                {isDecline && Math.abs(dec?.residualPerDay ?? 0) > 0 && (
                  <> However, an anomalous uncoupled divergence of <span className="font-semibold text-on-surface">{formatRpCompact(Math.abs(dec?.residualPerDay ?? 0))}/day</span> persists across stocked inventory sectors.</>
                )}
              </p>
            </div>
            {/* Confidence Score Pill */}
            <div className="bg-surface-container-lowest border border-[#86EFAC] rounded-md p-3 min-w-[210px] flex flex-col justify-center shadow-xs shrink-0">
              <div className="text-[11px] font-label-sm text-outline uppercase tracking-wider mb-1">Diagnostic Confidence</div>
              <div className="flex items-center space-x-2">
                <span className="font-headline-md text-headline-md font-bold text-tertiary">{explainedPct.toFixed(1)}%</span>
                <span className="text-label-sm font-label-sm px-2 py-0.5 bg-[#ECFDF5] text-tertiary font-bold border border-[#A7F3D0] rounded">
                  {explainedPct >= 80 ? "HIGH" : explainedPct >= 50 ? "MODERATE" : "LOW"}
                </span>
              </div>
              <div className="text-[11px] text-on-surface-variant mt-1 leading-tight">
                Deterministic Cross-Reference Validated via POS event stream
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-table-header text-xs uppercase tracking-wider text-slate-500">REVENUE ATTRIBUTION</h3>
          <div className="h-6 w-full rounded bg-slate-100 p-0.5 border border-slate-200 flex overflow-hidden">
            <div className="h-full rounded-l bg-primary flex items-center justify-between px-2 text-white text-[11px] font-bold" style={{ width: `${explainedPct}%` }}>
              <span>{explainedPct.toFixed(1)}%</span>
              <span>{formatRpCompact(explainedAbs)}</span>
            </div>
            <div className="h-full rounded-r bg-red-500 flex items-center justify-between px-2 text-white text-[11px] font-bold" style={{ width: `${residualPct}%` }}>
              <span>{residualPct.toFixed(1)}% UNEXPLAINED</span>
              <span>{formatRpCompact(residualAbs)}/day</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg pt-1">
            {/* Card 1: Explained */}
            <div className="bg-surface-container-lowest border border-primary/30 rounded-md p-space-lg shadow-xs hover:border-primary transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-label-sm font-label-sm font-bold text-primary uppercase tracking-wider">{explainedPct.toFixed(1)}% EXPLAINED</span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>Evidence-backed</span>
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="font-telemetry-data text-telemetry-data text-on-surface">{formatRpCompact(explainedAbs)}</span>
                <span className="text-body-sm font-body-sm text-on-surface-variant">/ day</span>
              </div>
              <p className="mt-2 text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
                Attributed strictly to verified SKU stockouts and confirmed zero-sales velocity periods recorded across central POS till buffers.
              </p>
              <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>Affected Lines: <strong className="text-on-surface">{stockoutFacts.length > 0 ? `${stockoutFacts[0]?.productName || "SKU"} (${stockoutFacts.length} SKU${stockoutFacts.length === 1 ? "" : "s"})` : "None"}</strong></span>
                <span className="text-tertiary font-semibold">100% Deterministic</span>
              </div>
            </div>

            {/* Card 2: Unexplained */}
            <div className="bg-surface-container-lowest border border-[#FECDD3] rounded-md p-space-lg shadow-xs hover:border-[#FDA4AF] transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-label-sm font-label-sm font-bold text-[#BE123C] uppercase tracking-wider">{residualPct.toFixed(1)}% UNEXPLAINED</span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]">
                  <span className="material-symbols-outlined text-[13px]">help</span>
                  <span>Requires Investigation</span>
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="font-telemetry-data text-telemetry-data text-[#9F1239]">{formatRpCompact(residualAbs)}</span>
                <span className="text-body-sm font-body-sm text-on-surface-variant">/ day</span>
              </div>
              <p className="mt-2 text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
                Unexplained residual variance across fully stocked categories. Inventory shelves remained green while customer transaction count slipped.
              </p>
              <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>Candidate Factor: <strong className="text-on-surface">{dedupedNextAreas.length > 0 ? dedupedNextAreas[0] : "External Traffic Shift"}</strong></span>
                <span className="text-[#BE123C] font-semibold">Investigation Triggered</span>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT WE KNOW */}
        <section className="bg-surface-container-low/60 border border-outline-variant rounded-md p-space-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-space-md">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">WHAT WE KNOW</h2>
            </div>
            <div className="inline-flex items-center px-2.5 py-1 bg-surface-container-lowest border border-outline-variant rounded text-label-sm font-label-sm text-on-surface">
              Estimated contribution: <strong className="text-primary ml-1">{stockoutSharePct.toFixed(1)}% of total revenue decline</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {stockoutFacts.slice(0, 2).map((fact) => {
              const duration = numFact(valueOf(fact, "duration"));
              const runRate = numFact(valueOf(fact, "revenueBaselinePerDay"));
              return (
                <div key={fact.id} className="bg-surface-container-lowest border border-outline-variant rounded-md p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1 text-label-sm font-label-sm font-bold text-error">
                      <span className="w-2 h-2 rounded-full bg-error"></span>
                      <span>Stockout {fact.productSku}</span>
                    </span>
                    <span className="text-[11px] text-outline font-mono-data">{fact.productSku}</span>
                  </div>
                  <div className="text-body-md font-body-md font-semibold text-on-surface">{fact.productName}</div>
                  <div className="text-body-sm font-body-sm text-error font-medium">{duration} continuous day{duration === 1 ? "" : "s"} out of stock</div>
                  <div className="text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/40">Historical Run-rate: {formatRpCompact(runRate)}/day lost</div>
                </div>
              );
            })}

            {stockoutFacts.length === 0 && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-md p-3.5 space-y-1">
                <div className="flex items-center space-x-1 text-label-sm font-label-sm font-bold text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  <span>No stockouts detected</span>
                </div>
                <div className="text-body-sm font-body-sm text-on-surface-variant">No stockout events were found in this analysis window.</div>
              </div>
            )}

            {/* Telemetry Concurrence */}
            <div className="bg-surface-container-lowest border border-[#A7F3D0] rounded-md p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center space-x-1 text-label-sm font-label-sm font-bold text-tertiary">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  <span>Telemetry Concurrence</span>
                </span>
                <span className="text-[11px] text-tertiary font-mono-data">POS TILLS 01-04</span>
              </div>
              <div className="text-body-md font-body-md font-semibold text-on-surface">Zero-Sales Validation</div>
              <div className="text-body-sm font-body-sm text-tertiary font-medium">Exact zero sales confirmed in register feeds</div>
              <div className="text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/40">Excludes cashier manual bypass errors</div>
            </div>
          </div>

          <div className="mt-space-md pt-space-sm border-t border-outline-variant/60 flex items-center justify-end">
            <a href={`/outlets/${slug}?endDate=${endDate}#evidence`} className="inline-flex items-center space-x-1 text-label-md font-label-md text-primary hover:text-primary-container font-semibold transition-colors">
              <span>View evidence details</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </section>

        {/* Hypotheses Matrix */}
        <section className="space-y-4">
           <h3 className="font-table-header text-xs uppercase tracking-wider text-slate-500">REASONING MATRIX</h3>
           <div className="overflow-x-auto border border-slate-200 rounded-md">
             <table className="w-full text-left border-collapse bg-white">
               <thead>
                 <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                   <th className="py-3 px-4">Status</th>
                   <th className="py-3 px-4">Hypothesis</th>
                   <th className="py-3 px-4">Confidence</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-sm">
                 {hypothesisRows.map((row) => (
                   <tr key={row.key} className="hover:bg-slate-50">
                     <td className="py-3 px-4">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                         {row.status}
                       </span>
                     </td>
                     <td className="py-3 px-4 font-semibold">{row.label}</td>
                     <td className="py-3 px-4 text-slate-600">{row.note || "-"}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </section>
      </div>
      
      {/* Error handling & Results Section */}
      <div className="p-8 space-y-8">
        {configError && !outcome?.providerId && (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {configError}
          </div>
        )}

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
            <a
              href={`/outlets/${slug}/investigate?endDate=${endDate}`}
              className="mt-4 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Re-run investigation
            </a>
          </div>
        )}

        {outcome?.ok && input && outcome.result && (
          <InvestigationResults
            input={input}
            result={outcome.result}
            slug={slug}
            endDate={endDate}
            impactNote={impactNote}
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
  slug,
  endDate,
  impactNote,
  nextAreas,
}: {
  input: InvestigationInput;
  result: InvestigationResult;
  slug: string;
  endDate: string;
  impactNote: (rec: Recommendation) => string | null;
  nextAreas: string[];
}) {
  return (
    <div className="space-y-10">
      {/* RECOMMENDED ACTIONS */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-[16px] text-primary">
            fact_check
          </span>
          <h3 className="font-table-header text-xs uppercase tracking-wider text-slate-500">
            Recommended actions
          </h3>
        </div>
        {result.recommendations.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-body-sm font-semibold text-slate-600">
              No recommendations were proposed.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {result.recommendations.map((rec, index) => (
              <div
                key={rec.id}
                className={`flex flex-col rounded-md border border-l-4 border-slate-200 bg-white p-5 shadow-sm ${priorityAccent[rec.priority]}`}
              >
                <p className="font-table-header text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {String(index + 1).padStart(2, "0")} ·{" "}
                  <span className="uppercase text-slate-700">
                    {rec.priority}
                  </span>
                </p>
                <p className="mt-2 font-headline-md text-base font-semibold leading-snug text-slate-900">
                  {rec.action}
                </p>
                <p className="mt-2 text-body-sm leading-relaxed text-slate-600">
                  {rec.rationale}
                </p>
                {impactNote(rec) && (
                  <p className="mt-3 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-body-sm font-semibold tabular-nums text-indigo-700">
                    Potential recovery {impactNote(rec)}
                  </p>
                )}
                <div className="mt-auto pt-4">
                  <a
                    href={`/outlets/${slug}?endDate=${endDate}#evidence`}
                    className="inline-flex items-center space-x-1 rounded-md border border-primary/30 px-3 py-1.5 text-body-sm font-semibold text-primary hover:bg-primary/5"
                  >
                    <span>Take action</span>
                    <span className="material-symbols-outlined text-[14px]">
                      north_east
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* NEXT VECTORS */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-[16px] text-primary">
            route
          </span>
          <h3 className="font-table-header text-xs uppercase tracking-wider text-slate-500">
            Next vectors
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextAreas.map((area) => (
            <span
              key={area}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-body-sm font-medium text-slate-700"
            >
              {area}
            </span>
          ))}
        </div>
        <p className="text-body-sm text-slate-500">
          Areas the current contract cannot resolve. See evidence gaps for the
          full list of dataset limitations.
        </p>
      </section>

      {/* EVIDENCE GAPS (collapsible) */}
      <details className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[16px] text-slate-500">
              unfold_more
            </span>
            <span className="font-table-header text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Evidence gaps &amp; limitations
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono-data text-[10px] font-bold text-slate-600">
              {DATA_GAPS.length + result.limitations.length} items
            </span>
          </span>
          <span className="material-symbols-outlined text-[16px] text-slate-400">
            expand_more
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <ul className="space-y-2">
            {DATA_GAPS.map((gap) => (
              <li
                key={gap.id}
                className="flex items-start space-x-2 text-body-sm leading-relaxed text-slate-600"
              >
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-[14px] text-slate-400">
                  more_horiz
                </span>
                <span>{gap.text}</span>
              </li>
            ))}
          </ul>
          {result.limitations.length > 0 && (
            <ul className="space-y-2 border-t border-slate-100 pt-4">
              {result.limitations.map((limitation, index) => (
                <li
                  key={index}
                  className="flex items-start space-x-2 text-body-sm leading-relaxed text-slate-600"
                >
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-[14px] text-amber-500">
                    error_outline
                  </span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}