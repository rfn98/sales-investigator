import { OutletFinding, Report } from "./types";

export function renderCliReport(report: Report): void {
  const line =
    "============================================================";

  console.log(line);
  console.log("AI BUSINESS INVESTIGATOR — ANALYTICS REPORT");
  console.log(line);
  console.log(`Analyzed at : ${report.analyzedAt}`);
  console.log(`End date    : ${report.endDate}`);
  console.log(
    `Current     : ${report.window.currentStart} → ${report.window.currentEnd} (${report.window.currentDays} days)`,
  );
  console.log(
    `Baseline    : ${report.window.baselineStart} → ${report.window.baselineEnd} (${report.window.baselineDays} days)`,
  );
  console.log(
    `Thresholds  : outlet change ≥±${report.thresholds.outletChangePct}%, product change ≥±${report.thresholds.productChangePct}%`,
  );
  console.log(`Z-score     : ${report.methodology.zScore}`);
  console.log(`activeLines : ${report.methodology.activeProductLines}`);
  console.log("");

  console.log("SUMMARY");
  const summaryRows: Array<[string, number]> = [
    ["Outlets analyzed", report.summary.totalOutlets],
    ["ANOMALY_DECLINE", report.summary.anomalyDecline],
    ["ANOMALY_GROWTH", report.summary.anomalyGrowth],
    ["NORMAL", report.summary.normal],
    ["Stockout events", report.summary.stockoutEvents],
  ];

  for (const [label, value] of summaryRows) {
    console.log(`  ${label.padEnd(18)} : ${value}`);
  }

  console.log("");

  console.log("OUTLET RESULTS");
  console.log(
    "  " +
      "Outlet".padEnd(20) +
      "Status".padEnd(18) +
      "Revenue Δ".padEnd(12) +
      "z-score".padEnd(8) +
      "Severity",
  );
  console.log("  " + "-".repeat(66));

  for (const finding of report.outlets) {
    console.log(
      "  " +
        finding.outletName.slice(0, 18).padEnd(20) +
        finding.status.padEnd(17) +
        `${finding.revenue.changePct.toFixed(1)}%`.padStart(11) +
        " " +
        String(finding.revenue.zScore ?? "n/a").padEnd(7) +
        finding.severity,
    );
  }

  console.log("");

  const interesting = report.outlets.filter(
    (finding) => finding.status !== "NORMAL",
  );

  for (const finding of interesting) {
    renderOutletDetail(finding);
  }

  console.log("");
  console.log(line);
  console.log("FULL REPORT (JSON)");
  console.log(line);
  console.log(JSON.stringify(report, null, 2));
}

function renderOutletDetail(finding: OutletFinding): void {
  console.log(`## ${finding.outletName} [${finding.status}]`);

  const revenueEvidence = finding.evidence.find(
    (evidence) => evidence.type === "outlet_revenue_change",
  );

  if (revenueEvidence) {
    console.log(`  ${revenueEvidence.description}`);
  }

  const activeLinesEvidence = finding.evidence.find(
    (evidence) => evidence.type === "outlet_active_lines_change",
  );

  if (activeLinesEvidence) {
    console.log(`  ${activeLinesEvidence.description}  (product breadth proxy)`);
  }

  console.log("");

  console.log("  Evidence:");
  for (const evidence of finding.evidence.slice(2)) {
    console.log(
      `    - [${evidence.severity.toUpperCase()}] ${evidence.type}: ${evidence.description}`,
    );
  }

  if (finding.causeChain.length > 0) {
    console.log("");
    console.log("  Cause chain (deterministic):");
    finding.causeChain.forEach((step, index) => {
      console.log(`    ${index + 1}. ${step}`);
    });
  }

  console.log("");

  console.log("  Narrative:");
  for (const line of finding.narrative) {
    console.log(`    ${line}`);
  }

  console.log("");
}