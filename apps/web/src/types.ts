/**
 * Frontend mirror of the backend wire contract.
 *
 * The authoritative producers are:
 *   - services/api/app/serialize.py  (incident_to_dict / capture_to_dict)
 *   - services/api/app/schemas.py    (Pydantic response models)
 *   - services/detect/severity.py    (ISSUE_TYPES, the detector class vocabulary)
 *
 * Do not add fields that the backend does not send.
 */

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

/** Client-side filter selection. An empty string means "no constraint". */
export type IncidentFilters = {
  type: IssueType | "";
  severity: Severity | "";
  status: IncidentStatus | "";
};

export const EMPTY_INCIDENT_FILTERS: IncidentFilters = {
  type: "",
  severity: "",
  status: "",
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

/** Ordered for UI menus. Must stay aligned with services/detect/severity.py ISSUE_TYPES. */
export const ISSUE_TYPES: IssueType[] = [
  "pothole",
  "damaged_road",
  "waterlogging",
  "blockage",
  "congestion",
];

export const SEVERITIES: Severity[] = ["high", "medium", "low"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  detected: "Detected",
  verified: "Verified",
  assigned: "Assigned",
  repaired: "Repaired",
};

/** Short, screen-reader friendly description of what each status means operationally. */
export const STATUS_HINT: Record<IncidentStatus, string> = {
  detected: "Reported by the fleet, not yet reviewed",
  verified: "Confirmed by an operator",
  assigned: "Handed to a repair crew",
  repaired: "Closed; excluded from clustering",
};
