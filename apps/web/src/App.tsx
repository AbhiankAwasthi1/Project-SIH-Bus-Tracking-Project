import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, fetchBuses, fetchIncidents, loadSession, openFeed } from "./api";
import { CITIES, DEFAULT_CITY, cityOf, type CityId } from "./cities";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Simulator } from "./pages/Simulator";
import type { Bus, Incident, Job } from "./types";

function Shell() {
  const navigate = useNavigate();
  const session = loadSession();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [cityId, setCityId] = useState<CityId>(DEFAULT_CITY);
  const city = CITIES[cityId];

  useEffect(() => {
    if (!session?.token) return;
    void fetchIncidents({}).then(setIncidents).catch(() => undefined);
    void fetchBuses().then(setBuses).catch(() => undefined);
    const ws = openFeed((data) => {
      if (data.type === "incident_upsert" && data.incident) {
        const incoming = data.incident as Incident;
        if (!incoming.city) incoming.city = cityOf(incoming.lat, incoming.lng);
        setIncidents((prev) => {
          const rest = prev.filter((row) => row.id !== incoming.id);
          return [incoming, ...rest];
        });
      }
      if (data.type === "bus_location") {
        const update = {
          id: String(data.bus_id),
          route_name: "Live capture",
          last_lat: Number(data.lat),
          last_lng: Number(data.lng),
          last_seen: new Date().toISOString(),
        };
        setBuses((prev) => {
          const rest = prev.filter((row) => row.id !== update.id);
          const existing = prev.find((row) => row.id === update.id);
          return [{ ...update, route_name: existing?.route_name || update.route_name }, ...rest];
        });
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
    });
    return () => ws.close();
  }, [session?.token]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Drishti</strong>
          <span>SIH26124 · {city.label} fleet</span>
        </div>
        <label className="city-switch">
          City
          <select value={cityId} onChange={(e) => setCityId(e.target.value as CityId)}>
            <option value="greater_noida">Greater Noida</option>
            <option value="ahmedabad">Ahmedabad</option>
          </select>
        </label>
        <nav className="nav">
          <NavLink to="/" end>
            Map
          </NavLink>
          <NavLink to="/simulate">Simulator</NavLink>
        </nav>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            clearSession();
            navigate("/login");
          }}
        >
          {session.email}
        </button>
      </header>
      <Routes>
        <Route
          path="/"
          element={<Dashboard incidents={incidents} buses={buses} city={city} onIncidents={setIncidents} />}
        />
        <Route path="/simulate" element={<Simulator job={job} city={city} />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
