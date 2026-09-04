import type { ReactNode } from "react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

export type CalloutTone = "error" | "warning" | "info";

export type CalloutProps = {
  tone: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
};

/**
 * Inline message for a recoverable problem. Errors use role="alert" so they are
 * announced; informational messages use role="status" to avoid interrupting.
 */
export function Callout({
  tone,
  title,
  children,
  onRetry,
  retryLabel = "Try again",
  onDismiss,
}: CalloutProps) {
  return (
    <div className={`callout callout--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {title ? <span className="callout__title">{title}</span> : null}
      <span>{children}</span>
      {onRetry || onDismiss ? (
        <span className="callout__actions">
          {onRetry ? (
            <Button size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {onDismiss ? (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export type StateViewProps = {
  title: ReactNode;
  children?: ReactNode;
  inline?: boolean;
};

/** Neutral placeholder used for empty results and idle panels. */
export function EmptyState({ title, children, inline = false }: StateViewProps) {
  return (
    <div className={inline ? "state state--inline" : "state"}>
      <span className="state__title">{title}</span>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

export function LoadingState({ title = "Loading", inline = false }: Partial<StateViewProps>) {
  return (
    <div className={inline ? "state state--inline" : "state"} role="status" aria-live="polite">
      <Spinner size="lg" label={null} />
      <span className="state__title">{title}</span>
    </div>
  );
}

export type ErrorStateProps = {
  title?: ReactNode;
  message: ReactNode;
  onRetry?: () => void;
};

export function ErrorState({ title = "Could not load this view", message, onRetry }: ErrorStateProps) {
  return (
    <div className="state" role="alert">
      <span className="state__title">{title}</span>
      <span>{message}</span>
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}
