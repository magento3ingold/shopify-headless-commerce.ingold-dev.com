/** Readable labels for Customer Account API order status enums. */
const LABELS = {
  // OrderFinancialStatus
  AUTHORIZED: 'Authorized',
  EXPIRED: 'Expired',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially paid',
  PARTIALLY_REFUNDED: 'Partially refunded',
  PENDING: 'Payment pending',
  REFUNDED: 'Refunded',
  VOIDED: 'Voided',
  // OrderFulfillmentStatus
  FULFILLED: 'Fulfilled',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  OPEN: 'Open',
  PARTIALLY_FULFILLED: 'Partially fulfilled',
  PENDING_FULFILLMENT: 'Pending fulfillment',
  READY_FOR_DELIVERY: 'Ready for delivery',
  READY_FOR_PICKUP: 'Ready for pickup',
  RESTOCKED: 'Restocked',
  SCHEDULED: 'Scheduled',
  UNFULFILLED: 'Unfulfilled',
};

const POSITIVE = new Set(['PAID', 'FULFILLED']);
const NEGATIVE = new Set(['EXPIRED', 'VOIDED', 'REFUNDED', 'RESTOCKED']);

/** @param {string | null | undefined} status */
export function orderStatusLabel(status) {
  if (!status) return null;
  return (
    LABELS[status] ??
    status
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^./, (c) => c.toUpperCase())
  );
}

/**
 * Status pill. The visible text is the status itself, so no extra ARIA
 * labelling is needed; `kind` gives assistive tech the context.
 * @param {{status?: string | null; kind: 'Payment' | 'Fulfillment' | 'Order'}}
 */
export function OrderStatusBadge({status, kind}) {
  const label = orderStatusLabel(status);
  if (!label) return null;
  const tone = POSITIVE.has(status)
    ? 'border-success/30 bg-success/10 text-success'
    : NEGATIVE.has(status)
      ? 'border-sale/30 bg-sale/10 text-sale'
      : 'border-line bg-surface text-ink';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      <span className="sr-only">{kind} status: </span>
      {label}
    </span>
  );
}

/** Fixed locale/time zone so server and client render the same date. */
const ORDER_DATE = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/** @param {string} value ISO date */
export function formatOrderDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : ORDER_DATE.format(date);
}
