import type { OutletStatus, Severity } from "../lib/analytics/types";
import { severityColorClass, statusColorClass } from "./format";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold capitalize ${severityColorClass(severity)}`}
    >
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: OutletStatus }) {
  const label =
    status === "ANOMALY_DECLINE"
      ? "Decline"
      : status === "ANOMALY_GROWTH"
        ? "Growth"
        : "Normal";

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${statusColorClass(status)}`}
    >
      {label}
    </span>
  );
}