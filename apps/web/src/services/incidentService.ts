import { request, toQuery } from "./apiClient";
import type { Incident, IncidentFilters, IncidentStatus } from "../types";

/** GET /api/incidents -> services/api/app/routers/incidents.py:list_incidents */
export function listIncidents(filters: Partial<IncidentFilters> = {}): Promise<Incident[]> {
  const query = toQuery({
    type: filters.type || undefined,
    severity: filters.severity || undefined,
    status: filters.status || undefined,
  });
  return request<Incident[]>(`/incidents${query}`);
}

/**
 * PATCH /api/incidents/{id} -> services/api/app/routers/incidents.py:patch_incident
 * The backend validates the status against ALLOWED_STATUS and broadcasts an
 * `incident_upsert` over the WebSocket, so callers get the update twice.
 */
export function updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
  return request<Incident>(`/incidents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: { status },
  });
}
