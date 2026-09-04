import { useEffect, useState } from "react";
import { Callout, ErrorState, LoadingState } from "../../components/ui";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { useCity } from "../../state/CityContext";
import { useFleet } from "../../state/FleetContext";
import { IncidentMap } from "../map/IncidentMap";
import { HotspotBrowser } from "./HotspotBrowser";
import { IncidentDetail } from "./IncidentDetail";
import { IncidentFilters } from "./IncidentFilters";
import { KpiRow } from "./KpiRow";
import { useDashboardView } from "./useDashboardView";

type Pane = "list" | "detail";

function emptyHintFor(hasFocusedArea: boolean, hasFocusedType: boolean, areaName?: string): string {
  if (!hasFocusedArea) {
    return "Pick a hotspot on the map or in the list to inspect that stretch of road.";
  }
  if (!hasFocusedType) {
    return `Choose an incident class to see each report in ${areaName ?? "this area"}.`;
  }
  return "Pick a pin for the exact location, evidence crop and repair controls.";
}

export function DashboardPage() {
  const { city, cityId } = useCity();
  const { incidents, buses, status, error, reload, applyIncident } = useFleet();
  const isMobile = useIsMobile();

  const view = useDashboardView({ incidents, buses, cityId, applyIncident });

  // On mobile the list and the detail share one cell, so selecting an incident
  // should bring its detail forward. The map stays mounted in its own cell.
  const [pane, setPane] = useState<Pane>("list");
  useEffect(() => {
    if (isMobile && view.selectedId) {
      setPane("detail");
    }
  }, [isMobile, view.selectedId]);

  if (status === "loading") {
    return (
      <div className="page-center">
        <LoadingState title="Loading the incident picture" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page-center">
        <ErrorState
          title="Could not load incidents"
          message={error ?? "The Drishti API did not return the incident list."}
          onRetry={reload}
        />
      </div>
    );
  }

  const listHidden = isMobile && pane !== "list";
  const detailHidden = isMobile && pane !== "detail";

  return (
    <div className="workspace">
      {isMobile ? (
        // A pair of toggle buttons rather than an ARIA tablist: the map is
        // always visible, so these panes are not tabpanels.
        <div className="pane-switch" role="group" aria-label="Choose visible panel">
          <button
            type="button"
            className="pane-switch__btn"
            aria-pressed={pane === "list"}
            onClick={() => setPane("list")}
          >
            Incidents
          </button>
          <button
            type="button"
            className="pane-switch__btn"
            aria-pressed={pane === "detail"}
            onClick={() => setPane("detail")}
          >
            Detail
          </button>
        </div>
      ) : null}

      <aside className="workspace__sidebar" hidden={listHidden} aria-label="Incident browser">
        <div className="panel">
          <div className="sidebar-controls">
            {/* A soft failure (for example fleet positions) should not hide the list. */}
            {error ? (
              <div className="sidebar-controls__alert">
                <Callout tone="warning" title="Partial data" onRetry={reload}>
                  {error}
                </Callout>
              </div>
            ) : null}

            <IncidentFilters
              filters={view.filters}
              onChange={view.setFilter}
              onReset={view.resetFilters}
              hasFilters={view.hasFilters}
              resultCount={view.visible.length}
              totalCount={view.inCityCount}
              collapsible={isMobile}
            />

            <KpiRow
              openCount={view.openCount}
              highCount={view.highCount}
              fleetCount={view.cityBuses.length}
            />
          </div>

          <HotspotBrowser
            hotspots={view.hotspots}
            innerHotspots={view.innerHotspots}
            focused={view.focused}
            focusType={view.focusType}
            focusedIncidents={view.focusedIncidents}
            visible={view.visible}
            selectedId={view.selectedId}
            hasFilters={view.hasFilters}
            onOpenArea={view.openArea}
            onOpenType={view.openType}
            onOpenIncident={view.openIncident}
            onSelectIncident={view.selectIncident}
            onBack={view.goBack}
            onResetFilters={view.resetFilters}
          />
        </div>
      </aside>

      <div className="workspace__map">
        <IncidentMap
          incidents={view.mapPins}
          buses={view.focused ? [] : view.cityBuses}
          hotspots={view.mapHotspots}
          city={city}
          selectedId={view.selected?.id ?? null}
          bounds={view.mapBounds}
          onSelect={view.selectIncident}
          onHotspot={view.openHotspot}
        />
      </div>

      <aside className="workspace__drawer" hidden={detailHidden} aria-label="Incident detail">
        <IncidentDetail
          incident={view.selected}
          emptyHint={emptyHintFor(Boolean(view.focused), Boolean(view.focusType), view.focused?.name)}
          statusPending={view.statusPending}
          statusError={view.statusError}
          onDismissStatusError={view.dismissStatusError}
          onChangeStatus={view.changeStatus}
        />
      </aside>
    </div>
  );
}
