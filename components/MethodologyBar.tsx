'use client';

import React, { useState } from 'react';
import MethodologyModal from './MethodologyModal';

export default function MethodologyBar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <section className="bg-white border border-slate-200 rounded p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <span
            className="material-symbols-outlined text-primary text-[16px]"
            data-icon="analytics"
          >
            analytics
          </span>

          <span className="text-body-sm font-mono-data text-slate-600">
            <strong className="text-slate-900 font-semibold">
              METHODOLOGY:
            </strong>{" "}
            7-day analysis · 28-day baseline · deterministic evidence → AI reasoning
          </span>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          type="button"
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-label-caps font-label-caps text-primary font-bold active:scale-[0.98] transition-all cursor-pointer"
        >
          View methodology
        </button>
      </section>

      <MethodologyModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
