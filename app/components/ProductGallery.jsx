import {useCallback, useEffect, useRef, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import {BagIcon, ChevronLeftIcon, ChevronRightIcon} from '~/components/Icons';

/**
 * Product image gallery: a swipeable, scroll-snapping main viewer (native
 * horizontal scrolling, no carousel library), thumbnails on tablet/desktop,
 * dots on mobile, and a fullscreen zoom lightbox.
 *
 * Images keep Shopify's media order. When the selected variant has its own
 * image, the gallery moves to it (matched by image URL, because variant
 * images and media images have different IDs in the Storefront API).
 * @param {{
 *   images: GalleryImage[];
 *   title: string;
 *   selectedImageUrl?: string | null;
 * }}
 */
export function ProductGallery({images, title, selectedImageUrl}) {
  const initialIndex = Math.max(0, findImageIndex(images, selectedImageUrl));
  const [active, setActive] = useState(initialIndex);
  const [lightboxIndex, setLightboxIndex] = useState(
    /** @type {number | null} */ (null),
  );
  const trackRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const frame = useRef(0);

  const scrollToIndex = useCallback((index, behavior = 'smooth') => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({left: index * track.clientWidth, behavior});
    setActive(index);
  }, []);

  // Start at the selected variant's image (SSR renders the track at 0).
  useEffect(() => {
    if (initialIndex > 0) scrollToIndex(initialIndex, 'instant');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow variant changes that bring their own image.
  const previousUrl = useRef(selectedImageUrl);
  useEffect(() => {
    if (selectedImageUrl === previousUrl.current) return;
    previousUrl.current = selectedImageUrl;
    const index = findImageIndex(images, selectedImageUrl);
    if (index >= 0) scrollToIndex(index);
  }, [images, selectedImageUrl, scrollToIndex]);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track || !track.clientWidth) return;
      setActive(Math.round(track.scrollLeft / track.clientWidth));
    });
  };

  if (!images.length) {
    return (
      <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-card bg-surface text-muted/60">
        <BagIcon className="size-12" strokeWidth={1.2} />
        <span className="text-sm">Image coming soon</span>
      </div>
    );
  }

  const count = images.length;
  const go = (delta) => scrollToIndex((active + delta + count) % count);

  return (
    <div className="ui-scope">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} images`}
        className="group relative"
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <div
              key={image.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
              className="w-full shrink-0 snap-center"
            >
              <button
                type="button"
                tabIndex={index === active ? 0 : -1}
                onClick={() => setLightboxIndex(index)}
                onKeyDown={(event) => {
                  if (count < 2) return;
                  if (event.key === 'ArrowRight') go(1);
                  else if (event.key === 'ArrowLeft') go(-1);
                  else return;
                  event.preventDefault();
                }}
                aria-label={`Zoom image ${index + 1} of ${count}`}
                className="block aspect-[4/5] w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              >
                <Image
                  data={image}
                  alt={altFor(image, title, index, count)}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  loading={index === initialIndex ? 'eager' : 'lazy'}
                  // React 18 only forwards the lowercase attribute.
                  fetchpriority={index === initialIndex ? 'high' : 'auto'}
                  className="size-full object-contain"
                />
              </button>
            </div>
          ))}
        </div>

        {count > 1 ? (
          <>
            <ArrowButton direction="previous" onClick={() => go(-1)} />
            <ArrowButton direction="next" onClick={() => go(1)} />
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <>
          {/* Thumbnails (tablet/desktop) */}
          <div className="mt-4 hidden gap-3 overflow-x-auto pb-1 md:flex">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`Show image ${index + 1} of ${count}`}
                aria-current={index === active ? 'true' : undefined}
                className={`size-20 shrink-0 overflow-hidden rounded-lg border-2 bg-surface transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  index === active
                    ? 'border-ink'
                    : 'border-transparent hover:border-line'
                }`}
              >
                <Image
                  data={image}
                  alt=""
                  aspectRatio="1/1"
                  sizes="80px"
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>

          {/* Dots (mobile) */}
          <div className="mt-4 flex justify-center gap-1 md:hidden">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`Show image ${index + 1} of ${count}`}
                aria-current={index === active ? 'true' : undefined}
                className="flex size-6 items-center justify-center focus-visible:outline-2 focus-visible:outline-ink"
              >
                <span
                  aria-hidden="true"
                  className={`block size-2 rounded-full transition-colors duration-200 ${
                    index === active ? 'bg-ink' : 'bg-line'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}

      <Lightbox
        images={images}
        title={title}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={(lastIndex) => {
          setLightboxIndex(null);
          // Keep the page gallery on the image last viewed.
          if (lastIndex !== active) scrollToIndex(lastIndex, 'instant');
        }}
      />
    </div>
  );
}

