import { request } from "./apiClient";
import type { Session } from "../types";

/**
 * POST /api/auth/login -> services/api/app/routers/auth.py:login
 * Response body is LoginResponse { token, email, role }, which is the Session shape.
 *
 * `reportUnauthorized: false` matters: a 401 here means "wrong credentials", not
 * "your session expired", so it must not trigger the global sign-out handler.
 */
export function login(email: string, password: string): Promise<Session> {
  return request<Session>("/auth/login", {
    method: "POST",
    json: { email, password },
    auth: false,
    reportUnauthorized: false,
  });
}
