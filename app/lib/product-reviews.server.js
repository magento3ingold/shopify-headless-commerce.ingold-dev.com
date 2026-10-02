/**
 * Custom product reviews stored as "Custom Product Review" metaobjects.
 * Server only: every read and write goes through the Admin API with private
 * credentials, so pending/rejected reviews and customer emails are never
 * queryable from the browser.
 *
 * - The metaobject type and field keys are read from the store's definition
 *   (matched by the definition name and the field names below), never
 *   hard-coded.
 * - Public reads return only approved reviews of one product (matched by
 *   Product ID), mapped to `PublicReview` without the customer email.
 * - New reviews are always created with Status = pending, Verified Buyer =
 *   false and a server timestamp; the browser cannot set them.
 * - Public data is cached briefly (see REVIEW_CACHE) so an approval in
 *   Shopify Admin appears within about two minutes, without a deployment.
 */
import {CacheCustom} from '@shopify/hydrogen';
import {adminGraphql, getAdminApiConfig} from '~/lib/admin-api.server';
import {
  REVIEW_CREATE_MUTATION,
  REVIEW_DEFINITIONS_QUERY,
  REVIEW_ENTRIES_QUERY,
  REVIEW_RATINGS_QUERY,
} from '~/graphql/admin/ProductReviews';
import {REVIEWS_PER_PAGE, REVIEW_SORTS} from '~/lib/reviews';

/** Name of the metaobject definition created in Shopify Admin. */
export const REVIEW_DEFINITION_NAME = 'Custom Product Review';

/** Field names (as shown in Shopify Admin) of that definition. */
const FIELD_NAMES = /** @type {const} */ ({
  productId: 'Product ID',
  productHandle: 'Product Handle',
  customerName: 'Customer Name',
  customerEmail: 'Customer Email',
  rating: 'Rating',
  title: 'Review Title',
  text: 'Review Text',
  verifiedBuyer: 'Verified Buyer',
  status: 'Status',
  createdAt: 'Created At',
});

const STATUS = /** @type {const} */ ({
  pending: 'pending',
  approved: 'approved',
});

/** Approved reviews summarised per product (8 Admin pages of 250). */
const MAX_SCANNED_REVIEWS = 2000;

/** Approved review data: ≤ 60 s fresh, ≤ 60 s more while revalidating. */
const REVIEW_CACHE = CacheCustom({
  mode: 'public',
  maxAge: 60,
  staleWhileRevalidate: 60,
});
const DEFINITION_CACHE = CacheCustom({
  mode: 'public',
  maxAge: 300,
  staleWhileRevalidate: 600,
});

export class ReviewConfigError extends Error {
  name = 'ReviewConfigError';
}

/** True when Admin API credentials are configured. */
export function isReviewSystemConfigured(env) {
  return getAdminApiConfig(env) !== null;
}

/* --------------------------------- Reading -------------------------------- */

/**
 * Summary, distribution and one page of approved reviews for a product.
 * Never throws. `canSubmit` tells the page whether new reviews can be
 * written: true whenever the Admin API and the definition are usable, even
 * if reading reviews failed (zero reviews is a normal "ok" result).
 * @param {ReviewContext} context
 * @param {{productId: string; sort?: string | null; page?: number | string | null}} args
 * @return {Promise<ProductReviewsResult>}
 */
