import {describeRating} from '~/lib/reviews';
import {ReviewStars} from '~/components/reviews/ReviewStars';

/**
 * "4.7 ★★★★★ / Based on 18 reviews" for the reviews section, or the empty
 * state. Approved reviews only.
 * @param {{summary: import('~/lib/reviews').ReviewSummary}}
 */
export function ReviewSummary({summary}) {
  const count = summary.reviewCount;
  if (!count) {
    return (
      <div className="text-sm text-muted">
        <p>No reviews yet.</p>
        <p>Be the first to review this product.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="flex items-center gap-3">
        <span className="text-5xl font-medium text-ink" aria-hidden="true">
          {summary.averageRating.toFixed(1)}
        </span>
        <ReviewStars rating={summary.averageRating} className="h-5" />
      </p>
      <p className="mt-2 text-sm text-muted">
        <span aria-hidden="true">
          Based on {count} {count === 1 ? 'review' : 'reviews'}
        </span>
        <span className="sr-only">{describeRating(summary)}</span>
      </p>
    </div>
  );
}
