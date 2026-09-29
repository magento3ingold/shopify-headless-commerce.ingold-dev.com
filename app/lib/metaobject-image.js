/**
 * Shared handling of `file_reference` image fields on metaobjects
 * (Homepage Banner, Homepage Promo...).
 *
 * Use in a query as:
 *   myField: field(key: "my_image") {
 *     reference {
 *       ...MetaobjectImageReference
 *     }
 *   }
 */
export const METAOBJECT_IMAGE_FRAGMENT = `#graphql
  fragment MetaobjectImageReference on MetafieldReference {
    __typename
    ... on MediaImage {
      id
      alt
      image {
        url
        altText
        width
        height
      }
      # Focal point set in Admin > Content > Files; keeps the subject in frame
      # when the image is cropped by object-fit: cover.
      presentation {
        asJson(format: IMAGE)
      }
    }
    ... on GenericFile {
      id
      alt
      url
      mimeType
    }
  }
`;

/**
 * Resolves a file_reference to an image usable with Hydrogen's <Image>, or
 * null when the field is empty or not an image.
 * @param {MetaobjectImageReferenceFragment | null | undefined} reference
 * @return {MetaobjectImage | null}
 */
export function toMetaobjectImage(reference) {
  if (!reference) return null;

  if (reference.__typename === 'MediaImage' && reference.image?.url) {
    return {
      url: reference.image.url,
      altText: reference.alt || reference.image.altText || '',
      width: reference.image.width ?? undefined,
      height: reference.image.height ?? undefined,
      objectPosition: toObjectPosition(reference.presentation?.asJson),
    };
  }

  // Some uploads (e.g. SVG) are stored as GenericFile; accept images only.
  if (
    reference.__typename === 'GenericFile' &&
    reference.url &&
    reference.mimeType?.startsWith('image/')
  ) {
    return {url: reference.url, altText: reference.alt || ''};
  }

  return null;
}

/**
 * Converts a Shopify focal point ({focalPoint: {x, y}}, as fractions or
 * percentages) into a CSS object-position value.
 * @param {unknown} presentation
 * @return {string | undefined}
 */
export function toObjectPosition(presentation) {
  const point = /** @type {{focalPoint?: {x?: unknown; y?: unknown}}} */ (
    presentation ?? {}
  ).focalPoint;
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const toPercent = (value) =>
    Math.min(100, Math.max(0, value <= 1 ? value * 100 : value));
  return `${toPercent(x).toFixed(1)}% ${toPercent(y).toFixed(1)}%`;
}

/**
 * Sort key for integer order fields (`sort_order`, `position`...). Entries
 * without a number sort last.
 * @param {string | null | undefined} value
 */
export function toOrder(value) {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}

/**
 * @typedef {{
 *   url: string;
 *   altText: string;
 *   width?: number;
 *   height?: number;
 *   objectPosition?: string;
 * }} MetaobjectImage
 */

/** @typedef {import('storefrontapi.generated').MetaobjectImageReferenceFragment} MetaobjectImageReferenceFragment */
