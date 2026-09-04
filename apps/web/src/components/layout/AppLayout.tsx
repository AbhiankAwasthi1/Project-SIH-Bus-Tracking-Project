import { Outlet } from "react-router-dom";
import { CityProvider } from "../../state/CityContext";
import { FleetProvider } from "../../state/FleetContext";
import { TopBar } from "./TopBar";

/**
 * Shell for the authenticated area.
 *
 * The data providers are mounted here rather than at the application root so
 * the fleet snapshot request and the WebSocket only exist once the operator is
 * signed in, and are torn down on sign-out when this subtree unmounts.
 */
export function AppLayout() {
  return (
    <CityProvider>
      <FleetProvider>
        <div className="app-shell">
          <TopBar />
          <Outlet />
        </div>
      </FleetProvider>
    </CityProvider>
  );
}
