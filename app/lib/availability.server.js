/**
 * Customer-facing availability for product listings.
 *
 * A product is available when at least one variant is available for sale,
 * and sold out only when every variant is unavailable. Shopify's
 * product-level `availableForSale` follows exactly this rule, so listings
 * use it directly (no variant fetching).
 *
 * Shopify's "Out of stock" filter value (`available: false`) however matches
 * per variant: it also returns products with a single sold-out size while
 * other sizes can still be bought. Listings therefore keep only products
 * whose `availableForSale` is false, and correct the value's count, from one
 * bounded request each; nothing here walks the whole catalog.
 */

/** Products examined per request for the corrected "Out of stock" view. */
export const SOLD_OUT_SCAN_LIMIT = 100;

/**
 * Products where no variant can be bought.
 * @template {{availableForSale: boolean}} T
 * @param {T[]} products
 * @return {T[]}
 */
export function onlySoldOut(products) {
  return products.filter((product) => product.availableForSale === false);
}

/**
 * Corrected "Out of stock" count from Shopify's `available: false`
 * candidates, or null when more candidates exist than were examined.
 * @param {{availableForSale: boolean}[]} candidates
 * @param {boolean} complete whether `candidates` holds every match
 * @return {number | null}
 */
export function countSoldOut(candidates, complete) {
  return complete ? onlySoldOut(candidates).length : null;
}