/**
 * @param {{direction: 'previous' | 'next'; onClick: () => void}}
 */
function ArrowButton({direction, onClick}) {
  const Icon = direction === 'next' ? ChevronRightIcon : ChevronLeftIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'next' ? 'Next image' : 'Previous image'}
      className={`absolute top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ink md:flex md:opacity-0 ${
        direction === 'next' ? 'right-3' : 'left-3'
      }`}
    >
      <Icon className="size-5" />
    </button>
  );
}

/* -------------------------------- Lightbox ------------------------------- */

/**
 * Fullscreen viewer on a native modal <dialog>: the browser moves focus to
 * its first control (Close), traps focus, closes on Escape and restores
 * focus to the opening control. Click or press the image to zoom in, then
 * scroll or swipe to pan.
 * @param {{
 *   images: GalleryImage[];
 *   title: string;
 *   index: number | null;
 *   onIndexChange: (index: number) => void;
 *   onClose: (lastIndex: number) => void;
 * }}
 */
function Lightbox({images, title, index, onIndexChange, onClose}) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const viewportRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [zoomed, setZoomed] = useState(false);
  const lastIndex = useRef(0);
  const open = index !== null;
  const count = images.length;
  if (open) lastIndex.current = index;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reset zoom whenever the image changes.
  useEffect(() => setZoomed(false), [index]);

  const go = (delta) => {
    if (index === null || count < 2) return;
    onIndexChange((index + delta + count) % count);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  /** Zooms in around the point that was clicked. */
  const toggleZoom = (event) => {
    const viewport = viewportRef.current;
    if (zoomed || !viewport) {
      setZoomed(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX ? (event.clientX - rect.left) / rect.width : 0.5;
    const y = event.clientY ? (event.clientY - rect.top) / rect.height : 0.5;
    setZoomed(true);
    requestAnimationFrame(() => {
      viewport.scrollLeft = x * viewport.scrollWidth - viewport.clientWidth / 2;
      viewport.scrollTop =
        y * viewport.scrollHeight - viewport.clientHeight / 2;
    });
  };

  const image = open ? images[index] : null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${title} image viewer`}
      onClose={() => {
        document.documentElement.style.overflow = '';
        onClose(lastIndex.current);
      }}
      className="ui-scope m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-ink backdrop:bg-black/60"
    >
      {image ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm text-muted" aria-live="polite">
              Image {index + 1} of {count}
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close image viewer"
              className="inline-flex size-10 items-center justify-center rounded-full text-2xl leading-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-ink"
            >
              &times;
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={viewportRef}
              className={`size-full ${
                zoomed
                  ? 'overflow-auto'
                  : 'flex items-center justify-center overflow-hidden'
              }`}
            >
              <button
                type="button"
                onClick={toggleZoom}
                aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
                aria-pressed={zoomed}
                className={`block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                  zoomed
                    ? 'w-[250%] max-w-none cursor-zoom-out md:w-[200%]'
                    : 'size-full cursor-zoom-in'
                }`}
              >
                <Image
                  key={image.id}
                  data={image}
                  alt={altFor(image, title, index, count)}
                  sizes={zoomed ? '250vw' : '100vw'}
                  loading="eager"
                  className={
                    zoomed ? 'h-auto w-full' : 'size-full object-contain'
                  }
                />
              </button>
            </div>

            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous image"
                  className="absolute top-1/2 left-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next image"
                  className="absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <ChevronRightIcon className="size-5" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/* --------------------------------- Helpers -------------------------------- */

/** Image URL without query string, used to match variant and media images. */
function imageKey(url) {
  return url ? url.split('?')[0] : '';
}

/**
 * @param {GalleryImage[]} images
 * @param {string | null | undefined} url
 */
function findImageIndex(images, url) {
  const key = imageKey(url);
  return key ? images.findIndex((image) => imageKey(image.url) === key) : -1;
}

/** Shopify alt text, or a descriptive fallback. */
function altFor(image, title, index, count) {
  if (image.altText) return image.altText;
  return count > 1 ? `${title}, image ${index + 1} of ${count}` : title;
}

/**
 * @typedef {{
 *   id: string;
 *   url: string;
 *   altText?: string | null;
 *   width?: number | null;
 *   height?: number | null;
 * }} GalleryImage
 */
