import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City } from "../cities";
import type { Hotspot, LngLatBounds } from "../hotspots";
import type { Bus, Incident } from "../types";
import { TYPE_COLOR, TYPE_LABEL } from "../types";

type Props = {
  incidents: Incident[];
  buses: Bus[];
  hotspots: Hotspot[];
  city: City;
  selectedId: string | null;
  bounds: LngLatBounds | null;
  onSelect: (id: string) => void;
  onHotspot: (hotspot: Hotspot) => void;
};

export function MapView({
  incidents,
  buses,
  hotspots,
  city,
  selectedId,
  bounds,
  onSelect,
  onHotspot,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const onHotspotRef = useRef(onHotspot);
  onSelectRef.current = onSelect;
  onHotspotRef.current = onHotspot;

  useEffect(() => {
    if (!wrap.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: wrap.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: city.center,
      zoom: city.zoom,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markers.current) marker.remove();
    markers.current = [];

    for (const hotspot of hotspots) {
      const el = document.createElement("div");
      el.className = `hotspot-marker${hotspot.kind === "type" ? " is-type" : ""}`;
      el.textContent = String(hotspot.incidentCount);
      el.title = hotspot.name;
      if (hotspot.issueType) el.style.background = TYPE_COLOR[hotspot.issueType];
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hotspot.lng, hotspot.lat])
        .addTo(map);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onHotspotRef.current(hotspot);
      });
      markers.current.push(marker);
    }

    for (const incident of incidents) {
      const active = selectedId === incident.id;
      const el = document.createElement("div");
      el.className = `incident-marker${active ? " is-active" : ""}`;
      el.style.background = TYPE_COLOR[incident.type];
      el.title = TYPE_LABEL[incident.type];
      const marker = new maplibregl.Marker({ element: el }).setLngLat([incident.lng, incident.lat]).addTo(map);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(incident.id);
      });
      markers.current.push(marker);
    }

    for (const bus of buses) {
      if (bus.last_lat == null || bus.last_lng == null) continue;
      const el = document.createElement("div");
      el.className = "bus-marker";
      el.title = `${bus.id} · ${bus.route_name}`;
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([bus.last_lng, bus.last_lat]).addTo(map));
    }
  }, [incidents, buses, hotspots, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (bounds) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 17, duration: 700 });
      return;
    }
    map.easeTo({ center: city.center, zoom: city.zoom, duration: 700 });
  }, [bounds, city]);

  useEffect(() => {
    const map = mapRef.current;
    const incident = incidents.find((row) => row.id === selectedId);
    if (!map || !incident) return;
    map.easeTo({ center: [incident.lng, incident.lat], zoom: Math.max(map.getZoom(), 16.5), duration: 450 });
  }, [selectedId, incidents]);

  return <div ref={wrap} style={{ position: "absolute", inset: 0 }} />;
}
