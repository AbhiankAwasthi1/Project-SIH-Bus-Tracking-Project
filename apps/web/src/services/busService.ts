import { request } from "./apiClient";
import type { Bus } from "../types";

/** GET /api/buses -> services/api/app/routers/buses.py:list_buses */
export function listBuses(): Promise<Bus[]> {
  return request<Bus[]>("/buses");
}
