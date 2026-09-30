import {redirect, useLoaderData, useLocation} from 'react-router';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductCard} from '~/components/ProductCard';
import {PRODUCT_GRID_CLASSES} from '~/components/ProductGrid';
import {
  FILTERED_PRODUCT_GRID_CLASSES,
  FilteredEmptyState,
  ProductFilters,
} from '~/components/ProductFilters';
import {PRODUCT_CARD_FRAGMENT, PRODUCT_FILTER_FRAGMENT} from '~/lib/fragments';
import {
  getProductFilters,
  getSortOption,
  hasActiveFilters,
  isRefinedListing,
} from '~/lib/product-filters';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data, location}) => {
  return [
    {title: `Hydrogen | ${data?.collection.title ?? ''} Collection`},
    // Filtered/sorted variants of the listing are not separate pages.
    ...(isRefinedListing(new URLSearchParams(location.search))
      ? [{name: 'robots', content: 'noindex, follow'}]
      : []),
  ];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, params, request}) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });
  // Filtering and sorting happen in Shopify, driven by the URL.
  const {searchParams} = new URL(request.url);
  const filters = getProductFilters(searchParams);
  const {sortKey, reverse} = getSortOption(searchParams, 'collection');

  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection, localization}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {handle, filters, sortKey, reverse, ...paginationVariables},
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  const {language, country} = storefront.i18n;
  return {
    collection,
    currency: localization.country.currency,
    locale: `${language.toLowerCase()}-${country}`,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  return {};
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const {collection, currency, locale} = useLoaderData();
  const {search} = useLocation();
  const {filters, nodes} = collection.products;

  return (
    <div className="collection page-full-bleed ui-scope">
      <div className="page-width py-12 md:py-16">
        <header className="mb-10 max-w-2xl md:mb-12">
          <h1 className="font-display text-4xl leading-tight font-medium text-ink md:text-5xl">
            {collection.title}
          </h1>
          {collection.description ? (
            <p className="mt-4 text-base leading-relaxed text-muted">
              {collection.description}
            </p>
          ) : null}
        </header>
        <ProductFilters
          filters={filters}
          listing="collection"
          currency={currency}
          locale={locale}
        >
          {nodes.length ? (
            <PaginatedResourceSection
              connection={collection.products}
              resourcesClassName={
                filters.length
                  ? FILTERED_PRODUCT_GRID_CLASSES
                  : PRODUCT_GRID_CLASSES
              }
            >
              {({node: product, index}) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  loading={index < 4 ? 'eager' : 'lazy'}
                />
              )}
            </PaginatedResourceSection>
          ) : (
            <FilteredEmptyState
              hasFilters={hasActiveFilters(new URLSearchParams(search))}
              emptyMessage="This collection has no products yet."
            />
          )}
        </ProductFilters>
      </div>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  ${PRODUCT_FILTER_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    localization {
      country {
        currency {
          isoCode
          symbol
        }
      }
    }
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filters,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        filters {
          ...ProductFilter
        }
        nodes {
          ...ProductCard
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
`;

/** @typedef {import('./+types/collections.$handle').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductCardFragment} ProductCardFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
