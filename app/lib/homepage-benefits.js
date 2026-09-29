/**
 * "Homepage Benefits" metaobjects (type `homepage_benefits`) that feed the
 * homepage "Why Shop With Us" section. Content is managed in Shopify Admin:
 * Content > Metaobjects > Homepage Benefits.
 *
 * The fragment is queried by HOMEPAGE_CONTENT_QUERY in the homepage route,
 * together with the other homepage metaobjects, in a single request.
 */
import {toMetaobjectImage, toOrder} from './metaobject-image.js';

export const HOMEPAGE_BENEFIT_FRAGMENT = `#graphql
  fragment HomepageBenefit on Metaobject {
    id
    handle
    icon: field(key: "icon") {
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
    position: field(key: "position") {
      value
    }
  }
`;

/**
 * Sorts entries by `position` ascending (entries without a number go last,
 * ties keep Shopify's order). Entries with neither a heading nor a
 * description are skipped; a missing icon is allowed.
 * @param {HomepageBenefitFragment[]} nodes
 * @return {HomepageBenefit[]}
 */
export function getHomepageBenefits(nodes) {
  return nodes
    .map((node, index) => ({node, index, order: toOrder(node.position?.value)}))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({node}) => ({
      id: node.id,
      heading: node.heading?.value?.trim() ?? '',
      description: node.description?.value?.trim() ?? '',
      icon: toMetaobjectImage(node.icon?.reference),
    }))
    .filter((benefit) => benefit.heading || benefit.description);
}

/**
 * @typedef {{
 *   id: string;
 *   heading: string;
 *   description: string;
 *   icon: import('./metaobject-image.js').MetaobjectImage | null;
 * }} HomepageBenefit
 */

/** @typedef {import('storefrontapi.generated').HomepageBenefitFragment} HomepageBenefitFragment */
