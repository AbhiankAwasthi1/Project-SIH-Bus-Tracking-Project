import {
  SEVERITY_LABEL,
  STATUS_HINT,
  STATUS_LABEL,
  type IncidentStatus,
  type Severity,
} from "../../types";

/**
 * Severity is conveyed by the written level as well as the colour, so the
 * information survives greyscale and colour-vision differences.
 */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge badge--${severity}`}>
      <span className="visually-hidden">Severity: </span>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`badge badge--${status}`} title={STATUS_HINT[status]}>
      <span className="visually-hidden">Status: </span>
      {STATUS_LABEL[status]}
    </span>
  );
}
