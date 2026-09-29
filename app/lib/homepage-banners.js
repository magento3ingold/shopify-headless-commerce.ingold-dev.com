/**
 * "Homepage Banner" metaobjects (type `homepage_banner`) that feed the
 * homepage HeroSlider. Content is managed entirely in Shopify Admin:
 * Content > Metaobjects > Homepage Banner.
 *
 * The fragment is queried by HOMEPAGE_CONTENT_QUERY in the homepage route,
 * together with the Homepage Promo entries, in a single request.
 */
import {resolveStorefrontUrl} from './links.js';
import {toMetaobjectImage, toOrder} from './metaobject-image.js';

export const HOMEPAGE_BANNER_FRAGMENT = `#graphql
  fragment HomepageBanner on Metaobject {
    id
    handle
    bannerImage: field(key: "banner_image") {
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
    sortOrder: field(key: "sort_order") {
      value
    }
    enabled: field(key: "enabled") {
      value
    }
  }
`;

/**
 * Turns raw metaobject entries into slides: keeps only entries whose
 * `enabled` is true, sorts by `sort_order` ascending (entries without a
 * number go last, ties keep Shopify's order) and resolves the button URL.
 * Metaobjects can only be sorted by built-in keys in the API, hence here.
 * @param {HomepageBannerFragment[]} nodes
 * @param {{internalHosts: Iterable<string | null | undefined>}} options
 * @return {HeroSlide[]}
 */
export function getHomepageBanners(nodes, {internalHosts}) {
  const hosts = [...internalHosts];

  return nodes
    .filter((node) => node.enabled?.value === 'true')
    .map((node, index) => ({
      node,
      index,
      order: toOrder(node.sortOrder?.value),
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({node}) => toSlide(node, hosts))
    .filter((slide) => slide.image || slide.heading);
}

/**
 * @param {HomepageBannerFragment} node
 * @param {Array<string | null | undefined>} internalHosts
 * @return {HeroSlide}
 */
function toSlide(node, internalHosts) {
  const image = toMetaobjectImage(node.bannerImage?.reference);
  const label = node.button?.value?.trim();
  // Shopify `url` fields must be absolute; links to this shop (or localhost
  // while developing) become internal paths. See ~/lib/links.
  const to = node.url?.value
    ? (resolveStorefrontUrl(node.url.value, {internalHosts})?.href ?? null)
    : null;

  return {
    id: node.id,
    heading: node.heading?.value?.trim() ?? '',
    description: node.description?.value?.trim() || undefined,
    cta: label && to ? {label, to} : null,
    image,
    objectPosition: image?.objectPosition,
  };
}

/**
 * @typedef {{
 *   id: string;
 *   heading: string;
 *   description?: string;
 *   cta: {label: string; to: string} | null;
 *   image: import('./metaobject-image.js').MetaobjectImage | null;
 *   objectPosition?: string;
 * }} HeroSlide
 */

/** @typedef {import('storefrontapi.generated').HomepageBannerFragment} HomepageBannerFragment */
