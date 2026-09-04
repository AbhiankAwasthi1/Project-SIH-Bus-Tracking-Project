/**
 * Evidence image URLs come from the API (`evidence_url` in
 * services/api/app/serialize.py, shaped as `/uploads/<file>`).
 *
 * The value is server-controlled rather than user-controlled today, but it is
 * still rendered straight into a DOM attribute, so it is validated here instead
 * of trusted. Only a same-origin absolute path or an http(s) URL is allowed;
 * anything else, including `javascript:` and `data:`, is rejected.
 */
export function safeMediaUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }

  // Same-origin absolute path. Reject "//host" which is protocol-relative.
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
