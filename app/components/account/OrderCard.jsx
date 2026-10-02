import {Link} from 'react-router';
import {Money} from '@shopify/hydrogen';
import {useLocalePath} from '~/lib/i18n';
import {ACCOUNT_BUTTON} from '~/components/account/AccountLayout';
import {
  OrderStatusBadge,
  formatOrderDate,
} from '~/components/account/OrderStatus';

/**
 * One order in the account order list. Only fields from the Customer
 * Account API OrderItem fragment are shown.
 * @param {{order: OrderItemFragment}}
 */
export function OrderCard({order}) {
  const localePath = useLocalePath();
  const url = localePath(`/account/orders/${btoa(order.id)}`);
  return (
    <article className="rounded-card border border-line bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">
            Order #{order.number}
          </h3>
          <p className="mt-1 text-sm text-muted">
            <time dateTime={order.processedAt}>
              {formatOrderDate(order.processedAt)}
            </time>
          </p>
        </div>
        <p className="text-base font-semibold text-ink">
          <span className="sr-only">Total: </span>
          <Money as="span" data={order.totalPrice} />
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.financialStatus} kind="Payment" />
        <OrderStatusBadge status={order.fulfillmentStatus} kind="Fulfillment" />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {order.confirmationNumber ? (
          <p className="text-sm text-muted">
            Confirmation:{' '}
            <span className="font-medium text-ink">
              {order.confirmationNumber}
            </span>
          </p>
        ) : (
          <span />
        )}
        <Link
          to={url}
          prefetch="intent"
          className={ACCOUNT_BUTTON.small}
          aria-label={`View order #${order.number}`}
        >
          View Order
        </Link>
      </div>
    </article>
  );
}

/** @typedef {import('customer-accountapi.generated').OrderItemFragment} OrderItemFragment */
