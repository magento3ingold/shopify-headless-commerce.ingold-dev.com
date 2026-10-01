/**
 * Shopify-native product filtering and sorting, driven by the URL.
 *
 * Filter definitions always come from Shopify (`ProductConnection.filters` or
 * `SearchResultItemConnection.productFilters`), which follow the store's
 * Search & Discovery configuration. Nothing here knows about colors, sizes,
 * vendors, etc.
 *
 * URL format (our own parameter names; the values are Shopify's):
 *   ?filter=<FilterValue.input>   repeated, one per selected value. The value
 *                                 is exactly the JSON string Shopify returns
 *                                 as `FilterValue.input`, i.e. a ProductFilter.
 *   ?minPrice=10&maxPrice=50      price range (PriceRangeFilter)
 *   ?sale=1                       only discounted products (see
 *                                 sale.server.js; not a Shopify filter)
 *   ?sort=price-ascending         see SORT_OPTIONS
 *   ?cursor=…&direction=…         Hydrogen pagination (reset on change)
 *
 * Hydrogen 2026.4 does not ship filter/sort URL helpers, hence this module.
 * It is dependency-free so it runs in loaders, components and tests.
 */

export const FILTER_PARAM = 'filter';
export const MIN_PRICE_PARAM = 'minPrice';
export const MAX_PRICE_PARAM = 'maxPrice';
export const SORT_PARAM = 'sort';
export const SALE_PARAM = 'sale';

/** Products per page (and per "Load more") on collection listings. */
export const PRODUCTS_PER_PAGE = 12;

/** Hydrogen Pagination's params; dropped whenever filters/sort change. */
const PAGINATION_PARAMS = ['cursor', 'direction'];

/** Keeps URLs and API calls bounded. */
const MAX_FILTERS = 25;
const MAX_STRING = 255;

/**
 * Sort options per listing type, mapped only to sort keys the current
 * Storefront API schema supports for that connection:
 * - collection.products: ProductCollectionSortKeys
 * - search (all products): `productsSortKey` (ProductSortKeys) for the
 *   unfiltered root `products` connection, and `sortKey` (SearchSortKeys)
 *   for filtered results from the product search. An empty-query search
 *   only paginates reliably when sorted by PRICE (under RELEVANCE Shopify
 *   returns incomplete pages), so "Featured" is offered unfiltered only.
 */
export const SORT_OPTIONS = /** @type {const} */ ({
  collection: [
    {
      value: 'featured',
      label: 'Featured',
      sortKey: 'COLLECTION_DEFAULT',
      reverse: false,
    },
    {
      value: 'best-selling',
      label: 'Best selling',
      sortKey: 'BEST_SELLING',
      reverse: false,
    },
    {
      value: 'price-ascending',
      label: 'Price: low to high',
      sortKey: 'PRICE',
      reverse: false,
    },
    {
      value: 'price-descending',
      label: 'Price: high to low',
      sortKey: 'PRICE',
      reverse: true,
    },
    {value: 'newest', label: 'Newest', sortKey: 'CREATED', reverse: true},
    {
      value: 'title-ascending',
      label: 'Alphabetical: A–Z',
      sortKey: 'TITLE',
      reverse: false,
    },
    {
      value: 'title-descending',
      label: 'Alphabetical: Z–A',
      sortKey: 'TITLE',
      reverse: true,
    },
  ],
  search: [
    {
      value: 'featured',
      label: 'Featured',
      sortKey: null,
      productsSortKey: 'ID',
      reverse: false,
      unfilteredOnly: true,
    },
    {
      value: 'price-ascending',
      label: 'Price: low to high',
      sortKey: 'PRICE',
      productsSortKey: 'PRICE',
      reverse: false,
    },
    {
      value: 'price-descending',
      label: 'Price: high to low',
      sortKey: 'PRICE',
      productsSortKey: 'PRICE',
      reverse: true,
    },
    {
      value: 'newest',
      label: 'Newest',
      sortKey: null,
      productsSortKey: 'CREATED_AT',
      reverse: true,
      unfilteredOnly: true,
    },
  ],
});

