/**
 * Wishlist persistence adapters.
 *
 * The wishlist UI never talks to localStorage directly; it goes through a
 * WishlistAdapter (see ./store.js). This first version uses browser
 * localStorage for guests. A logged-in adapter (e.g. Customer Account API
 * metafields via a server route) can later implement the same interface:
 *
 *   load(): WishlistItem[]                 read the current list
 *   save(items: WishlistItem[]): void      persist the list
 *   subscribe(onExternalChange): () => void  optional external updates
 *
 * Only minimal, stable identifiers are stored; product data (price, image,
 * availability) is always fetched fresh from Shopify.
 */

/** The single localStorage key for the guest wishlist. */
export const WISHLIST_STORAGE_KEY = 'hydrogen_wishlist';

/** Guest wishlists expire when not updated for this long. */
export const GUEST_WISHLIST_TTL_MS = 15 * 24 * 60 * 60 * 1000;

/** Upper bound that keeps storage small and the batch query fast. */
export const MAX_WISHLIST_ITEMS = 100;

const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;
const HANDLE = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;

/**
 * Validates and de-duplicates untrusted data (e.g. from localStorage).
 * Anything malformed is dropped rather than throwing.
 * @param {unknown} value
 * @return {WishlistItem[]}
 */
export function sanitizeWishlist(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  /** @type {WishlistItem[]} */
  const items = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const {productId, handle} = /** @type {Record<string, unknown>} */ (entry);
    if (typeof productId !== 'string' || !PRODUCT_GID.test(productId)) continue;
    if (typeof handle !== 'string' || !HANDLE.test(handle)) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    items.push({productId, handle});
    if (items.length >= MAX_WISHLIST_ITEMS) break;
  }
  return items;
}

/**
 * Guest wishlist stored in window.localStorage. Safe to create during server
 * rendering: nothing touches `window` until a method is called in the
 * browser.
 * @param {string} [key]
 * @return {WishlistAdapter}
 */
export function createLocalStorageAdapter(key = WISHLIST_STORAGE_KEY) {
  const storage = () => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      // Access can throw (privacy modes, disabled storage).
      return null;
    }
  };

  return {
    load() {
      const raw = storage()?.getItem(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        // Legacy format: a bare array (saved before expiry was added).
        if (Array.isArray(parsed)) return sanitizeWishlist(parsed);
        const updatedAt = Number(parsed?.updatedAt);
        if (
          !Number.isFinite(updatedAt) ||
          Date.now() - updatedAt > GUEST_WISHLIST_TTL_MS
        ) {
          // Expired (15 days without changes) or unreadable: start fresh.
          storage()?.removeItem(key);
          return [];
        }
        return sanitizeWishlist(parsed.items);
      } catch {
        // Corrupt JSON: reset instead of failing on every page.
        storage()?.removeItem(key);
        return [];
      }
    },

    save(items) {
      try {
        const store = storage();
        if (!store) return;
        if (items.length) {
          store.setItem(
            key,
            JSON.stringify({version: 1, updatedAt: Date.now(), items}),
          );
        } else {
          store.removeItem(key);
        }
      } catch {
        // Quota exceeded or storage disabled: keep the in-memory state.
      }
    },

    // The `storage` event fires in *other* tabs when this key changes.
    subscribe(onExternalChange) {
      if (typeof window === 'undefined') return () => {};
      const handler = (event) => {
        if (event.key === key || event.key === null) onExternalChange();
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  };
}

/**
 * @typedef {{productId: string; handle: string}} WishlistItem
 */
/**
 * @typedef {{
 *   load: () => WishlistItem[];
 *   save: (items: WishlistItem[]) => void;
 *   subscribe?: (onExternalChange: () => void) => () => void;
 * }} WishlistAdapter
 */
