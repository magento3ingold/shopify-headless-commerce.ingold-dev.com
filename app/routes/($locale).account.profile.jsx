import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  ACCOUNT_BUTTON,
  AccountPageHeader,
} from '~/components/account/AccountLayout';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Profile'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await context.customerAccount.handleAuthStatus();

  return {};
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {customerAccount} = context;

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const form = await request.formData();

  try {
    const customer = {};
    const validInputKeys = ['firstName', 'lastName'];
    for (const [key, value] of form.entries()) {
      if (!validInputKeys.includes(key)) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        customer[key] = value;
      }
    }

    // update customer and possibly password
    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer,
          language: customerAccount.i18n.language,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    if (data?.customerUpdate?.userErrors?.length) {
      throw new Error(
        data.customerUpdate.userErrors.map((error) => error.message).join(' '),
      );
    }

    if (!data?.customerUpdate?.customer) {
      throw new Error('Customer profile update failed.');
    }

    return {
      error: null,
      customer: data?.customerUpdate?.customer,
    };
  } catch (error) {
    return data(
      {error: error.message, customer: null},
      {
        status: 400,
      },
    );
  }
}

export default function AccountProfile() {
  const account = useOutletContext();
  const {state} = useNavigation();
  /** @type {ActionReturnData} */
  const action = useActionData();
  const customer = action?.customer ?? account?.customer;
  const email =
    account?.customer?.emailAddress?.emailAddress ??
    customer?.emailAddress?.emailAddress;
  const saving = state !== 'idle';

  return (
    <div>
      <AccountPageHeader
        title="Profile"
        description="Your personal information."
      />
      <Form method="PUT" className="max-w-xl space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            id="firstName"
            label="First name"
            autoComplete="given-name"
            defaultValue={customer?.firstName ?? ''}
          />
          <ProfileField
            id="lastName"
            label="Last name"
            autoComplete="family-name"
            defaultValue={customer?.lastName ?? ''}
          />
        </div>
        <div>
          <p className="mb-1.5 block text-sm font-semibold text-ink">Email</p>
          <p className="rounded-lg border border-line bg-surface px-4 py-2.5 text-base break-all text-ink">
            {email || '—'}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            Your sign-in email is managed by your Shopify customer account and
            can&apos;t be changed here.
          </p>
        </div>

        {action?.error ? (
          <p role="alert" className="text-sm text-sale">
            {action.error}
          </p>
        ) : action?.customer && !saving ? (
          <p role="status" className="text-sm text-success">
            Your profile was updated.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className={ACCOUNT_BUTTON.primary}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </Form>
    </div>
  );
}

/**
 * @param {{id: string; label: string; autoComplete: string; defaultValue: string}}
 */
function ProfileField({id, label, autoComplete, defaultValue}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-ink"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        minLength={2}
        maxLength={255}
        className="m-0 block w-full rounded-lg border border-line bg-white px-4 py-2.5 text-base text-ink focus:border-ink focus:outline-none"
      />
    </div>
  );
}

/**
 * @typedef {{
 *   error: string | null;
 *   customer: CustomerFragment | null;
 * }} ActionResponse
 */

/** @typedef {import('customer-accountapi.generated').CustomerFragment} CustomerFragment */
/** @typedef {import('@shopify/hydrogen/customer-account-api-types').CustomerUpdateInput} CustomerUpdateInput */
/** @typedef {import('./+types/account.profile').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