/** Short spellings accepted in URLs. */
const SORT_ALIASES = {
  'price-asc': 'price-ascending',
  'price-desc': 'price-descending',
  'title-asc': 'title-ascending',
  'title-desc': 'title-descending',
};

/**
 * Sort options available for the current Shopify filters (the sale toggle
 * does not restrict sorting).
 * @param {URLSearchParams} searchParams
 * @param {keyof typeof SORT_OPTIONS} listing
 */
export function getSortOptions(searchParams, listing) {
  const options = SORT_OPTIONS[listing];
  return getProductFilters(searchParams).length > 0
    ? options.filter((option) => !('unfilteredOnly' in option))
    : options;
}

/**
 * The requested sort, or the first available one when it is missing or
 * not supported.
 * @param {URLSearchParams} searchParams
 * @param {keyof typeof SORT_OPTIONS} listing
 */
export function getSortOption(searchParams, listing) {
  const options = getSortOptions(searchParams, listing);
  const raw = searchParams.get(SORT_PARAM) ?? '';
  const requested = SORT_ALIASES[raw] ?? raw;
  return options.find((option) => option.value === requested) ?? options[0];
}

/**
 * Every ProductFilter to send to Shopify: selected filter values plus the
 * price range (unless `includePrice` is false, e.g. to ask Shopify for the
 * full available price range while a price filter is applied).
 * @param {URLSearchParams} searchParams
 * @param {{includePrice?: boolean}} [options]
 * @return {ProductFilter[]}
 */
export function getProductFilters(searchParams, {includePrice = true} = {}) {
  const filters = getSelectedFilterInputs(searchParams).map(
    (entry) => entry.filter,
  );
  const price = includePrice ? getPriceRange(searchParams) : null;
  if (price) filters.push({price});
  return filters;
}

/**
 * Identity of Shopify's "Out of stock" availability value. Shopify matches
 * `available: false` per variant, so it also returns products that still
 * have sellable variants; listings correct this on the server.
 */
export const OUT_OF_STOCK_KEY = filterKey({available: false});
const IN_STOCK_KEY = filterKey({available: true});

/**
 * True when "Out of stock" is selected without "In stock" (both together
 * mean every product), i.e. when only fully sold-out products may show.
 * @param {URLSearchParams} searchParams
 */
export function isOutOfStockOnly(searchParams) {
  const keys = new Set(
    getSelectedFilterInputs(searchParams).map((entry) => entry.key),
  );
  return keys.has(OUT_OF_STOCK_KEY) && !keys.has(IN_STOCK_KEY);
}

/**
 * The current filters with the availability selection replaced by
 * `available: false`: the candidates for the corrected "Out of stock"
 * count.
 * @param {URLSearchParams} searchParams
 * @return {ProductFilter[]}
 */
export function getOutOfStockCandidateFilters(searchParams) {
  return [
    ...getProductFilters(searchParams).filter(
      (filter) => !('available' in filter),
    ),
    {available: false},
  ];
}

/** @param {URLSearchParams} searchParams */
export function isSaleSelected(searchParams) {
  return searchParams.get(SALE_PARAM) === '1';
}

/**
 * The available price range reported by Shopify's PRICE_RANGE filter,
 * widened to whole currency units. Null when Shopify reports none.
 * @param {Array<{type: string; values: Array<{input: unknown}>}>} filters
 * @return {{min: number; max: number} | null}
 */
export function getPriceBounds(filters) {
  const filter = filters?.find((entry) => entry.type === 'PRICE_RANGE');
  const range = parseFilterInput(filter?.values?.[0]?.input)?.price;
  if (!range || range.max === undefined) return null;
  const min = Math.floor(range.min ?? 0);
  const max = Math.ceil(range.max);
  return max > min ? {min, max} : null;
}

/**
 * @param {number} value
 * @param {{min: number; max: number}} bounds
 */
