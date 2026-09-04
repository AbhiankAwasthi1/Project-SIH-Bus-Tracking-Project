import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City } from "../../cities";
import type { Hotspot, LngLatBounds } from "../../hotspots";
import { TYPE_COLOR, type Bus, type Incident, type IssueType } from "../../types";
import {
  EMPTY_COLLECTION,
  INCIDENT_HALO_LAYER,
  INCIDENT_SELECTED_LAYER,
  INCIDENT_SOURCE,
  MAP_STYLE_URL,
  incidentLayerSpecs,
  incidentSourceSpec,
  selectedFilter,
  toIncidentCollection,
  type GeoJsonData,
} from "./mapLayers";

export type IncidentMapProps = {
  incidents: Incident[];
  buses: Bus[];
  hotspots: Hotspot[];
  city: City;
  selectedId: string | null;
  bounds: LngLatBounds | null;
  onSelect: (id: string) => void;
  onHotspot: (hotspot: Hotspot) => void;
};

function setSourceData(map: maplibregl.Map, sourceId: string, data: unknown): void {
  const source = map.getSource(sourceId);
  if (source && typeof (source as maplibregl.GeoJSONSource).setData === "function") {
    (source as maplibregl.GeoJSONSource).setData(data as GeoJsonData);
  }
}

/**
 * MapLibre view for incidents, hotspot clusters and live fleet positions.
 *
 * Rendering strategy, chosen per data shape rather than uniformly:
 *  - Incidents are a GeoJSON source with three circle layers. They arrive over
 *    the WebSocket and can grow without bound during an analysis run, so they
 *    must not be a DOM node each. Selection is a `setFilter` call, not a
 *    re-upload of the collection.
 *  - Buses stay DOM markers because there are only a few and the diamond
 *    silhouette distinguishes a vehicle from an incident. Marker instances are
 *    reused across position updates; only `setLngLat` is called.
 *  - Hotspots stay DOM markers because they carry a numeric badge, and are
 *    rendered as real <button>s so they are keyboard reachable.
 *
 * Every callback is read through a ref, so no MapLibre listener is ever
 * re-registered and none can capture a stale closure. The map itself is created
 * exactly once and torn down with `map.remove()`.
 */
