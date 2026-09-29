import {Suspense} from 'react';
import {Await, Link, NavLink, useAsyncValue} from 'react-router';
import {useAnalytics, useOptimisticCart} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import {useLocalePath} from '~/lib/i18n';
import {getSiteSettings} from '~/lib/site-settings';
import {DesktopNavigation} from '~/components/HeaderNavigation';
import {
  BagIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from '~/components/Icons';
import {useWishlistCount} from '~/lib/wishlist/context';

const ICON_BUTTON_BASE =
  'relative size-10 items-center justify-center rounded-full text-ink transition-colors duration-200 hover:bg-surface';
const ICON_BUTTON = `inline-flex ${ICON_BUTTON_BASE}`;

/**
 * @param {HeaderProps}
 */
export function Header({header, navigation, isLoggedIn, cart}) {
  const siteSettings = getSiteSettings(header);

  return (
    <header className="ui-scope sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md">
      <div className="page-width flex h-16 items-center gap-2 md:h-20 md:gap-6">
        <MobileMenuToggle />
        <BrandLogo {...siteSettings} />
        {/* Menu items come from Shopify, so the inline menu starts at lg to
            leave room for longer menus; smaller screens use the drawer. */}
        <nav
          aria-label="Main"
          className="hidden min-w-0 flex-1 justify-center lg:flex"
        >
          <DesktopNavigation items={navigation} />
        </nav>
        <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
      </div>
    </header>
  );
}

const LOGO_IMAGE_CLASSES =
  'block h-8 w-auto max-w-[160px] object-contain object-left md:h-10 md:max-w-[220px]';

/**
 * Site logo from the "Site Settings" metaobject, linking to the homepage.
 * - `logo` on desktop; `mobile_logo` below 768px (falls back to `logo`).
 * - `<picture>` means only the image for the current breakpoint downloads.
 * - Without any logo, the site name is shown as text.
 * @param {SiteSettings}
 */
function BrandLogo({siteName, logo, mobileLogo}) {
  const localePath = useLocalePath();
  const hasDistinctMobileLogo = !!mobileLogo && mobileLogo.url !== logo?.url;

  return (
    <Link
      to={localePath('/')}
      prefetch="intent"
      className="mr-auto flex min-w-0 items-center md:mr-0"
    >
      {logo ? (
        <picture>
          {hasDistinctMobileLogo ? (
            <source
              media="(max-width: 767px)"
              srcSet={mobileLogo.url}
              width={mobileLogo.width}
              height={mobileLogo.height}
            />
          ) : null}
          <img
            src={logo.url}
            alt={siteName}
            width={logo.width}
            height={logo.height}
            decoding="async"
            className={LOGO_IMAGE_CLASSES}
          />
        </picture>
      ) : mobileLogo ? (
        // Only a mobile logo is configured: image on mobile, name on desktop.
        <>
          <img
            src={mobileLogo.url}
            alt={siteName}
            width={mobileLogo.width}
            height={mobileLogo.height}
            decoding="async"
            className={`${LOGO_IMAGE_CLASSES} md:hidden`}
          />
          <SiteNameText siteName={siteName} className="hidden md:block" />
        </>
      ) : (
        <SiteNameText siteName={siteName} />
      )}
    </Link>
  );
}

/**
 * @param {{siteName: string; className?: string}}
 */
function SiteNameText({siteName, className = ''}) {
  return (
    <span
      className={`truncate font-display text-xl font-semibold tracking-tight text-ink md:text-2xl ${className}`}
    >
      {siteName}
    </span>
  );
}

/**
 * @param {Pick<HeaderProps, 'isLoggedIn' | 'cart'>}
 */
function HeaderCtas({isLoggedIn, cart}) {
  const localePath = useLocalePath();

  return (
    <div className="flex items-center gap-1 md:ml-0">
      <SearchToggle />
      <NavLink
        prefetch="intent"
        to={localePath('/account')}
        className={`${ICON_BUTTON_BASE} hidden sm:inline-flex`}
      >
        <UserIcon />
        <span className="sr-only">
          <Suspense fallback="Sign in">
            <Await resolve={isLoggedIn} errorElement="Sign in">
              {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
            </Await>
          </Suspense>
        </span>
      </NavLink>
      <WishlistLink />
      <CartToggle cart={cart} />
    </div>
  );
}

/**
 * Heart linking to /wishlist with a count badge. The count comes from the
 * wishlist store: 0 during SSR/hydration, the stored count right after.
 */
function WishlistLink() {
  const localePath = useLocalePath();
  const count = useWishlistCount();

  return (
    <NavLink
      prefetch="intent"
      to={localePath('/wishlist')}
      className={ICON_BUTTON}
      aria-label={
        count
          ? `Wishlist, ${count} ${count === 1 ? 'item' : 'items'}`
          : 'Wishlist'
      }
    >
      <HeartIcon />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none font-semibold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </NavLink>
  );
}

function MobileMenuToggle() {
  const {open} = useAside();
  return (
    <button
      type="button"
      className={`${ICON_BUTTON_BASE} -ml-2 inline-flex lg:hidden`}
      onClick={() => open('mobile')}
      aria-label="Open menu"
      aria-haspopup="dialog"
    >
      <MenuIcon className="size-6" />
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      type="button"
      className={ICON_BUTTON}
      onClick={() => open('search')}
      aria-label="Search"
      aria-haspopup="dialog"
    >
      <SearchIcon />
    </button>
  );
}

/**
 * @param {{count: number}}
 */
function CartBadge({count}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();
  const localePath = useLocalePath();

  return (
    <a
      href={localePath('/cart')}
      className={ICON_BUTTON}
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        });
      }}
    >
      <BagIcon />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none font-semibold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </a>
  );
}

/**
 * @param {Pick<HeaderProps, 'cart'>}
 */
function CartToggle({cart}) {
  return (
    <Suspense fallback={<CartBadge count={0} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue();
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

/** @typedef {import('~/lib/navigation').NavItem} NavItem */
/**
 * @typedef {Object} HeaderProps
 * @property {HeaderQuery} header
 * @property {NavItem[]} navigation Shopify main-menu, resolved by the root loader
 * @property {Promise<CartApiQueryFragment|null>} cart
 * @property {Promise<boolean>} isLoggedIn
 * @property {string} publicStoreDomain
 */

/** @typedef {import('@shopify/hydrogen').CartViewPayload} CartViewPayload */
/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
/** @typedef {import('~/lib/site-settings').SiteSettings} SiteSettings */
/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
