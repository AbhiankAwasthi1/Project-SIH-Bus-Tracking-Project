const CALLBACK = "__drishtiGoogleMapsReady";

export function googleMapsKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || "";
}

export function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (typeof google !== "undefined" && google.maps) {
    return Promise.resolve(google.maps);
  }

  const existing = document.querySelector<HTMLScriptElement>("script[data-drishti-gmaps]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(google.maps));
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
    });
  }

  return new Promise((resolve, reject) => {
    const previous = (window as unknown as Record<string, unknown>)[CALLBACK];
    (window as unknown as Record<string, () => void>)[CALLBACK] = () => {
      if (typeof previous === "function") previous();
      resolve(google.maps);
    };
    const script = document.createElement("script");
    script.dataset.drishtiGmaps = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&callback=${CALLBACK}`;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

