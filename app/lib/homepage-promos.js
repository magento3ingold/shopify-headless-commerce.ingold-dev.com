/**
 * "Homepage Promo" metaobjects (type `homepage_promo`) that feed the
 * homepage PromoSection. Content is managed entirely in Shopify Admin:
 * Content > Metaobjects > Homepage Promo.
 *
 * Layout by `position` (ascending): 1st = large left card, 2nd = top-right,
 * 3rd = bottom-right. Only the first three enabled entries are shown.
 *
 * The fragment is queried by HOMEPAGE_CONTENT_QUERY in the homepage route,
 * together with the Homepage Banner entries, in a single request.
 */
import {resolveStorefrontUrl} from './links.js';
import {toMetaobjectImage, toOrder} from './metaobject-image.js';

export const MAX_HOMEPAGE_PROMOS = 3;

export const HOMEPAGE_PROMO_FRAGMENT = `#graphql
  fragment HomepagePromo on Metaobject {
    id
    handle
    promoImage: field(key: "promo_image") {
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
    position: field(key: "position") {
      value
    }
    enabled: field(key: "enabled") {
      value
    }
  }
`;

/**
 * Keeps enabled entries, sorts them by `position` ascending (entries
 * without a number go last, ties keep Shopify's order) and resolves links.
 * Entries with neither an image nor a heading are skipped.
 * @param {HomepagePromoFragment[]} nodes
 * @param {{internalHosts: Iterable<string | null | undefined>}} options
 * @return {PromoBlock[]}
 */
export function getHomepagePromos(nodes, {internalHosts}) {
  const hosts = [...internalHosts];

  return nodes
    .filter((node) => node.enabled?.value === 'true')
    .map((node, index) => ({node, index, order: toOrder(node.position?.value)}))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({node}) => toPromo(node, hosts))
    .filter((promo) => promo.image || promo.heading)
    .slice(0, MAX_HOMEPAGE_PROMOS);
}

/**
 * @param {HomepagePromoFragment} node
 * @param {Array<string | null | undefined>} internalHosts
 * @return {PromoBlock}
 */
function toPromo(node, internalHosts) {
  const link = node.url?.value
    ? resolveStorefrontUrl(node.url.value, {internalHosts})
    : null;

  return {
    id: node.id,
    heading: node.heading?.value?.trim() ?? '',
    description: node.description?.value?.trim() || undefined,
    buttonLabel: node.button?.value?.trim() || undefined,
    link,
    image: toMetaobjectImage(node.promoImage?.reference),
  };
}

/**
 * @typedef {{
 *   id: string;
 *   heading: string;
 *   description?: string;
 *   buttonLabel?: string;
 *   link: import('./links.js').ResolvedLink | null;
 *   image: import('./metaobject-image.js').MetaobjectImage | null;
 * }} PromoBlock
 */

/** @typedef {import('storefrontapi.generated').HomepagePromoFragment} HomepagePromoFragment */
