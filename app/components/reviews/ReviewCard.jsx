import {ReviewStars} from '~/components/reviews/ReviewStars';

/** Fixed locale and time zone so server and client render the same date. */
const REVIEW_DATE = new Intl.DateTimeFormat('en', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

/**
 * One approved review. Customer text is rendered as plain React text
 * (escaped), never as HTML. There is no email in the data.
 * @param {{review: import('~/lib/reviews').PublicReview}}
 */
export function ReviewCard({review}) {
  const date = review.createdAt ? new Date(review.createdAt) : null;
  return (
    <article>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-3">
          <ReviewStars rating={review.rating} />
          <span className="sr-only">Rated {review.rating} out of 5</span>
          <span className="text-sm font-semibold text-ink">
            {review.customerName}
          </span>
        </div>
        {date ? (
          <time dateTime={review.createdAt} className="text-xs text-muted">
            {REVIEW_DATE.format(date)}
          </time>
        ) : null}
      </div>
      {review.reviewTitle ? (
        <h3 className="mt-3 text-base font-semibold break-words text-ink">
          {review.reviewTitle}
        </h3>
      ) : null}
      {review.reviewText ? (
        <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-line text-ink-soft">
          {review.reviewText}
        </p>
      ) : null}
    </article>
  );
}