export async function loadProductReviews(context, {productId, sort, page}) {
  if (!isReviewSystemConfigured(context.env)) {
    return {status: 'unavailable', reason: 'NOT_CONFIGURED', canSubmit: false};
  }

  let definition;
  try {
    definition = await getReviewDefinition(context);
  } catch (error) {
    console.error('[reviews] review definition unavailable:', error);
    return {
      status: 'unavailable',
      reason: error instanceof ReviewConfigError ? 'CONFIG' : 'ERROR',
      canSubmit: false,
    };
  }

  try {
    if (definition.readProblem) {
      throw new ReviewConfigError(definition.readProblem);
    }
    const ratings = await getApprovedRatings(context, definition, productId);
    const reviewPage = await getReviewPage(context, definition, ratings, {
      productId,
      sort,
      page,
    });
    return {
      status: 'ok',
      summary: summarise(ratings.items),
      page: reviewPage,
      // More approved reviews exist than were summarised.
      truncated: ratings.truncated,
      canSubmit: true,
    };
  } catch (error) {
    console.error('[reviews] could not load product reviews:', error);
    return {
      status: 'unavailable',
      reason: error instanceof ReviewConfigError ? 'CONFIG' : 'ERROR',
      // Writing does not depend on reading.
      canSubmit: true,
    };
  }
}

/**
 * @param {Array<{rating: number}>} items
 * @return {import('~/lib/reviews').ReviewSummary}
 */
export function summarise(items) {
  const distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
  let sum = 0;
  for (const {rating} of items) {
    distribution[rating] += 1;
    sum += rating;
  }
  const reviewCount = items.length;
  return {
    reviewCount,
    averageRating: reviewCount ? Math.round((sum / reviewCount) * 10) / 10 : 0,
    distribution,
  };
}

/**
 * Orders approved reviews: newest first, or by rating (ties newest first).
 * @param {Array<{id: string; rating: number; order: number}>} items newest first
 * @param {string} sort
 */
export function sortReviews(items, sort) {
  if (sort === 'highest') {
    return [...items].sort((a, b) => b.rating - a.rating || a.order - b.order);
  }
  if (sort === 'lowest') {
    return [...items].sort((a, b) => a.rating - b.rating || a.order - b.order);
  }
  return items;
}

/**
 * Ids and ratings of every approved review of a product (newest first),
 * filtered by Shopify and checked again here.
 * @param {ReviewContext} context
 * @param {ReviewDefinition} definition
 * @param {string} productId
 */
async function getApprovedRatings(context, definition, productId) {
  return context.withCache.run(
    {
      cacheKey: ['product-review-ratings', definition.type, productId],
      cacheStrategy: REVIEW_CACHE,
      shouldCacheResult: () => true,
    },
    async () => {
      const {keys} = definition;
      const query = [
        `fields.${keys.productId}:${quoteSearch(productId)}`,
        `fields.${keys.status}:${quoteSearch(definition.statusValues.approved)}`,
      ].join(' AND ');

      /** @type {Array<{id: string; rating: number; order: number}>} */
      const items = [];
      let after = null;
      let truncated = false;
      do {
        const data = await adminGraphql(
          getAdminApiConfig(context.env),
          REVIEW_RATINGS_QUERY,
          {
            type: definition.type,
            query,
            after,
            productKey: keys.productId,
            statusKey: keys.status,
            ratingKey: keys.rating,
          },
        );
        const {nodes, pageInfo} = data.metaobjects;
        for (const node of nodes) {
          if (!isApprovedFor(node, definition, productId)) continue;
          const rating = parseRating(node.rating?.value, definition);
          if (rating) items.push({id: node.id, rating, order: items.length});
        }
        after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        if (after && items.length >= MAX_SCANNED_REVIEWS) {
          truncated = true;
          after = null;
        }
      } while (after);
      return {items, truncated};
    },
  );
}

/**
 * One page of public reviews in the requested order.
 * @param {ReviewContext} context
 * @param {ReviewDefinition} definition
 * @param {{items: Array<{id: string; rating: number; order: number}>}} ratings
 * @param {{productId: string; sort?: string | null; page?: number | string | null}} args
 * @return {Promise<import('~/lib/reviews').ReviewPage>}
 */
