/**
 * Browser store for a signed-in customer's wishlist, persisted in Shopify
 * through the `/api/wishlist` route (customer metafield custom.wishlist).
 *
 * Same interface as the guest store (./store.js) so every UI component works
 * unchanged. Changes are applied optimistically and sent as operations
 * (add/remove/merge/clear) one at a time; the server's response is the
 * source of truth. On failure the store re-reads Shopify, so the UI never
 * pretends an unsaved change was saved, and exposes the error.
 * @param {{endpoint?: string; fetch?: typeof fetch}} [options]
 * @return {CustomerWishlistStore}
 */
export function createCustomerWishlistStore({
  endpoint = '/api/wishlist',
  fetch: fetchImpl,
} = {}) {
  /** @type {WishlistItem[]} */
  let items = EMPTY;
  let ids = new Set();
  /** @type {WishlistSyncError | null} */
  let lastError = null;
  const listeners = new Set();
  /** @type {WishlistOperation[]} */
  const queue = [];
  let processing = false;

  const request = (...args) => (fetchImpl ?? globalThis.fetch)(...args);
  const emit = () => listeners.forEach((listener) => listener());
  const setItems = (next) => {
    items = next.length ? next : EMPTY;
    ids = new Set(items.map((item) => item.productId));
  };

  /** @return {Promise<{ok: boolean; items?: WishlistItem[]; error?: WishlistSyncError}>} */
  const call = async (init) => {
    try {
      const response = await request(endpoint, {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        ...init,
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) return {ok: true, items: body.items ?? []};
      return {
        ok: false,
        error: {
          status: response.status,
          code:
            body?.error?.code ??
            (response.status === 401 ? 'NOT_AUTHENTICATED' : 'HTTP_ERROR'),
          message:
            body?.error?.message ??
            'Your wishlist could not be synced with your account.',
        },
      };
    } catch {
      return {
        ok: false,
        error: {
          status: 0,
          code: 'NETWORK_ERROR',
          message: 'Your wishlist could not be synced (network error).',
        },
      };
    }
  };

  const fail = (error) => {
    lastError = error;
    console.warn(
      `[wishlist] account sync failed: ${error.code} (HTTP ${error.status})`,
    );
  };

  const processQueue = async () => {
    if (processing) return;
    processing = true;
    while (queue.length) {
      const operation = queue[0];
      const result = await call({
        method: 'POST',
        body: JSON.stringify(operation),
      });
      queue.shift();
      if (!result.ok) {
        // Drop pending optimistic changes and show what Shopify really has.
        queue.length = 0;
        fail(result.error);
        const fresh = await call({method: 'GET'});
        if (fresh.ok) setItems(fresh.items);
        emit();
        break;
      }
      lastError = null;
      // Only adopt the server state once nothing else is pending, so
      // queued optimistic changes do not flicker.
      if (!queue.length) {
        setItems(result.items);
        emit();
      }
    }
    processing = false;
  };

  const enqueue = (operation, optimistic) => {
    setItems(optimistic);
    emit();
    queue.push(operation);
    void processQueue();
  };

  /** @type {CustomerWishlistStore} */
  const store = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => items,
    getServerSnapshot: () => EMPTY,
    has: (productId) => ids.has(productId),

    add(item) {
      if (ids.has(item.productId)) return;
      enqueue({type: 'add', item}, [item, ...items]);
    },
    remove(productId) {
      if (!ids.has(productId)) return;
      enqueue(
        {type: 'remove', productIds: [productId]},
        items.filter((item) => item.productId !== productId),
      );
    },
    removeMany(productIds) {
      const drop = productIds.filter((id) => ids.has(id));
      if (!drop.length) return;
      const set = new Set(drop);
      enqueue(
        {type: 'remove', productIds: drop},
        items.filter((item) => !set.has(item.productId)),
      );
    },
    toggle(item) {
      if (ids.has(item.productId)) {
        store.remove(item.productId);
        return false;
      }
      store.add(item);
      return true;
    },
    clear() {
      if (items.length) enqueue({type: 'clear'}, EMPTY);
    },

    /** Loads the saved wishlist. Resolves true when Shopify answered. */
    async load() {
      const result = await call({method: 'GET'});
      if (result.ok) {
        lastError = null;
        setItems(result.items);
      } else {
        fail(result.error);
      }
      emit();
      return result.ok;
    },

    /**
     * Merges guest items into the saved wishlist. Resolves true only when
     * Shopify confirmed the merged list was saved.
     * @param {WishlistItem[]} guestItems
     */
    async merge(guestItems) {
      const result = await call({
        method: 'POST',
        body: JSON.stringify({type: 'merge', items: guestItems}),
      });
      if (result.ok) {
        lastError = null;
        setItems(result.items);
      } else {
        fail(result.error);
      }
      emit();
      return result.ok;
    },

    /** Re-reads Shopify (e.g. when returning to the tab) unless busy. */
    async refresh() {
      if (processing || queue.length) return;
      const result = await call({method: 'GET'});
      if (result.ok && !processing && !queue.length) {
        setItems(result.items);
        emit();
      }
    },

    getError: () => lastError,
  };
  return store;
}

/** @type {WishlistItem[]} */
const EMPTY = Object.freeze([]);

/** @typedef {import('./storage.js').WishlistItem} WishlistItem */
/**
 * @typedef {(
 *   | {type: 'add'; item: WishlistItem}
 *   | {type: 'remove'; productIds: string[]}
 *   | {type: 'merge'; items: WishlistItem[]}
 *   | {type: 'clear'}
 * )} WishlistOperation
 */
/** @typedef {{status: number; code: string; message: string}} WishlistSyncError */
/**
 * @typedef {import('./store.js').WishlistStore & {
 *   load: () => Promise<boolean>;
 *   merge: (items: WishlistItem[]) => Promise<boolean>;
 *   refresh: () => Promise<void>;
 *   getError: () => WishlistSyncError | null;
 * }} CustomerWishlistStore
 */
