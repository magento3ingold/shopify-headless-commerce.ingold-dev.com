/**
 * "On sale" selection for product listings.
 *
 * The Storefront API has no sale sort key and no compare-at-price
 * ProductFilter, so Shopify cannot return only discounted products. This
 * module decides it on the server from real price data: a product is on
 * sale when at least one variant has `compareAtPrice > price`.
 *
 * - Products whose price data already decides it (a single variant, no
 *   compare-at price at all, or every compare-at price at or below the
 *   lowest price) need no extra request.
 * - Only undecided multi-variant products are checked variant by variant,
 *   in one `nodes` request.
 *
 * Listings add `...ProductSaleFields` (PRODUCT_SALE_FRAGMENT in
 * ~/lib/fragments) next to `...ProductCard`.
 *
 * Callers pass one bounded page of products (see SALE_SCAN_LIMIT); nothing
 * here walks the whole catalog.
 */

/** Products examined per request when the sale toggle is on. */
export const SALE_SCAN_LIMIT = 100;

/** Variants examined per undecided product. */
const VARIANTS_PER_PRODUCT = 100;

/**
 * @param {Storefront} storefront
 * @param {SaleCandidate[]} products
 * @return {Promise<SaleCandidate[]>} the products on sale, in their order
 */
export async function selectOnSaleProducts(storefront, products) {
  const decided = new Map();
  const undecided = [];

  for (const product of products) {
    const verdict = decideFromPriceRanges(product);
    if (verdict === null) undecided.push(product.id);
    else decided.set(product.id, verdict);
  }

  if (undecided.length) {
    const {nodes} = await storefront.query(SALE_VARIANTS_QUERY, {
      variables: {ids: undecided, first: VARIANTS_PER_PRODUCT},
    });
    for (const node of nodes) {
      if (!node?.id) continue;
      decided.set(
        node.id,
        node.variants.nodes.some((variant) => isDiscounted(variant)),
      );
    }
  }

  return products.filter((product) => decided.get(product.id) === true);
}

/**
 * Decides from product-level ranges where that is exact; null otherwise.
 * @param {SaleCandidate} product
 * @return {boolean | null}
 */
export function decideFromPriceRanges(product) {
  const maxCompareAt = Number(
    product.compareAtPriceRange?.maxVariantPrice?.amount ?? 0,
  );
  const minPrice = Number(product.priceRange.minVariantPrice.amount);
  // No variant has a compare-at price above the cheapest price, so none can
  // be above its own price.
  if (!(maxCompareAt > minPrice)) return false;
  if (product.variantsCount?.count === 1) {
    return isDiscounted(product.selectedOrFirstAvailableVariant);
  }
  return null;
}

/** @param {{price?: {amount: string}; compareAtPrice?: {amount: string} | null} | null | undefined} variant */
function isDiscounted(variant) {
  return (
    !!variant?.price &&
    !!variant.compareAtPrice &&
    Number(variant.compareAtPrice.amount) > Number(variant.price.amount)
  );
}

const SALE_VARIANTS_QUERY = `#graphql
  query SaleVariants(
    $ids: [ID!]!
    $first: Int!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    nodes(ids: $ids) {
      ... on Product {
        id
        variants(first: $first) {
          nodes {
            price {
              amount
            }
            compareAtPrice {
              amount
            }
          }
        }
      }
    }
  }
`;

/** @typedef {import('@shopify/hydrogen').Storefront} Storefront */
/**
 * @typedef {{
 *   id: string;
 *   priceRange: {minVariantPrice: {amount: string}};
 *   compareAtPriceRange?: {maxVariantPrice?: {amount: string}} | null;
 *   variantsCount?: {count: number} | null;
 *   selectedOrFirstAvailableVariant?: {
 *     price?: {amount: string};
 *     compareAtPrice?: {amount: string} | null;
 *   } | null;
 * }} SaleCandidate
 */
