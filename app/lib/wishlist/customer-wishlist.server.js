/**
 * Server-only persistence of the signed-in customer's wishlist in the
 * customer metafield `custom.wishlist` (type `json`), via the Customer
 * Account API of the current session.
 *
 * - The owner is always the authenticated customer from the session; no
 *   customer ID is ever accepted from the browser.
 * - Writes are compare-and-set (`compareDigest`): the latest value is read,
 *   the operation applied, and the write retried on a digest conflict, so
 *   concurrent updates from several tabs/devices are not lost.
 * - Every GraphQL error and `userErrors` entry is logged and surfaced.
 */
import {sanitizeWishlist, MAX_WISHLIST_ITEMS} from './storage.js';
import {
  CUSTOMER_WISHLIST_QUERY,
  CUSTOMER_WISHLIST_SET_MUTATION,
} from '../../graphql/customer-account/CustomerWishlist.js';

export const WISHLIST_METAFIELD = /** @type {const} */ ({
  namespace: 'custom',
  key: 'wishlist',
  type: 'json',
});

const MAX_WRITE_ATTEMPTS = 3;
const CONFLICT_CODES = new Set(['INVALID_COMPARE_DIGEST', 'STALE_OBJECT']);

export class CustomerWishlistError extends Error {
  name = 'CustomerWishlistError';
  /**
   * @param {string} message
   * @param {{code: string; status?: number}} details
   */
  constructor(message, {code, status = 502}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Reads the current wishlist.
 * @param {CustomerAccount} customerAccount
 * @return {Promise<{customerId: string; items: WishlistItem[]; compareDigest: string | null}>}
 */
export async function readCustomerWishlist(customerAccount) {
  const {data, errors} = await customerAccount.query(CUSTOMER_WISHLIST_QUERY);
  if (errors?.length) {
    throw new CustomerWishlistError(
      `Customer Account API query failed: ${errors.map((e) => e.message).join('; ')}`,
      {code: 'QUERY_FAILED'},
    );
  }
  const customer = data?.customer;
  if (!customer?.id) {
    throw new CustomerWishlistError('No authenticated customer returned', {
      code: 'NO_CUSTOMER',
      status: 401,
    });
  }

  return {
    customerId: customer.id,
    items: parseWishlistMetafield(customer.wishlist),
    compareDigest: customer.wishlist?.compareDigest ?? null,
  };
}

/**
 * Applies an operation to the latest stored wishlist and persists it with
 * compare-and-set, retrying on concurrent-write conflicts.
 * @param {CustomerAccount} customerAccount
 * @param {WishlistOperation} operation
 * @return {Promise<WishlistItem[]>} the wishlist as stored in Shopify
 */
export async function updateCustomerWishlist(customerAccount, operation) {
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const current = await readCustomerWishlist(customerAccount);
    const next = applyOperation(current.items, operation);
    if (sameItems(current.items, next)) return current.items;

    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_WISHLIST_SET_MUTATION,
      {
        variables: {
          metafields: [
            {
              ownerId: current.customerId,
              ...WISHLIST_METAFIELD,
              value: JSON.stringify(next),
              // null = only create if it does not exist yet.
              compareDigest: current.compareDigest,
            },
          ],
        },
      },
    );

    if (errors?.length) {
      throw new CustomerWishlistError(
        `metafieldsSet request failed: ${errors.map((e) => e.message).join('; ')}`,
        {code: 'MUTATION_FAILED'},
      );
    }

    const userErrors = data?.metafieldsSet?.userErrors ?? [];
    if (!userErrors.length) {
      const saved = data?.metafieldsSet?.metafields?.[0];
      return saved ? parseJson(saved.value) : next;
    }

    if (
      userErrors.every((error) => CONFLICT_CODES.has(error.code)) &&
      attempt < MAX_WRITE_ATTEMPTS
    ) {
      // Someone else wrote in between: re-read and re-apply.
      continue;
    }

    const [first] = userErrors;
    throw new CustomerWishlistError(
      `metafieldsSet rejected the wishlist: ${userErrors
        .map(
          (error) =>
            `${error.code ?? 'ERROR'} ${error.message} [${(error.field ?? []).join('.')}]`,
        )
        .join('; ')}`,
      {
        code: first?.code ?? 'USER_ERROR',
        status: first?.code === 'APP_NOT_AUTHORIZED' ? 403 : 502,
      },
    );
  }

  throw new CustomerWishlistError('Wishlist changed concurrently too often', {
    code: 'CONFLICT',
    status: 409,
  });
}

/**
 * @param {WishlistItem[]} items
 * @param {WishlistOperation} operation
 * @return {WishlistItem[]}
 */
export function applyOperation(items, operation) {
  switch (operation.type) {
    case 'add': {
      const [item] = sanitizeWishlist([operation.item]);
      if (!item || items.some((i) => i.productId === item.productId)) {
        return items;
      }
      return [item, ...items].slice(0, MAX_WISHLIST_ITEMS);
    }
    case 'remove': {
      const drop = new Set(operation.productIds);
      return items.filter((item) => !drop.has(item.productId));
    }
    case 'merge': {
      // Customer's saved items first, then guest items not already saved.
      return sanitizeWishlist([...items, ...operation.items]);
    }
    case 'clear':
      return [];
    default:
      return items;
  }
}

/**
 * Safe read of the json metafield. Missing or empty -> []. Invalid data ->
 * [] with a warning (never throws).
 * @param {{jsonValue?: unknown; value?: string} | null | undefined} metafield
 * @return {WishlistItem[]}
 */
export function parseWishlistMetafield(metafield) {
  if (!metafield) return [];
  if (Array.isArray(metafield.jsonValue)) {
    return sanitizeWishlist(metafield.jsonValue);
  }
  return parseJson(metafield.value);
}

/** @param {string | null | undefined} value */
function parseJson(value) {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      console.warn('[wishlist] custom.wishlist is not a JSON array; ignoring');
      return [];
    }
    return sanitizeWishlist(parsed);
  } catch {
    console.warn('[wishlist] custom.wishlist contains invalid JSON; ignoring');
    return [];
  }
}

/**
 * @param {WishlistItem[]} a
 * @param {WishlistItem[]} b
 */
function sameItems(a, b) {
  return (
    a.length === b.length &&
    a.every((item, index) => item.productId === b[index].productId)
  );
}

/** @typedef {import('./storage.js').WishlistItem} WishlistItem */
/** @typedef {import('@shopify/hydrogen').CustomerAccount} CustomerAccount */
/**
 * @typedef {(
 *   | {type: 'add'; item: WishlistItem}
 *   | {type: 'remove'; productIds: string[]}
 *   | {type: 'merge'; items: WishlistItem[]}
 *   | {type: 'clear'}
 * )} WishlistOperation
 */
