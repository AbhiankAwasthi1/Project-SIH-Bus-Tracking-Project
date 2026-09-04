/**
 * WebSocket transport for the live feed.
 *
 * Endpoint: WS /api/ws -> services/api/app/main.py:websocket_feed
 * Producers: services/api/app/pipeline.py and routers/incidents.py via
 *            services/api/app/ws.py Hub.broadcast
 *
 * The server never expects a client-initiated frame, so this module only ever
 * reads. No heartbeat or client message is sent, which keeps the wire protocol
 * exactly as the backend defines it.
 */

/** A decoded frame. Shape is narrowed by the consumer, not here. */
export type RealtimeEnvelope = Record<string, unknown>;

export type RealtimeStatus = "connecting" | "open" | "reconnecting" | "closed";

function realtimeUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/api/ws`;
}

/**
 * Low-level primitive kept for compatibility with the original `openFeed`
 * export in src/api.ts. Prefer `connectRealtime`, which adds status reporting
 * and reconnection.
 */
export function openFeed(onMessage: (data: RealtimeEnvelope) => void): WebSocket {
  const socket = new WebSocket(realtimeUrl());
  socket.onmessage = (event) => {
    const decoded = decode(event.data);
    if (decoded) {
      onMessage(decoded);
    }
  };
  return socket;
}

function decode(raw: unknown): RealtimeEnvelope | null {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as RealtimeEnvelope;
    }
  } catch {
    /* Ignore frames we cannot decode rather than tearing down the feed. */
  }
  return null;
}

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

export type ConnectRealtimeOptions = {
  onMessage: (data: RealtimeEnvelope) => void;
  onStatusChange?: (status: RealtimeStatus) => void;
};

/**
 * Opens the feed and keeps it open across transient drops.
 * Returns a disposer; calling it stops all reconnection attempts.
 */
export function connectRealtime({ onMessage, onStatusChange }: ConnectRealtimeOptions): () => void {
  let disposed = false;
  let attempt = 0;
  let socket: WebSocket | null = null;
  let retryTimer: number | null = null;

  const report = (status: RealtimeStatus) => {
    if (!disposed) {
      onStatusChange?.(status);
    }
  };

  const clearRetry = () => {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleRetry = () => {
    if (disposed || retryTimer !== null) {
      return;
    }
    if (attempt >= BACKOFF_MS.length) {
      report("closed");
      return;
    }
    const delay = BACKOFF_MS[attempt];
    attempt += 1;
    report("reconnecting");
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      open();
    }, delay);
  };

  function open(): void {
    if (disposed) {
      return;
    }
    report(attempt === 0 ? "connecting" : "reconnecting");

    let current: WebSocket;
    try {
      current = new WebSocket(realtimeUrl());
    } catch {
      scheduleRetry();
      return;
    }
    socket = current;

    current.onopen = () => {
      if (disposed) {
        return;
      }
      attempt = 0;
      report("open");
    };

    current.onmessage = (event) => {
      if (disposed) {
        return;
      }
      const decoded = decode(event.data);
      if (decoded) {
        onMessage(decoded);
      }
    };

    current.onclose = () => {
      if (disposed || socket !== current) {
        return;
      }
      socket = null;
      scheduleRetry();
    };

    // `error` is always followed by `close`, so reconnection is handled there.
    current.onerror = () => undefined;
  }

  // Coming back online is a strong signal to retry immediately.
  const handleOnline = () => {
    if (disposed || socket) {
      return;
    }
    clearRetry();
    attempt = 0;
    open();
  };
  window.addEventListener("online", handleOnline);

  open();

  return () => {
    disposed = true;
    clearRetry();
    window.removeEventListener("online", handleOnline);
    if (socket) {
      const closing = socket;
      socket = null;
      closing.onopen = null;
      closing.onmessage = null;
      closing.onclose = null;
      closing.onerror = null;
      closing.close();
    }
  };
}
