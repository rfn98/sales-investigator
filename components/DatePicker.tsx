"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDisplay(iso: string): string {
  return toUtcDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DatePicker({
  name,
  value,
  min,
  max,
}: {
  name: string;
  value: string;
  min: string;
  max: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    () => {
      const d = toUtcDate(value);
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    },
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const minDate = toUtcDate(min);
  const maxDate = toUtcDate(max);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(viewMonth.year, viewMonth.month, 1));
    const startOffset = first.getUTCDay();
    const daysInMonth = new Date(
      Date.UTC(viewMonth.year, viewMonth.month + 1, 0),
    ).getUTCDate();
    const list: (string | null)[] = [];
    for (let i = 0; i < startOffset; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      list.push(toIso(new Date(Date.UTC(viewMonth.year, viewMonth.month, day))));
    }
    return list;
  }, [viewMonth]);

  const canPrev =
    viewMonth.year > minDate.getUTCFullYear() ||
    (viewMonth.year === minDate.getUTCFullYear() &&
      viewMonth.month > minDate.getUTCMonth());
  const canNext =
    viewMonth.year < maxDate.getUTCFullYear() ||
    (viewMonth.year === maxDate.getUTCFullYear() &&
      viewMonth.month < maxDate.getUTCMonth());

  const prevMonth = () => {
    setViewMonth((v) => {
      const d = new Date(Date.UTC(v.year, v.month - 1, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  };
  const nextMonth = () => {
    setViewMonth((v) => {
      const d = new Date(Date.UTC(v.year, v.month + 1, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  };

  const pick = (iso: string) => {
    setSelected(iso);
    setOpen(false);
    if (iso !== value) {
      router.push(`/?${name}=${iso}`);
    }
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <label
        htmlFor={name}
        className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
      >
        Analysis date
      </label>

      <input type="hidden" name={name} value={selected} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="h-9 flex items-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px] text-primary">
          calendar_month
        </span>
        <span className="font-mono-data">{formatDisplay(selected)}</span>
        <span
          className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-surface-container-lowest border border-outline-variant rounded-md shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canPrev}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                chevron_left
              </span>
            </button>

            <div className="font-label-caps text-label-caps font-bold text-on-surface uppercase tracking-wider">
              {toUtcDate(
                toIso(new Date(Date.UTC(viewMonth.year, viewMonth.month, 1))),
              ).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              disabled={!canNext}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                chevron_right
              </span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="text-[10px] font-label-caps font-bold text-on-surface-variant uppercase tracking-wider py-1"
              >
                {day}
              </div>
            ))}

            {cells.map((iso, index) => {
              if (!iso) return <div key={`empty-${index}`} />;

              const dayDate = toUtcDate(iso);
              const disabled = dayDate < minDate || dayDate > maxDate;
              const isSelected = iso === selected;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(iso)}
                  className={`h-8 flex items-center justify-center rounded text-sm ${
                    isSelected
                      ? "bg-primary text-white font-bold"
                      : disabled
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  {dayDate.getUTCDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}