async function getReviewPage(context, definition, ratings, args) {
  const sort = REVIEW_SORTS.some((option) => option.value === args.sort)
    ? /** @type {string} */ (args.sort)
    : REVIEW_SORTS[0].value;
  const page = Math.max(1, Math.min(500, Math.trunc(Number(args.page)) || 1));
  const ordered = sortReviews(ratings.items, sort);
  const slice = ordered.slice(
    (page - 1) * REVIEWS_PER_PAGE,
    page * REVIEWS_PER_PAGE,
  );
  const ids = slice.map((item) => item.id);

  const reviews = ids.length
    ? await context.withCache.run(
        {
          cacheKey: ['product-review-entries', ...ids],
          cacheStrategy: REVIEW_CACHE,
          shouldCacheResult: () => true,
        },
        async () => {
          const {keys} = definition;
          const data = await adminGraphql(
            getAdminApiConfig(context.env),
            REVIEW_ENTRIES_QUERY,
            {
              ids,
              productKey: keys.productId,
              statusKey: keys.status,
              ratingKey: keys.rating,
              nameKey: keys.customerName,
              titleKey: keys.title,
              textKey: keys.text,
              verifiedKey: keys.verifiedBuyer,
              createdAtKey: keys.createdAt,
            },
          );
          const byId = new Map(
            data.nodes.filter(Boolean).map((node) => [node.id, node]),
          );
          return ids
            .map((id) => byId.get(id))
            .filter(
              (node) => node && isApprovedFor(node, definition, args.productId),
            )
            .map((node) => toPublicReview(node, definition))
            .filter(Boolean);
        },
      )
    : [];

  return {
    reviews,
    page,
    sort,
    hasNextPage: page * REVIEWS_PER_PAGE < ordered.length,
  };
}

/** Only fields safe to show publicly; the customer email is never read. */
function toPublicReview(node, definition) {
  const rating = parseRating(node.rating?.value, definition);
  if (!rating) return null;
  return {
    id: node.id,
    customerName: cleanText(node.name?.value, 80) || 'Customer',
    rating,
    reviewTitle: cleanText(node.title?.value, 200),
    reviewText: cleanText(node.text?.value, 6000, true),
    verifiedBuyer: node.verified?.value === 'true',
    createdAt:
      validDate(node.reviewCreatedAt?.value) ?? validDate(node.createdAt),
  };
}

function isApprovedFor(node, definition, productId) {
  return (
    node.product?.value === productId &&
    normalise(node.status?.value) ===
      normalise(definition.statusValues.approved)
  );
}

/** Rating field value (rating JSON or integer) as a whole 1–5 star value. */
function parseRating(value, definition) {
  if (value == null || value === '') return null;
  let number;
  if (definition.fieldTypes.rating === 'rating') {
    try {
      number = Number(JSON.parse(value).value);
    } catch {
      return null;
    }
  } else {
    number = Number(value);
  }
  const rounded = Math.round(number);
  return Number.isFinite(number) && rounded >= 1 && rounded <= 5
    ? rounded
    : null;
}

/* --------------------------------- Writing -------------------------------- */

/**
 * Creates a pending review. Resolves only once Shopify confirms the entry.
 * The submission id becomes the entry handle, so a repeated submission of
 * the same form is rejected by Shopify (reported as `duplicate`).
 * @param {ReviewContext} context
 * @param {import('~/lib/reviews').ReviewSubmission} review validated input
 * @return {Promise<{id: string | null; duplicate: boolean}>}
 */
export async function createPendingReview(context, review) {
  const config = getAdminApiConfig(context.env);
  if (!config) throw new ReviewConfigError('Admin API is not configured');
  const definition = await getReviewDefinition(context);

  const values = {
    productId: review.productId,
    productHandle: review.productHandle,
    customerName: review.name,
    customerEmail: review.email,
    rating: review.rating,
    title: review.title,
    text: review.body,
    // Set by the server only.
    verifiedBuyer: false,
    status: definition.statusValues.pending,
    createdAt: new Date(),
  };
  const fields = Object.entries(values).map(([field, value]) => ({
    key: definition.keys[field],
    value: encodeValue(definition, field, value),
  }));

  const data = await adminGraphql(config, REVIEW_CREATE_MUTATION, {
    metaobject: {
      type: definition.type,
      handle: `review-${review.submissionId}`,
      fields,
    },
  });
  const {metaobject, userErrors} = data.metaobjectCreate;
  if (metaobject?.id) return {id: metaobject.id, duplicate: false};

  if (
    userErrors.length &&
    userErrors.every(
      (error) => error.code === 'TAKEN' && /handle/i.test(String(error.field)),
    )
  ) {
    return {id: null, duplicate: true};
  }
  throw new Error(
    `metaobjectCreate rejected the review: ${userErrors
      .map((error) => `${error.code} ${error.message} [${error.field}]`)
      .join('; ')}`,
  );
}

