/**
 * "Homepage About Content" metaobject (type `homepage_about_content`) that
 * feeds the homepage About / Brand Story section. Content is managed in
 * Shopify Admin: Content > Metaobjects > Homepage About Content.
 *
 * The fragment is queried by HOMEPAGE_CONTENT_QUERY in the homepage route,
 * together with the banner and promo entries, in a single request.
 */
import {resolveStorefrontUrl} from './links.js';
import {toMetaobjectImage} from './metaobject-image.js';

export const HOMEPAGE_ABOUT_FRAGMENT = `#graphql
  fragment HomepageAbout on Metaobject {
    id
    handle
    image: field(key: "image") {
      reference {
        ...MetaobjectImageReference
      }
    }
    heading: field(key: "heading") {
      value
    }
    description: field(key: "description") {
      value
    }
    button: field(key: "button") {
      value
    }
    url: field(key: "url") {
      value
    }
  }
`;

/**
 * Normalizes the first entry. Returns null (section hidden) when there is no
 * entry or it has neither a heading nor an image.
 * @param {HomepageAboutFragment | null | undefined} node
 * @param {{internalHosts: Iterable<string | null | undefined>}} options
 * @return {HomepageAbout | null}
 */
export function getHomepageAbout(node, {internalHosts}) {
  if (!node) return null;

  const heading = node.heading?.value?.trim() ?? '';
  const image = toMetaobjectImage(node.image?.reference);
  if (!heading && !image) return null;

  const label = node.button?.value?.trim();
  const link = node.url?.value
    ? resolveStorefrontUrl(node.url.value, {internalHosts: [...internalHosts]})
    : null;

  return {
    id: node.id,
    heading,
    // Blank lines in the multi-line field separate paragraphs.
    body: (node.description?.value ?? '')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    cta: label && link ? {label, to: link.href} : null,
    image,
  };
}

/**
 * @typedef {{
 *   id: string;
 *   heading: string;
 *   body: string[];
 *   cta: {label: string; to: string} | null;
 *   image: import('./metaobject-image.js').MetaobjectImage | null;
 * }} HomepageAbout
 */

/** @typedef {import('storefrontapi.generated').HomepageAboutFragment} HomepageAboutFragment */
