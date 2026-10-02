import {
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
  useSearchParams,
} from 'react-router';
import {useRef} from 'react';
import {getPaginationVariables} from '@shopify/hydrogen';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import {useLocalePath} from '~/lib/i18n';
import {
  ACCOUNT_BUTTON,
  AccountEmptyState,
  AccountPageHeader,
} from '~/components/account/AccountLayout';
import {OrderCard} from '~/components/account/OrderCard';

/** Orders per page (one Customer Account API request per page). */
const ORDERS_PER_PAGE = 10;

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Orders'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context}) {
  const {customerAccount} = context;
  // Reads `cursor` / `direction` from the URL (cursor pagination).
  const paginationVariables = getPaginationVariables(request, {
    pageBy: ORDERS_PER_PAGE,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);
  const page = Math.max(
    1,
    Math.trunc(Number(url.searchParams.get('page'))) || 1,
  );

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

  return {customer: data.customer, filters, page};
}

export default function Orders() {
  /** @type {LoaderReturnData} */
  const {customer, filters, page} = useLoaderData();
  const {orders} = customer;
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div>
      <AccountPageHeader
        title="Orders"
        description="Your order history, newest first."
      />
      <OrderSearchForm currentFilters={filters} />
      <div aria-live="polite">
        {orders?.nodes.length ? (
          <>
            <ul className="space-y-4">
              {orders.nodes.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} />
                </li>
              ))}
            </ul>
            <OrdersPagination pageInfo={orders.pageInfo} page={page} />
          </>
        ) : (
          <EmptyOrders hasFilters={hasFilters} />
        )}
      </div>
    </div>
  );
}

/**
 * Previous / Next over Shopify's cursors. The Customer Account API does not
 * return a total order count, so numbered pages cannot be offered; the
 * current page number is carried in the URL for orientation.
 * @param {{
 *   pageInfo: CustomerOrdersFragment['orders']['pageInfo'];
 *   page: number;
 * }}
 */
function OrdersPagination({pageInfo, page}) {
  const location = useLocation();
  const navigation = useNavigation();
  const loading =
    navigation.state === 'loading' &&
    navigation.location?.pathname === location.pathname;

  if (!pageInfo.hasPreviousPage && !pageInfo.hasNextPage) return null;

  const linkTo = (direction) => {
    const params = new URLSearchParams(location.search);
    params.set('direction', direction);
    params.set(
      'cursor',
      direction === 'next' ? pageInfo.endCursor : pageInfo.startCursor,
    );
    const nextPage = direction === 'next' ? page + 1 : page - 1;
    if (nextPage > 1) params.set('page', String(nextPage));
    else params.delete('page');
    // Back on page 1: drop the cursor entirely.
    if (direction === 'previous' && nextPage <= 1) {
      params.delete('cursor');
      params.delete('direction');
    }
    const search = params.toString();
    return {pathname: location.pathname, search: search ? `?${search}` : ''};
  };

  return (
    <nav
      aria-label="Orders pagination"
      className="mt-8 flex items-center justify-between gap-4"
      aria-busy={loading}
    >
      {pageInfo.hasPreviousPage ? (
        <Link
          to={linkTo('previous')}
          preventScrollReset={false}
          className={ACCOUNT_BUTTON.secondary}
          rel="prev"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted" aria-current="page">
        Page {page}
      </p>
      {pageInfo.hasNextPage ? (
        <Link
          to={linkTo('next')}
          className={ACCOUNT_BUTTON.secondary}
          rel="next"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** @param {{hasFilters?: boolean}} */
function EmptyOrders({hasFilters = false}) {
  const localePath = useLocalePath();
  return hasFilters ? (
    <AccountEmptyState
      title="No matching orders"
      message="No orders match your search."
      action={
        <Link
          to={localePath('/account/orders')}
          className={ACCOUNT_BUTTON.secondary}
        >
          Clear search
        </Link>
      }
    />
  ) : (
    <AccountEmptyState
      title="No orders yet"
      message="You haven't placed any orders yet."
      action={
        <Link
          to={localePath('/collections/all')}
          className={ACCOUNT_BUTTON.primary}
        >
          Continue Shopping
        </Link>
      }
    />
  );
}

/**
 * @param {{
 *   currentFilters: OrderFilterParams;
 * }}
 */
function OrderSearchForm({currentFilters}) {
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
    const confirmationNumber = formData
      .get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)
      ?.toString()
      .trim();

    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
    if (confirmationNumber)
      params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);

    // A new search starts again at page 1.
    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;
  const inputClass =
    'm-0 w-full min-w-0 rounded-lg border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-ink focus:outline-none';

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="mb-6"
      aria-label="Search orders"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">
            Order number
          </span>
          <input
            type="search"
            name={ORDER_FILTER_FIELDS.NAME}
            placeholder="e.g. 1001"
            defaultValue={currentFilters.name || ''}
            className={inputClass}
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">
            Confirmation number
          </span>
          <input
            type="search"
            name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            placeholder="e.g. RD88M2ZRQ"
            defaultValue={currentFilters.confirmationNumber || ''}
            className={inputClass}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSearching}
            className={ACCOUNT_BUTTON.secondary}
          >
            {isSearching ? 'Searching…' : 'Search'}
          </button>
          {hasFilters ? (
            <button
              type="button"
              disabled={isSearching}
              className={ACCOUNT_BUTTON.secondary}
              onClick={() => {
                setSearchParams(new URLSearchParams());
                formRef.current?.reset();
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** @typedef {import('./+types/account.orders._index').Route} Route */
/** @typedef {import('~/lib/orderFilters').OrderFilterParams} OrderFilterParams */
/** @typedef {import('customer-accountapi.generated').CustomerOrdersFragment} CustomerOrdersFragment */
/** @typedef {import('customer-accountapi.generated').OrderItemFragment} OrderItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
