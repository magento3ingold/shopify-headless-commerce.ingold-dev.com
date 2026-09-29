import {useCallback, useEffect, useRef, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import {ButtonLink} from '~/components/ButtonLink';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from '~/components/Icons';

const AUTOPLAY_INTERVAL_MS = 6000;
const SWIPE_THRESHOLD_PX = 40;

/**
 * Slider height per breakpoint; keep in sync with the section's h-* classes.
 * @type {Array<[minViewportWidth: number, heightPx: number]>}
 */
const HERO_HEIGHTS = [
  [1280, 720],
  [1024, 680],
  [640, 600],
  [0, 560],
];

/**
 * `object-cover` fills a fixed-height box, so on narrow screens the image is
 * scaled to the box height, not the viewport width. Tell the browser the
 * width it will really render at, so it picks a sharp srcset candidate.
 * @param {{width?: number | null; height?: number | null}} image
 */
function getHeroSizes({width, height}) {
  if (!width || !height) return '100vw';
  const ratio = width / height;
  return HERO_HEIGHTS.map(([minWidth, boxHeight]) => {
    const size = `max(100vw, ${Math.ceil(boxHeight * ratio)}px)`;
    return minWidth ? `(min-width: ${minWidth}px) ${size}` : size;
  }).join(', ');
}

const CONTROL_BUTTON =
  'inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition-colors duration-200 hover:bg-white';

/**
 * Accessible, dependency-free hero carousel.
 *
 * - Slides cross-fade in place (fixed height, so no layout shift).
 * - Only the first image is eager / high priority (the LCP candidate).
 * - Auto-rotation pauses on hover, keyboard focus and touch, can be paused
 *   with a dedicated button (WCAG 2.2.2) and is disabled entirely when the
 *   visitor prefers reduced motion.
 * @param {{
 *   slides: HeroSlide[];
 *   label?: string;
 * }}
 */
export function HeroSlider({slides, label = 'Featured promotions'}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef(null);
  const count = slides.length;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const goTo = useCallback(
    (index) => setActiveIndex(((index % count) + count) % count),
    [count],
  );
  const next = useCallback(
    () => setActiveIndex((current) => (current + 1) % count),
    [count],
  );
  const previous = useCallback(
    () => setActiveIndex((current) => (current - 1 + count) % count),
    [count],
  );

  const isAutoplaying =
    count > 1 && !isPaused && !isInteracting && !prefersReducedMotion;

  useEffect(() => {
    if (!isAutoplaying) return;
    const timer = window.setTimeout(next, AUTOPLAY_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [isAutoplaying, next, activeIndex]);

  if (!count) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative h-[560px] overflow-hidden bg-ink sm:h-[600px] lg:h-[680px] xl:h-[720px]"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocus={() => setIsInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsInteracting(false);
        }
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
        setIsInteracting(true);
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        const endX = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        setIsInteracting(false);
        if (startX == null || endX == null) return;
        const delta = endX - startX;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
        if (delta < 0) {
          next();
        } else {
          previous();
        }
      }}
    >
      <div
        aria-live={isAutoplaying ? 'off' : 'polite'}
        className="relative size-full"
      >
        {slides.map((slide, index) => (
          <HeroSlideItem
            key={slide.id}
            slide={slide}
            index={index}
            total={count}
            isActive={index === activeIndex}
          />
        ))}
      </div>

      {count > 1 ? (
        <div className="page-width pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-between gap-4 md:bottom-10">
          <div className="pointer-events-auto flex items-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show slide ${index + 1} of ${count}${
                  slide.heading ? `: ${slide.heading}` : ''
                }`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className="group flex h-10 items-center"
              >
                <span
                  className={`block h-1 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? 'w-10 bg-white'
                      : 'w-5 bg-white/50 group-hover:bg-white/80'
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaused((paused) => !paused)}
              aria-label={isPaused ? 'Play slideshow' : 'Pause slideshow'}
              className={`${CONTROL_BUTTON} ${prefersReducedMotion ? 'hidden' : ''}`}
            >
              {isPaused ? (
                <PlayIcon className="size-4" />
              ) : (
                <PauseIcon className="size-4" />
              )}
            </button>
            <button
              type="button"
              onClick={previous}
              aria-label="Previous slide"
              className={CONTROL_BUTTON}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className={CONTROL_BUTTON}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {{
 *   slide: HeroSlide;
 *   index: number;
 *   total: number;
 *   isActive: boolean;
 * }}
 */
function HeroSlideItem({slide, index, total, isActive}) {
  const isFirst = index === 0;

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}`}
      aria-hidden={!isActive}
      // `inert` keeps links in hidden slides out of the tab order.
      inert={isActive ? undefined : ''}
      className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
        isActive ? 'z-10 opacity-100' : 'z-0 opacity-0'
      }`}
    >
      {slide.image ? (
        // Hydrogen <Image> builds a responsive srcset from the Shopify CDN.
        <Image
          data={slide.image}
          // The heading carries the meaning; alt text is optional in Shopify.
          alt={slide.image.altText}
          sizes={getHeroSizes(slide.image)}
          loading={isFirst ? 'eager' : 'lazy'}
          // React 18 only forwards the lowercase attribute; switch to
          // `fetchPriority` after upgrading to React 19.
          fetchpriority={isFirst ? 'high' : 'auto'}
          decoding={isFirst ? 'sync' : 'async'}
          className="absolute inset-0 size-full rounded-none object-cover"
          style={
            slide.objectPosition
              ? {objectPosition: slide.objectPosition}
              : undefined
          }
        />
      ) : null}
      {/* Scrim keeps the copy legible on any photography. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/60 via-black/25 to-black/10 md:bg-linear-to-r md:from-black/55 md:via-black/20 md:to-transparent"
      />
      <div className="page-width relative flex h-full items-end pb-24 md:items-center md:pb-0">
        <div className="max-w-xl text-white">
          {slide.heading ? (
            <h2 className="m-0 font-display text-4xl leading-[1.05] font-medium tracking-tight text-white sm:text-5xl lg:text-6xl">
              {slide.heading}
            </h2>
          ) : null}
          {slide.description ? (
            // pre-line keeps line breaks from the multi-line text field
            <p className="mt-4 max-w-md text-base leading-relaxed whitespace-pre-line text-white/85 md:mt-5 md:text-lg">
              {slide.description}
            </p>
          ) : null}
          {slide.cta ? (
            <ButtonLink
              to={slide.cta.to}
              variant="light"
              className="mt-7 md:mt-8"
            >
              {slide.cta.label}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** @typedef {import('~/lib/homepage-banners').HeroSlide} HeroSlide */
