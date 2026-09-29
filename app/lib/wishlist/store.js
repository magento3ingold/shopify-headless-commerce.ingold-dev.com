import {MAX_WISHLIST_ITEMS, sanitizeWishlist} from './storage.js';

/**
 * A tiny external store (compatible with React's useSyncExternalStore) that
 * owns the wishlist state and delegates persistence to an adapter.
 *
 * - SSR safe: nothing is read until the first client-side subscription, and
 *   the server snapshot is always the empty list, so hydration is stable.
 * - Snapshots are immutable arrays; unchanged state returns the same array,
 *   so components only re-render on real changes.
 * @param {import('./storage.js').WishlistAdapter} adapter
 * @return {WishlistStore}
 */
export function createWishlistStore(adapter) {
  /** @type {WishlistItem[]} */
  let items = EMPTY;
  /** @type {Set<string>} */
  let ids = new Set();
  let loaded = false;
  /** @type {Set<() => void>} */
  const listeners = new Set();
  /** @type {(() => void) | undefined} */
  let unsubscribeAdapter;

  const emit = () => listeners.forEach((listener) => listener());

  const setItems = (next, {persist}) => {
    items = next.length ? next : EMPTY;
    ids = new Set(items.map((item) => item.productId));
    if (persist) adapter.save(items);
    emit();
  };

  const ensureLoaded = () => {
    if (loaded || typeof window === 'undefined') return;
    loaded = true;
    const initial = adapter.load();
    items = initial.length ? initial : EMPTY;
    ids = new Set(items.map((item) => item.productId));
  };

  /** @type {WishlistStore} */
  const store = {
    subscribe(listener) {
      ensureLoaded();
      listeners.add(listener);
      if (listeners.size === 1 && adapter.subscribe) {
        // Another tab changed the list: reload and notify.
        unsubscribeAdapter = adapter.subscribe(() =>
          setItems(adapter.load(), {persist: false}),
        );
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          unsubscribeAdapter?.();
          unsubscribeAdapter = undefined;
        }
      };
    },

    getSnapshot() {
      ensureLoaded();
      return items;
    },

    getServerSnapshot() {
      return EMPTY;
    },

    has(productId) {
      ensureLoaded();
      return ids.has(productId);
    },

    add(item) {
      ensureLoaded();
      const [clean] = sanitizeWishlist([item]);
      if (!clean || ids.has(clean.productId)) return;
      // Newest first; oldest entries drop off beyond the limit.
      setItems([clean, ...items].slice(0, MAX_WISHLIST_ITEMS), {persist: true});
    },

    remove(productId) {
      ensureLoaded();
      if (!ids.has(productId)) return;
      setItems(
        items.filter((item) => item.productId !== productId),
        {persist: true},
      );
    },

    removeMany(productIds) {
      ensureLoaded();
      const drop = new Set(productIds);
      const next = items.filter((item) => !drop.has(item.productId));
      if (next.length !== items.length) setItems(next, {persist: true});
    },

    toggle(item) {
      ensureLoaded();
      if (ids.has(item.productId)) {
        store.remove(item.productId);
        return false;
      }
      store.add(item);
      return true;
    },

    clear() {
      ensureLoaded();
      if (items.length) setItems(EMPTY, {persist: true});
    },
  };
  return store;
}

/** @type {WishlistItem[]} */
const EMPTY = Object.freeze([]);

/** @typedef {import('./storage.js').WishlistItem} WishlistItem */
/**
 * @typedef {{
 *   subscribe: (listener: () => void) => () => void;
 *   getSnapshot: () => WishlistItem[];
 *   getServerSnapshot: () => WishlistItem[];
 *   has: (productId: string) => boolean;
 *   add: (item: WishlistItem) => void;
 *   remove: (productId: string) => void;
 *   removeMany: (productIds: string[]) => void;
 *   toggle: (item: WishlistItem) => boolean;
 *   clear: () => void;
 * }} WishlistStore
 */
