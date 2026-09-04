import { useCallback, useEffect, useMemo, useState } from "react";
import { cityOf, type CityId } from "../../cities";
import { boundsOf, buildHotspots, membersOf, typeClusters, type Hotspot } from "../../hotspots";
import { toErrorMessage } from "../../services/apiClient";
import { updateIncidentStatus } from "../../services/incidentService";
import {
  EMPTY_INCIDENT_FILTERS,
  type Bus,
  type Incident,
  type IncidentFilters,
  type IncidentStatus,
  type IssueType,
} from "../../types";

/**
 * View model for the dashboard.
 *
 * All of the derivation that used to sit inline in Dashboard.tsx lives here, so
 * the components below are presentational. The semantics are unchanged: city
 * scoping, client-side filtering, hotspot grouping and the area -> type ->
 * incident drill-down all behave as before.
 *
 * Note on scope: hotspot grouping is a *presentation* concern (which pins to
 * collapse at this zoom). The authoritative deduplication is the backend's 20 m
 * same-type merge in services/api/app/clustering.py, and nothing here changes
 * or second-guesses it.
 */

function incidentCity(row: Incident): string {
  return row.city || cityOf(row.lat, row.lng);
}

export type UseDashboardViewInput = {
  incidents: Incident[];
  buses: Bus[];
  cityId: CityId;
  /** Applies a server-confirmed incident back into shared state. */
  applyIncident: (incident: Incident) => void;
};

export function useDashboardView({
  incidents,
  buses,
  cityId,
  applyIncident,
}: UseDashboardViewInput) {
  const [filters, setFilters] = useState<IncidentFilters>(EMPTY_INCIDENT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusType, setFocusType] = useState<IssueType | null>(null);
  /** Which incident is mid-update, and to which status, so only that button spins. */
  const [statusPending, setStatusPending] = useState<{
    id: string;
    status: IncidentStatus;
  } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Switching city invalidates any selection or drill-down.
  useEffect(() => {
    setSelectedId(null);
    setFocusId(null);
    setFocusType(null);
    setStatusError(null);
  }, [cityId]);

  const inCity = useMemo(
    () => incidents.filter((row) => incidentCity(row) === cityId),
    [incidents, cityId],
  );

  const cityBuses = useMemo(
    () =>
      buses.filter((row) => {
        if (row.city) {
          return row.city === cityId;
        }
        if (row.last_lat == null || row.last_lng == null) {
          return false;
        }
        return cityOf(row.last_lat, row.last_lng) === cityId;
      }),
    [buses, cityId],
  );

  const visible = useMemo(
    () =>
      inCity.filter(
        (row) =>
          (!filters.type || row.type === filters.type) &&
          (!filters.severity || row.severity === filters.severity) &&
          (!filters.status || row.status === filters.status),
      ),
    [inCity, filters],
  );

  const hotspots = useMemo(() => buildHotspots(visible, cityId), [visible, cityId]);
  const focused = useMemo(
    () => hotspots.find((row) => row.id === focusId) ?? null,
    [hotspots, focusId],
  );
  const innerHotspots = useMemo(
    () => (focused ? typeClusters(focused, visible) : []),
    [focused, visible],
  );
  const focusedIncidents = useMemo(
    () => (focused ? membersOf(focused, visible, focusType) : []),
    [focused, visible, focusType],
  );

  const selected = useMemo(
    () => visible.find((row) => row.id === selectedId) ?? null,
    [visible, selectedId],
  );

  const openCount = useMemo(
    () => inCity.filter((row) => row.status !== "repaired").length,
    [inCity],
  );
  const highCount = useMemo(
    () => inCity.filter((row) => row.severity === "high" && row.status !== "repaired").length,
    [inCity],
  );

  const mapHotspots = focusType ? [] : focused ? innerHotspots : hotspots;
  const mapPins = focusType ? focusedIncidents : [];
  const mapBounds = useMemo(() => {
    if (!focused) {
      return null;
    }
    return boundsOf(focusType ? focusedIncidents : membersOf(focused, visible));
  }, [focused, focusType, focusedIncidents, visible]);

  const setFilter = useCallback(<K extends keyof IncidentFilters>(key: K, value: IncidentFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFilters(EMPTY_INCIDENT_FILTERS), []);

  const hasFilters = Boolean(filters.type || filters.severity || filters.status);

  const openArea = useCallback((id: string) => {
    setFocusId(id);
    setFocusType(null);
    setSelectedId(null);
  }, []);

  const openType = useCallback((issueType: IssueType, leadId: string, count: number) => {
    setFocusType(issueType);
    setSelectedId(count === 1 ? leadId : null);
  }, []);

  const openIncident = useCallback(
    (row: Incident) => {
      const area = hotspots.find((hotspot) => hotspot.incidentIds.includes(row.id));
      if (area) {
        setFocusId(area.id);
        setFocusType(row.type);
      }
      setSelectedId(row.id);
    },
    [hotspots],
  );

  const openHotspot = useCallback(
    (hotspot: Hotspot) => {
      if (hotspot.kind === "area") {
        openArea(hotspot.id);
      } else if (hotspot.issueType) {
        openType(hotspot.issueType, hotspot.leadIncidentId, hotspot.incidentCount);
      }
    },
    [openArea, openType],
  );

  const goBack = useCallback(() => {
    if (focusType) {
      setFocusType(null);
      setSelectedId(null);
      return;
    }
    setFocusId(null);
    setSelectedId(null);
  }, [focusType]);

  /**
   * PATCH /api/incidents/{id}. Previously this was a floating promise with no
   * error path, so a rejected status change failed silently.
   */
  const changeStatus = useCallback(
    async (id: string, next: IncidentStatus) => {
      setStatusPending({ id, status: next });
      setStatusError(null);
      try {
        const updated = await updateIncidentStatus(id, next);
        applyIncident(updated);
      } catch (cause) {
        setStatusError(toErrorMessage(cause, "Could not update the incident status."));
      } finally {
        setStatusPending(null);
      }
    },
    [applyIncident],
  );

  const dismissStatusError = useCallback(() => setStatusError(null), []);

  return {
    filters,
    setFilter,
    resetFilters,
    hasFilters,

    inCityCount: inCity.length,
    visible,
    cityBuses,
    openCount,
    highCount,

    hotspots,
    focused,
    innerHotspots,
    focusedIncidents,
    focusType,

    selected,
    selectedId,
    selectIncident: setSelectedId,

    mapHotspots,
    mapPins,
    mapBounds,

    openArea,
    openType,
    openIncident,
    openHotspot,
    goBack,

    statusPending,
    statusError,
    dismissStatusError,
    changeStatus,
  };
}
