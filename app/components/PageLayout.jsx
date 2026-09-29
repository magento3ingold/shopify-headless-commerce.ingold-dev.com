import {Await, Link} from 'react-router';
import {Suspense, useId} from 'react';
import {Aside, useAside} from '~/components/Aside';
import {WishlistProvider} from '~/lib/wishlist/context';
import {UserIcon} from '~/components/Icons';
import {useLocalePath} from '~/lib/i18n';
import {Footer} from '~/components/Footer';
import {Header} from '~/components/Header';
import {MobileNavigation} from '~/components/HeaderNavigation';
import {CartMain} from '~/components/CartMain';
import {
  SEARCH_ENDPOINT,
  SearchFormPredictive,
} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';

/**
 * @param {PageLayoutProps}
 */
export function PageLayout({
  cart,
  children = null,
  header,
  isLoggedIn,
  navigation = [],
  footerNavigation = [],
  publicStoreDomain,
}) {
  return (
    <WishlistProvider>
      <Aside.Provider>
        <a
          href="#main-content"
          className="sr-only z-50 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <CartAside cart={cart} />
        <SearchAside />
        <MobileMenuAside isLoggedIn={isLoggedIn} navigation={navigation} />
        {header && (
          <Header
            header={header}
            navigation={navigation}
            cart={cart}
            isLoggedIn={isLoggedIn}
            publicStoreDomain={publicStoreDomain}
          />
        )}
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer header={header} columns={footerNavigation} />
      </Aside.Provider>
    </WishlistProvider>
  );
}

/**
 * @param {{cart: PageLayoutProps['cart']}}
 */
function CartAside({cart}) {
  return (
    <Aside type="cart" heading="CART">
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

function SearchAside() {
  const queriesDatalistId = useId();
  return (
    <Aside type="search" heading="SEARCH">
      <div className="predictive-search">
        <br />
        <SearchFormPredictive>
          {({fetchResults, goToSearch, inputRef}) => (
            <>
              <input
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search"
                ref={inputRef}
                type="search"
                list={queriesDatalistId}
                aria-label="Search products"
                data-autofocus
              />
              &nbsp;
              <button onClick={goToSearch}>Search</button>
            </>
          )}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products, queries} = items;

            if (state === 'loading' && term.current) {
              return <div>Loading...</div>;
            }

            if (!total) {
              return <SearchResultsPredictive.Empty term={term} />;
            }

            return (
              <>
                <SearchResultsPredictive.Queries
                  queries={queries}
                  queriesDatalistId={queriesDatalistId}
                />
                <SearchResultsPredictive.Products
                  products={products}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Collections
                  collections={collections}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Pages
                  pages={pages}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Articles
                  articles={articles}
                  closeSearch={closeSearch}
                  term={term}
                />
                {term.current && total ? (
                  <Link
                    onClick={closeSearch}
                    to={`${SEARCH_ENDPOINT}?q=${term.current}`}
                  >
                    <p>
                      View all results for <q>{term.current}</q>
                      &nbsp; →
                    </p>
                  </Link>
                ) : null}
              </>
            );
          }}
        </SearchResultsPredictive>
      </div>
    </Aside>
  );
}

/**
 * @param {{
 *   isLoggedIn: PageLayoutProps['isLoggedIn'];
 *   navigation: NavItem[];
 * }}
 */
function MobileMenuAside({isLoggedIn, navigation}) {
  const {close} = useAside();
  const localePath = useLocalePath();

  return (
    <Aside type="mobile" heading="Menu">
      <nav aria-label="Mobile" className="ui-scope">
        <MobileNavigation items={navigation} />
        <Link
          to={localePath('/account')}
          onClick={close}
          prefetch="intent"
          className={`flex items-center gap-3 text-base font-medium text-ink ${
            navigation.length ? 'mt-6 border-t border-line pt-6' : ''
          }`}
        >
          <UserIcon />
          <Suspense fallback="Sign in">
            <Await resolve={isLoggedIn} errorElement="Sign in">
              {(isLoggedIn) => (isLoggedIn ? 'My account' : 'Sign in')}
            </Await>
          </Suspense>
        </Link>
      </nav>
    </Aside>
  );
}

/**
 * @typedef {Object} PageLayoutProps
 * @property {Promise<CartApiQueryFragment|null>} cart
 * @property {HeaderQuery} header
 * @property {NavItem[]} [navigation]
 * @property {FooterColumn[]} [footerNavigation]
 * @property {Promise<boolean>} isLoggedIn
 * @property {string} publicStoreDomain
 * @property {React.ReactNode} [children]
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
/** @typedef {import('~/lib/navigation').NavItem} NavItem */
/** @typedef {import('~/lib/navigation').FooterColumn} FooterColumn */
