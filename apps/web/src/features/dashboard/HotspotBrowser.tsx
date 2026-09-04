import type { Hotspot } from "../../hotspots";
import { Button, EmptyState } from "../../components/ui";
import { TYPE_LABEL, type Incident, type IssueType } from "../../types";
import { HotspotList } from "./HotspotList";
import { IncidentList } from "./IncidentList";

export type HotspotBrowserProps = {
  /** Top-level hotspot groups for the current filter selection. */
  hotspots: Hotspot[];
  /** Per-class groups inside the focused area. */
  innerHotspots: Hotspot[];
  focused: Hotspot | null;
  focusType: IssueType | null;
  focusedIncidents: Incident[];
  visible: Incident[];
  selectedId: string | null;
  hasFilters: boolean;
  onOpenArea: (id: string) => void;
  onOpenType: (issueType: IssueType, leadId: string, count: number) => void;
  onOpenIncident: (incident: Incident) => void;
  onSelectIncident: (id: string) => void;
  onBack: () => void;
  onResetFilters: () => void;
};

/**
 * Presents the area -> class -> incident drill-down.
 *
 * The three levels are mutually exclusive, which is why they live in one
 * component: splitting them further would only move the same branch elsewhere
 * and add prop plumbing without clarifying ownership.
 */
export function HotspotBrowser({
  hotspots,
  innerHotspots,
  focused,
  focusType,
  focusedIncidents,
  visible,
  selectedId,
  hasFilters,
  onOpenArea,
  onOpenType,
  onOpenIncident,
  onSelectIncident,
  onBack,
  onResetFilters,
}: HotspotBrowserProps) {
  // Level 3: a single class inside a focused area.
  if (focused && focusType) {
    return (
      <div className="list-section">
        <button type="button" className="back-link" onClick={onBack}>
          <span aria-hidden="true">&larr;</span> Back to {focused.name}
        </button>
        <div className="scroll-y">
          <div className="list-section__header">
            <h3 className="section-label">{TYPE_LABEL[focusType]}</h3>
          </div>
          {focusedIncidents.length ? (
            <IncidentList
              incidents={focusedIncidents}
              selectedId={selectedId}
              onSelect={(incident) => onSelectIncident(incident.id)}
              label={`${TYPE_LABEL[focusType]} incidents in ${focused.name}`}
            />
          ) : (
            <EmptyState title="Nothing left here" inline>
              Every incident of this class in {focused.name} is filtered out.
            </EmptyState>
          )}
        </div>
      </div>
    );
  }

  // Level 2: classes present inside a focused area.
  if (focused) {
    return (
      <div className="list-section">
        <button type="button" className="back-link" onClick={onBack}>
          <span aria-hidden="true">&larr;</span> All hotspots
        </button>
        <div className="scroll-y">
          <div className="list-section__header">
            <h3 className="section-label">{focused.name}</h3>
          </div>
          <HotspotList
            hotspots={innerHotspots}
            onOpen={(hotspot) =>
              hotspot.issueType
                ? onOpenType(hotspot.issueType, hotspot.leadIncidentId, hotspot.incidentCount)
                : undefined
            }
            label={`Incident classes in ${focused.name}`}
          />
        </div>
      </div>
    );
  }

  // Level 1: hotspots plus the flat incident list for the city.
  return (
    <div className="list-section">
      <div className="list-section__header">
        <h3 className="section-label">
          {hotspots.length ? "Hotspots and incidents" : "Incidents"}
        </h3>
      </div>

      <div className="scroll-y">
        {hotspots.length ? (
          <>
            <div className="list-section__header">
              <h4 className="section-label">
                Hotspots &middot; {hotspots.length}
              </h4>
            </div>
            <HotspotList
              hotspots={hotspots}
              onOpen={(hotspot) => onOpenArea(hotspot.id)}
              label="Incident hotspots"
            />
            <div className="list-section__header">
              <h4 className="section-label">All incidents &middot; {visible.length}</h4>
            </div>
          </>
        ) : null}

        {visible.length ? (
          <IncidentList
            incidents={visible}
            selectedId={selectedId}
            onSelect={onOpenIncident}
            label="Incidents in the selected city"
          />
        ) : (
          <EmptyState title="No incidents match" inline>
            {hasFilters ? (
              <>
                Nothing in this city matches the current filters.{" "}
                <Button size="sm" variant="ghost" onClick={onResetFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              "No incidents have been reported for this city yet. Run the bus simulator to generate some."
            )}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
