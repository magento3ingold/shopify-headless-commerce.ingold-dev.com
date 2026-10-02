/**
 * Approved reviews per star rating, with each bar showing its share of all
 * approved reviews.
 * @param {{summary: import('~/lib/reviews').ReviewSummary}}
 */
export function RatingDistribution({summary}) {
  const total = summary.reviewCount;
  if (!total) return null;
  return (
    <dl className="mt-6 space-y-2" aria-label="Rating distribution">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = summary.distribution[stars] ?? 0;
        const percent = (count / total) * 100;
        return (
          <div key={stars} className="flex items-center gap-3 text-sm">
            <dt className="w-14 shrink-0 text-ink">
              {stars} {stars === 1 ? 'star' : 'stars'}
            </dt>
            <dd className="m-0 flex min-w-0 flex-1 items-center gap-3">
              <span
                aria-hidden="true"
                className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-line"
              >
                <span
                  className="block h-full rounded-full bg-ink"
                  style={{width: `${percent}%`}}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-muted">
                {count}
                <span className="sr-only">
                  {' '}
                  of {total} ({Math.round(percent * 10) / 10}%)
                </span>
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
