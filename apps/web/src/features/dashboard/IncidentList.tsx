import { SeverityBadge, StatusBadge } from "../../components/ui";
import { formatCount, formatRelativeTime } from "../../lib/format";
import { TYPE_COLOR, TYPE_LABEL, type Incident } from "../../types";

export type IncidentListProps = {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (incident: Incident) => void;
  /** Accessible name for the list region. */
  label: string;
};

export function IncidentList({ incidents, selectedId, onSelect, label }: IncidentListProps) {
  return (
    <ul className="row-list" aria-label={label}>
      {incidents.map((incident) => {
        const isSelected = incident.id === selectedId;
        return (
          <li key={incident.id}>
            <button
              type="button"
              className="row-item"
              aria-current={isSelected ? "true" : undefined}
              onClick={() => onSelect(incident)}
            >
              <span className="row-item__head">
                <span
                  className="dot"
                  style={{ background: TYPE_COLOR[incident.type] }}
                  aria-hidden="true"
                />
                <span className="row-item__title truncate">{TYPE_LABEL[incident.type]}</span>
                <span className="row-item__badges">
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge status={incident.status} />
                </span>
              </span>
              <span className="row-item__meta">
                <span>{formatCount(incident.sighting_count, "sighting")}</span>
                <span className="mono">{formatRelativeTime(incident.last_seen)}</span>
                {incident.source_bus_id ? (
                  <span className="mono">{incident.source_bus_id}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
