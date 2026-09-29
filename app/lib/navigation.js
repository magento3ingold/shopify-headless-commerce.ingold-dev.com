import {resolveStorefrontUrl} from './links.js';

/**
 * Converts the Shopify `main-menu` (loaded by the root loader as part of
 * HEADER_QUERY) into a render-ready tree of up to three levels.
 *
 * - Links to this shop become internal, market-agnostic paths.
 * - External URLs stay external.
 * - Items without a usable link are kept only when they have children, so
 *   they can act as dropdown/collapsible group labels.
 * @param {HeaderQuery['menu'] | null | undefined} menu
 * @param {{internalHosts: Iterable<string | null | undefined>}} options
 * @return {NavItem[]}
 */
export function getNavigation(menu, options) {
  const hosts = [...options.internalHosts];
  return toNavItems(menu?.items ?? [], hosts);
}

/**
 * Shopify navigation menus shown as footer columns, in display order.
 * `label` is the column heading. Shopify menu titles are internal Admin names
 * (e.g. "Footer menu One"), so they are not shown to customers.
 */
export const FOOTER_MENUS = /** @type {const} */ ({
  shop: {handle: 'footer', label: 'Shop'},
  company: {handle: 'footer-menu-two', label: 'Company'},
  service: {handle: 'footer-menu-three', label: 'Customer Service'},
});

/**
 * Converts the footer menus (loaded with HEADER_QUERY) into footer columns.
 * A menu that is missing or has no usable items is left out, so only that
 * column disappears.
 * @param {Record<keyof typeof FOOTER_MENUS, HeaderQuery['menu'] | null | undefined>} menus
 * @param {{internalHosts: Iterable<string | null | undefined>}} options
 * @return {FooterColumn[]}
 */
export function getFooterNavigation(menus, options) {
  const hosts = [...options.internalHosts];

  return Object.entries(FOOTER_MENUS).flatMap(([key, {label}]) => {
    const menu = menus[/** @type {keyof typeof FOOTER_MENUS} */ (key)];
    const items = toNavItems(menu?.items ?? [], hosts);
    if (!items.length) return [];
    return [{id: menu?.id ?? key, title: label, items}];
  });
}

/**
 * @param {Array<MenuItemLike>} items
 * @param {Array<string | null | undefined>} internalHosts
 * @return {NavItem[]}
 */
function toNavItems(items, internalHosts) {
  return items.flatMap((item) => {
    const title = item.title?.trim();
    if (!title) return [];

    const children = toNavItems(item.items ?? [], internalHosts);
    const link = item.url
      ? resolveStorefrontUrl(item.url, {internalHosts})
      : null;
    if (!link && !children.length) return [];

    return [
      {
        id: item.id,
        title,
        href: link?.href ?? null,
        isExternal: link?.isExternal ?? false,
        items: children,
      },
    ];
  });
}

/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   href: string | null;
 *   isExternal: boolean;
 *   items: NavItem[];
 * }} NavItem
 */
/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   items: NavItem[];
 * }} FooterColumn
 */
/**
 * @typedef {{
 *   id: string;
 *   title?: string | null;
 *   url?: string | null;
 *   items?: MenuItemLike[];
 * }} MenuItemLike
 */

/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
