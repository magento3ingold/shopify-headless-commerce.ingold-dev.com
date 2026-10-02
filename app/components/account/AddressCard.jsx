import {ACCOUNT_BUTTON} from '~/components/account/AccountLayout';

/**
 * One saved address. Shopify's `formatted` lines are used for the body so
 * the layout follows each country's address format.
 * @param {{
 *   address: AddressFragment;
 *   isDefault: boolean;
 *   onEdit: () => void;
 *   onDelete: () => void;
 *   onMakeDefault: () => void;
 *   makingDefault?: boolean;
 * }}
 */
export function AddressCard({
  address,
  isDefault,
  onEdit,
  onDelete,
  onMakeDefault,
  makingDefault = false,
}) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(' ');
  const label = name || address.address1 || 'address';

  return (
    <article
      className={`flex h-full flex-col rounded-card border bg-white p-5 ${
        isDefault ? 'border-ink' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-semibold break-words text-ink">
          {name || 'Address'}
        </h3>
        {isDefault ? (
          <span className="shrink-0 rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-white">
            Default Address
          </span>
        ) : null}
      </div>
      <address className="mt-2 flex-1 text-sm leading-relaxed break-words text-muted not-italic">
        {address.company ? (
          <span className="block">{address.company}</span>
        ) : null}
        {(address.formatted ?? []).map((line, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={index} className="block">
            {line}
          </span>
        ))}
        {address.phoneNumber ? (
          <span className="mt-1 block">{address.phoneNumber}</span>
        ) : null}
      </address>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={onEdit}
          className={ACCOUNT_BUTTON.small}
          aria-label={`Edit ${label}`}
          aria-haspopup="dialog"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={ACCOUNT_BUTTON.small}
          aria-label={`Delete ${label}`}
          aria-haspopup="dialog"
        >
          Delete
        </button>
        {!isDefault ? (
          <button
            type="button"
            onClick={onMakeDefault}
            disabled={makingDefault}
            className={ACCOUNT_BUTTON.small}
            aria-label={`Make ${label} the default address`}
          >
            {makingDefault ? 'Saving…' : 'Make Default'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

/** @typedef {import('customer-accountapi.generated').AddressFragment} AddressFragment */
