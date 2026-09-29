import {useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {useLocalePath} from '~/lib/i18n';
import {
  NEWSLETTER_FIELDS,
  NEWSLETTER_HONEYPOT_FIELD,
  getFormValues,
  validateNewsletter,
} from '~/lib/forms';

/** Approximate section height, used to size the cover background image. */
const SECTION_HEIGHT_PX = 420;

const THEMES = {
  // Copy over the Shopify background image.
  image: {
    text: 'text-white',
    muted: 'text-white/80',
    faint: 'text-white/60',
    error: 'text-[#ffb4ab]',
    input:
      'border-white/30 bg-white/10 text-white placeholder:text-white/60 focus:border-white focus-visible:outline-white',
    inputError: 'border-[#ffb4ab]',
    button: 'bg-white text-ink hover:bg-surface',
  },
  // Clean neutral background when no image is configured.
  neutral: {
    text: 'text-ink',
    muted: 'text-muted',
    faint: 'text-muted',
    error: 'text-sale',
    input:
      'border-line bg-white text-ink placeholder:text-muted/70 focus:border-ink',
    inputError: 'border-sale',
    button: 'bg-ink text-white hover:bg-ink-soft',
  },
};

/**
 * Homepage newsletter sign-up. Copy and background come from the
 * "Homepage Newsletter" metaobject (~/lib/homepage-newsletter); the form
 * posts to the `/newsletter` action, which subscribes the email to Shopify
 * email marketing on the server (~/lib/newsletter.server).
 * The UI only reports success when that action confirms it.
 * @param {{content: HomepageNewsletter}}
 */
export function Newsletter({content}) {
  /** @type {import('react-router').FetcherWithComponents<FormActionResult>} */
  const fetcher = useFetcher({key: 'newsletter'});
  const localePath = useLocalePath();
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const successRef = useRef(/** @type {HTMLParagraphElement | null} */ (null));
  const [clientError, setClientError] = useState(
    /** @type {string | undefined} */ (undefined),
  );
  const headingId = useId();
  const inputId = useId();
  const messageId = useId();

  const {heading, description, buttonLabel, backgroundImage} = content;
  const theme = backgroundImage ? THEMES.image : THEMES.neutral;
  // Fallback only when the Shopify "button" field is left empty.
  const submitLabel = buttonLabel || 'Subscribe';

  const isSubmitting = fetcher.state !== 'idle';
  const result = isSubmitting ? undefined : fetcher.data;
  const isSuccess = result?.status === 'success';
  const error =
    clientError ??
    result?.fieldErrors?.email ??
    (result?.status === 'error' || result?.status === 'unavailable'
      ? result.message
      : undefined);

  // Announce and focus the confirmation once Shopify has saved the email.
  useEffect(() => {
    if (isSuccess) successRef.current?.focus();
  }, [isSuccess]);

  /** @param {React.FormEvent<HTMLFormElement>} event */
  function handleSubmit(event) {
    // Prevent duplicate submissions while a request is in flight.
    if (isSubmitting) {
      event.preventDefault();
      return;
    }
    const values = getFormValues(
      new FormData(event.currentTarget),
      NEWSLETTER_FIELDS,
    );
    const errors = validateNewsletter(values);
    if (errors.email) {
      event.preventDefault();
      setClientError(errors.email);
      inputRef.current?.focus();
      return;
    }
    setClientError(undefined);
  }

  return (
    <section
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : 'Newsletter'}
      className={`relative isolate overflow-hidden ${
        backgroundImage ? 'bg-ink' : 'border-t border-line bg-surface'
      }`}
    >
      {backgroundImage ? (
        <>
          <Image
            data={backgroundImage}
            alt=""
            loading="lazy"
            sizes={getCoverSizes(backgroundImage)}
            className="absolute inset-0 -z-20 size-full rounded-none object-cover"
            style={
              backgroundImage.objectPosition
                ? {objectPosition: backgroundImage.objectPosition}
                : undefined
            }
          />
          {/* Overlay keeps text and the form readable on any photograph. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-black/55"
          />
        </>
      ) : null}

      <div className="page-width grid items-center gap-8 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-lg">
          {heading ? (
            <h2
              id={headingId}
              className={`font-display text-3xl leading-tight font-medium md:text-4xl ${theme.text}`}
            >
              {heading}
            </h2>
          ) : null}
          {description ? (
            <p
              className={`text-base leading-relaxed whitespace-pre-line ${theme.muted} ${
                heading ? 'mt-3' : ''
              }`}
            >
              {description}
            </p>
          ) : null}
        </div>

        <div>
          {isSuccess ? (
            <p
              ref={successRef}
              tabIndex={-1}
              role="status"
              className={`rounded-card border px-5 py-4 text-base font-medium outline-none ${
                backgroundImage
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-success/30 bg-white text-success'
              }`}
            >
              {result.message}
            </p>
          ) : (
            <>
              <fetcher.Form
                method="post"
                action={localePath('/newsletter')}
                noValidate
                onSubmit={handleSubmit}
                aria-busy={isSubmitting}
                className="flex w-full max-w-none flex-col gap-3 sm:flex-row"
              >
                <label htmlFor={inputId} className="sr-only">
                  Email address
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  placeholder="Email address"
                  readOnly={isSubmitting}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={messageId}
                  onChange={() => clientError && setClientError(undefined)}
                  className={`m-0 block w-full min-w-0 flex-1 rounded-full border px-5 py-3 text-base transition-colors duration-200 ${theme.input} ${
                    error ? theme.inputError : ''
                  }`}
                />
                {/* Honeypot: hidden from people and assistive technology. */}
                <input
                  type="text"
                  name={NEWSLETTER_HONEYPOT_FIELD}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-colors duration-200 disabled:cursor-wait disabled:opacity-70 ${theme.button}`}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      />
                      <span>Subscribing&hellip;</span>
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              </fetcher.Form>
              <div
                id={messageId}
                aria-live="polite"
                className="mt-3 min-h-5 text-sm"
              >
                {error ? (
                  <p className={theme.error}>{error}</p>
                ) : (
                  <p className={theme.faint}>
                    By subscribing you agree to receive marketing emails. You
                    can unsubscribe at any time.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The background covers a full-width band of roughly fixed height, so on
 * narrow screens the image renders wider than the viewport.
 * @param {{width?: number; height?: number}} image
 */
function getCoverSizes({width, height}) {
  if (!width || !height) return '100vw';
  return `max(100vw, ${Math.ceil(SECTION_HEIGHT_PX * (width / height))}px)`;
}

/** @typedef {import('~/lib/homepage-newsletter').HomepageNewsletter} HomepageNewsletter */
/** @typedef {import('~/lib/forms').FormActionResult} FormActionResult */
