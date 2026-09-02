import { useEffect, useMemo, useState } from "react";
import { MapView } from "../components/MapView";
import { patchIncident } from "../api";
import { cityOf, type City } from "../cities";
import { boundsOf, buildHotspots, membersOf, typeClusters } from "../hotspots";
import type { Bus, Incident, IncidentStatus, IssueType, Severity } from "../types";
import { STATUSES, TYPE_COLOR, TYPE_LABEL } from "../types";

type Props = {
  incidents: Incident[];
  buses: Bus[];
  city: City;
  onIncidents: (next: Incident[] | ((prev: Incident[]) => Incident[])) => void;
};

function incidentCity(row: Incident) {
  return row.city || cityOf(row.lat, row.lng);
}

export function Dashboard({ incidents, buses, city, onIncidents }: Props) {
  const [type, setType] = useState<IssueType | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusType, setFocusType] = useState<IssueType | null>(null);

  useEffect(() => {
    setSelectedId(null);
    setFocusId(null);
    setFocusType(null);
  }, [city.id]);

  const inCity = useMemo(
    () => incidents.filter((row) => incidentCity(row) === city.id),
    [incidents, city.id],
  );
  const cityBuses = useMemo(
    () =>
      buses.filter((row) => {
        if (row.city) return row.city === city.id;
        if (row.last_lat == null || row.last_lng == null) return false;
        return cityOf(row.last_lat, row.last_lng) === city.id;
      }),
    [buses, city.id],
  );

  const visible = useMemo(
    () =>
      inCity.filter(
        (row) =>
          (!type || row.type === type) &&
          (!severity || row.severity === severity) &&
          (!status || row.status === status),
      ),
    [inCity, type, severity, status],
  );

  const hotspots = useMemo(() => buildHotspots(visible, city.id), [visible, city.id]);
  const focused = hotspots.find((row) => row.id === focusId) || null;
  const innerHotspots = useMemo(() => (focused ? typeClusters(focused, visible) : []), [focused, visible]);
  const focusedIncidents = useMemo(
    () => (focused ? membersOf(focused, visible, focusType) : []),
    [focused, visible, focusType],
  );

  const selected = visible.find((row) => row.id === selectedId) || null;
  const openCount = inCity.filter((row) => row.status !== "repaired").length;
  const highCount = inCity.filter((row) => row.severity === "high" && row.status !== "repaired").length;
  const mapHotspots = focusType ? [] : focused ? innerHotspots : hotspots;
  const mapPins = focusType ? focusedIncidents : [];
  const mapBounds = useMemo(() => {
    if (!focused) return null;
    return boundsOf(focusType ? focusedIncidents : membersOf(focused, visible));
  }, [focused, focusType, focusedIncidents, visible]);

  function openArea(id: string) {
    setFocusId(id);
    setFocusType(null);
    setSelectedId(null);
  }

  function openType(issueType: IssueType, leadId: string, count: number) {
    setFocusType(issueType);
    setSelectedId(count === 1 ? leadId : null);
  }

  function openIncident(row: Incident) {
    const area = hotspots.find((hotspot) => hotspot.incidentIds.includes(row.id));
    if (area) {
      setFocusId(area.id);
      setFocusType(row.type);
    }
    setSelectedId(row.id);
  }

  function goBack() {
    if (focusType) {
      setFocusType(null);
      setSelectedId(null);
      return;
    }
    setFocusId(null);
    setSelectedId(null);
  }

  async function setStatusFor(id: string, next: IncidentStatus) {
    const updated = await patchIncident(id, next);
    onIncidents((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="filters">
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as IssueType | "")}>
              <option value="">All classes</option>
              {Object.entries(TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}>
              <option value="">Any</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | "")}>
              <option value="">Any</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="stat-row">
          <div className="stat">
            <b>{openCount}</b>
            <span>Open incidents</span>
          </div>
          <div className="stat">
            <b>{highCount}</b>
            <span>High severity</span>
          </div>
        </div>
        {focused ? (
          <div className="hotspot-block">
            <button className="back-link" type="button" onClick={goBack}>
              ← {focusType ? focused.name : "All hotspots"}
            </button>
            <div className="section-label">
              {focusType ? TYPE_LABEL[focusType] : focused.name}
            </div>
            {!focusType ? (
              <ul className="incident-list">
                {innerHotspots.map((row) => (
                  <li key={row.id}>
                    <button onClick={() => openType(row.issueType as IssueType, row.leadIncidentId, row.incidentCount)}>
                      <span className="dot" style={{ background: TYPE_COLOR[row.issueType as IssueType] }} />
                      {row.name}
                      <div className="meta">
                        {row.incidentCount} {row.incidentCount === 1 ? "incident" : "incidents"} · {row.highCount} high
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="incident-list">
                {focusedIncidents.map((row) => (
                  <li key={row.id}>
                    <button className={selected?.id === row.id ? "selected" : ""} onClick={() => setSelectedId(row.id)}>
                      <span className="dot" style={{ background: TYPE_COLOR[row.type] }} />
                      {TYPE_LABEL[row.type]}
                      <div className="meta">
                        {row.severity} · {row.status} · seen {row.sighting_count}×
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : hotspots.length > 0 ? (
          <div className="hotspot-block">
            <div className="section-label">Hotspots</div>
            <ul className="incident-list">
              {hotspots.map((row) => (
                <li key={row.id}>
                  <button onClick={() => openArea(row.id)}>
                    {row.name}
                    <div className="meta">
                      {row.incidentCount} incidents · {row.highCount} high · {row.busCount}{" "}
                      {row.busCount === 1 ? "bus" : "buses"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="section-label">Incidents</div>
        )}
        {!focused ? (
          <div>
            {hotspots.length > 0 ? <div className="section-label">Incidents</div> : null}
            <ul className="incident-list">
              {visible.map((row) => (
                <li key={row.id}>
                  <button
                    className={selected?.id === row.id ? "selected" : ""}
                    onClick={() => openIncident(row)}
                  >
                    <span className="dot" style={{ background: TYPE_COLOR[row.type] }} />
                    {TYPE_LABEL[row.type]}
                    <div className="meta">
                      {row.severity} · {row.status} · seen {row.sighting_count}×
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
      <div className="map-pane">
        <MapView
          incidents={mapPins}
          buses={focused ? [] : cityBuses}
          hotspots={mapHotspots}
          city={city}
          selectedId={selected?.id || null}
          bounds={mapBounds}
          onSelect={setSelectedId}
          onHotspot={(row) => {
            if (row.kind === "area") openArea(row.id);
            else if (row.issueType) openType(row.issueType, row.leadIncidentId, row.incidentCount);
          }}
        />
      </div>
      <aside className="drawer">
        {selected ? (
          <div className="detail">
            <div>
              <div className="meta">INCIDENT</div>
              <strong>{TYPE_LABEL[selected.type]}</strong>
            </div>
            {selected.evidence_url ? (
              <img src={selected.evidence_url} alt={selected.type} />
            ) : (
              <div className="empty-photo">No crop yet — run the bus simulator</div>
            )}
            <div className="meta">
              {selected.source_bus_id || "unknown bus"} · confidence {(selected.confidence * 100).toFixed(0)}%
              <br />
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
              <br />
              last seen {new Date(selected.last_seen).toLocaleString()}
            </div>
            <div>
              <div className="meta">Repair workflow</div>
              <div className="status-row">
                {STATUSES.map((value) => (
                  <button
                    key={value}
                    className={`status-btn ${selected.status === value ? "active" : ""}`}
                    onClick={() => setStatusFor(selected.id, value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="detail">
            <p className="meta">
              {!focused
                ? "Click a hotspot to inspect that stretch of road."
                : !focusType
                  ? `Click a type marker to see each ${focused.name} incident.`
                  : "Click a pin for the exact location and photo."}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
