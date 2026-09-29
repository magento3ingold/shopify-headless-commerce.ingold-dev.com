/**
 * Validation shared by the browser (instant feedback) and the route actions
 * (the source of truth), so both always agree.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;

/**
 * @param {FormData} formData
 * @param {readonly string[]} keys
 * @return {Record<string, string>}
 */
export function getFormValues(formData, keys) {
  return Object.fromEntries(
    keys.map((key) => [key, String(formData.get(key) ?? '').trim()]),
  );
}

/**
 * @param {string} email
 * @return {string | undefined}
 */
function validateEmail(email) {
  if (!email) return 'Enter your email address.';
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email address, like name@example.com.';
  }
  return undefined;
}

export const NEWSLETTER_FIELDS = /** @type {const} */ (['email']);

/** Hidden form field that people never fill in; bots often do. */
export const HONEYPOT_FIELD = 'company_website';
export const NEWSLETTER_HONEYPOT_FIELD = HONEYPOT_FIELD;

/**
 * @param {Record<string, string>} values
 * @return {FieldErrors}
 */
export function validateNewsletter(values) {
  return compact({email: validateEmail(values.email)});
}

export const CONTACT_FIELDS = /** @type {const} */ ([
  'name',
  'email',
  'phone',
  'subject',
  'message',
]);

/**
 * @param {Record<string, string>} values
 * @return {FieldErrors}
 */
export function validateContact(values) {
  return compact({
    name: !values.name
      ? 'Enter your name.'
      : values.name.length > 100
        ? 'Name must be 100 characters or fewer.'
        : undefined,
    email: validateEmail(values.email),
    phone:
      values.phone && !PHONE_PATTERN.test(values.phone)
        ? 'Enter a valid phone number, or leave this field empty.'
        : undefined,
    subject: !values.subject
      ? 'Enter a subject.'
      : values.subject.length > 150
        ? 'Subject must be 150 characters or fewer.'
        : undefined,
    message: !values.message
      ? 'Enter a message.'
      : values.message.length < 10
        ? 'Message must be at least 10 characters.'
        : values.message.length > 5000
          ? 'Message must be 5000 characters or fewer.'
          : undefined,
  });
}

/**
 * @param {Record<string, string | undefined>} errors
 * @return {FieldErrors}
 */
function compact(errors) {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  );
}

/** @typedef {Record<string, string>} FieldErrors */
/**
 * Response shape returned by form actions.
 * - `invalid`: validation failed, see fieldErrors.
 * - `unavailable`: no backend is connected yet (see the action's
 *   INTEGRATION POINT comment); nothing was sent.
 * - `success`: the connected backend accepted the submission.
 * - `error`: the connected backend failed.
 * @typedef {{
 *   status: 'invalid' | 'unavailable' | 'success' | 'error';
 *   message?: string;
 *   fieldErrors?: FieldErrors;
 * }} FormActionResult
 */
