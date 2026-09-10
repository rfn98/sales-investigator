"use client";

import React, { useEffect, useState } from "react";
import type { EvidenceFact, InvestigationInput } from "../lib/ai/types";
import {
  formatDayLabel,
  formatDayRangeLabel,
  formatRpCompact,
} from "./format";

function numOf(
  fact: EvidenceFact,
  key: string,
): number {
  const v = fact.measured[key];
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

export default function EvidenceDrawer({
  outletName,
  window: win,
  stockoutFacts,
  productChangeFacts,
  stockoutSharePct,
  explainedAbs,
  residualAbs,
  residualPct,
  stockoutVerified,
  stockoutBasis,
}: {
  outletName: string;
  window: InvestigationInput["window"];
  stockoutFacts: EvidenceFact[];
  productChangeFacts: EvidenceFact[];
  stockoutSharePct: number;
  explainedAbs: number;
  residualAbs: number;
  residualPct: number;
  stockoutVerified: boolean;
  stockoutBasis: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setShouldRender(true);
      setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
      setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = "";
      }, 500);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const baselineRevBySku = new Map<string, number>();
  for (const fact of productChangeFacts) {
    if (fact.productSku) {
      baselineRevBySku.set(fact.productSku, numOf(fact, "revenueBaselinePerDay"));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center space-x-1 text-label-md font-label-md text-primary hover:text-primary-container font-semibold transition-colors cursor-pointer"
      >
        <span>View evidence details</span>
        <span className="material-symbols-outlined text-[16px]">
          arrow_forward
        </span>
      </button>

      {shouldRender && (
        <div
          className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!visible}
        >
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={close}
          />

          <aside
            className={`relative h-full w-full max-w-md bg-surface-container-lowest border-l border-outline-variant shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0.14,1)] ${
              visible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-outline-variant shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
                    EVIDENCE DETAILS
                  </h2>

                  <p className="font-body-md font-semibold text-on-surface mt-1">
                    {outletName}
                  </p>

                  <p className="font-mono-data text-mono-data text-on-surface-variant mt-0.5">
                    Analysis Window ·{" "}
                    {formatDayRangeLabel(win.currentStart, win.currentEnd)}
                  </p>
                </div>

                <button
                  onClick={close}
                  type="button"
                  aria-label="Close evidence details"
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors flex items-center justify-center -mr-1 -mt-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-6 overflow-y-auto flex-1 bg-surface-container-lowest">

              {/* Evidence Scope */}
              <section>
                <h3 className="font-table-header text-table-header text-on-surface-variant uppercase tracking-wider mb-3">
                  Evidence Scope
                </h3>

                <div className="border border-outline-variant rounded-md divide-y divide-outline-variant/40">
                  <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Current period
                    </span>

                    <span className="font-mono-data text-mono-data font-semibold text-on-surface text-right">
                      {formatDayRangeLabel(win.currentStart, win.currentEnd)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Baseline
                    </span>

                    <span className="font-mono-data text-mono-data font-semibold text-on-surface text-right">
                      {formatDayRangeLabel(win.baselineStart, win.baselineEnd)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Evidence sources
                    </span>

                    <span className="font-mono-data text-mono-data font-semibold text-on-surface text-right">
                      Sales · Inventory
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Granularity
                    </span>

                    <span className="font-mono-data text-mono-data font-semibold text-on-surface text-right">
                      Daily
                    </span>
                  </div>
                </div>
              </section>

              {/* Verified Stockouts */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-table-header text-table-header text-on-surface-variant uppercase tracking-wider">
                    Verified stockouts
                  </h3>
                  <span className="font-mono-data text-mono-data font-semibold text-on-surface-variant">
                    {stockoutFacts.length} affected SKU{stockoutFacts.length === 1 ? "" : "s"}
                  </span>
                </div>

                {stockoutFacts.length === 0 ? (
                  <div className="border border-outline-variant rounded-md p-4">
                    <div className="font-label-sm text-label-sm font-bold text-on-surface-variant">
                      NO VERIFIED STOCKOUTS
                    </div>
                    <div className="font-body-sm font-body-sm text-on-surface-variant mt-1">
                      No stockout events were detected in this analysis window.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stockoutFacts.map((fact) => {
                      const daysRaw = fact.measured["days"];
                      const days = Array.isArray(daysRaw)
                        ? (daysRaw as unknown as string[]).slice().sort()
                        : [];
                      const start = days[0];
                      const end = days[days.length - 1];
                      const duration = numOf(fact, "duration");
                      const verified = Boolean(fact.measured["zeroSalesVerified"]);
                      const baselineRev = baselineRevBySku.get(fact.productSku ?? "");

                      return (
                        <div
                          key={fact.id}
                          className="border border-outline-variant rounded-md p-3.5 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center space-x-1 font-label-sm text-label-sm font-bold text-error">
                              <span className="w-2 h-2 rounded-full bg-error" />
                              <span>{fact.productSku}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono-data font-bold text-tertiary bg-[#E7F7EE] border border-[#A7F3D0] rounded px-1.5 py-0.5">
                              <span className="material-symbols-outlined text-[11px]">
                                verified
                              </span>
                              VERIFIED
                            </span>
                          </div>

                          <div className="font-body-md font-body-md font-semibold text-on-surface">
                            {fact.productName}
                          </div>

                          <div className="pt-1 border-t border-outline-variant/40 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-on-surface-variant">
                                Stockout period
                              </span>
                              <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                                {start && end
                                  ? `${formatDayLabel(start)} → ${formatDayLabel(end)} · ${duration} day${duration === 1 ? "" : "s"}`
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-on-surface-variant">
                                Sales during stockout
                              </span>
                              <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                                {verified ? "0 units" : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-on-surface-variant">
                                Baseline revenue
                              </span>
                              <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                                {baselineRev && baselineRev > 0
                                  ? `${formatRpCompact(baselineRev)}/day`
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Product Signals */}
              <section>
                <h3 className="font-table-header text-table-header text-on-surface-variant uppercase tracking-wider mb-3">
                  Product Signals
                </h3>

                {productChangeFacts.length === 0 ? (
                  <div className="border border-outline-variant rounded-md p-4">
                    <div className="font-body-sm text-on-surface-variant">
                      No product-level change signals in this window.
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-outline-variant rounded-md">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant">
                          <th className="py-2 px-3.5 font-table-header text-table-header text-on-surface-variant uppercase tracking-wider">
                            SKU
                          </th>

                          <th className="py-2 px-3.5 font-table-header text-table-header text-on-surface-variant uppercase tracking-wider">
                            Current / day
                          </th>

                          <th className="py-2 px-3.5 font-table-header text-table-header text-on-surface-variant uppercase tracking-wider">
                            Baseline / day
                          </th>

                          <th className="py-2 px-3.5 font-table-header text-table-header text-on-surface-variant uppercase tracking-wider">
                            Change
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-outline-variant/40">
                        {productChangeFacts.map((fact) => {
                          const change = numOf(fact, "unitsChangePct");

                          const changeColor =
                            change < 0
                              ? "text-error"
                              : change > 0
                                ? "text-tertiary"
                                : "text-on-surface-variant";

                          const arrow = change >= 0 ? "↑" : "↓";

                          return (
                            <tr key={fact.id}>
                              <td className="py-2.5 px-3.5 font-mono-data text-mono-data font-semibold text-on-surface">
                                {fact.productSku}
                              </td>

                              <td className="py-2.5 px-3.5 font-mono-data text-mono-data text-on-surface-variant">
                                {numOf(fact, "unitsCurrent").toFixed(1)}
                              </td>

                              <td className="py-2.5 px-3.5 font-mono-data text-mono-data text-on-surface-variant">
                                {numOf(fact, "unitsBaseline").toFixed(1)}
                              </td>

                              <td
                                className={`py-2.5 px-3.5 font-mono-data text-mono-data font-bold ${changeColor}`}
                              >
                                {arrow}
                                {Math.abs(change).toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Attribution */}
              <section>
                <h3 className="font-table-header text-table-header text-on-surface-variant uppercase tracking-wider mb-3">
                  Attribution
                </h3>

                <div className="border border-outline-variant rounded-md p-4">
                  <div className="text-center">
                    <div className="font-telemetry-data text-telemetry-data font-bold text-primary">
                      {stockoutSharePct.toFixed(1)}%
                    </div>

                    <div className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                      ESTIMATED STOCKOUT CONTRIBUTION
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-outline-variant/40 pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] text-on-surface-variant">
                        Evidence-supported
                      </span>

                      <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                        {formatRpCompact(explainedAbs)}/day
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] text-on-surface-variant">
                        Remaining unexplained
                      </span>

                      <span className="font-mono-data text-mono-data font-semibold text-error">
                        {formatRpCompact(residualAbs)}/day
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed">
                  Attribution is an estimate based on the available deterministic
                  evidence. It does not establish that stockouts explain the full
                  revenue decline.
                </p>
              </section>

              {/* What This Evidence Supports */}
              <section>
                <h3 className="font-table-header text-table-header text-on-surface-variant uppercase tracking-wider mb-3">
                  What This Evidence Supports
                </h3>

                <div className="border border-[#A7F3D0] rounded-md p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm font-bold text-tertiary">
                      <span className="material-symbols-outlined text-[14px]">
                        check_circle
                      </span>
                      Inventory availability
                    </span>

                    <span className="inline-flex items-center text-[10px] font-mono-data font-bold text-tertiary bg-[#E7F7EE] border border-[#A7F3D0] rounded px-1.5 py-0.5">
                      {stockoutVerified ? "CONFIRMED" : "SUPPORTED"}
                    </span>
                  </div>

                  <p className="font-body-sm text-on-surface-variant mt-2 leading-relaxed">
                    {stockoutBasis ??
                      "Stockout events and zero-sales periods provide direct evidence that inventory availability contributed to the decline."}
                  </p>
                </div>

                {residualPct > 0 && (
                  <div className="mt-2 border border-amber-200 bg-amber-50 rounded-md p-3.5">
                    <div className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-amber-600 mt-0.5">
                        warning
                      </span>

                      <p className="font-body-sm text-amber-800 leading-relaxed">
                        This evidence does not explain the full revenue decline.
                        Additional evidence is required for the remaining{" "}
                        <strong>{residualPct.toFixed(1)}%</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-end shrink-0">
              <button
                onClick={close}
                type="button"
                className="px-5 py-2 rounded bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold tracking-wide transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}