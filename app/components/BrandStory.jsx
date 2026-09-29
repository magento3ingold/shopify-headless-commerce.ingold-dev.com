import {Image} from '@shopify/hydrogen';
import {ButtonLink} from '~/components/ButtonLink';

/**
 * Split image + copy section. Image sits left on desktop, stacked on mobile.
 *
 * `image` is either a Shopify image (`{url, altText, width, height}`, e.g.
 * from a metaobject; rendered with Hydrogen's responsive <Image>) or a local
 * asset (`{src, alt, width, height}`). Without an image the copy renders on
 * its own.
 * @param {{
 *   id?: string;
 *   eyebrow?: string;
 *   heading: string;
 *   body: string[];
 *   cta?: {label: string; to: string} | null;
 *   image?: ShopifyImage | LocalImage | null;
 *   reverse?: boolean;
 *   headingLevel?: 'h2' | 'h3';
 * }}
 */
export function BrandStory({
  id,
  eyebrow,
  heading,
  body,
  cta,
  image,
  reverse = false,
  headingLevel = 'h2',
}) {
  const Heading = headingLevel;

  return (
    <div
      className={`grid items-center gap-10 md:gap-12 lg:gap-20 ${
        image ? 'md:grid-cols-2' : ''
      }`}
    >
      {image ? (
        <div
          className={`overflow-hidden rounded-card bg-surface ${
            'url' in image ? '' : 'aspect-[10/11]'
          } ${reverse ? 'md:order-2' : ''}`}
          // Shopify images keep (close to) their own shape, so merchants'
          // uploads are not cropped into a fixed portrait box.
          style={
            'url' in image ? {aspectRatio: getBoxAspect(image)} : undefined
          }
        >
          <BrandStoryImage image={image} />
        </div>
      ) : null}
      <div className="max-w-xl">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {eyebrow}
          </p>
        ) : null}
        {heading ? (
          <Heading
            id={id}
            className="font-display text-3xl leading-tight font-medium text-ink md:text-4xl lg:text-5xl"
          >
            {heading}
          </Heading>
        ) : null}
        {body.length ? (
          <div className={`space-y-4 ${heading ? 'mt-6' : ''}`}>
            {body.map((paragraph, index) => (
              <p
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="text-base leading-relaxed text-muted md:text-lg md:whitespace-pre-line"
              >
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}
        {cta ? (
          <ButtonLink to={cta.to} variant="outline" className="mt-8">
            {cta.label}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {{image: ShopifyImage | LocalImage}}
 */
function BrandStoryImage({image}) {
  if ('url' in image) {
    return (
      <Image
        data={image}
        alt={image.altText ?? ''}
        loading="lazy"
        // The column is ~50% wide from md up and full width below; when the
        // image is cropped to the box it renders wider than the column.
        sizes={getCoverSizes(image)}
        className="size-full rounded-none object-cover"
        style={
          image.objectPosition
            ? {objectPosition: image.objectPosition}
            : undefined
        }
      />
    );
  }

  return (
    <img
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      className="size-full rounded-none object-cover"
    />
  );
}

/** Box shape limits: no taller than 4:5, no wider than 16:9. */
const MIN_BOX_ASPECT = 4 / 5;
const MAX_BOX_ASPECT = 16 / 9;

/** @param {{width?: number | null; height?: number | null}} image */
function getImageAspect({width, height}) {
  return width && height ? width / height : undefined;
}

/** @param {{width?: number | null; height?: number | null}} image */
function getBoxAspect(image) {
  const ratio = getImageAspect(image) ?? 10 / 11;
  return Math.min(MAX_BOX_ASPECT, Math.max(MIN_BOX_ASPECT, ratio)).toFixed(4);
}

/** @param {{width?: number | null; height?: number | null}} image */
function getCoverSizes(image) {
  const ratio = getImageAspect(image);
  const factor = ratio
    ? Math.max(1, ratio / Number(getBoxAspect(image))).toFixed(3)
    : '1';
  return `(min-width: 768px) calc(50vw * ${factor}), calc(100vw * ${factor})`;
}

/**
 * @typedef {{
 *   url: string;
 *   altText?: string | null;
 *   width?: number | null;
 *   height?: number | null;
 *   objectPosition?: string;
 * }} ShopifyImage
 */
/** @typedef {{src: string; alt: string; width: number; height: number}} LocalImage */
