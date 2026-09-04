import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type FieldFrameProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
};

/**
 * Shared label/hint/error scaffolding. Every control gets a real <label
 * htmlFor>, and hints and errors are wired up with aria-describedby by the
 * concrete field components below.
 */
function FieldFrame({ id, label, hint, error, children }: FieldFrameProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: ReactNode): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export type SelectOption<T extends string> = { value: T; label: string };

export type SelectFieldProps<T extends string> = {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onValueChange: (value: T) => void;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  /** Hides the visible label while keeping it available to assistive tech. */
  labelHidden?: boolean;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onValueChange,
  hint,
  error,
  disabled,
  labelHidden = false,
}: SelectFieldProps<T>) {
  const id = useId();

  const select = (
    <select
      id={id}
      className="control"
      value={value}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      // The option values are constrained to T by the `options` prop.
      onChange={(event) => onValueChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (labelHidden) {
    return (
      <div className="field">
        <label className="visually-hidden" htmlFor={id}>
          {label}
        </label>
        {select}
      </div>
    );
  }

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      {select}
    </FieldFrame>
  );
}

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "value" | "onChange"
> & {
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  hint?: ReactNode;
  error?: ReactNode;
};

export function TextField({
  label,
  value,
  onValueChange,
  hint,
  error,
  type = "text",
  ...rest
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <input
        {...rest}
        id={id}
        type={type}
        className="control"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </FieldFrame>
  );
}

export type FilePickerProps = {
  label: ReactNode;
  name: string;
  accept?: string;
  /** Text shown when nothing is selected. */
  placeholder: string;
  fileName: string;
  onFileChange: (file: File | null) => void;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
};

/**
 * A styled file input that keeps the native <input type="file"> as the real,
 * focusable control rather than replacing it with a button and a hidden input.
 */
export function FilePicker({
  label,
  name,
  accept,
  placeholder,
  fileName,
  onFileChange,
  hint,
  error,
  disabled,
}: FilePickerProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <span className="filepick">
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
        <span className="filepick__btn" aria-hidden="true">
          Choose file
        </span>
        <span className="filepick__name">{fileName || placeholder}</span>
      </span>
    </FieldFrame>
  );
}
