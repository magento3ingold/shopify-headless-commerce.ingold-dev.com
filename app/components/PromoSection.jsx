import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {useLocalePath} from '~/lib/i18n';
import {ArrowRightIcon} from '~/components/Icons';

/**
 * Tile layouts. Each maps to the card's box shape per breakpoint, which is
 * also used to tell the browser how wide the cover-cropped image renders.
 * Keep `boxes` in sync with `className`.
 */
const VARIANTS = {
  // Large left card (or either card when there are two promos).
  feature: {
    className: 'aspect-[4/5] sm:aspect-[16/11] lg:aspect-auto lg:min-h-[640px]',
    boxes: [
      {minWidth: 1024, width: '50vw', height: 640},
      {minWidth: 640, width: '100vw', aspect: 16 / 11},
      {minWidth: 0, width: '100vw', aspect: 4 / 5},
    ],
    headingClass: 'text-3xl md:text-4xl',
    paddingClass: 'p-6 md:p-10',
  },
  // Stacked top-right / bottom-right cards.
  compact: {
    className: 'aspect-[16/10] lg:aspect-auto lg:min-h-[308px]',
    boxes: [
      {minWidth: 1024, width: '50vw', height: 308},
      {minWidth: 640, width: '50vw', aspect: 16 / 10},
      {minWidth: 0, width: '100vw', aspect: 16 / 10},
    ],
    headingClass: 'text-2xl md:text-3xl',
    paddingClass: 'p-6 md:p-8',
  },
  // A single promo spans the full width.
  wide: {
    className: 'aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]',
    boxes: [
      {minWidth: 1024, width: '100vw', aspect: 21 / 9},
      {minWidth: 640, width: '100vw', aspect: 16 / 9},
      {minWidth: 0, width: '100vw', aspect: 4 / 5},
    ],
    headingClass: 'text-3xl md:text-5xl',
    paddingClass: 'p-6 md:p-12',
  },
};

/**
 * Homepage promotional cards from "Homepage Promo" metaobjects (see
 * ~/lib/homepage-promos). Layout adapts to the number of entries:
 * 3 = large left + two stacked right, 2 = two side by side, 1 = full width,
 * 0 = the section is not rendered.
 * @param {{
 *   promos: PromoBlock[];
 *   label?: string;
 * }}
 */
export function PromoSection({promos, label = 'Promotions'}) {
  if (!promos.length) return null;

  const [feature, ...others] = promos;

  return (
    <section aria-label={label} className="page-width py-16 md:py-24">
      <div
        className={`grid gap-4 md:gap-6 ${others.length ? 'lg:grid-cols-2' : ''}`}
      >
        <PromoTile
          promo={feature}
          variant={others.length ? 'feature' : 'wide'}
        />
        {others.length ? (
          <div
            className={`grid gap-4 md:gap-6 ${
              others.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-1' : ''
            }`}
          >
            {others.map((promo) => (
              <PromoTile
                key={promo.id}
                promo={promo}
                variant={others.length > 1 ? 'compact' : 'feature'}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The whole card is one link (no nested interactive elements); the CTA is
 * styled text inside it. Without a URL the card renders as plain content.
 * @param {{promo: PromoBlock; variant: keyof typeof VARIANTS}}
 */
function PromoTile({promo, variant}) {
  const localePath = useLocalePath();
  const config = VARIANTS[variant];
  const {image, link} = promo;

  const className = `group relative isolate flex overflow-hidden rounded-card bg-ink-soft ${config.className}`;
  const content = (
    <>
      {image ? (
        <Image
          data={image}
          // The heading carries the meaning; alt text is optional in Shopify.
          alt={image.altText}
          sizes={getCoverSizes(config.boxes, image)}
          loading="lazy"
          className="absolute inset-0 -z-10 size-full rounded-none object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          style={
            image.objectPosition
              ? {objectPosition: image.objectPosition}
              : undefined
          }
        />
      ) : null}
      {/* Scrim keeps the overlaid copy legible on any photograph. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-black/70 via-black/25 to-transparent"
      />
      <div className={`mt-auto w-full text-white ${config.paddingClass}`}>
        {promo.heading ? (
          <h3
            className={`font-display leading-tight font-medium text-white drop-shadow-sm ${config.headingClass}`}
          >
            {promo.heading}
          </h3>
        ) : null}
        {promo.description ? (
          <p className="mt-2 max-w-md text-sm leading-relaxed whitespace-pre-line text-white/90 md:text-base">
            {promo.description}
          </p>
        ) : null}
        {link && promo.buttonLabel ? (
          <span className="mt-5 inline-flex items-center gap-2 border-b border-white/60 pb-1 text-sm font-semibold transition-colors duration-200 group-hover:border-white">
            {promo.buttonLabel}
            <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        ) : null}
      </div>
    </>
  );

  if (!link) {
    return <div className={className}>{content}</div>;
  }

  // Cards without a heading still need an accessible link name.
  const ariaLabel = promo.heading
    ? undefined
    : promo.buttonLabel || image?.altText || undefined;

  if (link.isExternal) {
    return (
      <a
        href={link.href}
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      to={localePath(link.href)}
      prefetch="intent"
      aria-label={ariaLabel}
      className={className}
    >
      {content}
    </Link>
  );
}

/**
 * The image covers a box whose shape differs from the image's, so it can
 * render wider than the box. Returns a `sizes` value describing the width it
 * really needs at each breakpoint, so a sharp srcset candidate is chosen.
 * @param {Array<{minWidth: number; width: string; height?: number; aspect?: number}>} boxes
 * @param {{width?: number; height?: number}} image
 */
function getCoverSizes(boxes, {width, height}) {
  const ratio = width && height ? width / height : undefined;

  return boxes
    .map(({minWidth, width: boxWidth, height: boxHeight, aspect}) => {
      let size = boxWidth;
      if (ratio && boxHeight) {
        size = `max(${boxWidth}, ${Math.ceil(boxHeight * ratio)}px)`;
      } else if (ratio && aspect && ratio > aspect) {
        size = `calc(${boxWidth} * ${(ratio / aspect).toFixed(3)})`;
      }
      return minWidth ? `(min-width: ${minWidth}px) ${size}` : size;
    })
    .join(', ');
}

/** @typedef {import('~/lib/homepage-promos').PromoBlock} PromoBlock */
