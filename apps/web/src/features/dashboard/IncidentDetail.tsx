import { Button, Callout, EmptyState, SeverityBadge, StatusBadge } from "../../components/ui";
import {
  formatConfidence,
  formatCoordinates,
  formatCount,
  formatDateTime,
  formatRelativeTime,
} from "../../lib/format";
import { safeMediaUrl } from "../../lib/mediaUrl";
import { STATUSES, STATUS_HINT, STATUS_LABEL, TYPE_LABEL, type Incident, type IncidentStatus } from "../../types";

export type IncidentDetailProps = {
  incident: Incident | null;
  /** Hint shown when nothing is selected, describing the next useful action. */
  emptyHint: string;
  statusPending: { id: string; status: IncidentStatus } | null;
  statusError: string | null;
  onDismissStatusError: () => void;
  onChangeStatus: (id: string, status: IncidentStatus) => void;
};

export function IncidentDetail({
  incident,
  emptyHint,
  statusPending,
  statusError,
  onDismissStatusError,
  onChangeStatus,
}: IncidentDetailProps) {
  if (!incident) {
    return (
      <div className="detail">
        <EmptyState title="No incident selected">{emptyHint}</EmptyState>
      </div>
    );
  }

  const evidence = safeMediaUrl(incident.evidence_url);
  const pending = statusPending?.id === incident.id;

  return (
    <div className="detail scroll-y">
      <div className="detail__head">
        <span className="section-label">Incident</span>
        <div className="detail__title">
          <h2>{TYPE_LABEL[incident.type]}</h2>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>
      </div>

      {evidence ? (
        <img
          className="detail__media"
          src={evidence}
          alt={`Evidence crop for the reported ${TYPE_LABEL[incident.type].toLowerCase()}`}
          loading="lazy"
        />
      ) : (
        <div className="detail__media-empty">
          No evidence crop yet. Crops are produced by the analysis pipeline; run the bus simulator
          to generate one.
        </div>
      )}

      <dl className="detail__dl">
        <dt>Sightings</dt>
        <dd>{formatCount(incident.sighting_count, "report")}</dd>

        <dt>Confidence</dt>
        <dd>{formatConfidence(incident.confidence)}</dd>

        <dt>Source</dt>
        <dd>{incident.source_bus_id || "Unknown vehicle"}</dd>

        <dt>Location</dt>
        <dd className="mono">{formatCoordinates(incident.lat, incident.lng)}</dd>

        <dt>First seen</dt>
        <dd>
          <time dateTime={incident.first_seen}>{formatDateTime(incident.first_seen)}</time>
        </dd>

        <dt>Last seen</dt>
        <dd>
          <time dateTime={incident.last_seen}>{formatRelativeTime(incident.last_seen)}</time>
        </dd>
      </dl>

      <div className="stack-sm">
        <span className="section-label">Repair workflow</span>
        <p className="detail__hint">{STATUS_HINT[incident.status]}.</p>

        {statusError ? (
          <Callout tone="error" title="Status not saved" onDismiss={onDismissStatusError}>
            {statusError}
          </Callout>
        ) : null}

        <div className="status-row" role="group" aria-label="Set incident status">
          {STATUSES.map((status) => (
            <Button
              key={status}
              size="sm"
              active={incident.status === status}
              disabled={pending || incident.status === status}
              busy={pending && statusPending?.status === status}
              title={STATUS_HINT[status]}
              onClick={() => onChangeStatus(incident.id, status)}
            >
              {STATUS_LABEL[status]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
