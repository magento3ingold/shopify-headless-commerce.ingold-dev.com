import {createContext, useContext, useState, useSyncExternalStore} from 'react';
import {createLocalStorageAdapter} from './storage.js';
import {createWishlistStore} from './store.js';

/**
 * Wishlist state for the whole storefront.
 *
 * WishlistProvider owns one store. Components read it through hooks that use
 * useSyncExternalStore, which renders the empty server snapshot during SSR
 * and hydration, then switches to the stored list on the client — no
 * hydration mismatch and no `window` access on the server.
 *
 * To add logged-in sync later, pass a different adapter (same interface as
 * createLocalStorageAdapter) without touching any UI component.
 */
const WishlistContext = createContext(
  /** @type {import('./store.js').WishlistStore | null} */ (null),
);

/**
 * @param {{
 *   children: React.ReactNode;
 *   adapter?: import('./storage.js').WishlistAdapter;
 * }}
 */
export function WishlistProvider({children, adapter}) {
  const [store] = useState(() =>
    createWishlistStore(adapter ?? createLocalStorageAdapter()),
  );
  return (
    <WishlistContext.Provider value={store}>
      {children}
    </WishlistContext.Provider>
  );
}

function useWishlistStore() {
  const store = useContext(WishlistContext);
  if (!store) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return store;
}

/**
 * Full wishlist API. Re-renders when the list changes.
 */
export function useWishlist() {
  const store = useWishlistStore();
  const items = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  return {
    items,
    count: items.length,
    has: store.has,
    add: store.add,
    remove: store.remove,
    removeMany: store.removeMany,
    toggle: store.toggle,
    clear: store.clear,
  };
}

/**
 * Whether one product is wishlisted. Only re-renders when that answer
 * changes, so product grids stay cheap.
 * @param {string} productId
 */
export function useIsWishlisted(productId) {
  const store = useWishlistStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.has(productId),
    () => false,
  );
}

/** Number of wishlisted products (0 during SSR/hydration). */
export function useWishlistCount() {
  const store = useWishlistStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().length,
    () => 0,
  );
}

/** Store actions without subscribing to state. */
export function useWishlistActions() {
  return useWishlistStore();
}
