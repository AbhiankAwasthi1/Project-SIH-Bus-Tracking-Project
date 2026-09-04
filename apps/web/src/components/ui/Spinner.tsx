export type SpinnerProps = {
  size?: "md" | "lg";
  /** Accessible text. Pass null when a sibling already describes the wait. */
  label?: string | null;
};

export function Spinner({ size = "md", label = "Loading" }: SpinnerProps) {
  return (
    <>
      <span className={size === "lg" ? "spinner spinner--lg" : "spinner"} aria-hidden="true" />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </>
  );
}
