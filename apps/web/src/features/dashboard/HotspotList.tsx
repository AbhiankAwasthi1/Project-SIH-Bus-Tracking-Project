import type { Hotspot } from "../../hotspots";
import { formatCount } from "../../lib/format";
import { TYPE_COLOR } from "../../types";

export type HotspotListProps = {
  hotspots: Hotspot[];
  onOpen: (hotspot: Hotspot) => void;
  label: string;
};

/**
 * Hotspots are a client-side grouping used to keep the map readable at city
 * zoom. They are not backend entities: nothing here is persisted or sent to the
 * API, and it does not replace the backend's 20 m incident deduplication.
 */
export function HotspotList({ hotspots, onOpen, label }: HotspotListProps) {
  return (
    <ul className="row-list" aria-label={label}>
      {hotspots.map((hotspot) => (
        <li key={hotspot.id}>
          <button type="button" className="row-item" onClick={() => onOpen(hotspot)}>
            <span className="row-item__head">
              {hotspot.issueType ? (
                <span
                  className="dot"
                  style={{ background: TYPE_COLOR[hotspot.issueType] }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="row-item__title truncate">{hotspot.name}</span>
            </span>
            <span className="row-item__meta">
              <span>{formatCount(hotspot.incidentCount, "incident")}</span>
              <span>{hotspot.highCount} high</span>
              {hotspot.kind === "area" ? (
                <span>{formatCount(hotspot.busCount, "bus", "buses")}</span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
