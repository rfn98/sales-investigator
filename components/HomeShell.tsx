"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DashboardView from "./DashboardView";
import InvestigationDossier from "./InvestigationDossier";
import RoadLoading from "./RoadLoading";
import { slugify } from "./format";
import type { Report } from "../lib/analytics/types";
import type { InvestigationOutcome } from "../lib/ai";

type View =
  | { name: "dashboard" }
  | { name: "loading"; slug: string }
  | { name: "dossier"; slug: string; outcome: InvestigationOutcome };

function clearInvestigateParam() {
  const url = new URL(window.location.href);
  if (
    url.searchParams.has("investigate") ||
    url.searchParams.has("warm")
  ) {
    url.searchParams.delete("investigate");
    url.searchParams.delete("warm");
    window.history.replaceState({}, "", url.toString());
  }
}

/**
 * Single-page shell: the dashboard and the investigation dossier live on the
 * same route. Clicking Investigate runs the investigation API behind the
 * full-screen S-road loader; once it finishes, the dashboard content is
 * replaced in place by the dossier — no navigation, no cached outcome.
 */
export default function HomeShell({
  report,
  endDate,
  maxDate,
  minDate,
  initialInvestigate,
  initialOutcome,
}: {
  report: Report;
  endDate: string;
  maxDate: string;
  minDate: string;
  initialInvestigate: string | null;
  initialOutcome: InvestigationOutcome | null;
}) {
  const [view, setView] = useState<View>(() => {
    if (initialInvestigate) {
      if (initialOutcome) {
        return { name: "dossier", slug: initialInvestigate, outcome: initialOutcome };
      }
      return { name: "loading", slug: initialInvestigate };
    }
    return { name: "dashboard" };
  });

  const dispatchedKey = useRef<string | null>(null);

  const start = useCallback((slug: string) => {
    clearInvestigateParam();
    dispatchedKey.current = null;
    setView({ name: "loading", slug });
  }, []);

  useEffect(() => {
    if (view.name !== "loading") return;
    const slug = view.slug;
    const key = `${slug}:${endDate}`;
    if (dispatchedKey.current === key) return;
    dispatchedKey.current = key;
    clearInvestigateParam();

    let cancelled = false;
    fetch("/api/investigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, endDate }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`investigate api returned ${res.status}`);
        const data = await res.json();
        if (!cancelled && data.outcome) {
          setView({ name: "dossier", slug, outcome: data.outcome });
        }
      })
      .catch(() => {
        if (!cancelled) setView({ name: "dashboard" });
      });

    return () => {
      cancelled = true;
    };
  }, [view, endDate]);

  if (view.name === "dossier") {
    return (
      <InvestigationDossier
        report={report}
        slug={view.slug}
        endDate={endDate}
        outcome={view.outcome}
        onBack={() => setView({ name: "dashboard" })}
        onReRun={start}
      />
    );
  }

  if (view.name === "loading") {
    const outletName =
      report.outlets.find((o) => slugify(o.outletName) === view.slug)
        ?.outletName ?? view.slug;
    return (
      <>
        <DashboardView
          report={report}
          endDate={endDate}
          maxDate={maxDate}
          minDate={minDate}
          onInvestigate={start}
        />
        <RoadLoading outletName={outletName} />
      </>
    );
  }

  return (
    <DashboardView
      report={report}
      endDate={endDate}
      maxDate={maxDate}
      minDate={minDate}
      onInvestigate={start}
    />
  );
}