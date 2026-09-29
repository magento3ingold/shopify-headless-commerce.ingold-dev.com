/**
 * Normalizes the "Site Settings" metaobject (type `site_settings`) that is
 * loaded once per request by the root loader as part of HEADER_QUERY.
 *
 * Fallbacks:
 * - mobileLogo -> logo when `mobile_logo` is empty
 * - siteName   -> Shopify shop name when `site_name` is empty
 * - no logo    -> components render `siteName` as text
 * @param {HeaderQuery | null | undefined} header
 * @return {SiteSettings}
 */
export function getSiteSettings(header) {
  const entry = header?.siteSettings?.nodes?.[0];
  const siteName =
    entry?.siteName?.value?.trim() || header?.shop?.name || 'Store';
  const logo = toLogo(entry?.logo?.reference);
  const mobileLogo = toLogo(entry?.mobileLogo?.reference) ?? logo;

  return {siteName, logo, mobileLogo};
}

/**
 * Resolves a file_reference to a displayable image.
 * @param {SiteSettingsLogoFragment | null | undefined} reference
 * @return {SiteLogo | null}
 */
function toLogo(reference) {
  if (!reference) return null;

  if (reference.__typename === 'MediaImage' && reference.image?.url) {
    return {
      url: reference.image.url,
      altText: reference.image.altText ?? null,
      width: reference.image.width ?? undefined,
      height: reference.image.height ?? undefined,
    };
  }

  // Files such as SVGs may be stored as GenericFile; accept image types only.
  if (
    reference.__typename === 'GenericFile' &&
    reference.url &&
    reference.mimeType?.startsWith('image/')
  ) {
    return {url: reference.url, altText: reference.alt ?? null};
  }

  return null;
}

/**
 * @typedef {{
 *   url: string;
 *   altText: string | null;
 *   width?: number;
 *   height?: number;
 * }} SiteLogo
 */
/**
 * @typedef {{
 *   siteName: string;
 *   logo: SiteLogo | null;
 *   mobileLogo: SiteLogo | null;
 * }} SiteSettings
 */

/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
/** @typedef {import('storefrontapi.generated').SiteSettingsLogoFragment} SiteSettingsLogoFragment */