export function clampPrice(value, bounds) {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * Validated `filter` params (excluding price, which uses its own params).
 * Invalid or duplicate values are ignored.
 * @param {URLSearchParams} searchParams
 * @return {Array<{key: string; raw: string; filter: ProductFilter}>}
 */
export function getSelectedFilterInputs(searchParams) {
  const seen = new Set();
  const selected = [];
  for (const raw of searchParams.getAll(FILTER_PARAM)) {
    const filter = parseFilterInput(raw);
    if (!filter || 'price' in filter) continue;
    const key = filterKey(filter);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({key, raw, filter});
    if (selected.length >= MAX_FILTERS) break;
  }
  return selected;
}

/**
 * Parses a Shopify `FilterValue.input` (a JSON string, or already-parsed
 * JSON) into a ProductFilter, validating it against the ProductFilter input
 * shape of the Storefront API. Returns null when invalid.
 * @param {unknown} input
 * @return {ProductFilter | null}
 */
export function parseFilterInput(input) {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const keys = Object.keys(value);
  if (keys.length !== 1) return null;
  const [key] = keys;
  const inner = value[key];

  switch (key) {
    case 'available':
      return typeof inner === 'boolean' ? {available: inner} : null;
    case 'productType':
    case 'productVendor':
    case 'tag':
      return isText(inner) ? {[key]: inner} : null;
    case 'variantOption':
      return isObject(inner) && isText(inner.name) && isText(inner.value)
        ? {variantOption: {name: inner.name, value: inner.value}}
        : null;
    case 'productMetafield':
    case 'variantMetafield':
    case 'taxonomyMetafield':
      return isObject(inner) &&
        isText(inner.namespace) &&
        isText(inner.key) &&
        isText(inner.value)
        ? {
            [key]: {
              namespace: inner.namespace,
              key: inner.key,
              value: inner.value,
            },
          }
        : null;
    case 'category':
      return isObject(inner) && isText(inner.id)
        ? {category: {id: inner.id}}
        : null;
    case 'price': {
      const min = toPrice(inner?.min);
      const max = toPrice(inner?.max);
      return min === undefined && max === undefined
        ? null
        : {
            price: {
              ...(min !== undefined && {min}),
              ...(max !== undefined && {max}),
            },
          };
    }
    default:
      return null;
  }
}

/**
 * Stable identity of a filter, independent of key order/whitespace, used to
 * match URL values against Shopify's FilterValue.input.
 * @param {ProductFilter} filter
 */
export function filterKey(filter) {
  return JSON.stringify(filter, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

/**
 * Validated price range, or null. Negative/invalid values are ignored; a
 * minimum above the maximum is rejected as a whole.
 * @param {URLSearchParams} searchParams
 * @return {{min?: number; max?: number} | null}
 */
export function getPriceRange(searchParams) {
  const min = toPrice(searchParams.get(MIN_PRICE_PARAM));
  const max = toPrice(searchParams.get(MAX_PRICE_PARAM));
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined && min > max) return null;
  return {...(min !== undefined && {min}), ...(max !== undefined && {max})};
}

/**
 * Checks a price entered by the shopper.
 * @param {string} min
 * @param {string} max
 * @return {string | null} error message, or null when valid
 */
export function validatePriceInput(min, max) {
  const minValue = min.trim() === '' ? undefined : Number(min);
  const maxValue = max.trim() === '' ? undefined : Number(max);
  if (
    (minValue !== undefined && (!Number.isFinite(minValue) || minValue < 0)) ||
    (maxValue !== undefined && (!Number.isFinite(maxValue) || maxValue < 0))
  ) {
    return 'Prices must be zero or more.';
  }
  if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
    return 'The minimum price cannot be higher than the maximum.';
  }
  return null;
}

/* ----------------------------- URL builders ----------------------------- */

/** @param {URLSearchParams} searchParams */
function withoutPagination(searchParams) {
  const next = new URLSearchParams(searchParams);
  PAGINATION_PARAMS.forEach((param) => next.delete(param));
  return next;
}

/**
 * Adds or removes one Shopify filter value.
 * @param {URLSearchParams} searchParams
 * @param {string} input FilterValue.input
 */
export function toggleFilter(searchParams, input) {
  const target = parseFilterInput(input);
  const next = withoutPagination(searchParams);
  if (!target) return next;
  const targetKey = filterKey(target);
  const existing = next.getAll(FILTER_PARAM);
  const isActive = existing.some((raw) => {
    const parsed = parseFilterInput(raw);
    return parsed && filterKey(parsed) === targetKey;
  });

  next.delete(FILTER_PARAM);
  for (const raw of existing) {
    const parsed = parseFilterInput(raw);
    if (parsed && filterKey(parsed) !== targetKey)
      next.append(FILTER_PARAM, raw);
  }
  if (!isActive) {
    next.append(
      FILTER_PARAM,
      typeof input === 'string' ? input : JSON.stringify(input),
    );
  }
  return next;
}

/**
 * @param {URLSearchParams} searchParams
 * @param {{min?: string | number; max?: string | number}} range
 */
export function setPriceRange(searchParams, {min, max}) {
  const next = withoutPagination(searchParams);
  const set = (param, value) => {
    const price = toPrice(value);
    if (price === undefined) next.delete(param);
    else next.set(param, String(price));
  };
  set(MIN_PRICE_PARAM, min);
  set(MAX_PRICE_PARAM, max);
  return next;
}

/** @param {URLSearchParams} searchParams */
export function clearPriceRange(searchParams) {
  const next = withoutPagination(searchParams);
  next.delete(MIN_PRICE_PARAM);
  next.delete(MAX_PRICE_PARAM);
  return next;
}

/** @param {URLSearchParams} searchParams */
export function toggleSale(searchParams) {
  const next = withoutPagination(searchParams);
  if (isSaleSelected(next)) next.delete(SALE_PARAM);
  else next.set(SALE_PARAM, '1');
  return next;
}

/**
 * Removes every filter (price range and sale included) but keeps the sort.
 * @param {URLSearchParams} searchParams
 */
export function clearFilters(searchParams) {
  const next = clearPriceRange(searchParams);
  next.delete(FILTER_PARAM);
  next.delete(SALE_PARAM);
  return next;
}

/**
 * @param {URLSearchParams} searchParams
 * @param {string} sort
 * @param {keyof typeof SORT_OPTIONS} listing
 */
export function setSort(searchParams, sort, listing) {
  const next = withoutPagination(searchParams);
  if (sort === SORT_OPTIONS[listing][0].value) next.delete(SORT_PARAM);
  else next.set(SORT_PARAM, sort);
  return next;
}

/**
 * True when filters, a price range or the sale toggle are active.
 * @param {URLSearchParams} searchParams
 */
export function hasActiveFilters(searchParams) {
  return (
    getSelectedFilterInputs(searchParams).length > 0 ||
    getPriceRange(searchParams) !== null ||
    isSaleSelected(searchParams)
  );
}

/**
 * True when the listing is filtered or sorted (used to keep these URL
 * variants out of search engine indexes).
 * @param {URLSearchParams} searchParams
 */
export function isRefinedListing(searchParams) {
  return (
    searchParams.has(FILTER_PARAM) ||
    searchParams.has(MIN_PRICE_PARAM) ||
    searchParams.has(MAX_PRICE_PARAM) ||
    searchParams.has(SALE_PARAM) ||
    searchParams.has(SORT_PARAM)
  );
}

/**
 * Turns URLSearchParams into a "?…" suffix ("" when empty).
 * @param {URLSearchParams} searchParams
 */
export function toSearch(searchParams) {
  const value = searchParams.toString();
  return value ? `?${value}` : '';
}

/* -------------------------------- helpers ------------------------------- */

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isText(value) {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING
  );
}

/**
 * @param {unknown} value
 * @return {number | undefined}
 */
function toPrice(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e9) return undefined;
  return Math.round(number * 100) / 100;
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').ProductFilter} ProductFilter */
