import {data} from 'react-router';
import {
  NEWSLETTER_FIELDS,
  NEWSLETTER_HONEYPOT_FIELD,
  getFormValues,
  validateNewsletter,
} from '~/lib/forms';
import {
  AdminApiConfigError,
  subscribeToNewsletter,
} from '~/lib/newsletter.server';
import {isSameOrigin} from '~/lib/request.server';

/**
 * Resource route that receives newsletter sign-ups from <Newsletter />.
 * It has no UI; GET requests are not supported.
 */
export async function loader() {
  throw new Response('Not found', {status: 404});
}

/**
 * Subscribes the email to Shopify email marketing (see
 * ~/lib/newsletter.server). Runs only on the server; Admin API credentials
 * never reach the browser.
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return data(
      {status: 'error', message: 'Method not allowed.'},
      {status: 405},
    );
  }

  // Only accept submissions from this storefront's own pages.
  if (!isSameOrigin(request)) {
    return data(
      {status: 'error', message: 'This request was not allowed.'},
      {status: 403},
    );
  }

  const formData = await request.formData();

  if (String(formData.get(NEWSLETTER_HONEYPOT_FIELD) ?? '').trim()) {
    return data(
      {status: 'error', message: 'Your sign-up could not be processed.'},
      {status: 400},
    );
  }

  const values = getFormValues(formData, NEWSLETTER_FIELDS);
  const fieldErrors = validateNewsletter(values);
  if (Object.keys(fieldErrors).length) {
    return data({status: 'invalid', fieldErrors}, {status: 400});
  }

  try {
    const result = await subscribeToNewsletter(values.email, {
      env: context.env,
    });

    return data({
      status: 'success',
      message:
        result.status === 'already_subscribed'
          ? 'You’re already subscribed. Thanks for staying in touch!'
          : 'Thanks for subscribing! You’ll be the first to hear our news.',
    });
  } catch (error) {
    if (error instanceof AdminApiConfigError) {
      // Configuration problem: log it for the developer, stay generic for
      // the shopper, and never claim the address was saved.
      console.error(`[newsletter] ${error.message}`);
      return data(
        {
          status: 'unavailable',
          message:
            'Newsletter sign-up isn’t available right now. Please try again later.',
        },
        {status: 503},
      );
    }

    // Log without the customer's email address.
    console.error(
      '[newsletter] Subscription failed:',
      error instanceof Error ? error.message : error,
    );
    return data(
      {
        status: 'error',
        message:
          'We couldn’t complete your subscription. Please try again in a moment.',
      },
      {status: 502},
    );
  }
}

/** @typedef {import('./+types/newsletter').Route} Route */
/** @typedef {import('~/lib/forms').FormActionResult} FormActionResult */
