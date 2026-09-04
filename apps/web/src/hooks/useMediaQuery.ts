import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query so layout decisions that cannot be expressed
 * in CSS alone (for example which pane is mounted) stay in sync with the
 * breakpoints defined in src/styles/layout.css.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", handler);
    return () => list.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Matches the mobile breakpoint in src/styles/layout.css. */
export const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
