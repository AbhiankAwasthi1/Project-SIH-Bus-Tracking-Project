export type IssueType = "pothole" | "damaged_road" | "waterlogging" | "blockage" | "congestion";
export type Severity = "low" | "medium" | "high";
export type IncidentStatus = "detected" | "verified" | "assigned" | "repaired";

export type Incident = {
  id: string;
  type: IssueType;
  severity: Severity;
  status: IncidentStatus;
  lat: number;
  lng: number;
  confidence: number;
  sighting_count: number;
  first_seen: string;
  last_seen: string;
  evidence_url: string | null;
  source_bus_id: string | null;
  city?: string;
};

export type Bus = {
  id: string;
  route_name: string;
  last_lat: number | null;
  last_lng: number | null;
  last_seen: string | null;
  city?: string;
};

export type Job = {
  id: string;
  kind: string;
  status: string;
  message: string;
  progress: number;
  bus_id: string | null;
};

export type Session = {
  token: string;
  email: string;
  role: string;
};

export const TYPE_LABEL: Record<IssueType, string> = {
  pothole: "Pothole",
  damaged_road: "Damaged road",
  waterlogging: "Waterlogging",
  blockage: "Blockage",
  congestion: "Congestion",
};

export const TYPE_COLOR: Record<IssueType, string> = {
  pothole: "#e85d04",
  damaged_road: "#9b2226",
  waterlogging: "#1d8cff",
  blockage: "#c9a227",
  congestion: "#f4d35e",
};

export const STATUSES: IncidentStatus[] = ["detected", "verified", "assigned", "repaired"];
