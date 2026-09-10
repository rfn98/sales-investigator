"use client";

import React, { useEffect, useState } from "react";
import { formatDayLabel, formatRpCompact } from "./format";

export interface StockoutDrawerItem {
  id: string;
  outletName: string;
  productSku: string;
  productName: string;
  days: { date: string; inventory: number }[];
  zeroSalesVerified: boolean;
}

export interface BaselineRevenueEntry {
  outletName: string;
  productSku: string;
  revenueBaselineValue: number;
}

function dayArrowRange(start: string, end: string): string {
  return `${formatDayLabel(start)} → ${formatDayLabel(end)}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-table-header text-table-header text-on-surface-variant uppercase tracking-wider">
      {children}
    </h3>
  );
}

export default function StockoutDrawer({
  window: win,
  stockouts,
  baselineRevenueLookup,
}: {
  window: {
    currentStart: string;
    currentEnd: string;
    baselineStart: string;
    baselineEnd: string;
  };
  stockouts: StockoutDrawerItem[];
  baselineRevenueLookup: BaselineRevenueEntry[];
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

  const baselineRev = new Map<string, number>();
  for (const entry of baselineRevenueLookup) {
    if (entry.productSku) {
      baselineRev.set(`${entry.outletName}::${entry.productSku}`, entry.revenueBaselineValue);
    }
  }

  const totalEvents = stockouts.length;
  const affectedSkus = new Set(stockouts.map((s) => s.productSku)).size;
  const affectedSkuList = [...new Set(stockouts.map((s) => s.productSku))];

  const groupedMidstream: { outletName: string; items: StockoutDrawerItem[] }[] = [];
  for (const item of stockouts) {
    const last = groupedMidstream[groupedMidstream.length - 1];
    if (last && last.outletName === item.outletName) {
      last.items.push(item);
    } else {
      groupedMidstream.push({ outletName: item.outletName, items: [item] });
    }
  }
  const grouped = groupedMidstream.map((group) => ({
    ...group,
    items: group.items.sort(
      (a, b) => (b.days?.length ?? 0) - (a.days?.length ?? 0),
    ),
  }));

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-label-caps font-label-caps text-primary font-bold flex items-center justify-center space-x-1 active:scale-[0.99] transition-transform cursor-pointer"
      >
        <span>View stockouts →</span>
      </button>

      {shouldRender && (
        <div
          className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!visible}
        >
          <div className="absolute inset-0 bg-slate-900/60" onClick={close} />

          <aside
            className={`relative h-full w-full max-w-md bg-surface-container-lowest border-l border-outline-variant shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0.14,1)] ${
              visible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="px-5 pt-5 pb-4 border-b border-outline-variant shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
                    STOCKOUT DETAILS
                  </h2>
                  <p className="font-body-md font-body-md font-semibold text-on-surface-variant mt-1">
                    Inventory availability signals
                  </p>
                  <p className="font-mono-data text-mono-data text-on-surface-variant mt-0.5">
                    Analysis Window ·{" "}
                    {dayArrowRange(win.currentStart, win.currentEnd)}
                  </p>
                </div>

                <button
                  onClick={close}
                  type="button"
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors flex items-center justify-center -mr-1 -mt-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto flex-1 bg-surface-container-lowest">
              <section>
                <div className="flex items-center justify-between">
                  <SectionLabel>Stockout events</SectionLabel>
                  <span className="font-mono-data text-mono-data font-semibold text-on-surface-variant">
                    {totalEvents}
                  </span>
                </div>

                {affectedSkuList.length > 0 && (
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div className="font-table-header text-table-header text-on-surface-variant uppercase tracking-wider shrink-0">
                      Affected SKUs
                    </div>

                    <div className="flex flex-wrap justify-end gap-1">
                      {affectedSkuList.map((sku) => (
                        <span
                          key={sku}
                          className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container font-mono-data text-[10px] font-semibold text-primary"
                        >
                          {sku}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {totalEvents === 0 ? (
                  <div className="mt-3 border border-outline-variant rounded-md p-4">
                    <div className="font-label-sm text-label-sm font-bold text-on-surface-variant">
                      NO VERIFIED STOCKOUTS
                    </div>
                    <div className="font-body-sm font-body-sm text-on-surface-variant mt-1">
                      No stockout events were detected in this analysis window.
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {grouped
                      .flatMap((group) => group.items)
                      .map((stockout) => {
                        const days = (stockout.days ?? [])
                          .slice()
                          .sort((a, b) => a.date.localeCompare(b.date));
                        const start = days[0]?.date;
                        const end = days[days.length - 1]?.date;
                        const duration = days.length;
                        const verified = stockout.zeroSalesVerified;
                        const baseline = baselineRev.get(
                          `${stockout.outletName}::${stockout.productSku}`,
                        );

                        return (
                          <div
                            key={stockout.id}
                            className="border border-outline-variant rounded-md p-3.5 space-y-1"
                          >
                            <div className="flex items-center gap-1 text-[10px] font-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider">
                              <span className="material-symbols-outlined text-[12px]">
                                store
                              </span>
                              {stockout.outletName}
                            </div>

                            <div className="flex items-center justify-between">
                                  <span className="font-body-md font-body-md font-semibold text-on-surface">
                                    <span className="font-mono-data text-mono-data font-bold text-primary">
                                      {stockout.productSku}
                                    </span>
                                    {" · "}
                                    {stockout.productName}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-mono-data font-bold rounded px-1.5 py-0.5 border ${
                                      verified
                                        ? "text-tertiary bg-[#E7F7EE] border-[#A7F3D0]"
                                        : "text-amber-800 bg-amber-50 border-amber-200"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px]">
                                      {verified ? "verified" : "inventory_2"}
                                    </span>
                                    {verified ? "VERIFIED" : "DETECTED"}
                                  </span>
                                </div>

                                <div
                                  className={`font-body-sm font-body-sm ${
                                    verified ? "text-error" : "text-amber-700"
                                  }`}
                                >
                                  Stockout · {duration} day
                                  {duration === 1 ? "" : "s"} ·{" "}
                                  {verified
                                    ? "Zero sales verified"
                                    : "Zero sales not verified"}
                                </div>

                                <div className="pt-1 border-t border-outline-variant/40 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-on-surface-variant">
                                      Stockout period
                                    </span>
                                    <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                                      {start && end
                                        ? dayArrowRange(start, end)
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
                                      Baseline daily revenue
                                    </span>
                                    <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                                      {baseline && baseline > 0
                                        ? `${formatRpCompact(baseline)}/day`
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
                <section>
                  <SectionLabel>Evidence scope</SectionLabel>
                  <div className="mt-3 border border-outline-variant rounded-md divide-y divide-outline-variant/40">
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Current period
                      </span>
                      <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                        {dayArrowRange(win.currentStart, win.currentEnd)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Baseline
                      </span>
                      <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                        {dayArrowRange(win.baselineStart, win.baselineEnd)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Evidence sources
                      </span>
                      <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                        Sales · Inventory
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Granularity
                      </span>
                      <span className="font-mono-data text-mono-data font-semibold text-on-surface">
                        Daily
                      </span>
                    </div>
                  </div>
                </section>
            </div>

            <div className="px-5 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-end shrink-0">
              <button
                onClick={close}
                type="button"
                className="px-5 py-2 rounded bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold tracking-wide transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span>Close</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}