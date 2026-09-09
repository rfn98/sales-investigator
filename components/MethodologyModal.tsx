'use client';

import React, { useState, useEffect } from 'react';

export default function MethodologyModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [isVisible, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setShouldRender(true);
      setTimeout(() => setIsOpen(true), 10);
    } else {
      setIsOpen(false);
      setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = '';
      }, 200);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-200 ${isVisible ? 'opacity-100 backdrop-blur-sm' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose}></div>

      {/* Container */}
      <div className={`relative w-full max-w-xl max-h-full bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col transition-all duration-200 ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-b from-slate-50/70 to-white shrink-0">
          <div className="space-y-1.5 pr-4">
            <div className="inline-flex items-center gap-2">
              <span className="p-1 rounded-md bg-sky-50 text-sky-600 border border-sky-100">
                <span className="material-symbols-outlined text-[18px]">psychology</span>
              </span>

              <span className="text-[11px] font-mono-data uppercase tracking-wider font-semibold text-sky-700 bg-sky-50/80 px-2 py-0.5 rounded border border-sky-200/50">
                Analytical Framework
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              How this analysis works
            </h2>

            <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
              Sales Investigator separates measured performance signals from AI-generated investigation and recommendations.
            </p>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors flex items-center justify-center -mr-1 -mt-1 group"
          >
            <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-90">
              close
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3.5 overflow-y-auto bg-slate-50/40 flex-1">

          {/* Step 1 */}
          <div className="bg-white rounded p-4 border border-slate-200/80 hover:border-sky-300 transition-all shadow-sm hover:shadow group">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-700 text-xs font-mono-data font-bold shrink-0 border border-slate-200/60 group-hover:bg-sky-50 group-hover:text-sky-700 group-hover:border-sky-200 transition-colors">
                01
              </span>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Revenue change
                  </h3>

                  <span className="text-[11px] font-mono-data text-slate-400 font-medium">
                    Metric #1
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Current performance is compared with a 28-day baseline using daily revenue averages.
                </p>

                <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 px-3 py-2 rounded bg-slate-50 border border-slate-200/80 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 font-mono-data text-xs font-semibold text-slate-800">
                    <span>Current 7-day average</span>
                    <span className="text-slate-400 font-normal">vs</span>
                    <span>28-day baseline</span>
                  </div>

                  <span className="hidden sm:inline-block text-slate-300">
                    |
                  </span>

                  <span className="inline-flex items-center gap-0.5 text-xs font-mono-data font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Revenue change
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded p-4 border border-slate-200/80 hover:border-sky-300 transition-all shadow-sm hover:shadow group">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-700 text-xs font-mono-data font-bold shrink-0 border border-slate-200/60 group-hover:bg-sky-50 group-hover:text-sky-700 group-hover:border-sky-200 transition-colors">
                02
              </span>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Anomaly detection
                  </h3>

                  <span className="text-[11px] font-mono-data text-slate-400 font-medium">
                    Statistical
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  The current 7-day revenue average is compared with the distribution of rolling 7-day averages calculated from the baseline period.
                </p>

                <div className="pt-1 flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50/80 p-2.5 rounded border border-slate-200">
                  <span className="material-symbols-outlined text-sky-600 text-[16px] shrink-0 mt-0.5">
                    insights
                  </span>

                  <div className="leading-relaxed">
                    <p>
                      <span className="font-semibold text-slate-700">Z-score</span>{" "}
                      measures how far current performance deviates from the baseline distribution.
                    </p>

                    <p className="mt-1 text-slate-400">
                      Higher absolute values indicate a stronger statistical deviation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded p-4 border border-slate-200/80 hover:border-sky-300 transition-all shadow-sm hover:shadow group">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-700 text-xs font-mono-data font-bold shrink-0 border border-slate-200/60 group-hover:bg-sky-50 group-hover:text-sky-700 group-hover:border-sky-200 transition-colors">
                03
              </span>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Severity
                  </h3>

                  <span className="text-[11px] font-mono-data text-slate-400 font-medium">
                    Classification
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Severity combines the magnitude of revenue change with estimated revenue impact.
                </p>

                <div className="pt-1 space-y-2">

                  {/* Magnitude */}
                  <div>
                    <div className="text-[10px] font-mono-data uppercase tracking-wider text-slate-400 mb-1">
                      Revenue change magnitude
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono-data text-[11px]">
                      <div className="px-2 py-1.5 rounded bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-center">
                        <span className="font-bold block">Low</span>
                        <span className="text-[10px] text-emerald-600">
                          &lt;20%
                        </span>
                      </div>

                      <div className="px-2 py-1.5 rounded bg-amber-50 border border-amber-200/70 text-amber-800 text-center">
                        <span className="font-bold block">Medium</span>
                        <span className="text-[10px] text-amber-600">
                          20–29%
                        </span>
                      </div>

                      <div className="px-2 py-1.5 rounded bg-orange-50 border border-orange-200/70 text-orange-800 text-center">
                        <span className="font-bold block">High</span>
                        <span className="text-[10px] text-orange-600">
                          30–39%
                        </span>
                      </div>

                      <div className="px-2 py-1.5 rounded bg-rose-50 border border-rose-200/70 text-rose-800 text-center ring-1 ring-rose-300/40">
                        <span className="font-bold block">Critical</span>
                        <span className="text-[10px] text-rose-600">
                          ≥40%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Revenue impact */}
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200/80">
                    <span className="material-symbols-outlined text-sky-600 text-[15px] shrink-0">
                      payments
                    </span>

                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-700">
                        Revenue impact
                      </span>{" "}
                      estimates the daily revenue difference between current performance and baseline over the analysis window.
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Final severity uses the more severe result from revenue-change magnitude and estimated revenue impact.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded p-4 border border-slate-200/80 hover:border-sky-300 transition-all shadow-sm hover:shadow group">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-700 text-xs font-mono-data font-bold shrink-0 border border-slate-200/60 group-hover:bg-sky-50 group-hover:text-sky-700 group-hover:border-sky-200 transition-colors">
                04
              </span>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Evidence
                  </h3>

                  <span className="inline-flex items-center gap-1 text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                    <span className="material-symbols-outlined text-[12px]">
                      verified
                    </span>
                    Deterministic
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Supporting evidence is calculated deterministically from sales and inventory data.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-2 rounded bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                    <span className="material-symbols-outlined text-sky-600 text-[14px]">
                      inventory_2
                    </span>
                    Verified stockouts
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-2 rounded bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                    <span className="material-symbols-outlined text-sky-600 text-[14px]">
                      monitoring
                    </span>
                    Product-level changes
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-2 rounded bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                    <span className="material-symbols-outlined text-sky-600 text-[14px]">
                      category
                    </span>
                    Product availability
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-2 rounded bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                    <span className="material-symbols-outlined text-sky-600 text-[14px]">
                      compare_arrows
                    </span>
                    Revenue comparisons
                  </div>
                </div>

                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500 bg-sky-50/50 px-2.5 py-2 rounded border border-sky-100">
                  <span className="material-symbols-outlined text-sky-600 text-[14px] shrink-0">
                    info
                  </span>

                  <p className="leading-relaxed">
                    Evidence describes <span className="font-semibold text-slate-700">what was observed</span>; it does not automatically prove why it happened.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded p-4 border border-slate-200/80 hover:border-sky-300 transition-all shadow-sm hover:shadow group bg-gradient-to-r from-white via-white to-sky-50/20">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-sky-100 text-sky-800 text-xs font-mono-data font-bold shrink-0 border border-sky-200 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                05
              </span>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    AI investigation

                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded h-2 w-2 bg-sky-500"></span>
                    </span>
                  </h3>

                  <span className="text-[11px] font-mono-data text-sky-600 font-medium">
                    Reasoning Engine
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  AI receives measured signals and deterministic evidence to investigate possible explanations and recommend next actions.
                </p>

                {/* Pipeline */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono-data text-[10px]">
                  <span className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600">
                    Measured data
                  </span>

                  <span className="text-slate-300">→</span>

                  <span className="px-2 py-1 rounded bg-sky-50 border border-sky-200 text-sky-700">
                    Evidence
                  </span>

                  <span className="text-slate-300">→</span>

                  <span className="px-2 py-1 rounded bg-sky-50 border border-sky-200 text-sky-700">
                    AI investigation
                  </span>

                  <span className="text-slate-300">→</span>

                  <span className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                    Action
                  </span>
                </div>

                {/* Confidence states */}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <div className="px-2.5 py-2 rounded bg-emerald-50 border border-emerald-200/70">
                    <span className="block text-[10px] font-mono-data font-bold text-emerald-700">
                      CONFIRMED
                    </span>
                    <span className="block text-[10px] text-emerald-700/70 mt-0.5">
                      Directly supported by evidence
                    </span>
                  </div>

                  <div className="px-2.5 py-2 rounded bg-amber-50 border border-amber-200/70">
                    <span className="block text-[10px] font-mono-data font-bold text-amber-700">
                      POSSIBLE
                    </span>
                    <span className="block text-[10px] text-amber-700/70 mt-0.5">
                      Plausible but not fully verified
                    </span>
                  </div>

                  <div className="px-2.5 py-2 rounded bg-slate-50 border border-slate-200/80">
                    <span className="block text-[10px] font-mono-data font-bold text-slate-600">
                      UNVERIFIED
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Required evidence is unavailable
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-start gap-1.5 text-[11px] font-mono-data text-slate-500 bg-slate-50 px-2.5 py-2 rounded border border-slate-200/60">
                  <span className="material-symbols-outlined text-slate-400 text-[14px] shrink-0">
                    shield
                  </span>

                  <p className="leading-relaxed">
                    AI does not generate the underlying sales, inventory, or product metrics. It reasons over measured evidence and identifies what remains unresolved.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            type="button"
            className="px-5 py-2 rounded bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold tracking-wide transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
          >
            <span>Close</span>
          </button>
        </div>

      </div>
    </div>
  );
}
