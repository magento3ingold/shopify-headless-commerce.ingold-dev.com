import {useId} from 'react';
import {REVIEW_SORTS} from '~/lib/reviews';

/**
 * "Sort by" for approved reviews (sorted on the server across all of them).
 * @param {{value: string; onChange: (sort: string) => void; disabled?: boolean}}
 */
export function ReviewSort({value, onChange, disabled = false}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        Sort by
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="m-0 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-ink"
      >
        {REVIEW_SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
