import {useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {
  REVIEWS_API_PATH,
  REVIEW_LIMITS,
  validateReviewInput,
} from '~/lib/reviews';
import {STAR_PATH} from '~/components/reviews/ReviewStars';

/**
 * "Write a Review" in a native modal <dialog>: the browser traps focus and
 * Escape closes it; focus returns via `onClose`. Submits to the server,
 * which validates again and creates a pending review. Success is shown only
 * after Shopify confirmed the entry.
 * @param {{
 *   product: {id: string; handle: string; title: string};
 *   open: boolean;
 *   onClose: () => void;
 * }}
 */
export function ReviewForm({product, open, onClose}) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const formRef = useRef(/** @type {HTMLFormElement | null} */ (null));
  const submit = useFetcher();
  const prefill = useFetcher();
  const [submissionId, setSubmissionId] = useState('');
  // The submission the current fetcher response belongs to.
  const [submittedId, setSubmittedId] = useState('');
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
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
  const shownRating = hovered || rating;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
      // A fresh id per new review: the server uses it as the entry handle, so
      // a repeated submission of the same review is rejected by Shopify.
      if (!submissionId || succeeded) setSubmissionId(crypto.randomUUID());
      if (prefill.state === 'idle' && !prefill.data) {
        prefill.load(`${REVIEWS_API_PATH}?prefill=1`);
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Prefill a signed-in customer's own name and email (empty fields only).
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
    if (submitting) {
      event.preventDefault();
      return;
    }
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
  const close = () => dialogRef.current?.close();

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
        <div className="min-w-0">
          <h2 id={`${ids}-title`} className="text-lg font-semibold text-ink">
            Write a Review
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted">{product.title}</p>
        </div>
        <button
          type="button"
          onClick={close}
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
            onClick={close}
            className="mt-6 rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
          >
            Close
          </button>
        </div>
      ) : (
        <submit.Form
          ref={formRef}
          method="post"
          action={REVIEWS_API_PATH}
          noValidate
          onSubmit={onSubmit}
          className="space-y-5 px-5 py-6 md:px-8"
        >
          {/* Product context; the server checks the id belongs to the handle. */}
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
              Rating <RequiredMark />
            </legend>
            <div
              className="flex flex-wrap items-center gap-1"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  onMouseEnter={() => setHovered(value)}
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
                      value <= shownRating ? 'text-ink' : 'text-line'
                    }`}
                  >
                    <path d={STAR_PATH} />
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
            label="Review Title"
            maxLength={REVIEW_LIMITS.title}
            error={fieldError('title')}
            errorId={errorId('title')}
          />
          <TextField
            id={`${ids}-body`}
            name="body"
            label="Review Text"
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
              onClick={close}
              className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !submissionId}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-8 py-3 text-sm font-semibold text-white hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
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

function RequiredMark() {
  return (
    <>
      <span className="text-sale" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
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
        {label} <RequiredMark />
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
