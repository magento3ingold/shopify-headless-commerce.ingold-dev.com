import {useRouteLoaderData} from 'react-router';

/**
 * Global social profile links from the "Social Media" metaobject
 * (type `social_media`, first entry), managed in Shopify Admin:
 * Content > Metaobjects > Social Media.
 *
 * Loaded once per request by the root loader (HEADER_QUERY) and exposed as
 * `socialLinks` in the root loader data. Read it anywhere with
 * useSocialLinks().
 *
 * Each network reads its `*_url` field key (the keys used by the current
 * definition) and falls back to the bare network name, so either naming
 * works if the definition is changed later.
 */
export const SOCIAL_MEDIA_FRAGMENT = `#graphql
  fragment SocialMedia on Metaobject {
    id
    facebookUrl: field(key: "facebook_url") {
      value
    }
    facebook: field(key: "facebook") {
      value
    }
    instagramUrl: field(key: "instagram_url") {
      value
    }
    instagram: field(key: "instagram") {
      value
    }
    youtubeUrl: field(key: "youtube_url") {
      value
    }
    youtube: field(key: "youtube") {
      value
    }
    linkedinUrl: field(key: "linkedin_url") {
      value
    }
    linkedin: field(key: "linkedin") {
      value
    }
    twitterUrl: field(key: "twitter_url") {
      value
    }
    twitter: field(key: "twitter") {
      value
    }
  }
`;

/**
 * Supported networks, in display order. `fields` are fragment aliases, in
 * order of preference.
 */
export const SOCIAL_NETWORKS = /** @type {const} */ ([
  {network: 'facebook', label: 'Facebook', fields: ['facebookUrl', 'facebook']},
  {
    network: 'instagram',
    label: 'Instagram',
    fields: ['instagramUrl', 'instagram'],
  },
  {network: 'youtube', label: 'YouTube', fields: ['youtubeUrl', 'youtube']},
  {network: 'linkedin', label: 'LinkedIn', fields: ['linkedinUrl', 'linkedin']},
  {network: 'twitter', label: 'X (Twitter)', fields: ['twitterUrl', 'twitter']},
]);

/**
 * Returns only the networks with a valid http(s) URL configured.
 * @param {SocialMediaFragment | null | undefined} node
 * @return {SocialLink[]}
 */
export function getSocialLinks(node) {
  if (!node) return [];

  return SOCIAL_NETWORKS.flatMap(({network, label, fields}) => {
    const href = fields
      .map((field) => toHttpUrl(node[field]?.value))
      .find(Boolean);
    return href ? [{network, label, href}] : [];
  });
}

/** @param {string | null | undefined} value */
function toHttpUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Social links from the root loader, for use in any component.
 * @return {SocialLink[]}
 */
export function useSocialLinks() {
  /** @type {{socialLinks?: SocialLink[]} | undefined} */
  const data = useRouteLoaderData('root');
  return data?.socialLinks ?? [];
}

/**
 * @typedef {{
 *   network: (typeof SOCIAL_NETWORKS)[number]['network'];
 *   label: string;
 *   href: string;
 * }} SocialLink
 */

/** @typedef {import('storefrontapi.generated').SocialMediaFragment} SocialMediaFragment */
