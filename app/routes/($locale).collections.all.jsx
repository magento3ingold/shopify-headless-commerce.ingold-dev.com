import {useLoaderData, useLocation} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
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
export const meta = ({location}) => {
  return [
    {title: `Hydrogen | Products`},
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
 *
 * The root `products` connection cannot be filtered, so filtered results
 * come from the product search (empty query + Shopify `productFilters`);
 * the filter definitions always come from the search.
 *
 * Unfiltered, the root `products` connection is used with normal cursor
 * pagination. Cursor pagination of an empty-query search is not reliable
 * (Shopify can return short pages, a wrong `hasNextPage` and repeated
 * products), so filtered results are loaded in one bounded request.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, request}) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });
  const {searchParams} = new URL(request.url);
  const filters = getProductFilters(searchParams);
  const {sortKey, productsSortKey, reverse} = getSortOption(
    searchParams,
    'search',
  );
  const filtered = filters.length > 0;

  const [{catalog, filteredCatalog, facets, localization}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {
        filtered,
        filters,
        sortKey,
        productsSortKey,
        reverse,
        filteredLimit: FILTERED_RESULTS_LIMIT,
        ...paginationVariables,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  const {language, country} = storefront.i18n;
  return {
    products: filtered
      ? {
          nodes: uniqueById(filteredCatalog.nodes),
          pageInfo: {
            hasPreviousPage: false,
            hasNextPage: false,
            startCursor: null,
            endCursor: null,
          },
        }
      : catalog,
    isLimited:
      filtered && filteredCatalog.nodes.length >= FILTERED_RESULTS_LIMIT,
    filters: (filtered ? filteredCatalog : facets).productFilters,
    currency: localization.country.currency,
    locale: `${language.toLowerCase()}-${country}`,
  };
}

/** Upper bound of filtered results loaded at once. */
const FILTERED_RESULTS_LIMIT = 100;

/**
 * @template {{id?: string}} T
 * @param {T[]} nodes
 * @return {T[]}
 */
function uniqueById(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    if (!node.id || seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
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
  const {products, isLimited, filters, currency, locale} = useLoaderData();
  const {search} = useLocation();

  return (
    <div className="collection page-full-bleed ui-scope">
      <div className="page-width py-12 md:py-16">
        <header className="mb-10 max-w-2xl md:mb-12">
          <h1 className="font-display text-4xl leading-tight font-medium text-ink md:text-5xl">
            Shop All Products
          </h1>
        </header>
        <ProductFilters
          filters={filters}
          listing="search"
          currency={currency}
          locale={locale}
        >
          {products.nodes.length ? (
            <PaginatedResourceSection
              connection={products}
              resourcesClassName={
                filters.length
                  ? FILTERED_PRODUCT_GRID_CLASSES
                  : PRODUCT_GRID_CLASSES
              }
            >
              {({node: product, index}) =>
                product.__typename === 'Product' ? (
                  <ProductCard
                    key={product.id}
                    product={product}
                    loading={index < 4 ? 'eager' : 'lazy'}
                  />
                ) : null
              }
            </PaginatedResourceSection>
          ) : null}
          {isLimited ? (
            <p className="mt-10 text-center text-sm text-muted">
              Showing the first {products.nodes.length} matching products. Add
              more filters to narrow the results.
            </p>
          ) : null}
          {products.nodes.length ? null : (
            <FilteredEmptyState
              hasFilters={hasActiveFilters(new URLSearchParams(search))}
            />
          )}
        </ProductFilters>
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/products
// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/search
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $filtered: Boolean!
    $filters: [ProductFilter!]
    $sortKey: SearchSortKeys
    $productsSortKey: ProductSortKeys
    $reverse: Boolean
    $filteredLimit: Int!
  ) @inContext(country: $country, language: $language) {
    localization {
      country {
        currency {
          isoCode
          symbol
        }
      }
    }
    catalog: products(
      first: $first
      last: $last
      before: $startCursor
      after: $endCursor
      sortKey: $productsSortKey
      reverse: $reverse
    ) @skip(if: $filtered) {
      nodes {
        __typename
        ...ProductCard
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
    facets: search(query: "", types: [PRODUCT], first: 1)
      @skip(if: $filtered) {
      productFilters {
        ...ProductFilter
      }
    }
    filteredCatalog: search(
      query: ""
      types: [PRODUCT]
      productFilters: $filters
      sortKey: $sortKey
      reverse: $reverse
      first: $filteredLimit
    ) @include(if: $filtered) {
      productFilters {
        ...ProductFilter
      }
      nodes {
        __typename
        ...ProductCard
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
  ${PRODUCT_FILTER_FRAGMENT}
`;

/** @typedef {import('./+types/collections.all').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductCardFragment} ProductCardFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
