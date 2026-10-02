import {REVIEWS_SECTION_ID, describeRating} from '~/lib/reviews';
import {ReviewStars} from '~/components/reviews/ReviewStars';

/** Smooth-scrolls to the reviews section (respects reduced motion). */
function scrollToReviews(event) {
  const section = document.getElementById(REVIEWS_SECTION_ID);
  if (!section) return;
  event.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({behavior: reduce ? 'auto' : 'smooth'});
  window.history.replaceState(null, '', `#${REVIEWS_SECTION_ID}`);
}

/**
 * Below the product title: "★★★★★ 4.7 (18 reviews)" or "☆☆☆☆☆ No reviews
 * yet", linking to the reviews section. Approved reviews only. Renders
 * nothing while reviews cannot be read.
 * @param {{result: ProductReviewsResult | null}}
 */
export function ProductRatingSummary({result}) {
  if (result?.status !== 'ok') return null;
  const {summary} = result;
  const hasReviews = summary.reviewCount > 0;
  return (
    <a
      href={`#${REVIEWS_SECTION_ID}`}
      onClick={scrollToReviews}
      className="mt-3 inline-flex min-h-6 items-center gap-2 text-sm text-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <ReviewStars rating={hasReviews ? summary.averageRating : 0} />
      {hasReviews ? (
        <>
          <span aria-hidden="true">
            {summary.averageRating.toFixed(1)}{' '}
            <span className="text-muted">
              ({summary.reviewCount}{' '}
              {summary.reviewCount === 1 ? 'review' : 'reviews'})
            </span>
          </span>
          <span className="sr-only">{describeRating(summary)}</span>
        </>
      ) : (
        <span className="text-muted">No reviews yet</span>
      )}
    </a>
  );
}

/** Space-holder while the summary streams in (no layout shift). */
export function ProductRatingSummaryPlaceholder() {
  return <span aria-hidden="true" className="mt-3 block h-6" />;
}

/** @typedef {import('~/lib/product-reviews.server').ProductReviewsResult} ProductReviewsResult */
