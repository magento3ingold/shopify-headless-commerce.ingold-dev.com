/**
 * "Homepage Newsletter" metaobject (type `homepage_newsletter`) with the
 * copy and background of the homepage newsletter section. Content is
 * managed in Shopify Admin: Content > Metaobjects > Homepage Newsletter.
 *
 * The fragment is queried by HOMEPAGE_CONTENT_QUERY in the homepage route,
 * together with the other homepage metaobjects, in a single request.
 */
import {toMetaobjectImage} from './metaobject-image.js';

export const HOMEPAGE_NEWSLETTER_FRAGMENT = `#graphql
  fragment HomepageNewsletter on Metaobject {
    id
    handle
    heading: field(key: "heading") {
      value
    }
    description: field(key: "description") {
      value
    }
    button: field(key: "button") {
      value
    }
    backgroundImage: field(key: "background_image") {
      reference {
        ...MetaobjectImageReference
      }
    }
  }
`;

/**
 * Normalizes the first entry. Returns null (section hidden) when there is no
 * entry or it has no heading and no description.
 * @param {HomepageNewsletterFragment | null | undefined} node
 * @return {HomepageNewsletter | null}
 */
export function getHomepageNewsletter(node) {
  if (!node) return null;

  const heading = node.heading?.value?.trim() ?? '';
  const description = node.description?.value?.trim() ?? '';
  if (!heading && !description) return null;

  return {
    id: node.id,
    heading,
    description,
    buttonLabel: node.button?.value?.trim() || null,
    backgroundImage: toMetaobjectImage(node.backgroundImage?.reference),
  };
}

/**
 * @typedef {{
 *   id: string;
 *   heading: string;
 *   description: string;
 *   buttonLabel: string | null;
 *   backgroundImage: import('./metaobject-image.js').MetaobjectImage | null;
 * }} HomepageNewsletter
 */

/** @typedef {import('storefrontapi.generated').HomepageNewsletterFragment} HomepageNewsletterFragment */
