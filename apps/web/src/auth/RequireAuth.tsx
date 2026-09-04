import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Route guard for the authenticated area.
 *
 * This is a UX constraint, not access control. The backend is the only thing
 * that can actually authorise a request; every protected endpoint already
 * requires a valid bearer token via services/api/app/auth.py:current_user.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Remember where the operator was headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
