import {Suspense} from 'react';
import {Await, useLoaderData, useRouteLoaderData} from 'react-router';
import {MockShopNotice} from '~/components/MockShopNotice';
import {HeroSlider} from '~/components/HeroSlider';
import {SectionHeading} from '~/components/SectionHeading';
import {CollectionGrid} from '~/components/CollectionGrid';
import {ProductGrid, ProductGridSkeleton} from '~/components/ProductGrid';
import {PromoSection} from '~/components/PromoSection';
import {BrandStory} from '~/components/BrandStory';
import {Benefits} from '~/components/Benefits';
import {Newsletter} from '~/components/Newsletter';
import {COLLECTION_CARD_FRAGMENT, PRODUCT_CARD_FRAGMENT} from '~/lib/fragments';
import {
  HOMEPAGE_NEWSLETTER_FRAGMENT,
  getHomepageNewsletter,
} from '~/lib/homepage-newsletter';
import {
  HOMEPAGE_BENEFIT_FRAGMENT,
  getHomepageBenefits,
} from '~/lib/homepage-benefits';
import {HOMEPAGE_ABOUT_FRAGMENT, getHomepageAbout} from '~/lib/homepage-about';
import {
  HOMEPAGE_BANNER_FRAGMENT,
  getHomepageBanners,
} from '~/lib/homepage-banners';
import {
  HOMEPAGE_PROMO_FRAGMENT,
  getHomepagePromos,
} from '~/lib/homepage-promos';
import {METAOBJECT_IMAGE_FRAGMENT} from '~/lib/metaobject-image';

/**
 * Handle of the collection shown in "Featured Products". Shopify creates a
 * `frontpage` ("Home page") collection by default. If it is missing or has
 * fewer than FEATURED_PRODUCTS_COUNT products, the newest products fill the
 * remaining slots.
 */
