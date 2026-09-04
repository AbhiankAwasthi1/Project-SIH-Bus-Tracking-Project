import { request } from "./apiClient";
import type { Job } from "../types";

/**
 * Job endpoints -> services/api/app/routers/jobs.py
 *
 * Both routes read multipart form fields (`bus_id`, `city`, `video`, `gps`), so
 * the field names below are part of the backend contract. Uploads disable the
 * request timeout because the API stores the video and parses the GPS track
 * before it answers.
 */

export function startSampleRun(busId: string, city: string): Promise<Job> {
  const body = new FormData();
  body.set("bus_id", busId);
  body.set("city", city);
  return request<Job>("/jobs/sample", { method: "POST", body, timeoutMs: null });
}

export type AnalyzeRunInput = {
  video: File;
  /** Optional. When omitted the backend substitutes the city sample track. */
  gps?: File | null;
  busId: string;
  city: string;
};

export function startAnalyzeRun({ video, gps, busId, city }: AnalyzeRunInput): Promise<Job> {
  const body = new FormData();
  body.set("video", video);
  if (gps && gps.size) {
    body.set("gps", gps);
  }
  body.set("bus_id", busId);
  body.set("city", city);
  return request<Job>("/jobs/analyze", { method: "POST", body, timeoutMs: null });
}
