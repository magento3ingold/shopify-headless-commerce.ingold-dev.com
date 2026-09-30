import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import {createLocalStorageAdapter} from './storage.js';
import {createWishlistStore} from './store.js';
import {createCustomerWishlistStore} from './customer-store.js';

/**
 * Wishlist state for the whole storefront.
 *
 * - Guests: localStorage store (./store.js + ./storage.js).
 * - Signed-in customers: Shopify customer metafield custom.wishlist through
 *   /api/wishlist (./customer-store.js), shared across browsers/devices.
 *
 * Components read the *active* store through hooks built on
 * useSyncExternalStore: SSR and hydration always render the empty server
 * snapshot, so there is no hydration mismatch and no `window` access on the
 * server. The switch to the customer store happens after hydration.
 */
const WishlistContext = createContext(
  /** @type {import('./store.js').WishlistStore | null} */ (null),
);
const WishlistSyncContext = createContext(
  /** @type {WishlistSyncState} */ ({mode: 'guest', error: null}),
);

/** Refresh the customer wishlist when returning to the tab, at most this often. */
const REFRESH_INTERVAL_MS = 15_000;

/**
 * @param {{
 *   children: React.ReactNode;
 *   isLoggedIn?: Promise<boolean> | boolean;
 *   adapter?: import('./storage.js').WishlistAdapter;
 * }}
 */
export function WishlistProvider({children, isLoggedIn, adapter}) {
  const [guestStore] = useState(() =>
    createWishlistStore(adapter ?? createLocalStorageAdapter()),
  );
  const [customerStore] = useState(() => createCustomerWishlistStore());
  const [sync, setSync] = useState(
    /** @type {WishlistSyncState} */ ({mode: 'guest', error: null}),
  );

  // Login: merge guest items into the account wishlist, clear guest storage
  // only after Shopify confirmed the save, then switch to the account.
  useEffect(() => {
    let cancelled = false;

    Promise.resolve(isLoggedIn)
      .then(async (loggedIn) => {
        if (!loggedIn || cancelled) return;

        const guestItems = guestStore.getSnapshot();
        const merged = guestItems.length
          ? await customerStore.merge(guestItems)
          : false;
        if (cancelled) return;

        if (merged) {
          guestStore.clear();
          setSync({mode: 'customer', error: null});
          return;
        }

        // No guest items, or the merge failed: load the account wishlist.
        // Guest items stay in storage and are merged again next time.
        const mergeError = guestItems.length ? customerStore.getError() : null;
        if (mergeError?.status === 403) {
          // Shopify refuses writes (metafield access/scopes not configured):
          // keep the working guest wishlist and report the problem.
          setSync({mode: 'guest', error: mergeError});
          return;
        }
        const loaded = await customerStore.load();
        if (cancelled) return;
        setSync(
          loaded
            ? {mode: 'customer', error: mergeError}
            : // Account unreachable: keep the guest wishlist usable.
              {mode: 'guest', error: customerStore.getError()},
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, guestStore, customerStore]);

  // Cross-device freshness: re-read the account wishlist when the tab
  // becomes visible again.
  useEffect(() => {
    if (sync.mode !== 'customer') return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last < REFRESH_INTERVAL_MS) return;
      last = Date.now();
      void customerStore.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sync.mode, customerStore]);

  // Surface write failures of the customer store (e.g. missing permission).
  useEffect(() => {
    if (sync.mode !== 'customer') return;
    return customerStore.subscribe(() => {
      const error = customerStore.getError();
      setSync((current) =>
        current.error === error ? current : {...current, error},
      );
    });
  }, [sync.mode, customerStore]);

  const store = sync.mode === 'customer' ? customerStore : guestStore;
  return (
    <WishlistSyncContext.Provider value={sync}>
      <WishlistContext.Provider value={store}>
        {children}
      </WishlistContext.Provider>
    </WishlistSyncContext.Provider>
  );
}

/**
 * Which storage is active and the last account-sync error, if any.
 * @return {WishlistSyncState}
 */
export function useWishlistSync() {
  return useContext(WishlistSyncContext);
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

/**
 * @typedef {{
 *   mode: 'guest' | 'customer';
 *   error: import('./customer-store.js').WishlistSyncError | null;
 * }} WishlistSyncState
 */
