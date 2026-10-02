import {useEffect, useId, useRef} from 'react';
import {ACCOUNT_BUTTON} from '~/components/account/AccountLayout';

/**
 * Confirmation in a native modal <dialog> (focus trap, Escape cancels).
 * Focus starts on Cancel, the safe choice.
 * @param {{
 *   open: boolean;
 *   title: string;
 *   message?: string;
 *   confirmLabel: string;
 *   busy?: boolean;
 *   error?: string | null;
 *   onConfirm: () => void;
 *   onCancel: () => void;
 * }}
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const cancelRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={message ? `${id}-message` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="ui-scope m-auto w-[min(28rem,calc(100vw-2rem))] max-w-none rounded-card bg-white p-6 text-ink shadow-card backdrop:bg-black/50"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {message ? (
        <p id={`${id}-message`} className="mt-2 text-sm break-words text-muted">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-sale">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={ACCOUNT_BUTTON.secondary}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={ACCOUNT_BUTTON.danger}
        >
          {busy ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
