import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "default" | "primary" | "ghost" | "danger";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: Variant;
  size?: "md" | "sm";
  block?: boolean;
  /** Renders as selected. Also sets aria-pressed so the state is announced. */
  active?: boolean;
  /** Shows a spinner, disables the button and announces the busy state. */
  busy?: boolean;
  children: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  default: "",
  primary: "btn--primary",
  ghost: "btn--ghost",
  danger: "btn--danger",
};

export function Button({
  variant = "default",
  size = "md",
  block = false,
  active = false,
  busy = false,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    VARIANT_CLASS[variant],
    size === "sm" ? "btn--sm" : "",
    block ? "btn--block" : "",
    active ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-pressed={active || undefined}
    >
      {busy ? <Spinner label={null} /> : null}
      {children}
    </button>
  );
}