export function IncidentMap({
  incidents,
  buses,
  hotspots,
  city,
  selectedId,
  bounds,
  onSelect,
  onHotspot,
}: IncidentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkersRef = useRef(new Map<string, maplibregl.Marker>());
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const loadedRef = useRef(false);

  const onSelectRef = useRef(onSelect);
  const onHotspotRef = useRef(onHotspot);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onHotspotRef.current = onHotspot;
  }, [onHotspot]);

  // Only used for the very first camera position; later changes go through the
  // camera effects below so the map is never rebuilt.
  const initialViewRef = useRef({ center: city.center, zoom: city.zoom });

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLE_URL,
        center: initialViewRef.current.center,
        zoom: initialViewRef.current.zoom,
      });
    } catch {
      setFailed(true);
      return;
    }

    mapRef.current = map;
    loadedRef.current = false;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const handleLoad = () => {
      map.addSource(INCIDENT_SOURCE, incidentSourceSpec());
      for (const layer of incidentLayerSpecs()) {
        map.addLayer(layer);
      }

      // Registered once. `event.features` is scoped to the halo layer, which is
      // the largest of the three and therefore a comfortable tap target.
      map.on("click", INCIDENT_HALO_LAYER, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") {
          onSelectRef.current(id);
        }
      });
      map.on("mouseenter", INCIDENT_HALO_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", INCIDENT_HALO_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });

      loadedRef.current = true;
      setReady(true);
    };

    // Before load, an error means the style or its sources are unreachable.
    // Afterwards it is usually a single failed tile, which is not fatal.
    const handleError = () => {
      if (!loadedRef.current) {
        setFailed(true);
      }
    };

    map.on("load", handleLoad);
    map.on("error", handleError);

    return () => {
      loadedRef.current = false;
      setReady(false);
      mapRef.current = null;
      busMarkersRef.current.clear();
      hotspotMarkersRef.current = [];
      // Tears down listeners, sources, layers, markers and the WebGL context.
      map.remove();
    };
  }, []);

  // Incident features.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    setSourceData(map, INCIDENT_SOURCE, incidents.length ? toIncidentCollection(incidents) : EMPTY_COLLECTION);
  }, [incidents, ready]);

  // Selection emphasis, without touching the feature data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer(INCIDENT_SELECTED_LAYER)) {
      return;
    }
    map.setFilter(INCIDENT_SELECTED_LAYER, selectedFilter(selectedId) as never);
  }, [selectedId, ready]);

  // Fleet positions: reuse markers, move them, remove only what disappeared.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    const markers = busMarkersRef.current;
    const seen = new Set<string>();

    for (const bus of buses) {
      const { last_lat: lat, last_lng: lng } = bus;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }
      seen.add(bus.id);
      const label = `${bus.id} - ${bus.route_name}`;
      const existing = markers.get(bus.id);
      if (existing) {
        existing.setLngLat([lng, lat]);
        existing.getElement().title = label;
        continue;
      }
      const element = document.createElement("div");
      element.className = "bus-marker";
      element.title = label;
      // Decorative: the fleet list in the UI carries the same information.
      element.setAttribute("aria-hidden", "true");
      markers.set(bus.id, new maplibregl.Marker({ element }).setLngLat([lng, lat]).addTo(map));
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [buses, ready]);

  // Hotspot badges. Grouping changes identity, so these are rebuilt rather than
  // reused, but every previous marker is explicitly removed first.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    for (const marker of hotspotMarkersRef.current) {
      marker.remove();
    }
    hotspotMarkersRef.current = [];

    for (const hotspot of hotspots) {
      if (!Number.isFinite(hotspot.lat) || !Number.isFinite(hotspot.lng)) {
        continue;
      }
      const element = document.createElement("button");
      element.type = "button";
      element.className =
        hotspot.kind === "type" ? "hotspot-marker hotspot-marker--type" : "hotspot-marker";
      element.textContent = String(hotspot.incidentCount);
      element.title = hotspot.name;
      element.setAttribute(
        "aria-label",
        `${hotspot.name}: ${hotspot.incidentCount} ${hotspot.incidentCount === 1 ? "incident" : "incidents"}`,
      );
      if (hotspot.issueType) {
        element.style.background = TYPE_COLOR[hotspot.issueType as IssueType];
      }
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onHotspotRef.current(hotspot);
      });
      hotspotMarkersRef.current.push(
        new maplibregl.Marker({ element }).setLngLat([hotspot.lng, hotspot.lat]).addTo(map),
      );
    }
  }, [hotspots, ready]);

  // Camera: explicit bounds win, otherwise recentre on the selected city.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }
    if (bounds) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 17, duration: 700 });
      return;
    }
    map.easeTo({ center: city.center, zoom: city.zoom, duration: 700 });
  }, [bounds, city, ready]);

  // Camera: bring the selected incident into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) {
      return;
    }
    const incident = incidents.find((row) => row.id === selectedId);
    if (!incident || !Number.isFinite(incident.lat) || !Number.isFinite(incident.lng)) {
      return;
    }
    map.easeTo({
      center: [incident.lng, incident.lat],
      zoom: Math.max(map.getZoom(), 16.5),
      duration: 450,
    });
  }, [selectedId, incidents, ready]);

  return (
    <div className="map-root">
      <div className="map-canvas" ref={containerRef} />

      {failed ? (
        <div className="map-status" role="alert">
          The basemap could not be loaded. Check the network connection to
          tiles.openfreemap.org; incident data is unaffected and still listed alongside the map.
        </div>
      ) : null}

      {!ready && !failed ? (
        <div className="map-status" role="status" aria-live="polite">
          Loading basemap
        </div>
      ) : null}

      <div className="map-overlay map-overlay--bottom-left">
        <div className="map-legend">
          <span className="map-legend__title">Legend</span>
          <span className="map-legend__item">
            <span className="hotspot-marker" aria-hidden="true">
              n
            </span>
            Hotspot, n incidents
          </span>
          <span className="map-legend__item">
            <span className="bus-marker" aria-hidden="true" />
            Fleet vehicle
          </span>
        </div>
      </div>
    </div>
  );
}
