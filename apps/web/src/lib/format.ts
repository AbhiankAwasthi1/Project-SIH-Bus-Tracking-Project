/** Presentation-only formatting helpers. No domain rules live here. */

const RELATIVE_STEPS: Array<[limitSeconds: number, divisor: number, unit: string]> = [
  [60, 1, "s"],
  [3_600, 60, "m"],
  [86_400, 3_600, "h"],
  [2_592_000, 86_400, "d"],
];

/** "just now", "4m ago", "3h ago". Returns an em dash for unusable input. */
export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) {
    return "—";
  }
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "—";
  }
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) {
    return "just now";
  }
  for (const [limit, divisor, unit] of RELATIVE_STEPS) {
    if (seconds < limit) {
      return `${Math.floor(seconds / divisor)}${unit} ago`;
    }
  }
  return new Date(timestamp).toLocaleDateString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? "—" : new Date(timestamp).toLocaleString();
}

/** Confidence arrives as 0..1 from the backend. */
export function formatConfidence(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

export function formatCoordinates(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "—";
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
