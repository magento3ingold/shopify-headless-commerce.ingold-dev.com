import {useEffect, useRef, useState} from 'react';
import {data, Form, useActionData, useNavigation} from 'react-router';
import {FormField} from '~/components/FormField';
import {
  ContactDetailsList,
  SocialIconLinks,
  useHasSocialLinks,
} from '~/components/ContactDetails';
import {
  CONTACT_FIELDS,
  HONEYPOT_FIELD,
  getFormValues,
  validateContact,
} from '~/lib/forms';
import {getSiteSettings} from '~/lib/site-settings';
import {useContactInformation} from '~/lib/contact-information';
import {isSameOrigin} from '~/lib/request.server';
import {
  ContactFormConfigError,
  sendContactMessage,
} from '~/lib/contact-form.server';

/**
 * Contact page at /pages/contact.
 *
 * This static route takes precedence over the generic
 * `($locale).pages.$handle.jsx` route for the `contact` handle only; every
 * other Shopify Page keeps rendering through the generic route.
 *
 * Contact details and social links come from the global "Contact
 * Information" and "Social Media" metaobjects already loaded by the root
 * loader, so this page makes no Storefront API request of its own.
 * @type {Route.MetaFunction}
 */
export const meta = ({matches}) => {
  const root = matches.find((match) => match?.id === 'root');
  const {siteName} = getSiteSettings((root?.loaderData ?? root?.data)?.header);
  return [
    {title: `Contact Us | ${siteName}`},
    {
      name: 'description',
      content: `Get in touch with ${siteName}. Questions about an order, a product or anything else? Send us a message and we will get back to you.`,
    },
  ];
};

