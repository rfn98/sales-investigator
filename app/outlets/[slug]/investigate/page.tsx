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
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${strengthStyle[strength]}`}
    >
      {strength}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${priorityStyle[priority]}`}
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
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
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
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-white shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Sales Investigator
        </p>
        <a
          href={`/outlets/${slug}/investigate?endDate=${endDate}`}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Re-run investigation ↗
        </a>
      </div>

      <section>
        <a href={`/outlets/${slug}?endDate=${endDate}`} className={linkClass}>
          ← Back to {finding.outletName}
        </a>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-sm">
        <div className="px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                AI Investigation
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight uppercase">
                  {finding.outletName}
                </h1>
                {finding.status !== "NORMAL" && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-bold uppercase ${severityBadge[finding.severity].color}`}
                  >
                    <span>{severityBadge[finding.severity].emoji}</span>
                    {finding.severity}
                    {isDecline
                      ? " decline"
                      : finding.status === "ANOMALY_GROWTH"
                        ? " growth"
                        : ""}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Revenue {declineArrow}{Math.abs(revenueChange.changePct).toFixed(1)}% ·{" "}
                <span className={revenueColor}>
                  {formatRpCompact(revenueChange.baselineDailyAvg)} →{" "}
                  {formatRpCompact(revenueChange.currentDailyAvg)}
                </span>
                /day
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDayRangeLabel(
                  report.window.currentStart,
                  report.window.currentEnd,
                )}{" "}
                vs{" "}
                {formatDayRangeLabel(
                  report.window.baselineStart,
                  report.window.baselineEnd,
                )}
              </p>
            </div>
          </div>
          {(outcome?.providerId === "none" || !outcome) && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <p className="text-sm font-semibold text-amber-300">
                Investigation unavailable
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                This outlet runs in offline/deterministic mode. Configure{" "}
                <code className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">
                  AI_PROVIDER=openai
                </code>
                ,{" "}
                <code className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">
                  OPENAI_API_KEY
                </code>{" "}
                and{" "}
                <code className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">
                  OPENAI_MODEL
                </code>{" "}
                in .env to run a real investigation.
              </p>
            </div>
          )}
          {outcome && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1">
                Provider: OpenAI-compatible
              </span>
              {outcome.model && (
                <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1 capitalize">
                  Model: {outcome.model}
                </span>
              )}
              <span
                className={`rounded-lg border px-3 py-1 font-semibold ${
                  outcome.ok
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-400/40 bg-rose-500/10 text-rose-300"
                }`}
              >
                Validation: {outcome.ok ? "PASS" : "FAIL"}
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1">
                {outcome.attempts ?? 1} attempt
                {(outcome.attempts ?? 1) === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
      </div>

      {configError && !outcome?.providerId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {configError}
        </div>
      )}

      {outcome && !outcome.ok && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-rose-800">
            Investigation failed
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The LLM output did not pass strict provenance and causality
            validation. Evidence ids are never repaired automatically — the
            final output is always validated with the same strict rules.
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
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Re-run investigation
          </a>
        </div>
      )}

      {outcome?.ok && input && outcome.result && (
        <InvestigationResults
          input={input}
          result={outcome.result}
          isDecline={isDecline}
          slug={slug}
          endDate={endDate}
          explainedPct={explainedPct}
          residualPct={residualPct}
          explainedAbs={explainedAbs}
          residualAbs={residualAbs}
          stockoutSharePct={stockoutSharePct}
          stockoutFacts={stockoutFacts}
          stockoutProfile={stockoutProfile}
          impactNote={impactNote}
          hypothesisRows={hypothesisRows}
          nextAreas={dedupedNextAreas}
        />
      )}

      {finding.narrative.length > 0 && (
        <SectionCard title="Narrative">
          <p className="text-sm leading-relaxed text-slate-700">
            {finding.narrative.join(" ")}
          </p>
        </SectionCard>
      )}

      <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
          <span>
            Evidence gaps &amp; limitations
            {outcome?.result
              ? ` · ${DATA_GAPS.length + outcome.result.limitations.length} items`
              : ` · ${DATA_GAPS.length} gaps`}
          </span>
          <span className="text-slate-400">▼</span>
        </summary>
        <div className="mt-3 space-y-4">
          <ul className="space-y-1.5">
            {DATA_GAPS.map((gap) => (
              <li key={gap.id} className="text-sm leading-relaxed text-slate-600">
                {gap.text}
              </li>
            ))}
          </ul>
          {outcome?.result && outcome.result.limitations.length > 0 && (
            <ul className="list-disc space-y-1.5 border-t border-slate-100 pl-5 pt-3">
              {outcome.result.limitations.map((limitation, index) => (
                <li key={index} className="text-sm leading-relaxed text-slate-600">
                  {limitation}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <p className="text-xs text-slate-500">
        Machine-readable:{" "}
        <a href={`/api/report?endDate=${endDate}`} className={linkClass}>
          /api/report?endDate={endDate}
        </a>
      </p>
    </div>
  );
}

function InvestigationResults({
  input,
  result,
  isDecline,
  slug,
  endDate,
  explainedPct,
  residualPct,
  explainedAbs,
  residualAbs,
  stockoutSharePct,
  stockoutFacts,
  stockoutProfile,
  impactNote,
  hypothesisRows,
  nextAreas,
}: {
  input: InvestigationInput;
  result: InvestigationResult;
  isDecline: boolean;
  slug: string;
  endDate: string;
  explainedPct: number;
  residualPct: number;
  explainedAbs: number;
  residualAbs: number;
  stockoutSharePct: number;
  stockoutFacts: EvidenceFact[];
  stockoutProfile: NonNullable<InvestigationInput["supportProfiles"]>[number] | undefined;
  impactNote: (rec: Recommendation) => string | null;
  hypothesisRows: {
    key: string;
    label: string;
    status: "confirmed" | "possible" | "unverified";
    note?: string;
  }[];
  nextAreas: string[];
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Investigation verdict" className="border-indigo-200">
        <p className="text-lg font-medium leading-relaxed text-slate-900">
          {result.primaryFinding.statement}
        </p>
      </SectionCard>

      {isDecline && (
        <SectionCard title="How much do we explain?">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Explained
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                {explainedPct.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Evidence-backed · {formatRpCompact(explainedAbs)}/day
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Unexplained
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">
                {residualPct.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Requires further investigation ·{" "}
                {formatRpCompact(residualAbs)}/day
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evidence coverage
          </p>
          <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="bg-emerald-500"
              style={{
                width: `${Math.min(100, Math.max(0, explainedPct))}%`,
              }}
            />
          </div>
        </SectionCard>
      )}

      <SectionCard title="What we know">
        {stockoutProfile && (
          <div className="mb-4 rounded-xl border border-l-4 border-l-emerald-500 border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                ✓ Confirmed contributor
              </p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                {confidenceFromLevel(stockoutProfile.level)} BASIS
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              Inventory availability
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {stockoutFacts.map((fact) => (
                <li key={fact.id}>
                  <span className="font-medium text-slate-900">
                    🔴 {fact.productSku}
                  </span>{" "}
                  was out of stock for {numFact(valueOf(fact, "duration"))}{" "}
                  {numFact(valueOf(fact, "duration")) === 1 ? "day" : "days"}.
                </li>
              ))}
              {stockoutFacts.some(
                (fact) => valueOf(fact, "zeroSalesVerified") === true,
              ) && (
                <li>
                  ✓{" "}
                  <span className="font-medium text-slate-900">
                    Zero sales verified
                  </span>{" "}
                  during stockout periods.
                </li>
              )}
            </ul>
            <p className="mt-3 text-sm text-slate-600">
              Estimated contribution:{" "}
              <span className="font-semibold text-slate-900">
                {stockoutSharePct.toFixed(1)}%
              </span>{" "}
              of revenue decline
            </p>
            <a
              href={`/outlets/${slug}?endDate=${endDate}#evidence`}
              className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              [ View evidence ]
            </a>
          </div>
        )}

        {!stockoutProfile && stockoutFacts.length > 0 && (
          <div className="mb-4 rounded-xl border border-l-4 border-l-slate-300 border-slate-200 bg-white p-4 shadow-sm">
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {stockoutFacts.map((fact) => (
                <li key={fact.id}>
                  🔴 {fact.productSku} was out of stock for{" "}
                  {numFact(valueOf(fact, "duration"))} day
                  {numFact(valueOf(fact, "duration")) === 1 ? "" : "s"}.
                </li>
              ))}
            </ul>
          </div>
        )}

        {stockoutFacts.length === 0 && (
          <p className="text-sm text-slate-500">
            No stockout evidence was detected in this window.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Hypotheses">
        <ul className="divide-y divide-slate-100">
          {hypothesisRows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {row.status === "confirmed"
                    ? "✓"
                    : row.status === "possible"
                      ? "◐"
                      : "?"}{" "}
                  {row.label}
                </p>
                {row.note && (
                  <p className="mt-0.5 text-xs text-slate-500">{row.note}</p>
                )}
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase ${
                  row.status === "confirmed"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : row.status === "possible"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {row.status}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Recommended actions">
        {result.recommendations.length === 0 ? (
          <p className="text-sm text-slate-500">
            No recommendations were proposed.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {result.recommendations.map((rec, index) => (
              <div
                key={rec.id}
                className={`flex flex-col rounded-xl border border-l-4 bg-white ${priorityAccent[rec.priority]} border-slate-200 p-4 shadow-sm`}
              >
                <p className="text-xs font-bold text-slate-400">
                  {String(index + 1).padStart(2, "0")} ·{" "}
                  <span className="uppercase text-slate-700">
                    {rec.priority}
                  </span>
                </p>
                <p className="mt-2 font-semibold leading-snug text-slate-900">
                  {rec.priority === "high"
                    ? "🔴"
                    : rec.priority === "medium"
                      ? "🟠"
                      : "🟡"}{" "}
                  {rec.action}
                </p>
                {impactNote(rec) && (
                  <p className="mt-2 text-sm font-semibold tabular-nums text-indigo-700">
                    Potential recovery {impactNote(rec)}
                  </p>
                )}
                <div className="mt-auto pt-3">
                  <a
                    href={`/outlets/${slug}?endDate=${endDate}#evidence`}
                    className="inline-block rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    Take action
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="What should we investigate next?">
        <div className="flex flex-wrap gap-2">
          {nextAreas.map((area) => (
            <span
              key={area}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              {area}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Areas the current contract cannot resolve. See evidence gaps for the
          full list of dataset limitations.
        </p>
      </SectionCard>

      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detailed output
        </p>
        <SectionCard title="Executive summary">
          <p className="text-sm leading-relaxed text-slate-700">
            {result.executiveSummary}
          </p>
        </SectionCard>
        <SectionCard title="Primary finding">
          <ClaimCard claim={result.primaryFinding} />
        </SectionCard>
        <SectionCard title="Contributing factors">
          {result.contributingFactors.length === 0 ? (
            <p className="text-sm text-slate-500">
              No additional contributing factors were identified.
            </p>
          ) : (
            <ul className="space-y-3">
              {result.contributingFactors.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} />
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Alternative hypotheses">
          {result.alternativeHypotheses.length === 0 ? (
            <p className="text-sm text-slate-500">
              No alternative hypotheses were offered.
            </p>
          ) : (
            <ul className="space-y-3">
              {result.alternativeHypotheses.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} />
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Recommendations">
          {result.recommendations.length === 0 ? (
            <p className="text-sm text-slate-500">
              No recommendations were proposed.
            </p>
          ) : (
            <ul className="space-y-3">
              {result.recommendations.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </ul>
          )}
        </SectionCard>
      </section>
    </div>
  );
}