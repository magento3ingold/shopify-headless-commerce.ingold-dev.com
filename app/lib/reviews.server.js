/**
 * Server-side access to individual product reviews.
 *
 * Shopify does not store individual reviews; they live in a review app.
 * This module is the single integration point for that app's API: it
 * returns `null` when no provider is configured, and the PDP then shows only
 * what Shopify has (the rating summary metafields), without fake reviews.
 *
 * To connect a provider, implement `ReviewsProvider` below with its
 * server-side API (credentials from private env vars, never the browser)
 * and return it from `getReviewsProvider`.
 */
import {REVIEWS_PER_PAGE, REVIEW_SORTS} from '~/lib/reviews';

/**
 * The configured review provider, or null. None is configured in this
 * storefront: no review app integration, metafields or metaobjects were
 * found on the store.
 * A provider reads its credentials from `env` (private variables).
 * @param {Env} env
 * @return {ReviewsProvider | null}
 */
// eslint-disable-next-line no-unused-vars
export function getReviewsProvider(env) {
  return null;
}

/**
 * One page of a product's reviews, or null without a provider. Errors are
 * logged and reported as null so the product page still renders.
 * @param {{
 *   env: Env;
 *   product: {id: string; handle: string};
 *   sort?: string | null;
 *   page?: number | string | null;
 * }} args
 * @return {Promise<import('~/lib/reviews').ReviewPage | null>}
 */
export async function loadProductReviews({env, product, sort, page}) {
  const provider = getReviewsProvider(env);
  if (!provider) return null;

  const safeSort = REVIEW_SORTS.some((option) => option.value === sort)
    ? sort
    : REVIEW_SORTS[0].value;
  const safePage = Math.max(1, Math.min(1000, Number(page) || 1));

  try {
    return await provider.getReviews({
      product,
      sort: safeSort,
      page: safePage,
      perPage: REVIEWS_PER_PAGE,
    });
  } catch (error) {
    console.error('[reviews] provider request failed', error);
    return null;
  }
}

/**
 * @typedef {{
 *   getReviews: (args: {
 *     product: {id: string; handle: string};
 *     sort: string;
 *     page: number;
 *     perPage: number;
 *   }) => Promise<import('~/lib/reviews').ReviewPage>;
 * }} ReviewsProvider
 */