const FEATURED_COLLECTION_HANDLE = 'frontpage';
const FEATURED_PRODUCTS_COUNT = 8;

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches}) => {
  const root = matches.find((match) => match?.id === 'root');
  const shop = (root?.loaderData ?? root?.data)?.header?.shop;
  return [
    {title: shop?.name ?? 'Home'},
    ...(shop?.description
      ? [{name: 'description', content: shop.description}]
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
async function loadCriticalData({context, request}) {
  const {storefront, env} = context;

  const [{collections}, content] = await Promise.all([
    storefront.query(HOMEPAGE_COLLECTIONS_QUERY),
    // Banners (the hero is the LCP element) and promos share one request.
    // A failure only hides those two sections instead of the homepage.
    storefront
      .query(HOMEPAGE_CONTENT_QUERY, {cache: storefront.CacheShort()})
      .catch((error) => {
        console.error(error);
        return null;
      }),
  ]);

  // Links in Shopify content that point at these hosts stay internal.
  const linkOptions = {
    internalHosts: [new URL(request.url).hostname, env.PUBLIC_STORE_DOMAIN],
  };

  return {
    isShopLinked: Boolean(env.PUBLIC_STORE_DOMAIN),
    collections: collections.nodes,
    heroSlides: getHomepageBanners(
      content?.homepageBanners?.nodes ?? [],
      linkOptions,
    ),
    promos: getHomepagePromos(
      content?.homepagePromos?.nodes ?? [],
      linkOptions,
    ),
    newsletter: getHomepageNewsletter(content?.homepageNewsletter?.nodes?.[0]),
    benefits: getHomepageBenefits(content?.homepageBenefits?.nodes ?? []),
    about: getHomepageAbout(content?.homepageAbout?.nodes?.[0], linkOptions),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  const {storefront} = context;

  const recommendedProducts = storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .then(({products}) => products.nodes)
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return [];
    });

  // Curated collection first, topped up with the newest products (both
  // queries run in parallel) so the section is never sparse.
  const featuredProducts = Promise.all([
    storefront.query(FEATURED_PRODUCTS_QUERY, {
      variables: {handle: FEATURED_COLLECTION_HANDLE},
    }),
    storefront.query(NEWEST_PRODUCTS_QUERY),
  ])
    .then(([{collection}, {products}]) => {
      const curated = collection?.products.nodes ?? [];
      const curatedIds = new Set(curated.map((product) => product.id));
      const newest = products.nodes.filter(
        (product) => !curatedIds.has(product.id),
      );
      return [...curated, ...newest].slice(0, FEATURED_PRODUCTS_COUNT);
    })
    .catch((error) => {
      console.error(error);
      return [];
    });

  return {recommendedProducts, featuredProducts};
}

export default function Homepage() {
  /** @type {LoaderReturnData} */
  const data = useLoaderData();
  /** @type {RootLoader | undefined} */
  const rootData = useRouteLoaderData('root');
  const shopName = rootData?.header?.shop?.name;

  return (
    <div className="page-full-bleed ui-scope">
      <h1 className="sr-only">{shopName ?? 'Home'}</h1>
      {data.isShopLinked ? null : (
        <div className="page-width">
          <MockShopNotice />
        </div>
      )}

      <HeroSlider slides={data.heroSlides} />

      {data.collections.length ? (
        <section
          aria-labelledby="shop-by-collection"
          className="page-width py-16 md:py-24"
        >
          <SectionHeading
            id="shop-by-collection"
            eyebrow="Explore"
            title="Shop by Collection"
            action={{label: 'View all collections', to: '/collections'}}
          />
          <CollectionGrid collections={data.collections} />
        </section>
      ) : null}

      <ProductSection
        id="recommended-products"
        eyebrow="Curated picks"
        title="Recommended For You"
        products={data.recommendedProducts}
        action={{label: 'Shop all', to: '/collections/all'}}
        className="bg-surface"
      />

      <PromoSection promos={data.promos} />

      <ProductSection
        id="featured-products"
        eyebrow="Handpicked"
        title="Featured Products"
        products={data.featuredProducts}
        action={{label: 'Shop all', to: '/collections/all'}}
      />

      {data.about ? (
        <section
          aria-labelledby={data.about.heading ? 'homepage-about' : undefined}
          aria-label={data.about.heading ? undefined : 'About us'}
          className="page-width py-16 md:py-24"
        >
          <BrandStory
            id="homepage-about"
            heading={data.about.heading}
            body={data.about.body}
            cta={data.about.cta}
            image={data.about.image}
          />
        </section>
      ) : null}

      <Benefits benefits={data.benefits} />

      {data.newsletter ? <Newsletter content={data.newsletter} /> : null}
    </div>
  );
}

/**
 * A titled product grid fed by a deferred Storefront API query.
 * @param {{
 *   id: string;
 *   eyebrow?: string;
 *   title: string;
 *   products: Promise<ProductCardFragment[]>;
 *   action?: {label: string; to: string};
 *   className?: string;
 * }}
 */
function ProductSection({
  id,
  eyebrow,
  title,
  products,
  action,
  className = '',
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="page-width py-16 md:py-24">
        <SectionHeading
          id={id}
          eyebrow={eyebrow}
          title={title}
          action={action}
        />
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <Await resolve={products}>
            {(nodes) =>
              nodes.length ? (
                <ProductGrid products={nodes} />
              ) : (
                <p className="text-muted">Products will appear here soon.</p>
              )
            }
          </Await>
        </Suspense>
      </div>
    </section>
  );
}

/**
 * Homepage content managed as metaobjects in Shopify Admin. `enabled` and the
 * ordering fields are applied in code (the API cannot sort metaobjects by a
 * custom field), so more entries than are displayed are fetched.
 */
const HOMEPAGE_CONTENT_QUERY = `#graphql
  query HomepageContent($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    homepageBanners: metaobjects(type: "homepage_banner", first: 50) {
      nodes {
        ...HomepageBanner
      }
    }
    homepagePromos: metaobjects(type: "homepage_promo", first: 20) {
      nodes {
        ...HomepagePromo
      }
    }
    homepageAbout: metaobjects(type: "homepage_about_content", first: 1) {
      nodes {
        ...HomepageAbout
      }
    }
    homepageBenefits: metaobjects(type: "homepage_benefits", first: 20) {
      nodes {
        ...HomepageBenefit
      }
    }
    homepageNewsletter: metaobjects(type: "homepage_newsletter", first: 1) {
      nodes {
        ...HomepageNewsletter
      }
    }
  }
  ${HOMEPAGE_BANNER_FRAGMENT}
  ${HOMEPAGE_PROMO_FRAGMENT}
  ${HOMEPAGE_ABOUT_FRAGMENT}
  ${HOMEPAGE_BENEFIT_FRAGMENT}
  ${HOMEPAGE_NEWSLETTER_FRAGMENT}
  ${METAOBJECT_IMAGE_FRAGMENT}
`;

const HOMEPAGE_COLLECTIONS_QUERY = `#graphql
  query HomepageCollections($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...CollectionCard
      }
    }
  }
  ${COLLECTION_CARD_FRAGMENT}
`;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  query RecommendedProducts($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 8, sortKey: BEST_SELLING) {
      nodes {
        ...ProductCard
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

const FEATURED_PRODUCTS_QUERY = `#graphql
  query FeaturedProducts(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      products(first: 8) {
        nodes {
          ...ProductCard
        }
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

const NEWEST_PRODUCTS_QUERY = `#graphql
  query NewestProducts($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 8, sortKey: CREATED_AT, reverse: true) {
      nodes {
        ...ProductCard
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductCardFragment} ProductCardFragment */
/** @typedef {import('~/root').RootLoader} RootLoader */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
