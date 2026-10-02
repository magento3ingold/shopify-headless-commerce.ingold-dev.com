import {data as remixData, Outlet, useLoaderData} from 'react-router';
import {AccountLayout} from '~/components/account/AccountLayout';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

export function shouldRevalidate() {
  return true;
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountRoute() {
  /** @type {LoaderReturnData} */
  const {customer} = useLoaderData();

  return (
    <AccountLayout customer={customer}>
      <Outlet context={{customer}} />
    </AccountLayout>
  );
}

/** @typedef {import('./+types/account').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
