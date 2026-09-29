import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import {useFetcher} from 'react-router';
import {ProductCard} from '~/components/ProductCard';
import {
  PRODUCT_GRID_CLASSES,
  ProductGridSkeleton,
} from '~/components/ProductGrid';
import {ButtonLink} from '~/components/ButtonLink';
import {PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import {getSiteSettings} from '~/lib/site-settings';
import {useLocalePath} from '~/lib/i18n';
import {useWishlist} from '~/lib/wishlist/context';
import {MAX_WISHLIST_ITEMS} from '~/lib/wishlist/storage';

const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches}) => {
  const root = matches.find((match) => match?.id === 'root');
  const {siteName} = getSiteSettings((root?.loaderData ?? root?.data)?.header);
  return [
    {title: `Wishlist | ${siteName}`},
    // Personal, browser-specific page: keep it out of search results.
    {name: 'robots', content: 'noindex, follow'},
  ];
};

/**
 * Page navigations return nothing: the wishlist lives in the browser. The
 * page then calls this loader through a fetcher with `?ids=` to get fresh
 * Shopify data for all saved products in one batched query.
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context}) {
  const url = new URL(request.url);
  const requested = [
    ...new Set(
      (url.searchParams.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => PRODUCT_GID.test(id)),
    ),
  ].slice(0, MAX_WISHLIST_ITEMS);

  if (!requested.length) return {products: [], missingIds: [], error: false};

  try {
    const {nodes} = await context.storefront.query(WISHLIST_PRODUCTS_QUERY, {
      variables: {ids: requested},
      cache: context.storefront.CacheShort(),
    });

    const products = nodes.filter((node) => node?.__typename === 'Product');
    const found = new Set(products.map((product) => product.id));
    // Deleted or unpublished products come back as null.
    const missingIds = requested.filter((id) => !found.has(id));

    return {products, missingIds, error: false};
  } catch (error) {
    console.error('[wishlist] Could not load products:', error);
    return {products: [], missingIds: [], error: true};
  }
}

export default function WishlistPage() {
  const {items, removeMany, remove, clear} = useWishlist();
  const hydrated = useHydrated();
  const localePath = useLocalePath();
  /** @type {import('react-router').FetcherWithComponents<LoaderData>} */
  const fetcher = useFetcher();
  const productsById = useRef(
    /** @type {Map<string, ProductCardFragment>} */ (new Map()),
  );

  const ids = useMemo(() => items.map((item) => item.productId), [items]);

  // Remember every product fetched so far, so removing an item never
  // triggers a new request.
  if (fetcher.data?.products) {
    for (const product of fetcher.data.products) {
      productsById.current.set(product.id, product);
    }
  }

  const unknownIds = ids.filter((id) => !productsById.current.has(id));
  const unknownKey = unknownIds.join(',');
  const missingIds = fetcher.data?.missingIds;

  // Fetch current Shopify data whenever the list contains products we have
  // not loaded yet (first visit, added in another tab...).
  useEffect(() => {
    if (!hydrated || !unknownKey || fetcher.state !== 'idle') return;
    if (missingIds && unknownIds.every((id) => missingIds.includes(id))) return;
    const params = new URLSearchParams({ids: unknownKey});
    fetcher.load(`${localePath('/wishlist')}?${params}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, unknownKey, fetcher.state, localePath]);

  // Products that no longer exist are dropped from the saved wishlist.
  useEffect(() => {
    if (missingIds?.length) removeMany(missingIds);
  }, [missingIds, removeMany]);

  const products = ids
    .map((id) => productsById.current.get(id))
    .filter(Boolean);
  // Loading until hydrated and every saved product has been fetched.
  const isLoading =
    !hydrated || (unknownIds.length > 0 && !fetcher.data?.error);
  const isEmpty = hydrated && ids.length === 0;

  return (
    <div className="page-full-bleed ui-scope">
      <div className="page-width py-12 md:py-16">
        <header className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-4xl leading-tight font-medium text-ink md:text-5xl">
              Wishlist
            </h1>
            {hydrated && ids.length ? (
              <p className="mt-3 text-sm text-muted" aria-live="polite">
                {ids.length} {ids.length === 1 ? 'item' : 'items'} saved
              </p>
            ) : null}
          </div>
          {hydrated && ids.length ? (
            <button
              type="button"
              onClick={clear}
              className="self-start text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline md:self-auto"
            >
              Clear wishlist
            </button>
          ) : null}
        </header>

        {isEmpty ? (
          <div className="rounded-card border border-line bg-surface px-6 py-16 text-center">
            <p className="text-lg text-ink">Your wishlist is empty.</p>
            <p className="mt-2 text-sm text-muted">
              Tap the heart on any product to save it here.
            </p>
            <ButtonLink to="/collections/all" className="mt-8">
              Continue Shopping
            </ButtonLink>
          </div>
        ) : fetcher.data?.error && !products.length ? (
          <div
            role="alert"
            className="rounded-card border border-line bg-surface px-6 py-12 text-center"
          >
            <p className="text-ink">
              We couldn&rsquo;t load your wishlist right now.
            </p>
            <button
              type="button"
              onClick={() =>
                fetcher.load(
                  `${localePath('/wishlist')}?${new URLSearchParams({ids: unknownKey})}`,
                )
              }
              className="mt-6 text-sm font-semibold text-ink underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : products.length ? (
          <ul className={PRODUCT_GRID_CLASSES}>
            {products.map((product) => (
              <li key={product.id} className="flex flex-col">
                <ProductCard product={product} loading="lazy" />
                <button
                  type="button"
                  onClick={() => remove(product.id)}
                  className="mt-3 self-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Remove
                  <span className="sr-only">
                    {' '}
                    {product.title} from wishlist
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : isLoading ? (
          <ProductGridSkeleton count={Math.min(Math.max(ids.length, 4), 8)} />
        ) : null}
      </div>
    </div>
  );
}

/** False during SSR and hydration, true afterwards (no mismatch). */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const noopSubscribe = () => () => {};

// One request for every saved product. Market pricing via @inContext.
const WISHLIST_PRODUCTS_QUERY = `#graphql
  query WishlistProducts(
    $ids: [ID!]!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    nodes(ids: $ids) {
      __typename
      ... on Product {
        ...ProductCard
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

/**
 * @typedef {{
 *   products: ProductCardFragment[];
 *   missingIds: string[];
 *   error: boolean;
 * }} LoaderData
 */

/** @typedef {import('./+types/wishlist').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductCardFragment} ProductCardFragment */
