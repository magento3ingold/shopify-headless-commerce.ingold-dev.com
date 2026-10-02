import {Suspense} from 'react';
import {Await, useLoaderData} from 'react-router';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {ProductReviews} from '~/components/reviews/ProductReviews';
import {
  ProductRatingSummary,
  ProductRatingSummaryPlaceholder,
} from '~/components/reviews/ProductRatingSummary';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {loadProductReviews} from '~/lib/product-reviews.server';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [
    {title: `Hydrogen | ${data?.product.title ?? ''}`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
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

  return {
    ...deferredData,
    ...criticalData,
    // Approved "Custom Product Review" metaobjects, read on the server via
    // the Admin API. Streams in without blocking the page; never throws.
    reviews: loadProductReviews(args.context, {
      productId: criticalData.product.id,
    }),
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, params, request}) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context, params}) {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  return {};
}

export default function Product() {
  /** @type {LoaderReturnData} */
  const {product, reviews} = useLoaderData();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;
  const images = product.media.nodes
    .map((media) => media.image)
    .filter(Boolean);

  return (
    <div className="product-page page-full-bleed ui-scope">
      <div className="page-width py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <ProductGallery
            images={images}
            title={title}
            selectedImageUrl={selectedVariant?.image?.url}
          />
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h1 className="font-display text-3xl leading-tight font-medium text-ink md:text-4xl">
              {title}
            </h1>
            <Suspense fallback={<ProductRatingSummaryPlaceholder />}>
              <Await resolve={reviews} errorElement={null}>
                {(result) => <ProductRatingSummary result={result} />}
              </Await>
            </Suspense>
            <div className="mt-4 text-lg">
              <ProductPrice
                price={selectedVariant?.price}
                compareAtPrice={selectedVariant?.compareAtPrice}
              />
            </div>
            <div className="mt-8">
              <ProductForm
                productOptions={productOptions}
                selectedVariant={selectedVariant}
                product={product}
              />
            </div>
            {descriptionHtml ? (
              <div className="mt-10 border-t border-line pt-8">
                <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
                  Description
                </h2>
                <div
                  className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft"
                  dangerouslySetInnerHTML={{__html: descriptionHtml}}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-16 md:mt-24">
          <Suspense
            fallback={<ProductReviews product={product} result={null} />}
          >
            <Await
              resolve={reviews}
              errorElement={
                <ProductReviews
                  product={product}
                  result={{status: 'unavailable', reason: 'ERROR'}}
                />
              }
            >
              {(result) => <ProductReviews product={product} result={result} />}
            </Await>
          </Suspense>
        </div>
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
`;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
    media(first: 20) {
      nodes {
        ... on MediaImage {
          id
          image {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
`;

/** @typedef {import('./+types/products.$handle').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
