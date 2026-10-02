/**
 * Product review contract and validation shared by the server and the UI.
 *
 * Reviews are "Custom Product Review" metaobjects, read and written only on
 * the server through the Admin API (see product-reviews.server.js). The
 * browser only ever receives `PublicReview` objects (never the customer
 * email) and the summary below.
 */

/** Anchor of the reviews section on the product page. */
export const REVIEWS_SECTION_ID = 'product-reviews';

/** Server route for review pages, prefill and submissions. */
export const REVIEWS_API_PATH = '/api/product-reviews';

/** Review sort orders (all applied across every approved review). */
export const REVIEW_SORTS = /** @type {const} */ ([
  {value: 'recent', label: 'Most recent'},
  {value: 'highest', label: 'Highest rated'},
  {value: 'lowest', label: 'Lowest rated'},
]);

/** Reviews per page / per "Load more". */
export const REVIEWS_PER_PAGE = 10;

/** Submission limits (enforced on the server; mirrored in the form). */
export const REVIEW_LIMITS = /** @type {const} */ ({
  name: 100,
  email: 254,
  title: 150,
  text: 5000,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SUBMISSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;

/**
 * Validates a submitted review. Returns the cleaned values, or field errors.
 * @param {Record<string, unknown>} input raw form values
 * @return {{ok: true; value: ReviewSubmission} | {ok: false; errors: Record<string, string>}}
 */
export function validateReviewInput(input) {
  const text = (key) =>
    typeof input[key] === 'string'
      ? input[key].replace(/\r\n/g, '\n').trim()
      : '';
  const errors = {};

  const ratingRaw = text('rating');
  const rating = Number(ratingRaw);
  if (!/^[1-5]$/.test(ratingRaw) || !Number.isInteger(rating)) {
    errors.rating = 'Please choose a rating from 1 to 5 stars.';
  }

  const name = text('name').replace(/\s+/g, ' ');
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > REVIEW_LIMITS.name) {
    errors.name = `Please use at most ${REVIEW_LIMITS.name} characters.`;
  }

  const email = text('email').toLowerCase();
  if (!email) errors.email = 'Please enter your email address.';
  else if (email.length > REVIEW_LIMITS.email || !EMAIL.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  const title = text('title').replace(/\s+/g, ' ');
  if (!title) errors.title = 'Please enter a review title.';
  else if (title.length > REVIEW_LIMITS.title) {
    errors.title = `Please use at most ${REVIEW_LIMITS.title} characters.`;
  }

  const body = text('body');
  if (!body) errors.body = 'Please write your review.';
  else if (body.length > REVIEW_LIMITS.text) {
    errors.body = `Please use at most ${REVIEW_LIMITS.text} characters.`;
  }

  const productId = text('productId');
  const productHandle = text('productHandle');
  const submissionId = text('submissionId');
  if (
    !PRODUCT_GID.test(productId) ||
    !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,254}$/u.test(productHandle) ||
    !SUBMISSION_ID.test(submissionId)
  ) {
    errors.form = 'This review could not be submitted. Please reload the page.';
  }

  if (Object.keys(errors).length) return {ok: false, errors};
  return {
    ok: true,
    value: {
      rating,
      name,
      email,
      title,
      body,
      productId,
      productHandle,
      submissionId: submissionId.toLowerCase(),
    },
  };
}

/**
 * "Rated 4.7 out of 5 based on 18 reviews"
 * @param {ReviewSummary} summary
 */
export function describeRating({averageRating, reviewCount}) {
  return `Rated ${averageRating} out of 5 based on ${reviewCount} ${
    reviewCount === 1 ? 'review' : 'reviews'
  }`;
}

/**
 * @typedef {{
 *   averageRating: number;
 *   reviewCount: number;
 *   distribution: Record<1 | 2 | 3 | 4 | 5, number>;
 * }} ReviewSummary
 */
/**
 * What the browser receives for one approved review. Never contains the
 * customer email.
 * @typedef {{
 *   id: string;
 *   customerName: string;
 *   rating: number;
 *   reviewTitle: string;
 *   reviewText: string;
 *   createdAt: string | null;
 * }} PublicReview
 */
/**
 * @typedef {{
 *   reviews: PublicReview[];
 *   page: number;
 *   hasNextPage: boolean;
 *   sort: string;
 * }} ReviewPage
 */
/**
 * @typedef {{
 *   rating: number;
 *   name: string;
 *   email: string;
 *   title: string;
 *   body: string;
 *   productId: string;
 *   productHandle: string;
 *   submissionId: string;
 * }} ReviewSubmission
 */
