import {useIsWishlisted, useWishlistActions} from '~/lib/wishlist/context';
import {HeartIcon} from '~/components/Icons';

const VARIANTS = {
  // Round icon button over a product card image.
  icon: {
    base: 'inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur-sm transition-colors duration-200 hover:bg-white',
    active: 'text-sale',
    iconClass: 'size-5',
  },
  // Outlined button with text, next to Add to Cart on the product page.
  full: {
    base: 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors duration-200 sm:w-auto',
    idle: 'border-line text-ink hover:border-ink',
    active: 'border-ink bg-surface text-ink',
    iconClass: 'size-5',
  },
};

/**
 * Toggles a product in the wishlist. Shared by product cards, the product
 * page and the wishlist page; all state lives in WishlistProvider.
 *
 * It is a real <button> (never inside the product link) with aria-pressed
 * and a label naming the product.
 * @param {{
 *   product: {id: string; handle: string; title: string};
 *   variant?: keyof typeof VARIANTS;
 *   className?: string;
 * }}
 */
export function WishlistButton({product, variant = 'icon', className = ''}) {
  const isWishlisted = useIsWishlisted(product.id);
  const {toggle} = useWishlistActions();
  const styles = VARIANTS[variant];

  return (
    <button
      type="button"
      aria-pressed={isWishlisted}
      // Icon-only buttons name the product; the text variant uses its
      // visible text as the accessible name (WCAG "label in name").
      aria-label={
        variant === 'icon'
          ? isWishlisted
            ? `Remove ${product.title} from wishlist`
            : `Add ${product.title} to wishlist`
          : undefined
      }
      onClick={(event) => {
        // Never trigger a surrounding card link or form.
        event.preventDefault();
        event.stopPropagation();
        toggle({productId: product.id, handle: product.handle});
      }}
      className={`cursor-pointer ${styles.base} ${
        isWishlisted ? styles.active : (styles.idle ?? '')
      } ${className}`}
    >
      <HeartIcon
        filled={isWishlisted}
        className={`${styles.iconClass} ${
          isWishlisted && variant === 'full' ? 'text-sale' : ''
        }`}
      />
      {variant === 'full' ? (
        <span>{isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}</span>
      ) : null}
    </button>
  );
}
