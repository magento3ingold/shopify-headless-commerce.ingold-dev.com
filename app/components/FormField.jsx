import {useId} from 'react';

export const INPUT_CLASSES =
  'm-0 block w-full rounded-lg border bg-white px-4 py-3 text-base text-ink placeholder:text-muted/70 transition-colors duration-200 focus:border-ink';

/**
 * Labelled input or textarea with an associated error message.
 * @param {{
 *   label: string;
 *   name: string;
 *   error?: string;
 *   hint?: string;
 *   optional?: boolean;
 *   multiline?: boolean;
 * } & React.InputHTMLAttributes<HTMLInputElement> &
 *   React.TextareaHTMLAttributes<HTMLTextAreaElement>}
 */
export function FormField({
  label,
  name,
  error,
  hint,
  optional = false,
  multiline = false,
  className = '',
  ...inputProps
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  const Control = multiline ? 'textarea' : 'input';

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        {label}
        {/* Visual cue only: `required` on the control already tells
            assistive technology the field is required. */}
        {inputProps.required ? (
          <span aria-hidden="true" className="ml-0.5 text-sale">
            *
          </span>
        ) : null}
        {optional ? (
          <>
            {' '}
            <span className="font-normal text-muted">(optional)</span>
          </>
        ) : null}
      </label>
      <Control
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT_CLASSES} ${
          error ? 'border-sale' : 'border-line hover:border-muted'
        } ${multiline ? 'min-h-40 resize-y' : ''}`}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-sale">
          {error}
        </p>
      ) : null}
    </div>
  );
}
