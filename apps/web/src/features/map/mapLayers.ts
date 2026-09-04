import type maplibregl from "maplibre-gl";
import { ISSUE_TYPES, TYPE_COLOR, type Incident, type IssueType, type Severity } from "../../types";

/**
 * Layer and source definitions for the incident map.
 *
 * Types are derived from the library's own signatures instead of naming the
 * GeoJSON namespace, so this stays correct across maplibre-gl versions.
 */
export type SourceSpec = Parameters<maplibregl.Map["addSource"]>[1];
export type LayerSpec = Parameters<maplibregl.Map["addLayer"]>[0];
export type GeoJsonData = Parameters<maplibregl.GeoJSONSource["setData"]>[0];

export const INCIDENT_SOURCE = "drishti-incidents";
export const INCIDENT_HALO_LAYER = "drishti-incident-halo";
export const INCIDENT_CORE_LAYER = "drishti-incident-core";
export const INCIDENT_SELECTED_LAYER = "drishti-incident-selected";

/** Style URL is unchanged: a token-free dark basemap suitable for a demo. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

const FALLBACK_COLOR = "#8d8578";

type IncidentProperties = {
  id: string;
  type: IssueType;
  severity: Severity;
};

type PointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: IncidentProperties;
};

export type IncidentCollection = {
  type: "FeatureCollection";
  features: PointFeature[];
};

export const EMPTY_COLLECTION: IncidentCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Drops rows without usable coordinates. Live `bus_location` and
 * `incident_upsert` frames are coerced with Number(), so NaN is possible and
 * would otherwise make MapLibre discard the whole tile.
 */
export function toIncidentCollection(incidents: Incident[]): IncidentCollection {
  return {
    type: "FeatureCollection",
    features: incidents
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))
      .map((row) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [row.lng, row.lat] },
        properties: { id: row.id, type: row.type, severity: row.severity },
      })),
  };
}

/** Derived from TYPE_COLOR so map colours cannot drift from list colours. */
function typeColorExpression(): unknown {
  return [
    "match",
    ["get", "type"],
    ...ISSUE_TYPES.flatMap((issue) => [issue, TYPE_COLOR[issue]]),
    FALLBACK_COLOR,
  ];
}

/** Higher severity reads as a larger target, so size carries meaning too. */
function severityRadiusExpression(scale: number): unknown {
  return ["match", ["get", "severity"], "high", 8 * scale, "medium", 6.5 * scale, "low", 5.5 * scale, 6.5 * scale];
}

export function incidentSourceSpec(): SourceSpec {
  return {
    type: "geojson",
    data: EMPTY_COLLECTION as GeoJsonData,
  } as SourceSpec;
}

/**
 * Three layers over one source:
 *  - halo      generous, low-opacity disc; also the click/tap target
 *  - core      the readable pin
 *  - selected  emphasis ring, driven by setFilter rather than re-uploading data
 */
export function incidentLayerSpecs(): LayerSpec[] {
  return [
    {
      id: INCIDENT_HALO_LAYER,
      type: "circle",
      source: INCIDENT_SOURCE,
      paint: {
        "circle-radius": severityRadiusExpression(2.2),
        "circle-color": typeColorExpression(),
        "circle-opacity": 0.18,
      },
    } as unknown as LayerSpec,
    {
      id: INCIDENT_CORE_LAYER,
      type: "circle",
      source: INCIDENT_SOURCE,
      paint: {
        "circle-radius": severityRadiusExpression(1),
        "circle-color": typeColorExpression(),
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0e0d0c",
      },
    } as unknown as LayerSpec,
    {
      id: INCIDENT_SELECTED_LAYER,
      type: "circle",
      source: INCIDENT_SOURCE,
      filter: ["==", ["get", "id"], "__none__"],
      paint: {
        "circle-radius": severityRadiusExpression(1.55),
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#ece7dc",
      },
    } as unknown as LayerSpec,
  ];
}

export function selectedFilter(selectedId: string | null): unknown[] {
  return ["==", ["get", "id"], selectedId ?? "__none__"];
}
