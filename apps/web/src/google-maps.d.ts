declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: Record<string, unknown>);
    panTo(latLng: { lat: number; lng: number }): void;
    setZoom(zoom: number): void;
    getZoom(): number | undefined;
  }
  class Marker {
    constructor(opts?: Record<string, unknown>);
    setMap(map: Map | null): void;
    addListener(event: string, handler: () => void): void;
  }
  class InfoWindow {
    constructor(opts?: Record<string, unknown>);
    open(opts: { map: Map; anchor: Marker }): void;
  }
  enum SymbolPath {
    CIRCLE = 0,
    FORWARD_CLOSED_ARROW = 1,
  }
  type MapTypeStyle = Record<string, unknown>;
}

declare const google: {
  maps: typeof google.maps;
};
