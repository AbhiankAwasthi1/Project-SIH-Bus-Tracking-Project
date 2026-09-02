import { LANDMARKS, type CityId } from "./cities";
import type { Incident, IssueType, Severity } from "./types";
import { TYPE_LABEL } from "./types";

const HOTSPOT_RADIUS_M = 400;
const MIN_INCIDENTS = 2;
const MAX_LANDMARK_M = 1500;
const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

export type Hotspot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  incidentCount: number;
  highCount: number;
  busCount: number;
  incidentIds: string[];
  leadIncidentId: string;
  kind: "area" | "type";
  issueType?: IssueType;
};

export type LngLatBounds = [[number, number], [number, number]];

export function buildHotspots(incidents: Incident[], cityId: CityId): Hotspot[] {
  const remaining = incidents.filter((row) => row.status !== "repaired");
  const groups: Incident[][] = [];

  while (remaining.length) {
    const seed = remaining.shift();
    if (!seed) break;
    const group = [seed];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const row = remaining[i];
      if (haversineM(seed.lat, seed.lng, row.lat, row.lng) <= HOTSPOT_RADIUS_M) {
        group.push(row);
        remaining.splice(i, 1);
      }
    }
    if (group.length >= MIN_INCIDENTS) groups.push(group);
  }

  const usedNames = new Map<string, number>();
  return groups
    .map((group) => toHotspot(group, uniqueName(nameFor(meanLat(group), meanLng(group), cityId), usedNames), "area"))
    .sort((a, b) => b.highCount - a.highCount || b.incidentCount - a.incidentCount);
}

export function typeClusters(area: Hotspot, incidents: Incident[]): Hotspot[] {
  const members = incidents.filter((row) => area.incidentIds.includes(row.id) && row.status !== "repaired");
  const byType = new Map<IssueType, Incident[]>();
  for (const row of members) {
    const list = byType.get(row.type) || [];
    list.push(row);
    byType.set(row.type, list);
  }

  const clusters = [...byType.entries()].map(([issueType, group]) =>
    toHotspot(group, TYPE_LABEL[issueType], "type", issueType),
  );
  fanOut(clusters);
  return clusters.sort((a, b) => b.incidentCount - a.incidentCount);
}

export function membersOf(area: Hotspot, incidents: Incident[], issueType?: IssueType | null): Incident[] {
  return incidents.filter((row) => area.incidentIds.includes(row.id) && (!issueType || row.type === issueType));
}

export function boundsOf(rows: { lat: number; lng: number }[]): LngLatBounds | null {
  if (!rows.length) return null;
  const lats = rows.map((row) => row.lat);
  const lngs = rows.map((row) => row.lng);
  const pad = 0.0008;
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

function toHotspot(group: Incident[], name: string, kind: "area" | "type", issueType?: IssueType): Hotspot {
  const lead = leadIncident(group);
  const buses = new Set(group.map((row) => row.source_bus_id).filter(Boolean));
  return {
    id: kind === "type" ? `type-${lead.id}-${issueType}` : `hs-${lead.id}`,
    name,
    lat: meanLat(group),
    lng: meanLng(group),
    incidentCount: group.length,
    highCount: group.filter((row) => row.severity === "high").length,
    busCount: buses.size,
    incidentIds: group.map((row) => row.id),
    leadIncidentId: lead.id,
    kind,
    issueType,
  };
}

function fanOut(clusters: Hotspot[]) {
  if (clusters.length < 2) return;
  const radius = 0.00022;
  clusters.forEach((row, index) => {
    const angle = (index / clusters.length) * Math.PI * 2 - Math.PI / 2;
    row.lat += radius * Math.cos(angle);
    row.lng += radius * Math.sin(angle);
  });
}

function leadIncident(group: Incident[]): Incident {
  return [...group].sort((a, b) => {
    const severity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severity) return severity;
    const evidence = Number(Boolean(b.evidence_url)) - Number(Boolean(a.evidence_url));
    if (evidence) return evidence;
    if (b.sighting_count !== a.sighting_count) return b.sighting_count - a.sighting_count;
    return b.last_seen.localeCompare(a.last_seen);
  })[0];
}

function nameFor(lat: number, lng: number, cityId: CityId): string {
  let best = "";
  let bestM = MAX_LANDMARK_M;
  for (const place of LANDMARKS[cityId]) {
    const meters = haversineM(lat, lng, place.lat, place.lng);
    if (meters < bestM) {
      bestM = meters;
      best = place.name;
    }
  }
  return best || "Local cluster";
}

function uniqueName(base: string, used: Map<string, number>): string {
  const next = (used.get(base) || 0) + 1;
  used.set(base, next);
  return next === 1 ? base : `${base} (${next})`;
}

function meanLat(group: Incident[]): number {
  return mean(group.map((row) => row.lat));
}

function meanLng(group: Incident[]): number {
  return mean(group.map((row) => row.lng));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLmb = toRad(lng2 - lng1);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLmb / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