/** Converts a value to the string format of the field's metaobject type. */
function encodeValue(definition, field, value) {
  const type = definition.fieldTypes[field];
  const label = `"${FIELD_NAMES[field]}" (${type})`;
  switch (type) {
    case 'single_line_text_field':
    case 'multi_line_text_field':
      if (field === 'verifiedBuyer') return value ? 'true' : 'false';
      if (field === 'createdAt') return isoSeconds(value);
      return String(value);
    case 'number_integer':
      return String(Math.trunc(Number(value)));
    case 'rating': {
      const {min, max} = definition.ratingScale;
      return JSON.stringify({
        value: String(value),
        scale_min: String(min),
        scale_max: String(max),
      });
    }
    case 'boolean':
      return value ? 'true' : 'false';
    case 'date_time':
      return isoSeconds(value);
    case 'date':
      return isoSeconds(value).slice(0, 10);
    case 'product_reference':
      return String(value);
    default:
      throw new ReviewConfigError(`Unsupported field type for ${label}`);
  }
}

/* ------------------------------- Definition ------------------------------- */

/**
 * The "Custom Product Review" definition: type, field keys, field types
 * and status values, read from Shopify and cached for a few minutes.
 * @param {ReviewContext} context
 * @return {Promise<ReviewDefinition>}
 */
export async function getReviewDefinition(context) {
  const raw = await context.withCache.run(
    {
      cacheKey: ['product-review-definition', REVIEW_DEFINITION_NAME],
      cacheStrategy: DEFINITION_CACHE,
      shouldCacheResult: (value) => Boolean(value),
    },
    async () => {
      let after = null;
      do {
        const data = await adminGraphql(
          getAdminApiConfig(context.env),
          REVIEW_DEFINITIONS_QUERY,
          {after},
        );
        const {nodes, pageInfo} = data.metaobjectDefinitions;
        const found = nodes.find(
          (node) => normalise(node.name) === normalise(REVIEW_DEFINITION_NAME),
        );
        if (found) return found;
        after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
      } while (after);
      return null;
    },
  );
  if (!raw) {
    throw new ReviewConfigError(
      `No metaobject definition named "${REVIEW_DEFINITION_NAME}" was found`,
    );
  }
  return resolveDefinition(raw);
}

/**
 * Maps the definition's fields (by name) to keys and checks everything the
 * review system relies on. Exported for tests.
 * @param {RawDefinition} raw
 * @return {ReviewDefinition}
 */
