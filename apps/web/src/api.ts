/**
 * COMPATIBILITY FACADE.
 *
 * This module is a protected interface: its path and its exported names and
 * signatures are unchanged from before the frontend refactor, so anything that
 * imported `src/api.ts` keeps working and no backend call site had to move.
 *
 * The implementation now lives in:
 *   - src/services/apiClient.ts     request construction, auth header, errors
 *   - src/services/authService.ts   POST /api/auth/login
 *   - src/services/incidentService.ts
 *   - src/services/busService.ts
 *   - src/services/jobService.ts
 *   - src/services/realtimeClient.ts
 *   - src/auth/session.ts           the only module that touches localStorage
 *
 * New code should import from those modules directly. This file exists so the
 * refactor did not silently change a documented contract; retiring it is a
 * separate decision for the maintainer.
 */

import { clearSession, loadSession, saveSession } from "./auth/session";
import { listBuses } from "./services/busService";
import { listIncidents, updateIncidentStatus } from "./services/incidentService";
import { startAnalyzeRun, startSampleRun } from "./services/jobService";
import { login } from "./services/authService";
import { openFeed } from "./services/realtimeClient";
import type { Bus, Incident, IncidentStatus, IssueType, Job, Session, Severity } from "./types";

export { clearSession, loadSession, saveSession, openFeed };

export function loginRequest(email: string, password: string): Promise<Session> {
  return login(email, password);
}

export function fetchIncidents(filters: {
  type?: IssueType | "";
  severity?: Severity | "";
  status?: IncidentStatus | "";
}): Promise<Incident[]> {
  return listIncidents(filters);
}

export function fetchBuses(): Promise<Bus[]> {
  return listBuses();
}

export function patchIncident(id: string, status: IncidentStatus): Promise<Incident> {
  return updateIncidentStatus(id, status);
}

export function startSample(busId = "GNA-12", city = "greater_noida"): Promise<Job> {
  return startSampleRun(busId, city);
}

export function startAnalyze(
  video: File,
  gps: File | null,
  busId: string,
  city = "greater_noida",
): Promise<Job> {
  return startAnalyzeRun({ video, gps, busId, city });
}
