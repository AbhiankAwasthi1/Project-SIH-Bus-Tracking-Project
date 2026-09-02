import type { Bus, Incident, IncidentStatus, IssueType, Job, Session, Severity } from "./types";

const TOKEN_KEY = "drishti.session";

export function loadSession(): Session | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}

function headers(extra?: HeadersInit): HeadersInit {
  const session = loadSession();
  return {
    ...(extra || {}),
    ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function loginRequest(email: string, password: string): Promise<Session> {
  return parse<Session>(
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

export async function fetchIncidents(filters: {
  type?: IssueType | "";
  severity?: Severity | "";
  status?: IncidentStatus | "";
}): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.status) params.set("status", filters.status);
  const q = params.toString();
  return parse<Incident[]>(await fetch(`/api/incidents${q ? `?${q}` : ""}`, { headers: headers() }));
}

export async function fetchBuses(): Promise<Bus[]> {
  return parse<Bus[]>(await fetch("/api/buses", { headers: headers() }));
}

export async function patchIncident(id: string, status: IncidentStatus): Promise<Incident> {
  return parse<Incident>(
    await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status }),
    }),
  );
}

export async function startSample(busId = "GNA-12", city = "greater_noida"): Promise<Job> {
  const body = new FormData();
  body.set("bus_id", busId);
  body.set("city", city);
  return parse<Job>(await fetch("/api/jobs/sample", { method: "POST", headers: headers(), body }));
}

export async function startAnalyze(video: File, gps: File | null, busId: string, city = "greater_noida"): Promise<Job> {
  const body = new FormData();
  body.set("video", video);
  if (gps && gps.size) body.set("gps", gps);
  body.set("bus_id", busId);
  body.set("city", city);
  return parse<Job>(await fetch("/api/jobs/analyze", { method: "POST", headers: headers(), body }));
}

export function openFeed(onMessage: (data: Record<string, unknown>) => void): WebSocket {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${window.location.host}/api/ws`);
  ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data) as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  };
  return ws;
}
