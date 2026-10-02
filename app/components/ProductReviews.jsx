import {useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {
  REVIEW_LIMITS,
  REVIEW_SORTS,
  describeRating,
  validateReviewInput,
} from '~/lib/reviews';

export const REVIEWS_SECTION_ID = 'product-reviews';
const API = '/api/product-reviews';

/* ---------------------------------- Stars --------------------------------- */

/**
 * Five stars filled to `rating` (0–5, fractions allowed): a muted row with
 * a solid row on top, clipped to the rating. Decorative only (hidden from
 * assistive technology); pair it with text such as describeRating().
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
      className={`block aspect-[5/1] h-full max-w-none ${className}`}
    >
      {[0, 1, 2, 3, 4].map((star) => (
        <path key={star} transform={`translate(${star * 24} 0)`} d={STAR} />
      ))}
    </svg>
  );
}

const STAR =
  'M12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21 12 17.27 5.82 21l1.64-7.03L2 9.24l7.19-.61z';

/* ------------------------- Summary below the title ------------------------- */

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
 * "★★★★★ 4.7 (18 reviews)" or "☆☆☆☆☆ No reviews yet", linking to the
 * reviews section. Renders nothing while reviews are unavailable.
 * @param {{result: ProductReviewsResult | null}}
 */
export function ReviewSummaryLink({result}) {
  if (result?.status !== 'ok') return null;
  const {summary} = result;
  const hasReviews = summary.reviewCount > 0;
  return (
    <a
      href={`#${REVIEWS_SECTION_ID}`}
      onClick={scrollToReviews}
      className="mt-3 inline-flex min-h-6 items-center gap-2 text-sm text-ink no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <StarRating rating={hasReviews ? summary.averageRating : 0} />
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
export function ReviewSummaryPlaceholder() {
  return <span aria-hidden="true" className="mt-3 block h-6" />;
}

/* ----------------------------- Reviews section ----------------------------- */

/**
 * Customer reviews: summary, distribution, "Write a review" and approved
 * reviews (10 at a time). All numbers come from approved reviews only.
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
  const sortId = useId();
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
      `${API}?${new URLSearchParams({
        productId: product.id,
        sort,
        page: String(pageNumber),
      })}`,
    );

  const available = result?.status === 'ok';
  const summary = available ? result.summary : null;
  const count = summary?.reviewCount ?? 0;
  const loadFailed = fetcher.state === 'idle' && fetcher.data?.ok === false;

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
        Customer reviews
      </h2>

      {!result ? (
        <p className="mt-6 text-sm text-muted">Loading reviews…</p>
      ) : !available ? (
        <p className="mt-6 text-sm text-muted">
          Reviews are currently unavailable. Please check back later.
        </p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
          <div>
            {count ? (
              <>
                <p className="flex items-center gap-3">
                  <span className="text-5xl font-medium text-ink">
                    {summary.averageRating.toFixed(1)}
                  </span>
                  <StarRating rating={summary.averageRating} className="h-5" />
                </p>
                <p className="mt-2 text-sm text-muted">
                  Based on {count} {count === 1 ? 'review' : 'reviews'}
                  <span className="sr-only">. {describeRating(summary)}</span>
                </p>
                <RatingDistribution summary={summary} />
              </>
            ) : (
              <p className="text-sm text-muted">
                No reviews yet. Be the first to review this product.
              </p>
            )}
            <button
              ref={writeButton}
              type="button"
              onClick={() => setFormOpen(true)}
              aria-haspopup="dialog"
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-8 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:w-auto"
            >
              Write a review
            </button>
          </div>

          <div>
            {count > 1 ? (
              <div className="mb-6 flex items-center justify-end gap-2">
                <label htmlFor={sortId} className="text-sm text-muted">
                  Sort reviews
                </label>
                <select
                  id={sortId}
                  value={page?.sort ?? REVIEW_SORTS[0].value}
                  onChange={(event) => load(event.target.value, 1)}
                  className="m-0 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink"
                >
                  {REVIEW_SORTS.map((option) => (
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

            {loadFailed ? (
              <p role="alert" className="mt-6 text-sm text-sale">
                More reviews could not be loaded. Please try again.
              </p>
            ) : null}

            {page?.hasNextPage ? (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  disabled={fetcher.state === 'loading'}
                  onClick={() => load(page.sort, page.page + 1)}
                  className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-60"
                >
                  {fetcher.state === 'loading' ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {available ? (
        <ReviewFormDialog
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

/** @param {{summary: import('~/lib/reviews').ReviewSummary}} */
function RatingDistribution({summary}) {
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <dl className="mt-6 space-y-2">
      {[5, 4, 3, 2, 1].map((stars) => {
        const value = summary.distribution[stars] ?? 0;
        return (
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
                  style={{width: `${(value / max) * 100}%`}}
                />
              </span>
              <span className="w-8 text-right text-muted">{value}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Fixed locale and time zone so server and client render the same date. */
const REVIEW_DATE = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/**
 * Customer text is rendered as plain React text (escaped), never as HTML.
 * @param {{review: import('~/lib/reviews').PublicReview}}
 */
function ReviewCard({review}) {
  const date = review.createdAt ? new Date(review.createdAt) : null;
  return (
    <article>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating rating={review.rating} />
        <span className="sr-only">Rated {review.rating} out of 5</span>
        <span className="text-sm font-semibold text-ink">
          {review.customerName}
        </span>
        {review.verifiedBuyer ? (
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink">
            Verified buyer
          </span>
        ) : null}
        {date ? (
          <time
            dateTime={review.createdAt}
            className="ml-auto text-xs text-muted"
          >
            {REVIEW_DATE.format(date)}
          </time>
        ) : null}
      </div>
      {review.reviewTitle ? (
        <h3 className="mt-3 text-base font-semibold text-ink">
          {review.reviewTitle}
        </h3>
      ) : null}
      {review.reviewText ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
          {review.reviewText}
        </p>
      ) : null}
    </article>
  );
}

/* ------------------------------- Review form ------------------------------ */

/**
 * "Write a review" in a native modal <dialog> (focus trap, Escape to
 * close). Submits to the server, which creates a pending review; success is
 * shown only after Shopify confirmed the entry.
 * @param {{
 *   product: {id: string; handle: string; title: string};
 *   open: boolean;
 *   onClose: () => void;
 * }}
 */
function ReviewFormDialog({product, open, onClose}) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const formRef = useRef(/** @type {HTMLFormElement | null} */ (null));
  const submit = useFetcher();
  const prefill = useFetcher();
  const [submissionId, setSubmissionId] = useState('');
  // The submission the current fetcher response belongs to.
  const [submittedId, setSubmittedId] = useState('');
  const [rating, setRating] = useState(0);
  const [clientErrors, setClientErrors] = useState(
    /** @type {Record<string, string>} */ ({}),
  );
  const ids = useId();

  const response =
    submit.state === 'idle' && submittedId === submissionId
      ? submit.data
      : null;
  const succeeded = response?.ok === true;
  const errors =
    response && !response.ok ? (response.errors ?? {}) : clientErrors;
  const submitting = submit.state !== 'idle';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
      // A fresh id per new review: the server uses it to reject a repeated
      // submission of the same review.
      if (!submissionId || succeeded) setSubmissionId(crypto.randomUUID());
      if (prefill.state === 'idle' && !prefill.data) {
        prefill.load(`${API}?prefill=1`);
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Prefill a signed-in customer's own name and email (only empty fields).
  useEffect(() => {
    const form = formRef.current;
    const data = prefill.data;
    if (!form || !data) return;
    for (const key of ['name', 'email']) {
      const input = form.elements.namedItem(key);
      if (data[key] && input && !input.value) input.value = data[key];
    }
  }, [prefill.data]);

  useEffect(() => {
    if (succeeded) setRating(0);
  }, [succeeded]);

  const onSubmit = (event) => {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = validateReviewInput(values);
    if (!result.ok) {
      event.preventDefault();
      setClientErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      formRef.current
        ?.querySelector(
          first === 'rating' ? 'input[name=rating]' : `[name="${first}"]`,
        )
        ?.focus();
      return;
    }
    setClientErrors({});
    setSubmittedId(submissionId);
  };

  const errorId = (name) => (errors[name] ? `${ids}-${name}-error` : undefined);
  const fieldError = (name) =>
    errors[name] ? (
      <p id={errorId(name)} className="mt-1.5 text-sm text-sale">
        {errors[name]}
      </p>
    ) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids}-title`}
      onClose={() => {
        document.documentElement.style.overflow = '';
        onClose();
      }}
      className="ui-scope m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] max-w-none overflow-y-auto rounded-card bg-white p-0 text-ink shadow-card backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div>
          <h2 id={`${ids}-title`} className="text-lg font-semibold text-ink">
            Write a review
          </h2>
          <p className="mt-0.5 text-sm text-muted">{product.title}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-ink"
        >
          &times;
        </button>
      </div>

      {succeeded ? (
        <div className="px-5 py-10 text-center md:px-8">
          <p role="status" className="text-base text-ink">
            {response.message}
          </p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="mt-6 rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
          >
            Close
          </button>
        </div>
      ) : (
        <submit.Form
          ref={formRef}
          method="post"
          action={API}
          noValidate
          onSubmit={onSubmit}
          className="space-y-5 px-5 py-6 md:px-8"
        >
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="productHandle" value={product.handle} />
          <input type="hidden" name="submissionId" value={submissionId} />
          {/* Honeypot for bots: hidden from people and assistive tech. */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] size-px overflow-hidden"
          >
            <label>
              Website
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>

          <fieldset
            aria-describedby={errorId('rating')}
            className="m-0 border-0 p-0"
          >
            <legend className="mb-2 p-0 text-sm font-semibold text-ink">
              Rating{' '}
              <span className="text-sale" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </legend>
            <div className="flex flex-wrap items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    className="sr-only"
                  />
                  <span className="sr-only">
                    {value} {value === 1 ? 'star' : 'stars'}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`size-8 transition-colors duration-150 ${
                      value <= rating ? 'text-ink' : 'text-line'
                    }`}
                  >
                    <path d={STAR} />
                  </svg>
                </label>
              ))}
              <span aria-hidden="true" className="ml-2 text-sm text-muted">
                {rating ? `${rating} out of 5` : 'Select a rating'}
              </span>
            </div>
            {fieldError('rating')}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={`${ids}-name`}
              name="name"
              label="Name"
              autoComplete="name"
              maxLength={REVIEW_LIMITS.name}
              error={fieldError('name')}
              errorId={errorId('name')}
            />
            <TextField
              id={`${ids}-email`}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              maxLength={REVIEW_LIMITS.email}
              hint="Never shown publicly."
              error={fieldError('email')}
              errorId={errorId('email')}
            />
          </div>
          <TextField
            id={`${ids}-title`}
            name="title"
            label="Review title"
            maxLength={REVIEW_LIMITS.title}
            error={fieldError('title')}
            errorId={errorId('title')}
          />
          <TextField
            id={`${ids}-body`}
            name="body"
            label="Review"
            multiline
            maxLength={REVIEW_LIMITS.text}
            error={fieldError('body')}
            errorId={errorId('body')}
          />

          {response && !response.ok ? (
            <p role="alert" className="text-sm text-sale">
              {response.message}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !submissionId}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-8 py-3 text-sm font-semibold text-white hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
          </div>
          <p className="text-xs text-muted">
            Reviews are published after approval.
          </p>
        </submit.Form>
      )}
    </dialog>
  );
}

/**
 * @param {{
 *   id: string;
 *   name: string;
 *   label: string;
 *   type?: string;
 *   multiline?: boolean;
 *   autoComplete?: string;
 *   maxLength: number;
 *   hint?: string;
 *   error: React.ReactNode;
 *   errorId?: string;
 * }}
 */
function TextField({
  id,
  name,
  label,
  type = 'text',
  multiline = false,
  autoComplete,
  maxLength,
  hint,
  error,
  errorId,
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const props = {
    id,
    name,
    required: true,
    maxLength,
    autoComplete,
    'aria-invalid': errorId ? true : undefined,
    'aria-describedby':
      [hintId, errorId].filter(Boolean).join(' ') || undefined,
    className: `m-0 block w-full rounded-lg border bg-white px-4 py-3 text-base text-ink focus:border-ink focus:outline-none ${
      errorId ? 'border-sale' : 'border-line'
    }`,
  };
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-ink"
      >
        {label}{' '}
        <span className="text-sale" aria-hidden="true">
          *
        </span>
        <span className="sr-only"> (required)</span>
      </label>
      {multiline ? (
        <textarea rows={5} {...props} />
      ) : (
        <input type={type} {...props} />
      )}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error}
    </div>
  );
}

/** @typedef {import('~/lib/product-reviews.server').ProductReviewsResult} ProductReviewsResult */
