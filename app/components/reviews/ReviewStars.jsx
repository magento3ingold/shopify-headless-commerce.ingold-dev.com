/** Star outline on a 24×24 grid. */
export const STAR_PATH =
  'M12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21 12 17.27 5.82 21l1.64-7.03L2 9.24l7.19-.61z';

/**
 * Five stars filled to `rating` (0–5, fractions allowed): a muted row with a
 * solid row on top, clipped to the rating. Decorative only (aria-hidden);
 * pair it with accessible text such as describeRating().
 * @param {{rating: number; className?: string}} props `className` sets the
 *   height, e.g. "h-4".
 */
export function ReviewStars({rating, className = 'h-4'}) {
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
        <path
          key={star}
          transform={`translate(${star * 24} 0)`}
          d={STAR_PATH}
        />
      ))}
    </svg>
  );
}