/**
 * Validates the submission on the server and delivers it through the
 * configured integration (~/lib/contact-form.server). Success is only
 * reported after the provider has accepted the message.
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  if (!isSameOrigin(request)) {
    return data(
      {status: 'error', message: 'This request was not allowed.'},
      {status: 403},
    );
  }

  const formData = await request.formData();
  const values = getFormValues(formData, CONTACT_FIELDS);

  if (String(formData.get(HONEYPOT_FIELD) ?? '').trim()) {
    return data(
      {status: 'error', message: 'Your message could not be processed.'},
      {status: 400},
    );
  }

  const fieldErrors = validateContact(values);
  if (Object.keys(fieldErrors).length) {
    // Return the values so a no-JavaScript submission keeps what was typed.
    return data({status: 'invalid', fieldErrors, values}, {status: 400});
  }

  try {
    await sendContactMessage(
      {
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        subject: values.subject,
        message: values.message,
      },
      {env: context.env, pageUrl: request.url},
    );

    return data({
      status: 'success',
      message:
        'Thank you, your message has been sent. We’ll get back to you as soon as possible.',
    });
  } catch (error) {
    if (error instanceof ContactFormConfigError) {
      console.error(`[contact] ${error.message}`);
      return data(
        {
          status: 'unavailable',
          message:
            'Our contact form isn’t available right now, so your message was not sent.',
          values,
        },
        {status: 503},
      );
    }

    // Log without the visitor's personal data.
    console.error(
      '[contact] Delivery failed:',
      error instanceof Error ? error.message : error,
    );
    return data(
      {
        status: 'error',
        message: 'We couldn’t send your message. Please try again in a moment.',
        values,
      },
      {status: 502},
    );
  }
}

export default function ContactPage() {
  /** @type {ContactActionData | undefined} */
  const actionData = useActionData();
  const navigation = useNavigation();
  const contact = useContactInformation();
  const hasSocialLinks = useHasSocialLinks();
  const formRef = useRef(/** @type {HTMLFormElement | null} */ (null));
  const statusRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [clientErrors, setClientErrors] = useState(
    /** @type {FieldErrors | null} */ (null),
  );

  const isSubmitting =
    navigation.state === 'submitting' &&
    navigation.formMethod?.toUpperCase() === 'POST';
  const fieldErrors = clientErrors ?? actionData?.fieldErrors ?? {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const status = isSubmitting ? undefined : actionData?.status;
  const hasContactDetails = Boolean(
    contact.email || contact.phone || contact.address,
  );

  // After a real successful delivery: clear the form and announce it.
  // After a delivery problem: move focus to the message.
  useEffect(() => {
    if (status === 'success') formRef.current?.reset();
    if (
      status === 'success' ||
      status === 'error' ||
      status === 'unavailable'
    ) {
      statusRef.current?.focus();
    }
  }, [status, actionData]);

  /** @param {React.FormEvent<HTMLFormElement>} event */
  function handleSubmit(event) {
    // Prevent duplicate submissions while one is in flight.
    if (isSubmitting) {
      event.preventDefault();
      return;
    }
    const values = getFormValues(
      new FormData(event.currentTarget),
      CONTACT_FIELDS,
    );
    const errors = validateContact(values);
    if (Object.keys(errors).length) {
      event.preventDefault();
      setClientErrors(errors);
      const firstInvalid = CONTACT_FIELDS.find((field) => errors[field]);
      formRef.current?.elements.namedItem(firstInvalid)?.focus();
      return;
    }
    setClientErrors(null);
  }

  /** @param {React.FormEvent<HTMLFormElement>} event */
  function handleChange(event) {
    const {name} = /** @type {HTMLInputElement} */ (event.target);
    if (!clientErrors?.[name]) return;
    const rest = {...clientErrors};
    delete rest[name];
    setClientErrors(rest);
  }

  // Values echoed back by the server when submission failed (no-JS support).
  const previous = status === 'success' ? undefined : actionData?.values;

  return (
    <div className="page-full-bleed ui-scope">
      <section aria-labelledby="contact-heading" className="bg-surface">
        <div className="page-width py-16 md:py-24">
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            Contact Us
          </p>
          <h1
            id="contact-heading"
            className="max-w-3xl font-display text-4xl leading-[1.1] font-medium text-ink md:text-6xl"
          >
            Have a question?
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            We&rsquo;d love to hear from you. Send us a message and our team
            will get back to you as soon as possible.
          </p>
        </div>
      </section>

      <div
        className={`page-width grid gap-12 py-16 md:py-24 lg:gap-20 ${
          hasContactDetails || hasSocialLinks ? 'lg:grid-cols-[1fr_1.6fr]' : ''
        }`}
      >
        {hasContactDetails || hasSocialLinks ? (
          <section aria-labelledby="contact-details-heading">
            <h2
              id="contact-details-heading"
              className="font-display text-2xl font-medium text-ink md:text-3xl"
            >
              Get in touch
            </h2>
            <ContactDetailsList tone="light" showLabels className="mt-8" />
            {hasSocialLinks ? (
              <div className="mt-10 border-t border-line pt-8">
                <h3 className="text-xs font-semibold tracking-[0.15em] text-muted uppercase">
                  Follow us
                </h3>
                <SocialIconLinks tone="light" className="mt-4" />
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          aria-labelledby="contact-form-heading"
          className="rounded-card border border-line bg-white p-6 shadow-card md:p-10"
        >
          <h2
            id="contact-form-heading"
            className="font-display text-2xl font-medium text-ink md:text-3xl"
          >
            Send us a message
          </h2>
          <p className="mt-2 text-sm text-muted">
            Fields marked with{' '}
            <span aria-hidden="true" className="text-sale">
              *
            </span>
            <span className="sr-only">an asterisk</span> are required.
          </p>

          <div
            ref={statusRef}
            tabIndex={-1}
            aria-live="polite"
            className="mt-6 outline-none empty:hidden"
          >
            {hasFieldErrors ? (
              <p className="rounded-lg border border-sale/30 bg-sale/5 px-4 py-3 text-sm text-sale">
                Please correct the highlighted fields and try again.
              </p>
            ) : status === 'success' ? (
              <p
                role="status"
                className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success"
              >
                {actionData.message}
              </p>
            ) : status === 'unavailable' || status === 'error' ? (
              <p
                role="alert"
                className="rounded-lg border border-sale/30 bg-sale/5 px-4 py-3 text-sm text-ink"
              >
                {actionData.message}
                {contact.email ? (
                  <>
                    {' '}
                    You can also email us at{' '}
                    <a
                      href={contact.email.href}
                      className="font-medium underline underline-offset-2"
                    >
                      {contact.email.value}
                    </a>
                    .
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <Form
            ref={formRef}
            method="post"
            noValidate
            onSubmit={handleSubmit}
            onChange={handleChange}
            aria-busy={isSubmitting}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            <FormField
              label="Name"
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              defaultValue={previous?.name}
              error={fieldErrors.name}
            />
            <FormField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              defaultValue={previous?.email}
              error={fieldErrors.email}
            />
            <FormField
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              optional
              defaultValue={previous?.phone}
              error={fieldErrors.phone}
            />
            <FormField
              label="Subject"
              name="subject"
              required
              maxLength={150}
              defaultValue={previous?.subject}
              error={fieldErrors.subject}
            />
            <FormField
              label="Message"
              name="message"
              multiline
              required
              rows={6}
              maxLength={5000}
              defaultValue={previous?.message}
              error={fieldErrors.message}
              className="sm:col-span-2"
            />
            {/* Honeypot: hidden from people and assistive technology. */}
            <input
              type="text"
              name={HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-ink-soft disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                    Sending&hellip;
                  </>
                ) : (
                  'Send Message'
                )}
              </button>
            </div>
          </Form>
        </section>
      </div>
    </div>
  );
}

/**
 * @typedef {{
 *   status: 'invalid' | 'success' | 'unavailable' | 'error';
 *   message?: string;
 *   fieldErrors?: FieldErrors;
 *   values?: Record<string, string>;
 * }} ContactActionData
 */

/** @typedef {import('./+types/pages.contact').Route} Route */
/** @typedef {import('~/lib/forms').FieldErrors} FieldErrors */