export function resolveDefinition(raw) {
  const byName = new Map(
    raw.fieldDefinitions.map((field) => [normalise(field.name), field]),
  );
  const keys = {};
  const fieldTypes = {};
  const missing = [];
  for (const [field, name] of Object.entries(FIELD_NAMES)) {
    const definition = byName.get(normalise(name));
    if (!definition) {
      missing.push(name);
      continue;
    }
    keys[field] = definition.key;
    fieldTypes[field] = definition.type.name;
  }
  if (missing.length) {
    throw new ReviewConfigError(
      `"${raw.name}" (${raw.type}) has no field named: ${missing.join(', ')}`,
    );
  }

  const fieldOf = (field) => byName.get(normalise(FIELD_NAMES[field]));
  const notFilterable = ['productId', 'status'].filter(
    (field) => !fieldOf(field).capabilities?.adminFilterable?.enabled,
  );
  // Needed to read approved reviews per product; creating reviews works
  // without it.
  const readProblem = notFilterable.length
    ? `Enable the Admin filter for: ${notFilterable
        .map((field) => FIELD_NAMES[field])
        .join(', ')}`
    : null;

  // Status: use the definition's own choice values when it has a list.
  const statusChoices = parseChoices(fieldOf('status').validations);
  const statusValues = {};
  for (const [state, value] of Object.entries(STATUS)) {
    const choice = statusChoices
      ? statusChoices.find((option) => normalise(option) === value)
      : value;
    if (!choice) {
      throw new ReviewConfigError(
        `Status choices must include "${value}" (found: ${statusChoices.join(', ')})`,
      );
    }
    statusValues[state] = choice;
  }

  const ratingScale = {min: 1, max: 5};
  if (fieldTypes.rating === 'rating') {
    const validation = (name) =>
      Number(
        fieldOf('rating').validations?.find((entry) => entry.name === name)
          ?.value,
      );
    ratingScale.min = validation('scale_min') || 1;
    ratingScale.max = validation('scale_max') || 5;
    if (ratingScale.min > 1 || ratingScale.max !== 5) {
      throw new ReviewConfigError(
        `Rating must use a 1–5 scale (found ${ratingScale.min}–${ratingScale.max})`,
      );
    }
  }

  return {
    type: raw.type,
    keys,
    fieldTypes,
    statusValues,
    statusChoices,
    ratingScale,
    readProblem,
  };
}

/* --------------------------------- Helpers -------------------------------- */

function normalise(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseChoices(validations) {
  const raw = validations?.find((entry) => entry.name === 'choices')?.value;
  if (!raw) return null;
  try {
    const choices = JSON.parse(raw);
    return Array.isArray(choices) ? choices.map(String) : null;
  } catch {
    return null;
  }
}

/** Value quoted for Shopify search syntax. */
function quoteSearch(value) {
  return `"${String(value).replace(/["\\]/g, '\\$&')}"`;
}

function isoSeconds(date) {
  return (date instanceof Date ? date : new Date(date))
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Plain text only; control characters removed, length bounded. */
function cleanText(value, max, multiline = false) {
  const text = Array.from(String(value ?? ''))
    .filter((char) => {
      const code = char.charCodeAt(0);
      if (multiline && code === 10) return true; // keep line breaks
      return code > 31 && code !== 127;
    })
    .join('')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * @typedef {{
 *   env: Record<string, string | undefined>;
 *   withCache: import('@shopify/hydrogen').WithCache;
 * }} ReviewContext
 */
/**
 * @typedef {{
 *   type: string;
 *   name: string;
 *   fieldDefinitions: Array<{
 *     key: string;
 *     name: string;
 *     type: {name: string};
 *     validations?: Array<{name: string; value: string | null}>;
 *     capabilities?: {adminFilterable?: {enabled: boolean}};
 *   }>;
 * }} RawDefinition
 */
/**
 * @typedef {{
 *   type: string;
 *   keys: Record<keyof typeof FIELD_NAMES, string>;
 *   fieldTypes: Record<keyof typeof FIELD_NAMES, string>;
 *   statusValues: {pending: string; approved: string};
 *   statusChoices: string[] | null;
 *   ratingScale: {min: number; max: number};
 *   readProblem: string | null;
 * }} ReviewDefinition
 */
/**
 * @typedef {(
 *   | {
 *       status: 'ok';
 *       summary: import('~/lib/reviews').ReviewSummary;
 *       page: import('~/lib/reviews').ReviewPage;
 *       truncated: boolean;
 *       canSubmit: true;
 *     }
 *   | {
 *       status: 'unavailable';
 *       reason: 'NOT_CONFIGURED' | 'CONFIG' | 'ERROR';
 *       canSubmit: boolean;
 *     }
 * )} ProductReviewsResult
 */
