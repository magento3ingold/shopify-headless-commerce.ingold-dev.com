import {data} from 'react-router';
import {loadProductReviews, getReviewsProvider} from '~/lib/reviews.server';

/**
 * Product reviews API (no UI), used by the PDP reviews section for sorting
 * and "more reviews" without reloading the product.
 *
 * GET ?handle=<product handle>&sort=recent|highest|lowest&page=<n>
 *   -> {ok: true, reviews: ReviewPage}
 *   -> 404 {ok: false, code: 'NO_REVIEW_PROVIDER'} when no provider is set up
 *
 * The product is resolved through the Storefront API (current market), so
 * only real, published products can be queried.
 * @param {Route.LoaderArgs}
 */
export async function loader({context, request}) {
  if (!getReviewsProvider(context.env)) {
    return data({ok: false, code: 'NO_REVIEW_PROVIDER'}, {status: 404});
  }

  const params = new URL(request.url).searchParams;
  const handle = params.get('handle') ?? '';
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(handle)) {
    return data({ok: false, code: 'INVALID_HANDLE'}, {status: 400});
  }

  const {product} = await context.storefront.query(REVIEW_PRODUCT_QUERY, {
    variables: {handle},
  });
  if (!product) {
    return data({ok: false, code: 'NOT_FOUND'}, {status: 404});
  }

  const reviews = await loadProductReviews({
    env: context.env,
    product,
    sort: params.get('sort'),
    page: params.get('page'),
  });
  if (!reviews) {
    return data({ok: false, code: 'PROVIDER_ERROR'}, {status: 502});
  }
  return data(
    {ok: true, reviews},
    {headers: {'Cache-Control': 'public, max-age=60'}},
  );
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
