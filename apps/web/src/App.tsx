import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingState } from "./components/ui";
import { LoginPage } from "./features/auth/LoginPage";
import { NotFoundPage } from "./features/misc/NotFoundPage";

/**
 * The authenticated pages are split out so that MapLibre (the single largest
 * dependency) is not downloaded before sign-in. The login route stays eager
 * because it is the entry point.
 */
const DashboardPage = lazy(() =>
  import("./features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const SimulatorPage = lazy(() =>
  import("./features/simulator/SimulatorPage").then((module) => ({
    default: module.SimulatorPage,
  })),
);

function RouteFallback() {
  return (
    <div className="page-center">
      <LoadingState title="Loading console" />
    </div>
  );
}

/**
 * Route table only.
 *
 * Responsibilities that used to live here now have dedicated homes:
 *   - session/auth        src/auth (AuthProvider, RequireAuth, session)
 *   - layout shell + nav  src/components/layout (AppLayout, TopBar)
 *   - shared app state    src/state (CityContext, FleetContext)
 *   - WebSocket lifecycle src/state/FleetContext + src/services/realtimeClient
 *   - page composition    src/features/<feature>
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<RouteFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="simulate"
            element={
              <Suspense fallback={<RouteFallback />}>
                <SimulatorPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
