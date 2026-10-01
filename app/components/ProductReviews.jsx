import {useEffect, useId, useState} from 'react';
import {useFetcher} from 'react-router';
import {REVIEW_SORTS, describeRating} from '~/lib/reviews';

/**
 * Five stars filled to `rating` (0–5, fractions allowed): a muted row with
 * a solid row on top, clipped to the rating. Decorative: pair it with text
 * such as describeRating() for assistive technology.
 * @param {{rating: number; className?: string}} props `className` sets the
 *   height, e.g. "h-4".
 */
export function StarRating({rating, className = 'h-4'}) {
  const percent = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block aspect-[5/1] shrink-0 ${className}`}
    >
      <StarRow className="text-line" />
      <span
        className="absolute inset-y-0 left-0 overflow-hidden text-ink"
        style={{width: `${percent}%`}}
      >
        <StarRow className="" />
      </span>
    </span>
  );
}

/** @param {{className: string}} */
function StarRow({className}) {
  return (
    <svg
      viewBox="0 0 120 24"
      fill="currentColor"
      className={`block h-full aspect-[5/1] max-w-none ${className}`}
    >
      {[0, 1, 2, 3, 4].map((star) => (
        <path
          key={star}
          transform={`translate(${star * 24} 0)`}
          d="M12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21 12 17.27 5.82 21l1.64-7.03L2 9.24l7.19-.61z"
        />
      ))}
    </svg>
  );
}

/**
 * Rating summary under the product title. Links to the reviews section.
 * Renders nothing without real rating data.
 * @param {{summary: import('~/lib/reviews').ReviewSummary | null}}
 */
export function ReviewSummaryLink({summary}) {
  if (!summary) return null;
  return (
    <a
      href="#reviews"
      className="mt-3 inline-flex items-center gap-2 text-sm text-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <StarRating rating={summary.averageRating} />
      <span aria-hidden="true">
        {summary.averageRating.toFixed(1)}{' '}
        <span className="text-muted">
          ({summary.reviewCount}{' '}
          {summary.reviewCount === 1 ? 'review' : 'reviews'})
        </span>
      </span>
      <span className="sr-only">{describeRating(summary)}</span>
    </a>
  );
}

/**
 * Full reviews section. Shows exactly what the data sources supply: the
 * Shopify rating summary, and individual reviews, distribution, sorting and
 * paging only when a review provider supplies them. There is no "Write a
 * review" form: it needs the provider's submission API.
 * @param {{
 *   productHandle: string;
 *   summary: import('~/lib/reviews').ReviewSummary | null;
 *   initialPage: import('~/lib/reviews').ReviewPage | null;
 * }}
 */
export function ProductReviews({productHandle, summary, initialPage}) {
  const fetcher = useFetcher();
  const [reviewData, setReviewData] = useState(initialPage);
  const [reviews, setReviews] = useState(initialPage?.reviews ?? []);
  const sortId = useId();

  useEffect(() => {
    setReviewData(initialPage);
    setReviews(initialPage?.reviews ?? []);
  }, [initialPage]);

  // Merge a fetched page: a new sort replaces, the next page appends.
  useEffect(() => {
    const page = fetcher.data?.ok ? fetcher.data.reviews : null;
    if (!page) return;
    setReviews((current) =>
      page.page > 1 ? [...current, ...page.reviews] : page.reviews,
    );
    setReviewData(page);
  }, [fetcher.data]);

  const load = (sort, page) =>
    fetcher.load(
      `/api/product-reviews?${new URLSearchParams({
        handle: productHandle,
        sort,
        page: String(page),
      })}`,
    );

  const sorts = REVIEW_SORTS.filter((option) =>
    reviewData?.sorts?.includes(option.value),
  );
  const distribution = reviewData?.distribution ?? null;
  const total = summary?.reviewCount ?? 0;

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="scroll-mt-28 border-t border-line pt-12 md:pt-16"
    >
      <h2
        id="reviews-heading"
        className="font-display text-3xl font-medium text-ink md:text-4xl"
      >
        Product reviews
      </h2>

      <div className="mt-8 grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
        <div>
          {summary ? (
            <>
              <p className="flex items-baseline gap-3">
                <span className="text-5xl font-medium text-ink">
                  {summary.averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-muted">out of 5</span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <StarRating rating={summary.averageRating} className="h-5" />
                <span className="text-sm text-muted">
                  {total} {total === 1 ? 'review' : 'reviews'}
                </span>
              </div>
              <p className="sr-only">{describeRating(summary)}</p>
            </>
          ) : (
            <p className="text-sm text-muted">
              There are no reviews for this product yet.
            </p>
          )}

          {distribution ? (
            <RatingDistribution distribution={distribution} />
          ) : null}
        </div>

        <div>
          {sorts.length > 1 && reviews.length ? (
            <div className="mb-6 flex items-center justify-end gap-2">
              <label htmlFor={sortId} className="text-sm text-muted">
                Sort reviews
              </label>
              <select
                id={sortId}
                value={reviewData?.sort}
                onChange={(event) => load(event.target.value, 1)}
                className="m-0 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink"
              >
                {sorts.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {reviews.length ? (
            <ul
              aria-busy={fetcher.state === 'loading'}
              className="divide-y divide-line border-y border-line"
            >
              {reviews.map((review) => (
                <li key={review.id} className="py-6">
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>
          ) : null}

          {reviewData?.hasNextPage ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                disabled={fetcher.state === 'loading'}
                onClick={() => load(reviewData.sort, reviewData.page + 1)}
                className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-ink disabled:opacity-60"
              >
                {fetcher.state === 'loading' ? 'Loading…' : 'More reviews'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Fixed locale and time zone so server and client render the same date. */
const REVIEW_DATE = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/** @param {{distribution: Record<number, number>}} */
function RatingDistribution({distribution}) {
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: Number(distribution[stars]) || 0,
  }));
  const max = Math.max(1, ...counts.map((entry) => entry.count));
  return (
    <dl className="mt-6 space-y-2">
      {counts.map(({stars, count}) => (
        <div key={stars} className="flex items-center gap-3 text-sm">
          <dt className="w-14 shrink-0 text-ink">
            {stars} {stars === 1 ? 'star' : 'stars'}
          </dt>
          <dd className="m-0 flex flex-1 items-center gap-3">
            <span
              aria-hidden="true"
              className="h-2 flex-1 overflow-hidden rounded-full bg-line"
            >
              <span
                className="block h-full rounded-full bg-ink"
                style={{width: `${(count / max) * 100}%`}}
              />
            </span>
            <span className="w-8 text-right text-muted">{count}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** @param {{review: import('~/lib/reviews').Review}} */
function ReviewCard({review}) {
  const date = review.createdAt ? new Date(review.createdAt) : null;
  return (
    <article>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating rating={review.rating} />
        <span className="sr-only">Rated {review.rating} out of 5</span>
        {review.author ? (
          <span className="text-sm font-semibold text-ink">
            {review.author}
          </span>
        ) : null}
        {review.verifiedBuyer ? (
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink">
            Verified buyer
          </span>
        ) : null}
        {date && !Number.isNaN(date.getTime()) ? (
          <time
            dateTime={review.createdAt}
            className="ml-auto text-xs text-muted"
          >
            {REVIEW_DATE.format(date)}
          </time>
        ) : null}
      </div>
      {review.title ? (
        <h3 className="mt-3 text-base font-semibold text-ink">
          {review.title}
        </h3>
      ) : null}
      {review.body ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
          {review.body}
        </p>
      ) : null}
      {review.images?.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {review.images.map((image) => (
            <li key={image.url}>
              <img
                src={image.url}
                alt={image.altText ?? 'Review photo'}
                loading="lazy"
                width="80"
                height="80"
                className="size-20 rounded-lg object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
