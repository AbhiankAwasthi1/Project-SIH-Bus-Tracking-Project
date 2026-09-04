import { useConnectionStatus } from "../../state/FleetContext";
import type { RealtimeStatus } from "../../services/realtimeClient";

const LABEL: Record<RealtimeStatus, string> = {
  connecting: "Connecting",
  open: "Live",
  reconnecting: "Reconnecting",
  closed: "Offline",
};

const DESCRIPTION: Record<RealtimeStatus, string> = {
  connecting: "Opening the live incident feed",
  open: "Receiving live incident and fleet updates",
  reconnecting: "Live feed dropped, retrying",
  closed: "Live feed is offline. Reload to retry.",
};

/**
 * Makes feed health visible instead of leaving the operator to guess why the
 * map stopped moving. Reads its own context so incident traffic does not
 * re-render the whole top bar.
 */
export function ConnectionBadge() {
  const status = useConnectionStatus();
  return (
    <span
      className={`conn conn--${status}`}
      role="status"
      aria-live="polite"
      title={DESCRIPTION[status]}
    >
      <span className="conn__dot" aria-hidden="true" />
      {LABEL[status]}
      <span className="visually-hidden">. {DESCRIPTION[status]}</span>
    </span>
  );
}
