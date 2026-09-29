/**
 * Explicit mapping from Shopify policy URL handles (/policies/:handle) to
 * Storefront API `Shop` fields. Only these handles are queried; anything
 * else is a 404 without touching the API.
 *
 * All fields exist in Storefront API 2026-04 (the version Hydrogen 2026.4
 * uses). `subscriptionPolicy` is a ShopPolicyWithDefault; the others are
 * ShopPolicy.
 */
export const POLICY_FIELDS_BY_HANDLE = /** @type {const} */ ({
  'privacy-policy': 'privacyPolicy',
  'refund-policy': 'refundPolicy',
  'shipping-policy': 'shippingPolicy',
  'terms-of-service': 'termsOfService',
  'legal-notice': 'legalNotice',
  'contact-information': 'contactInformation',
  'terms-of-sale': 'termsOfSale',
  'subscription-policy': 'subscriptionPolicy',
});

/** All policy fields, in the order they are listed on /policies. */
export const POLICY_FIELDS = /** @type {const} */ ([
  'privacyPolicy',
  'refundPolicy',
  'shippingPolicy',
  'termsOfService',
  'termsOfSale',
  'legalNotice',
  'contactInformation',
  'subscriptionPolicy',
]);

/**
 * @param {string | undefined} handle
 * @return {PolicyField | null}
 */
export function getPolicyField(handle) {
  const key = handle?.trim().toLowerCase();
  if (!key || !Object.hasOwn(POLICY_FIELDS_BY_HANDLE, key)) return null;
  return POLICY_FIELDS_BY_HANDLE[
    /** @type {keyof typeof POLICY_FIELDS_BY_HANDLE} */ (key)
  ];
}

/**
 * Variables for the `@include(if: ...)` flags of POLICY_CONTENT_QUERY: only
 * the requested policy is fetched.
 * @param {PolicyField} field
 * @return {Record<PolicyField, boolean>}
 */
export function getPolicyIncludeVariables(field) {
  return /** @type {Record<PolicyField, boolean>} */ (
    Object.fromEntries(POLICY_FIELDS.map((name) => [name, name === field]))
  );
}

/**
 * A policy counts as configured only when Shopify returns body content.
 * @param {{body?: string | null} | null | undefined} policy
 */
export function isPolicyConfigured(policy) {
  return Boolean(policy?.body?.replace(/<[^>]*>/g, '').trim());
}

/**
 * Plain-text summary of policy HTML for the meta description.
 * @param {string} html
 * @param {number} [maxLength]
 */
export function getPolicyDescription(html, maxLength = 155) {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

/** @typedef {(typeof POLICY_FIELDS)[number]} PolicyField */
