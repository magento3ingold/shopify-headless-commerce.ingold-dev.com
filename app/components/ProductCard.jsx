import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {AddToCartButton} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';
import {BagIcon} from '~/components/Icons';
import {WishlistButton} from '~/components/WishlistButton';

const ACTION_CLASSES =
  'inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-200';

/**
 * Product tile used across the storefront. Data comes from the
 * `ProductCard` fragment in ~/lib/fragments.
 *
 * Add to cart is offered only when it is unambiguous: the product has a
 * single variant, is available and does not require a selling plan.
 * Otherwise the shopper is sent to the product page to choose options.
 *
 * The sale price and struck-through compare-at price are shown when the
 * displayed variant has `compareAtPrice > price`. `onSale` marks a product
 * the server verified as discounted on another variant (the "On sale"
 * filter), which shows the Sale badge only.
 * @param {{
 *   product: ProductCardFragment;
 *   loading?: 'eager' | 'lazy';
 *   onSale?: boolean;
 * }}
 */
export function ProductCard({product, loading = 'lazy', onSale = false}) {
  const url = useVariantUrl(product.handle);
  const {open} = useAside();

  const variant = product.selectedOrFirstAvailableVariant;
  const image = product.featuredImage ?? variant?.image;
  const minPrice = product.priceRange.minVariantPrice;
  const maxPrice = product.priceRange.maxVariantPrice;
  const price = variant?.price ?? minPrice;
  const compareAtPrice = variant?.compareAtPrice;

  const hasPriceRange = minPrice.amount !== maxPrice.amount;
  const isOnSale =
    !!compareAtPrice &&
    Number(compareAtPrice.amount) > Number(price.amount) &&
    price.amount === minPrice.amount;
  const showSaleBadge = isOnSale || onSale;
  const isAvailable = product.availableForSale;
  const canQuickAdd =
    isAvailable &&
    !!variant?.availableForSale &&
    product.variantsCount?.count === 1 &&
    !product.requiresSellingPlan;

  return (
    <article className="ui-scope group flex h-full flex-col">
      {/* The wishlist button sits over the image but outside the link, so
          it never navigates and is not part of the product link. */}
      <div className="relative">
        <Link
          to={url}
          prefetch="intent"
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-[4/5] overflow-hidden rounded-card bg-surface"
        >
          {image ? (
            <Image
              data={image}
              alt={image.altText || product.title}
              aspectRatio="4/5"
              loading={loading}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted/60">
              <BagIcon className="size-10" strokeWidth={1.2} />
              <span className="text-xs tracking-wide">Image coming soon</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {!isAvailable ? (
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink uppercase shadow-sm">
                Sold out
              </span>
            ) : showSaleBadge ? (
              <span className="rounded-full bg-sale px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                Sale
              </span>
            ) : null}
          </div>
        </Link>
        <WishlistButton
          product={product}
          className="absolute top-2.5 right-2.5"
        />
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="text-sm leading-snug font-medium text-ink md:text-base">
          <Link
            to={url}
            prefetch="intent"
            className="underline-offset-4 hover:underline"
          >
            {product.title}
          </Link>
        </h3>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          {hasPriceRange ? (
            <span className={isOnSale ? 'font-semibold text-sale' : 'text-ink'}>
              From <Money as="span" data={minPrice} />
            </span>
          ) : (
            <span
              className={`font-semibold ${isOnSale ? 'text-sale' : 'text-ink'}`}
            >
              {isOnSale ? <span className="sr-only">Sale price </span> : null}
              <Money as="span" data={price} />
            </span>
          )}
          {isOnSale && compareAtPrice ? (
            <s className="text-muted">
              <span className="sr-only">Regular price </span>
              <Money as="span" data={compareAtPrice} />
            </s>
          ) : null}
        </div>

        {!isAvailable ? (
          <p className="mt-1 text-xs font-medium text-muted">Sold out</p>
        ) : null}

        <div className="mt-auto pt-4">
          {canQuickAdd && variant ? (
            <AddToCartButton
              className={`${ACTION_CLASSES} cursor-pointer bg-ink text-white hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60`}
              onClick={() => open('cart')}
              lines={[
                {
                  merchandiseId: variant.id,
                  quantity: 1,
                  selectedVariant: variant,
                },
              ]}
            >
              Add to cart
              <span className="sr-only">: {product.title}</span>
            </AddToCartButton>
          ) : isAvailable ? (
            <Link
              to={url}
              prefetch="intent"
              className={`${ACTION_CLASSES} border border-line text-ink hover:border-ink`}
            >
              Choose options
              <span className="sr-only">: {product.title}</span>
            </Link>
          ) : (
            <span
              className={`${ACTION_CLASSES} cursor-not-allowed border border-line text-muted`}
              aria-hidden="true"
            >
              Sold out
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** @typedef {import('storefrontapi.generated').ProductCardFragment} ProductCardFragment */
