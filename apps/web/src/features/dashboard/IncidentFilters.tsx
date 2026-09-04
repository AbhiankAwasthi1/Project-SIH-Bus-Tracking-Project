import type { ReactNode } from "react";
import { Button, SelectField, type SelectOption } from "../../components/ui";
import {
  ISSUE_TYPES,
  SEVERITIES,
  SEVERITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  TYPE_LABEL,
  type IncidentFilters as Filters,
  type IncidentStatus,
  type IssueType,
  type Severity,
} from "../../types";

const TYPE_OPTIONS: Array<SelectOption<IssueType | "">> = [
  { value: "", label: "All classes" },
  ...ISSUE_TYPES.map((issue) => ({ value: issue, label: TYPE_LABEL[issue] })),
];

const SEVERITY_OPTIONS: Array<SelectOption<Severity | "">> = [
  { value: "", label: "Any severity" },
  ...SEVERITIES.map((severity) => ({ value: severity, label: SEVERITY_LABEL[severity] })),
];

const STATUS_OPTIONS: Array<SelectOption<IncidentStatus | "">> = [
  { value: "", label: "Any status" },
  ...STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] })),
];

export type IncidentFiltersProps = {
  filters: Filters;
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onReset: () => void;
  hasFilters: boolean;
  resultCount: number;
  totalCount: number;
  /** Collapses into a disclosure on narrow screens to protect vertical space. */
  collapsible: boolean;
};

export function IncidentFilters({
  filters,
  onChange,
  onReset,
  hasFilters,
  resultCount,
  totalCount,
  collapsible,
}: IncidentFiltersProps) {
  const summary =
    resultCount === totalCount
      ? `${totalCount} in view`
      : `${resultCount} of ${totalCount} in view`;

  const controls: ReactNode = (
    <div className="filters">
      <div className="filters__row">
        <SelectField<IssueType | "">
          label="Class"
          value={filters.type}
          options={TYPE_OPTIONS}
          onValueChange={(value) => onChange("type", value)}
        />
        <SelectField<Severity | "">
          label="Severity"
          value={filters.severity}
          options={SEVERITY_OPTIONS}
          onValueChange={(value) => onChange("severity", value)}
        />
        <SelectField<IncidentStatus | "">
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onValueChange={(value) => onChange("status", value)}
        />
      </div>
      <div className="filters__footer">
        <span className="filters__count" aria-live="polite">
          {summary}
        </span>
        <Button size="sm" variant="ghost" onClick={onReset} disabled={!hasFilters}>
          Clear filters
        </Button>
      </div>
    </div>
  );

  if (!collapsible) {
    return <section aria-label="Incident filters">{controls}</section>;
  }

  return (
    <details className="filters--collapsible">
      <summary>Filters{hasFilters ? " (active)" : ""}</summary>
      {controls}
    </details>
  );
}
