/**
 * Resolves URLs coming from Shopify content (menus, metaobject `url`
 * fields...) for the headless storefront.
 *
 * Shopify stores links to its own resources as absolute URLs on the
 * *.myshopify.com or primary Online Store domain. Rendering those as-is would
 * send customers out of the Hydrogen storefront, so links that point at this
 * shop become root-relative paths. Hydrogen routes mirror Shopify's URL
 * structure (/collections/..., /products/..., /pages/..., /blogs/...,
 * /policies/...), so the paths work unchanged.
 *
 * Kept dependency-free so it can run anywhere (loaders, components, tests).
 */

/** First path segment that is a market subfolder, e.g. `/en-ca`. */
export const LOCALE_PATH_SEGMENT = /^\/([a-z]{2}-[a-z]{2})(?=\/|$)/i;

/**
 * @param {string} raw
 * @param {{internalHosts: Iterable<string | null | undefined>}} options
 * @return {ResolvedLink | null} null when there is nothing to link to
 */
export function resolveStorefrontUrl(raw, {internalHosts}) {
  const value = raw?.trim();
  // Empty values and "#" placeholders are not real destinations.
  if (!value || value.startsWith('#')) return null;

  if (value.startsWith('/') && !value.startsWith('//')) {
    return {href: stripLocalePrefix(value), isExternal: false};
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
    return {href: value, isExternal: true};
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const hosts = new Set(
    [...internalHosts, 'localhost', '127.0.0.1']
      .filter(Boolean)
      .map((host) => String(host).toLowerCase()),
  );

  if (!hosts.has(url.hostname.toLowerCase())) {
    return {href: url.toString(), isExternal: true};
  }

  // `https://shop.myshopify.com#` is Shopify's representation of a "#" link.
  if (url.pathname === '/' && !url.search && value.endsWith('#')) {
    return null;
  }

  const path = `${url.pathname}${url.search}${url.hash}` || '/';
  return {href: stripLocalePrefix(path), isExternal: false};
}

/**
 * Removes a market subfolder so the link can be re-localized for the market
 * the visitor is browsing (see useLocalePath in ~/lib/i18n).
 * @param {string} path
 */
export function stripLocalePrefix(path) {
  return path.replace(LOCALE_PATH_SEGMENT, '') || '/';
}

/**
 * Hostname of an absolute URL, or undefined.
 * @param {string | null | undefined} url
 */
export function getHostname(url) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * @typedef {{
 *   href: string;
 *   isExternal: boolean;
 * }} ResolvedLink
 */
