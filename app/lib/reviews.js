/**
 * Product review data contract shared by the server and the UI.
 *
 * Rating summary: Shopify's standard product review metafields
 * `reviews.rating` (type `rating`) and `reviews.rating_count` (integer).
 * Review apps (Shopify Product Reviews, Judge.me, Yotpo, Okendo, Loox,
 * Stamped, ...) can sync their totals into these, and they are read through
 * the Storefront API with the product, so no extra request is needed. The
 * metafields must be exposed to the Storefront API (Settings → Custom data →
 * Products → definition → Storefront access).
 *
 * Individual reviews: Shopify stores none, so they come from a review
 * provider's API (see reviews.server.js).
 */

/** Review sort orders a provider may support. */
export const REVIEW_SORTS = /** @type {const} */ ([
  {value: 'recent', label: 'Most recent'},
  {value: 'highest', label: 'Highest rated'},
  {value: 'lowest', label: 'Lowest rated'},
]);

/** Reviews per page requested from a provider. */
export const REVIEWS_PER_PAGE = 5;

/**
 * Storefront API fields for the rating summary; spread into the product.
 */
export const PRODUCT_REVIEW_SUMMARY_FRAGMENT = `#graphql
  fragment ProductReviewSummary on Product {
    reviewRating: metafield(namespace: "reviews", key: "rating") {
      value
    }
    reviewCount: metafield(namespace: "reviews", key: "rating_count") {
      value
    }
  }
`;

/**
 * Average rating (normalised to a 0–5 scale) and review count from the
 * standard review metafields, or null when they are missing or invalid.
 * Never invents values.
 * @param {{
 *   reviewRating?: {value?: string | null} | null;
 *   reviewCount?: {value?: string | null} | null;
 * }} product
 * @return {ReviewSummary | null}
 */
export function parseReviewSummary(product) {
  const count = Number.parseInt(product?.reviewCount?.value ?? '', 10);
  if (!Number.isFinite(count) || count <= 0) return null;

  let rating;
  try {
    rating = JSON.parse(product?.reviewRating?.value ?? '');
  } catch {
    return null;
  }
  const value = Number(rating?.value);
  const min = Number(rating?.scale_min ?? 1);
  const max = Number(rating?.scale_max ?? 5);
  if (![value, min, max].every(Number.isFinite) || max <= min) return null;
  if (value < min || value > max) return null;

  // Express on a 5-star scale whatever scale the provider uses.
  const averageRating = Math.round((value / max) * 5 * 10) / 10;
  return {averageRating, reviewCount: count};
}

/**
 * "Rated 4.7 out of 5 based on 128 reviews"
 * @param {ReviewSummary} summary
 */
export function describeRating({averageRating, reviewCount}) {
  return `Rated ${averageRating} out of 5 based on ${reviewCount} ${
    reviewCount === 1 ? 'review' : 'reviews'
  }`;
}

/** @typedef {{averageRating: number; reviewCount: number}} ReviewSummary */
/**
 * One review as supplied by a provider. Optional fields are shown only when
 * the provider supplies them.
 * @typedef {{
 *   id: string;
 *   rating: number;
 *   author?: string | null;
 *   title?: string | null;
 *   body?: string | null;
 *   createdAt?: string | null;
 *   verifiedBuyer?: boolean | null;
 *   images?: Array<{url: string; altText?: string | null}> | null;
 * }} Review
 */
/**
 * A page of reviews from a provider.
 * @typedef {{
 *   reviews: Review[];
 *   page: number;
 *   hasNextPage: boolean;
 *   sort: string;
 *   sorts: string[];
 *   distribution?: Record<1 | 2 | 3 | 4 | 5, number> | null;
 * }} ReviewPage
 */
