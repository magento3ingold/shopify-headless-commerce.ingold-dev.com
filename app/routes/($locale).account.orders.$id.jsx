import {Link, redirect, useLoaderData} from 'react-router';
import {Money, Image} from '@shopify/hydrogen';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {useLocalePath} from '~/lib/i18n';
import {ACCOUNT_BUTTON} from '~/components/account/AccountLayout';
import {
  OrderStatusBadge,
  formatOrderDate,
} from '~/components/account/OrderStatus';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  const {customerAccount} = context;
  if (!params.id) {
    return redirect('/account/orders');
  }

  let orderId;
  try {
    orderId = atob(params.id);
  } catch {
    throw new Response('Order not found', {status: 404});
  }
  const {data, errors} = await customerAccount.query(CUSTOMER_ORDER_QUERY, {
    variables: {
      orderId,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  return {order: data.order};
}

export default function OrderRoute() {
  /** @type {LoaderReturnData} */
  const {order} = useLoaderData();
  const localePath = useLocalePath();
  const lineItems = order.lineItems.nodes;
  const totalDiscounts = order.discountInformation?.totalDiscounts;
  const hasDiscount = Number(totalDiscounts?.amount ?? 0) > 0;

  return (
    <div>
      <Link
        to={localePath('/account/orders')}
        className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-ink no-underline hover:underline"
      >
        ← Back to Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h2 className="text-xl font-semibold text-ink md:text-2xl">
            Order {order.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Placed on{' '}
            <time dateTime={order.processedAt}>
              {formatOrderDate(order.processedAt)}
            </time>
            {order.confirmationNumber ? (
              <> · Confirmation {order.confirmationNumber}</>
            ) : null}
          </p>
          {order.cancelledAt ? (
            <p className="mt-1 text-sm font-medium text-sale">
              Cancelled on {formatOrderDate(order.cancelledAt)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={order.financialStatus} kind="Payment" />
          <OrderStatusBadge
            status={order.fulfillmentStatus}
            kind="Fulfillment"
          />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="order-items-heading" className="min-w-0">
          <h3 id="order-items-heading" className="sr-only">
            Items
          </h3>
          <ul className="divide-y divide-line rounded-card border border-line">
            {lineItems.map((lineItem) => (
              <li key={lineItem.id} className="p-4 md:p-5">
                <OrderLine lineItem={lineItem} />
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-2 rounded-card border border-line p-5 text-sm">
            <SummaryRow label="Subtotal" money={order.subtotal} />
            {hasDiscount ? (
              <SummaryRow label="Discounts" money={totalDiscounts} negative />
            ) : null}
            <SummaryRow label="Shipping" money={order.totalShipping} />
            <SummaryRow label="Tax" money={order.totalTax} />
            <div className="flex items-center justify-between border-t border-line pt-3 text-base font-semibold text-ink">
              <dt>Total</dt>
              <dd className="m-0">
                <Money data={order.totalPrice} />
              </dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <AddressBlock
            title="Shipping address"
            address={order.shippingAddress}
            empty="No shipping address for this order."
          />
          <AddressBlock
            title="Billing address"
            address={order.billingAddress}
            empty="No billing address for this order."
          />
          {order.statusPageUrl ? (
            <a
              href={order.statusPageUrl}
              target="_blank"
              rel="noreferrer"
              className={`${ACCOUNT_BUTTON.secondary} w-full`}
            >
              View order status
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** @param {{lineItem: OrderLineItemFullFragment}} */
function OrderLine({lineItem}) {
  const options = (lineItem.variantOptions ?? []).filter(
    (option) => option.value && option.value !== 'Default Title',
  );
  const variant = options.length
    ? options.map((option) => `${option.name}: ${option.value}`).join(' · ')
    : lineItem.variantTitle;

  return (
    <div className="flex gap-4">
      <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-surface">
        {lineItem.image ? (
          <Image
            data={lineItem.image}
            alt={lineItem.image.altText || lineItem.title}
            width={80}
            height={80}
            sizes="80px"
            className="size-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="font-medium break-words text-ink">{lineItem.title}</p>
          {variant && variant !== 'Default Title' ? (
            <p className="text-sm text-muted">{variant}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted">
            Qty {lineItem.quantity}
            {lineItem.price ? (
              <>
                {' '}
                × <Money as="span" data={lineItem.price} />
              </>
            ) : null}
          </p>
        </div>
        {lineItem.totalPrice ? (
          <p className="font-semibold text-ink sm:text-right">
            <span className="sr-only">Line total: </span>
            <Money as="span" data={lineItem.totalPrice} />
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {{label: string; money?: {amount: string; currencyCode: string} | null; negative?: boolean}}
 */
function SummaryRow({label, money, negative = false}) {
  if (!money) return null;
  return (
    <div className="flex items-center justify-between text-ink">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0">
        {negative ? '−' : null}
        <Money as="span" data={money} />
      </dd>
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   address?: {formatted?: string[] | null} | null;
 *   empty: string;
 * }}
 */
function AddressBlock({title, address, empty}) {
  return (
    <section className="rounded-card border border-line p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {address?.formatted?.length ? (
        <address className="mt-2 text-sm leading-relaxed text-muted not-italic">
          {address.formatted.map((line, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={index} className="block">
              {line}
            </span>
          ))}
        </address>
      ) : (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

/** @typedef {import('./+types/account.orders.$id').Route} Route */
/** @typedef {import('customer-accountapi.generated').OrderLineItemFullFragment} OrderLineItemFullFragment */
/** @typedef {import('customer-accountapi.generated').OrderQuery} OrderQuery */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
