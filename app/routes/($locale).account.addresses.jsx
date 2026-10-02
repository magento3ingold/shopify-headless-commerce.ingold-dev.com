import {useEffect, useRef, useState} from 'react';
import {data, useFetcher, useOutletContext, useLoaderData} from 'react-router';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';
import {
  ACCOUNT_BUTTON,
  AccountEmptyState,
  AccountPageHeader,
} from '~/components/account/AccountLayout';
import {AddressCard} from '~/components/account/AddressCard';
import {AddressFormDialog} from '~/components/account/AddressFormDialog';
import {ConfirmDialog} from '~/components/account/ConfirmDialog';
import {PlusIcon} from '~/components/Icons';
import {normalizePhone} from '~/lib/phone';
import {CUSTOMER_DEFAULT_ADDRESS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

/** CustomerAddressInput fields (Customer Account API). */
const ADDRESS_KEYS = [
  'firstName',
  'lastName',
  'company',
  'address1',
  'address2',
  'city',
  'zoneCode',
  'zip',
  'territoryCode',
  'phoneNumber',
];
const REQUIRED = ['firstName', 'lastName', 'address1', 'city', 'territoryCode'];
const MAX_LENGTH = 255;

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Addresses'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await context.customerAccount.handleAuthStatus();

  // Countries the store sells to, for the country selector.
  const {localization} = await context.storefront.query(COUNTRIES_QUERY, {
    cache: context.storefront.CacheLong(),
  });
  const countries = [...(localization?.availableCountries ?? [])]
    .map(({isoCode, name}) => ({isoCode, name}))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {countries};
}

/**
 * Address create / update / delete / set-default through the Customer
 * Account API. Returns `{ok, intent, message}` or `{ok: false, error,
 * fieldErrors}`.
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {customerAccount} = context;
  const fail = (error, status = 400, fieldErrors) =>
    data({ok: false, error, fieldErrors: fieldErrors ?? null}, {status});

  if (request.method !== 'POST') return fail('Method not allowed.', 405);
  // Never redirect a mutation to login.
  if (!(await customerAccount.isLoggedIn())) {
    return fail('Your session has expired. Please sign in again.', 401);
  }

  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  const addressId = form.get('addressId')
    ? String(form.get('addressId'))
    : null;
  const language = customerAccount.i18n.language;

  /** Runs a mutation and returns the payload or an error message. */
  const run = async (mutation, variables, key) => {
    const {data: result, errors} = await customerAccount.mutate(mutation, {
      variables: {...variables, language},
    });
    if (errors?.length) return {error: errors[0].message};
    const payload = result?.[key];
    if (payload?.userErrors?.length) {
      return {
        error: payload.userErrors.map((error) => error.message).join(' '),
      };
    }
    return {payload};
  };

  try {
    if (intent === 'delete' || intent === 'setDefault') {
      if (!addressId) return fail('Missing address.');
      if (intent === 'delete') {
        // Business rule, enforced here and not only in the UI: the default
        // address cannot be deleted. Default status comes from the signed-in
        // customer's data in Shopify, never from the browser.
        const {data: current, errors} = await customerAccount.query(
          CUSTOMER_DEFAULT_ADDRESS_QUERY,
          {variables: {language}},
        );
        if (errors?.length || !current?.customer) {
          return fail('The address could not be deleted. Please try again.');
        }
        if (current.customer.defaultAddress?.id === addressId) {
          return fail(
            'The default address cannot be deleted. Set another address as default first.',
            409,
          );
        }
        const {error, payload} = await run(
          DELETE_ADDRESS_MUTATION,
          {addressId},
          'customerAddressDelete',
        );
        if (error || !payload?.deletedAddressId) {
          return fail(error ?? 'The address could not be deleted.');
        }
        return {ok: true, intent, message: 'Address deleted.'};
      }
      // Only the default flag changes; the address itself is untouched.
      const {error, payload} = await run(
        UPDATE_ADDRESS_MUTATION,
        {addressId, defaultAddress: true},
        'customerAddressUpdate',
      );
      if (error || !payload?.customerAddress) {
        return fail(error ?? 'The default address could not be changed.');
      }
      return {ok: true, intent, message: 'Default address updated.'};
    }

    if (intent !== 'create' && intent !== 'update') {
      return fail('Unknown action.');
    }

    // Validate and collect the address.
    const address = {};
    const fieldErrors = {};
    for (const key of ADDRESS_KEYS) {
      const raw = form.get(key);
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length > MAX_LENGTH) fieldErrors[key] = 'This is too long.';
      if (REQUIRED.includes(key) && !value) {
        fieldErrors[key] = 'This field is required.';
      }
      address[key] = value;
    }
    if (address.territoryCode && !/^[A-Z]{2}$/.test(address.territoryCode)) {
      fieldErrors.territoryCode = 'Please choose a country.';
    }
    // Phone is optional; when given it is checked leniently and sent
    // without separators. Shopify remains the final validator.
    const phone = normalizePhone(address.phoneNumber);
    if (phone.ok) address.phoneNumber = phone.value;
    else fieldErrors.phoneNumber = phone.error;
    if (Object.keys(fieldErrors).length) {
      return fail('Please check the highlighted fields.', 400, fieldErrors);
    }
    const defaultAddress = form.get('defaultAddress') === 'on';

    if (intent === 'create') {
      const {error, payload} = await run(
        CREATE_ADDRESS_MUTATION,
        {address, defaultAddress},
        'customerAddressCreate',
      );
      if (error || !payload?.customerAddress) {
        return fail(error ?? 'The address could not be saved.');
      }
      return {ok: true, intent, message: 'Address added.'};
    }

    if (!addressId) return fail('Missing address.');
    const {error, payload} = await run(
      UPDATE_ADDRESS_MUTATION,
      // Only send the default flag when it should become the default.
      {address, addressId, ...(defaultAddress && {defaultAddress: true})},
      'customerAddressUpdate',
    );
    if (error || !payload?.customerAddress) {
      return fail(error ?? 'The address could not be saved.');
    }
    return {ok: true, intent, message: 'Address updated.'};
  } catch (error) {
    console.error('[account] address action failed', error);
    return fail('Something went wrong. Please try again.', 500);
  }
}

