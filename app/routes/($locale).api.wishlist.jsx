import {data} from 'react-router';
import {sanitizeWishlist} from '~/lib/wishlist/storage';
import {
  CustomerWishlistError,
  readCustomerWishlist,
  updateCustomerWishlist,
} from '~/lib/wishlist/customer-wishlist.server';
import {isSameOrigin} from '~/lib/request.server';

/**
 * Signed-in customer wishlist API (no UI).
 *
 * GET  -> {ok, authenticated, items}
 * POST -> JSON body: {type: 'add', item} | {type: 'remove', productIds}
 *         | {type: 'merge', items} | {type: 'clear'}
 *         -> {ok, items} with the wishlist as stored in Shopify
 *
 * The customer is always the one of the current session; responses are
 * never cached and never contain tokens or other customer data.
 */
const NO_STORE = {'Cache-Control': 'private, no-store'};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  if (!(await context.customerAccount.isLoggedIn())) {
    return data(
      {ok: false, authenticated: false, items: []},
      {status: 401, headers: NO_STORE},
    );
  }

  try {
    const {items} = await readCustomerWishlist(context.customerAccount);
    return data({ok: true, authenticated: true, items}, {headers: NO_STORE});
  } catch (error) {
    return errorResponse(error, 'read');
  }
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return data(
      {ok: false, error: {code: 'METHOD_NOT_ALLOWED'}},
      {status: 405, headers: NO_STORE},
    );
  }
  if (!isSameOrigin(request)) {
    return data(
      {ok: false, error: {code: 'FORBIDDEN'}},
      {status: 403, headers: NO_STORE},
    );
  }
  if (!(await context.customerAccount.isLoggedIn())) {
    return data(
      {ok: false, authenticated: false, error: {code: 'NOT_AUTHENTICATED'}},
      {status: 401, headers: NO_STORE},
    );
  }

  const operation = parseOperation(await request.json().catch(() => null));
  if (!operation) {
    return data(
      {ok: false, error: {code: 'INVALID_OPERATION'}},
      {status: 400, headers: NO_STORE},
    );
  }

  try {
    const items = await updateCustomerWishlist(
      context.customerAccount,
      operation,
    );
    return data({ok: true, items}, {headers: NO_STORE});
  } catch (error) {
    return errorResponse(error, operation.type);
  }
}

/**
 * Validates the untrusted request body.
 * @param {unknown} body
 * @return {import('~/lib/wishlist/customer-wishlist.server').WishlistOperation | null}
 */
function parseOperation(body) {
  if (!body || typeof body !== 'object') return null;
  const {type} = /** @type {{type?: unknown}} */ (body);

  if (type === 'add') {
    const [item] = sanitizeWishlist([body.item]);
    return item ? {type, item} : null;
  }
  if (type === 'remove' && Array.isArray(body.productIds)) {
    const productIds = body.productIds.filter(
      (id) => typeof id === 'string' && id.startsWith('gid://shopify/Product/'),
    );
    return productIds.length ? {type, productIds} : null;
  }
  if (type === 'merge' && Array.isArray(body.items)) {
    return {type, items: sanitizeWishlist(body.items)};
  }
  if (type === 'clear') return {type};
  return null;
}

/**
 * Logs the full error server-side and returns a safe, useful response.
 * @param {unknown} error
 * @param {string} operation
 */
function errorResponse(error, operation) {
  if (error instanceof Response) {
    // The Customer Account client throws a redirect when the session is
    // no longer valid.
    return data(
      {ok: false, authenticated: false, error: {code: 'NOT_AUTHENTICATED'}},
      {status: 401, headers: NO_STORE},
    );
  }

  const code =
    error instanceof CustomerWishlistError ? error.code : 'UNEXPECTED_ERROR';
  const status = error instanceof CustomerWishlistError ? error.status : 500;
  console.error(
    `[wishlist] customer wishlist ${operation} failed (${code}):`,
    error instanceof Error ? error.message : error,
  );
  return data(
    {
      ok: false,
      error: {
        code,
        message:
          code === 'APP_NOT_AUTHORIZED'
            ? 'This store is not configured to save customer wishlists yet.'
            : 'Your wishlist could not be saved to your account.',
      },
    },
    {status, headers: NO_STORE},
  );
}

/** @typedef {import('./+types/api.wishlist').Route} Route */
