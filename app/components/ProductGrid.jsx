import {ProductCard} from '~/components/ProductCard';

/** Grid columns shared with paginated collection pages. */
export const PRODUCT_GRID_CLASSES =
  'grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4';

/**
 * @param {{
 *   products: ProductCardFragment[];
 *   eagerCount?: number;
 * }}
 */
export function ProductGrid({products, eagerCount = 0}) {
  return (
    <ul className={`ui-scope ${PRODUCT_GRID_CLASSES}`}>
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            loading={index < eagerCount ? 'eager' : 'lazy'}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Placeholder with the same footprint as ProductGrid, shown while deferred
 * product data streams in so the page does not shift.
 * @param {{count?: number}}
 */
export function ProductGridSkeleton({count = 8}) {
  return (
    <div className={PRODUCT_GRID_CLASSES} aria-hidden="true">
      {Array.from({length: count}, (_, index) => (
        <div key={index} className="animate-pulse motion-reduce:animate-none">
          <div className="aspect-[4/5] rounded-card bg-surface" />
          <div className="mt-4 h-4 w-3/4 rounded bg-surface" />
          <div className="mt-2 h-4 w-1/3 rounded bg-surface" />
          <div className="mt-4 h-10 rounded-full bg-surface" />
        </div>
      ))}
    </div>
  );
}

/** @typedef {import('storefrontapi.generated').ProductCardFragment} ProductCardFragment */
