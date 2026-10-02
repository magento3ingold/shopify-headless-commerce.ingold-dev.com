import {data} from 'react-router';
import {
  createPendingReview,
  isReviewSystemConfigured,
  loadProductReviews,
} from '~/lib/product-reviews.server';
import {validateReviewInput} from '~/lib/reviews';
import {isSameOrigin} from '~/lib/request.server';
import {CUSTOMER_REVIEW_PREFILL_QUERY} from '~/graphql/customer-account/CustomerReviewPrefill';

/**
 * Product reviews API (no UI).
 *
 * GET ?productId=<Product GID>&sort=recent|highest|lowest&page=<n>
 *   -> approved, public review data only (never customer emails)
 * GET ?prefill=1
 *   -> the signed-in customer's own name/email for the review form (private)
 * POST (form data) -> creates a pending "Custom Product Review" entry
 *
 * Product identity is verified against the Storefront API, and status,
 * verified-buyer and the timestamp are set on the server only.
 */

const NO_STORE = {'Cache-Control': 'private, no-store'};
const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context, request}) {
  const params = new URL(request.url).searchParams;

  if (params.get('prefill') === '1') {
    return data(await getPrefill(context), {headers: NO_STORE});
  }

  const productId = params.get('productId') ?? '';
  if (!PRODUCT_GID.test(productId)) {
    return data({ok: false, code: 'INVALID_PRODUCT'}, {status: 400});
  }
  const result = await loadProductReviews(context, {
    productId,
    sort: params.get('sort'),
    page: params.get('page'),
  });
  if (result.status !== 'ok') {
    return data({ok: false, code: 'UNAVAILABLE'}, {status: 503});
  }
  return data(
    {ok: true, page: result.page},
    {headers: {'Cache-Control': 'public, max-age=60'}},
  );
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({context, request}) {
  if (request.method !== 'POST') {
    return data({ok: false, message: 'Method not allowed.'}, {status: 405});
  }
  if (!isSameOrigin(request)) {
    return data({ok: false, message: 'Invalid request.'}, {status: 403});
  }
  if (!isReviewSystemConfigured(context.env)) {
    return data(
      {ok: false, message: 'Reviews cannot be submitted at the moment.'},
      {status: 503, headers: NO_STORE},
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return data({ok: false, message: 'Invalid request.'}, {status: 400});
  }

  // Honeypot: real visitors never see or fill this field.
  if (String(form.get('website') ?? '').trim()) {
    return data(
      {ok: false, message: 'Your review could not be submitted.'},
      {status: 400, headers: NO_STORE},
    );
  }

  const values = Object.fromEntries(
    [
      'rating',
      'name',
      'email',
      'title',
      'body',
      'productId',
      'productHandle',
      'submissionId',
    ].map((key) => [key, form.get(key)]),
  );
  const validation = validateReviewInput(values);
  if (!validation.ok) {
    return data(
      {
        ok: false,
        errors: validation.errors,
        message:
          validation.errors.form ?? 'Please check the highlighted fields.',
      },
      {status: 400, headers: NO_STORE},
    );
  }
  const review = validation.value;

  // The product must exist in this storefront and match the given handle.
  const {product} = await context.storefront.query(REVIEW_PRODUCT_QUERY, {
    variables: {handle: review.productHandle},
    cache: context.storefront.CacheNone(),
  });
  if (!product || product.id !== review.productId) {
    return data(
      {ok: false, message: 'This product could not be found.'},
      {status: 400, headers: NO_STORE},
    );
  }

  try {
    await createPendingReview(context, {
      ...review,
      productHandle: product.handle,
    });
  } catch (error) {
    console.error('[reviews] review submission failed:', error);
    return data(
      {
        ok: false,
        message:
          'Sorry, your review could not be submitted. Please try again later.',
      },
      {status: 502, headers: NO_STORE},
    );
  }

  return data(
    {
      ok: true,
      message: 'Thank you. Your review has been submitted for approval.',
    },
    {headers: NO_STORE},
  );
}

/** Name/email of the signed-in customer, or nothing for guests. */
async function getPrefill(context) {
  try {
    if (!(await context.customerAccount.isLoggedIn())) return {ok: true};
    const {data: result} = await context.customerAccount.query(
      CUSTOMER_REVIEW_PREFILL_QUERY,
    );
    const customer = result?.customer;
    return {
      ok: true,
      name: [customer?.firstName, customer?.lastName].filter(Boolean).join(' '),
      email: customer?.emailAddress?.emailAddress ?? '',
    };
  } catch {
    return {ok: true};
  }
}

const REVIEW_PRODUCT_QUERY = `#graphql
  query ReviewProduct(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      handle
    }
  }
`;

/** @typedef {import('./+types/api.product-reviews').Route} Route */
