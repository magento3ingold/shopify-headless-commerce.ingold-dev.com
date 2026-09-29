import {Image} from '@shopify/hydrogen';
import {SectionHeading} from '~/components/SectionHeading';

const ICON_SIZE = 72;

/**
 * "Why Shop With Us" cards from "Homepage Benefits" metaobjects (see
 * ~/lib/homepage-benefits). Renders nothing when there are no entries.
 * @param {{
 *   benefits: HomepageBenefit[];
 *   title?: string;
 * }}
 */
export function Benefits({benefits, title = 'Why Shop With Us'}) {
  if (!benefits.length) return null;

  return (
    <section
      aria-labelledby="benefits-heading"
      className="border-y border-line bg-surface"
    >
      <div className="page-width py-16 md:py-20">
        <SectionHeading id="benefits-heading" title={title} align="center" />
        <ul className="grid gap-4 min-[480px]:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <li
              key={benefit.id}
              className="flex flex-col items-center rounded-card border border-line bg-white p-6 text-center md:p-8"
            >
              {benefit.icon ? <BenefitIcon icon={benefit.icon} /> : null}
              {benefit.heading ? (
                <h3
                  className={`text-base font-semibold text-ink ${
                    benefit.icon ? 'mt-5' : ''
                  }`}
                >
                  {benefit.heading}
                </h3>
              ) : null}
              {benefit.description ? (
                <p
                  className={`text-sm leading-relaxed whitespace-pre-line text-muted ${
                    benefit.heading || benefit.icon ? 'mt-2' : ''
                  }`}
                >
                  {benefit.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Icons are uploaded as regular files, often far larger than displayed.
 * A fixed-width Hydrogen <Image> requests small 1x/2x/3x CDN renditions,
 * and object-contain keeps non-square artwork uncropped.
 * @param {{icon: NonNullable<HomepageBenefit['icon']>}}
 */
function BenefitIcon({icon}) {
  const isCdnImage = Boolean(icon.width && icon.height);

  return (
    <span className="flex size-18 shrink-0 items-center justify-center">
      {isCdnImage ? (
        <Image
          data={icon}
          width={ICON_SIZE}
          // Decorative: the heading below names the benefit.
          alt=""
          loading="lazy"
          className="max-h-full max-w-full rounded-none object-contain"
        />
      ) : (
        // e.g. an SVG stored as a generic file: no CDN resizing needed.
        <img
          src={icon.url}
          alt=""
          width={ICON_SIZE}
          height={ICON_SIZE}
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full rounded-none object-contain"
        />
      )}
    </span>
  );
}

/** @typedef {import('~/lib/homepage-benefits').HomepageBenefit} HomepageBenefit */
