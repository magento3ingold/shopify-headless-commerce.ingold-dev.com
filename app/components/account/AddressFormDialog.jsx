import {useEffect, useId, useRef} from 'react';
import {useFetcher} from 'react-router';
import {ACCOUNT_BUTTON} from '~/components/account/AccountLayout';

/**
 * Add / edit address form in a native modal <dialog> (focus trap, Escape to
 * close). Saves through the addresses route action (Customer Account API);
 * closes only after Shopify confirmed the change.
 * @param {{
 *   open: boolean;
 *   mode: 'create' | 'edit';
 *   address: AddressFragment | null;
 *   isDefault: boolean;
 *   countries: Array<{isoCode: string; name: string}>;
 *   onSaved: (message: string) => void;
 *   onClose: () => void;
 * }}
 */
export function AddressFormDialog({
  open,
  mode,
  address,
  isDefault,
  countries,
  onSaved,
  onClose,
}) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const fetcher = useFetcher();
  const ids = useId();
  const saving = fetcher.state !== 'idle';
  const result = fetcher.state === 'idle' ? fetcher.data : null;
  const fieldErrors = result?.ok === false ? (result.fieldErrors ?? {}) : {};

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close on confirmed success.
  useEffect(() => {
    if (result?.ok && open) {
      onSaved(result.message);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const field = (name, label, props = {}) => (
    <Field
      id={`${ids}-${name}`}
      name={name}
      label={label}
      defaultValue={address?.[name] ?? ''}
      error={fieldErrors[name]}
      {...props}
    />
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids}-title`}
      onClose={onClose}
      className="ui-scope m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] max-w-none overflow-y-auto rounded-card bg-white p-0 text-ink shadow-card backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <h2 id={`${ids}-title`} className="text-lg font-semibold text-ink">
          {mode === 'edit' ? 'Edit address' : 'Add new address'}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-ink"
        >
          &times;
        </button>
      </div>

      <fetcher.Form method="POST" className="space-y-4 px-5 py-6 md:px-8">
        <input
          type="hidden"
          name="intent"
          value={mode === 'edit' ? 'update' : 'create'}
        />
        {address ? (
          <input type="hidden" name="addressId" value={address.id} />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {field('firstName', 'First name', {
            required: true,
            autoComplete: 'given-name',
          })}
          {field('lastName', 'Last name', {
            required: true,
            autoComplete: 'family-name',
          })}
        </div>
        {field('company', 'Company', {autoComplete: 'organization'})}
        {field('address1', 'Address line 1', {
          required: true,
          autoComplete: 'address-line1',
        })}
        {field('address2', 'Address line 2', {autoComplete: 'address-line2'})}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('city', 'City', {
            required: true,
            autoComplete: 'address-level2',
          })}
          {field('zip', 'Postal / ZIP code', {autoComplete: 'postal-code'})}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${ids}-territoryCode`} required>
              Country
            </Label>
            <select
              id={`${ids}-territoryCode`}
              name="territoryCode"
              required
              defaultValue={address?.territoryCode ?? ''}
              autoComplete="country"
              aria-invalid={fieldErrors.territoryCode ? true : undefined}
              aria-describedby={
                fieldErrors.territoryCode
                  ? `${ids}-territoryCode-error`
                  : undefined
              }
              className={inputClass(fieldErrors.territoryCode)}
            >
              <option value="" disabled>
                Select a country
              </option>
              {countries.map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.name}
                </option>
              ))}
            </select>
            <FieldError
              id={`${ids}-territoryCode-error`}
              error={fieldErrors.territoryCode}
            />
          </div>
          {field('zoneCode', 'State / Province code', {
            autoComplete: 'address-level1',
            hint: 'Where required, e.g. CA or ON.',
          })}
        </div>
        {field('phoneNumber', 'Phone', {
          type: 'tel',
          autoComplete: 'tel',
          hint: 'International format, e.g. +4930123456.',
        })}

        {!isDefault ? (
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="defaultAddress"
              className="m-0 size-4 accent-ink"
            />
            Set as default address
          </label>
        ) : (
          <p className="text-sm text-muted">This is your default address.</p>
        )}

        {result?.ok === false ? (
          <p role="alert" className="text-sm text-sale">
            {result.error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={ACCOUNT_BUTTON.secondary}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={ACCOUNT_BUTTON.primary}
          >
            {saving ? 'Saving…' : 'Save Address'}
          </button>
        </div>
      </fetcher.Form>
    </dialog>
  );
}

/** @param {string | undefined} error */
function inputClass(error) {
  return `m-0 block w-full rounded-lg border bg-white px-4 py-2.5 text-base text-ink focus:border-ink focus:outline-none ${
    error ? 'border-sale' : 'border-line'
  }`;
}

/** @param {{htmlFor: string; required?: boolean; children: React.ReactNode}} */
function Label({htmlFor, required = false, children}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-semibold text-ink"
    >
      {children}
      {required ? (
        <>
          {' '}
          <span className="text-sale" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </label>
  );
}

/** @param {{id: string; error?: string}} */
function FieldError({id, error}) {
  return error ? (
    <p id={id} className="mt-1.5 text-sm text-sale">
      {error}
    </p>
  ) : null;
}

/**
 * @param {{
 *   id: string;
 *   name: string;
 *   label: string;
 *   defaultValue: string;
 *   error?: string;
 *   required?: boolean;
 *   type?: string;
 *   autoComplete?: string;
 *   hint?: string;
 * }}
 */
function Field({
  id,
  name,
  label,
  defaultValue,
  error,
  required = false,
  type = 'text',
  autoComplete,
  hint,
}) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        maxLength={255}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass(error)}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

/** @typedef {import('customer-accountapi.generated').AddressFragment} AddressFragment */
