import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cityOf } from "../cities";
import { toErrorMessage } from "../services/apiClient";
import { listBuses } from "../services/busService";
import { listIncidents } from "../services/incidentService";
import {
  connectRealtime,
  type RealtimeEnvelope,
  type RealtimeStatus,
} from "../services/realtimeClient";
import type { Bus, Incident, Job } from "../types";

export type LoadStatus = "loading" | "ready" | "error";

type FleetContextValue = {
  incidents: Incident[];
  buses: Bus[];
  /** Progress of the most recent analysis job, as reported over the feed. */
  job: Job | null;
  status: LoadStatus;
  /** Set whenever any part of the snapshot failed, even if the rest loaded. */
  error: string | null;
  reload: () => void;
  /** Merges a server-confirmed incident, e.g. the response to a status change. */
  applyIncident: (incident: Incident) => void;
};

const FleetContext = createContext<FleetContextValue | null>(null);
const ConnectionContext = createContext<RealtimeStatus>("connecting");

/** Newest first, matching the backend's `ORDER BY last_seen DESC`. */
function upsertIncident(list: Incident[], incoming: Incident): Incident[] {
  return [incoming, ...list.filter((row) => row.id !== incoming.id)];
}

/**
 * Owns the fleet snapshot and the live feed for the authenticated area.
 *
 * The WebSocket message names and payload fields below are the backend contract
 * (services/api/app/pipeline.py and routers/incidents.py, broadcast through
 * services/api/app/ws.py). They are handled here exactly as they were in
 * App.tsx before the refactor; only the surrounding lifecycle changed.
 */
export function FleetProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<RealtimeStatus>("connecting");
  const [reloadToken, setReloadToken] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const applyIncident = useCallback((incident: Incident) => {
    setIncidents((current) => upsertIncident(current, incident));
  }, []);

  // Initial snapshot. Incidents and buses are settled independently so a bus
  // failure does not hide the incident list, which is the primary data.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    void Promise.allSettled([listIncidents({}), listBuses()]).then(([incidentResult, busResult]) => {
      if (cancelled || !mountedRef.current) {
        return;
      }

      if (incidentResult.status === "fulfilled") {
        setIncidents(incidentResult.value);
        setStatus("ready");
      } else {
        setStatus("error");
        setError(toErrorMessage(incidentResult.reason, "Could not load incidents."));
      }

      if (busResult.status === "fulfilled") {
        setBuses(busResult.value);
      } else if (incidentResult.status === "fulfilled") {
        setError(toErrorMessage(busResult.reason, "Could not load fleet positions."));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Live feed. One connection for the whole authenticated area.
  useEffect(() => {
    const handleMessage = (data: RealtimeEnvelope) => {
      if (data.type === "incident_upsert" && data.incident) {
        const incoming = { ...(data.incident as Incident) };
        if (!incoming.city) {
          incoming.city = cityOf(incoming.lat, incoming.lng);
        }
        setIncidents((current) => upsertIncident(current, incoming));
        return;
      }

      if (data.type === "bus_location") {
        const update: Bus = {
          id: String(data.bus_id),
          route_name: "Live capture",
          last_lat: Number(data.lat),
          last_lng: Number(data.lng),
          last_seen: new Date().toISOString(),
        };
        setBuses((current) => {
          const existing = current.find((row) => row.id === update.id);
          const rest = current.filter((row) => row.id !== update.id);
          // `city` is deliberately left unset so it is re-derived from the new
          // coordinates, exactly as before. Carrying the previous value forward
          // would pin a moving vehicle to a stale city.
          return [{ ...update, route_name: existing?.route_name || update.route_name }, ...rest];
        });
        return;
      }

      if (data.type === "job_progress") {
        setJob({
          id: String(data.job_id),
          kind: "analyze",
          status: String(data.status),
          message: String(data.message || ""),
          progress: Number(data.progress || 0),
          bus_id: null,
        });
      }
    };

    return connectRealtime({
      onMessage: handleMessage,
      onStatusChange: (next) => {
        if (mountedRef.current) {
          setConnection(next);
        }
      },
    });
  }, []);

  const value = useMemo<FleetContextValue>(
    () => ({ incidents, buses, job, status, error, reload, applyIncident }),
    [incidents, buses, job, status, error, reload, applyIncident],
  );

  return (
    <ConnectionContext.Provider value={connection}>
      <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
    </ConnectionContext.Provider>
  );
}

export function useFleet(): FleetContextValue {
  const value = useContext(FleetContext);
  if (!value) {
    throw new Error("useFleet must be used inside <FleetProvider>.");
  }
  return value;
}

/**
 * Separate from `useFleet` so the top bar's connection badge does not re-render
 * on every incident that arrives over the feed.
 */
export function useConnectionStatus(): RealtimeStatus {
  return useContext(ConnectionContext);
}
