import {useId, useState} from 'react';
import {Link} from 'react-router';
import {useLocalePath} from '~/lib/i18n';
import {FOOTER} from '~/lib/storefront-content';
import {getSiteSettings} from '~/lib/site-settings';
import {ChevronDownIcon} from '~/components/Icons';
import {ContactDetailsList, SocialIconLinks} from '~/components/ContactDetails';
import {MenuLink} from '~/components/HeaderNavigation';

/** Menu grid columns from md up, by number of Shopify menus shown. */
const MENU_GRID = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
};

/**
 * Store footer, fully managed in Shopify Admin:
 * - logo / site name: "Site Settings" metaobject (~/lib/site-settings)
 * - contact details: "Contact Information" metaobject (~/lib/contact-information)
 * - social icons: "Social Media" metaobject (~/lib/social-media)
 * - link columns: footer menus (FOOTER_MENUS in ~/lib/navigation)
 * All of it is loaded by the root loader in a single request.
 * @param {FooterProps}
 */
export function Footer({header, columns = []}) {
  const {siteName, logo} = getSiteSettings(header);
  const menuColumns = columns.slice(0, 3);
  const year = new Date().getFullYear();

  return (
    <footer className="ui-scope mt-auto bg-ink text-white/80 [&_:focus-visible]:outline-white">
      <div
        className={`page-width grid gap-10 py-14 md:py-16 lg:gap-16 lg:py-20 ${
          menuColumns.length
            ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]'
            : ''
        }`}
      >
        {/* Tablet: logo + social beside the contact details; stacked on
            mobile and in the desktop brand column. */}
        <div className="flex flex-col gap-7 md:grid md:grid-cols-2 md:items-start md:gap-x-10 lg:flex">
          <div className="md:col-start-1 md:row-start-1">
            <FooterLogo siteName={siteName} logo={logo} />
          </div>
          <div className="md:col-start-2 md:row-span-2 md:row-start-1">
            <ContactDetailsList tone="dark" />
          </div>
          <div className="md:col-start-1 md:row-start-2">
            <SocialIconLinks tone="dark" />
          </div>
        </div>

        {menuColumns.length ? (
          <div
            className={`grid md:gap-8 ${MENU_GRID[menuColumns.length] ?? ''}`}
          >
            {menuColumns.map((column) => (
              <FooterColumn key={column.id} column={column} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10">
        <div className="page-width flex flex-col gap-4 py-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p className="text-xs">
            &copy; {year} {siteName}. All rights reserved.
          </p>
          <ul
            className="flex flex-wrap gap-2"
            aria-label="Accepted payment methods"
          >
            {FOOTER.paymentMethods.map((method) => (
              <li
                key={method}
                className="rounded border border-white/15 px-2 py-1 text-[11px] font-medium tracking-wide text-white/70"
              >
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

/**
 * Site Settings `logo`, linking home; the site name when no logo is set.
 * @param {Pick<SiteSettings, 'siteName' | 'logo'>}
 */
function FooterLogo({siteName, logo}) {
  const localePath = useLocalePath();

  return (
    <Link
      to={localePath('/')}
      prefetch="intent"
      className="self-start rounded-sm"
    >
      {logo ? (
        <img
          src={logo.url}
          alt={siteName}
          width={logo.width}
          height={logo.height}
          loading="lazy"
          decoding="async"
          className="block h-10 w-auto max-w-[220px] rounded-none object-contain object-left brightness-0 invert"
        />
      ) : (
        <span className="font-display text-2xl font-semibold text-white">
          {siteName}
        </span>
      )}
    </Link>
  );
}

/**
 * One Shopify menu. Collapsible below 768px (accordion), always expanded
 * from md up.
 * @param {{column: FooterColumnData}}
 */
function FooterColumn({column}) {
  const [isOpen, setIsOpen] = useState(false);
  const headingId = useId();
  const listId = useId();

  return (
    <nav
      aria-labelledby={headingId}
      className="border-t border-white/10 last:border-b md:border-0 md:last:border-0"
    >
      <h2
        id={headingId}
        className="text-xs font-semibold tracking-[0.2em] text-white uppercase"
      >
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full items-center justify-between py-4 text-left tracking-[0.2em] uppercase md:hidden"
        >
          {column.title}
          <ChevronDownIcon
            className={`size-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <span className="hidden md:inline">{column.title}</span>
      </h2>
      <ul
        id={listId}
        className={`space-y-3 pb-5 md:mt-5 md:block md:pb-0 ${
          isOpen ? 'block' : 'hidden'
        }`}
      >
        {column.items.map((item) => (
          <FooterItem key={item.id} item={item} />
        ))}
      </ul>
    </nav>
  );
}

/**
 * Menu item plus its nested items (Shopify menus allow three levels).
 * @param {{item: NavItem; depth?: number}}
 */
function FooterItem({item, depth = 0}) {
  return (
    <li>
      <MenuLink item={item} className={footerLinkClass(depth)} />
      {item.items.length ? (
        <ul className="mt-2 space-y-2 border-l border-white/10 pl-3">
          {item.items.map((child) => (
            <FooterItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** @param {number} depth */
function footerLinkClass(depth) {
  return ({isActive = false} = {}) =>
    `${depth ? 'text-xs' : 'text-sm'} underline-offset-4 transition-colors duration-200 hover:text-white hover:underline ${
      isActive ? 'text-white' : 'text-white/70'
    }`;
}

/**
 * @typedef {Object} FooterProps
 * @property {HeaderQuery | null} header
 * @property {FooterColumnData[]} [columns] Shopify footer menus
 */

/** @typedef {import('~/lib/site-settings').SiteSettings} SiteSettings */
/** @typedef {import('~/lib/navigation').FooterColumn} FooterColumnData */
/** @typedef {import('~/lib/navigation').NavItem} NavItem */
/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