export default function Addresses() {
  const {customer} = useOutletContext();
  const {countries} = useLoaderData();
  const {defaultAddress, addresses} = customer;
  const list = addresses.nodes;

  /** @type {[null | {mode: 'create'} | {mode: 'edit'; address: AddressFragment}, Function]} */
  const [form, setForm] = useState(null);
  const [toDelete, setToDelete] = useState(
    /** @type {AddressFragment | null} */ (null),
  );
  const [notice, setNotice] = useState('');
  const addButton = useRef(/** @type {HTMLButtonElement | null} */ (null));

  const deleter = useFetcher();
  const defaulter = useFetcher();

  // Success feedback once Shopify confirmed the change (lists revalidate).
  useEffect(() => {
    if (deleter.state === 'idle' && deleter.data?.ok) {
      setNotice(deleter.data.message);
      setToDelete(null);
    }
  }, [deleter.state, deleter.data]);
  useEffect(() => {
    if (defaulter.state === 'idle' && defaulter.data?.ok) {
      setNotice(defaulter.data.message);
    }
  }, [defaulter.state, defaulter.data]);

  const addAction = (
    <button
      ref={addButton}
      type="button"
      onClick={() => setForm({mode: 'create'})}
      className={ACCOUNT_BUTTON.primary}
      aria-haspopup="dialog"
    >
      <PlusIcon className="size-4" />
      Add New Address
    </button>
  );

  const defaultError =
    defaulter.state === 'idle' && defaulter.data?.ok === false
      ? defaulter.data.error
      : null;

  return (
    <div>
      <AccountPageHeader
        title="Addresses"
        description="Saved addresses for faster checkout."
        action={list.length ? addAction : null}
      />

      <p role="status" aria-live="polite" className="empty:hidden">
        {notice ? (
          <span className="mb-5 block rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            {notice}
          </span>
        ) : null}
      </p>
      {defaultError ? (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-sale/30 bg-sale/10 px-4 py-3 text-sm text-sale"
        >
          {defaultError}
        </p>
      ) : null}

      {list.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {list.map((address) => {
            const isDefault = defaultAddress?.id === address.id;
            const settingThis =
              defaulter.state !== 'idle' &&
              defaulter.formData?.get('addressId') === address.id;
            return (
              <li key={address.id}>
                <AddressCard
                  address={address}
                  isDefault={isDefault}
                  onEdit={() => setForm({mode: 'edit', address})}
                  onDelete={() => setToDelete(address)}
                  onMakeDefault={() => {
                    setNotice('');
                    defaulter.submit(
                      {intent: 'setDefault', addressId: address.id},
                      {method: 'POST'},
                    );
                  }}
                  makingDefault={settingThis}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <AccountEmptyState
          title="No addresses saved"
          message="You haven't added an address yet."
          action={addAction}
        />
      )}

      <AddressFormDialog
        key={form?.mode === 'edit' ? form.address.id : 'create'}
        open={Boolean(form)}
        mode={form?.mode ?? 'create'}
        address={form?.mode === 'edit' ? form.address : null}
        isDefault={
          form?.mode === 'edit' && defaultAddress?.id === form.address.id
        }
        countries={countries}
        onSaved={(message) => setNotice(message)}
        onClose={() => {
          setForm(null);
          addButton.current?.focus();
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this address?"
        message={
          toDelete
            ? [toDelete.firstName, toDelete.lastName, toDelete.address1]
                .filter(Boolean)
                .join(', ')
            : ''
        }
        confirmLabel="Delete Address"
        busy={deleter.state !== 'idle'}
        error={
          deleter.state === 'idle' && deleter.data?.ok === false
            ? deleter.data.error
            : null
        }
        onConfirm={() => {
          setNotice('');
          deleter.submit(
            {intent: 'delete', addressId: toDelete.id},
            {method: 'POST'},
          );
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

const COUNTRIES_QUERY = `#graphql
  query AddressCountries($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    localization {
      availableCountries {
        isoCode
        name
      }
    }
  }
`;

/** @typedef {import('customer-accountapi.generated').AddressFragment} AddressFragment */
/** @typedef {import('./+types/account.addresses').Route} Route */
