import {useEffect, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {
  REVIEWS_API_PATH,
  REVIEWS_SECTION_ID,
  REVIEW_SORTS,
} from '~/lib/reviews';
import {ReviewSummary} from '~/components/reviews/ReviewSummary';
import {RatingDistribution} from '~/components/reviews/RatingDistribution';
import {ReviewCard} from '~/components/reviews/ReviewCard';
import {ReviewSort} from '~/components/reviews/ReviewSort';
import {ReviewForm} from '~/components/reviews/ReviewForm';

/**
 * "Customer Reviews" section: summary, distribution, Write a Review, sort
 * and approved reviews, 10 at a time. Every number comes from approved
 * reviews only (see ~/lib/product-reviews.server).
 *
 * States: loading, ok (with or without reviews), reading failed but
 * submitting works (notice + Write a Review), and unavailable.
 * @param {{
 *   product: {id: string; handle: string; title: string};
 *   result: ProductReviewsResult | null;
 * }}
 */
export function ProductReviews({product, result}) {
  const fetcher = useFetcher();
  const initialPage = result?.status === 'ok' ? result.page : null;
  const [page, setPage] = useState(initialPage);
  const [reviews, setReviews] = useState(initialPage?.reviews ?? []);
  const [formOpen, setFormOpen] = useState(false);
  const writeButton = useRef(/** @type {HTMLButtonElement | null} */ (null));

  useEffect(() => {
    setPage(initialPage);
    setReviews(initialPage?.reviews ?? []);
  }, [initialPage]);

  // A new sort replaces the list; the next page appends.
  useEffect(() => {
    const next = fetcher.data?.ok ? fetcher.data.page : null;
    if (!next) return;
    setReviews((current) =>
      next.page > 1 ? [...current, ...next.reviews] : next.reviews,
    );
    setPage(next);
  }, [fetcher.data]);

  const load = (sort, pageNumber) =>
    fetcher.load(
      `${REVIEWS_API_PATH}?${new URLSearchParams({
        productId: product.id,
        sort,
        page: String(pageNumber),
      })}`,
    );

  const available = result?.status === 'ok';
  // Zero reviews is "ok". Writing stays possible when only reading failed.
  const canSubmit = Boolean(result?.canSubmit);
  const summary = available ? result.summary : null;
  const count = summary?.reviewCount ?? 0;
  const loading = fetcher.state === 'loading';
  const loadFailed = fetcher.state === 'idle' && fetcher.data?.ok === false;

  const writeReviewButton = (
    <button
      ref={writeButton}
      type="button"
      onClick={() => setFormOpen(true)}
      aria-haspopup="dialog"
      className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-8 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:w-auto"
    >
      Write a Review
    </button>
  );

  return (
    <section
      id={REVIEWS_SECTION_ID}
      aria-labelledby={`${REVIEWS_SECTION_ID}-heading`}
      className="scroll-mt-28 border-t border-line pt-12 md:pt-16"
    >
      <h2
        id={`${REVIEWS_SECTION_ID}-heading`}
        className="font-display text-3xl font-medium text-ink md:text-4xl"
      >
        Customer Reviews
      </h2>

      {!result ? (
        <p className="mt-6 text-sm text-muted">Loading reviews…</p>
      ) : !available && canSubmit ? (
        <div className="mt-6">
          <p role="status" className="text-sm text-muted">
            Reviews could not be loaded right now. You can still write a review.
          </p>
          {writeReviewButton}
        </div>
      ) : !available ? (
        <p className="mt-6 text-sm text-muted">
          Customer reviews are currently unavailable.
        </p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
          <div>
            <ReviewSummary summary={summary} />
            <RatingDistribution summary={summary} />
            {writeReviewButton}
          </div>

          <div className="min-w-0">
            {count > 1 ? (
              <div className="mb-6 flex justify-end">
                <ReviewSort
                  value={page?.sort ?? REVIEW_SORTS[0].value}
                  onChange={(sort) => load(sort, 1)}
                  disabled={loading}
                />
              </div>
            ) : null}

            {reviews.length ? (
              <ul
                aria-busy={loading}
                className="divide-y divide-line border-y border-line"
              >
                {reviews.map((review) => (
                  <li key={review.id} className="py-6">
                    <ReviewCard review={review} />
                  </li>
                ))}
              </ul>
            ) : null}

            {loadFailed ? (
              <p role="alert" className="mt-6 text-sm text-sale">
                More reviews could not be loaded. Please try again.
              </p>
            ) : null}

            {page?.hasNextPage ? (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => load(page.sort, page.page + 1)}
                  className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-60"
                >
                  {loading ? 'Loading…' : 'Load More'}
                </button>
              </div>
            ) : reviews.length ? (
              <p className="mt-8 text-center text-sm text-muted">
                You&apos;ve reached the end of the reviews.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {canSubmit ? (
        <ReviewForm
          product={product}
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            writeButton.current?.focus();
          }}
        />
      ) : null}
    </section>
  );
}

/** @typedef {import('~/lib/product-reviews.server').ProductReviewsResult} ProductReviewsResult */
