/**
 * Server-only delivery of Contact page messages by email through Resend
 * (https://resend.com). Shopify has no API that sends contact-form messages,
 * and submissions are not stored in Shopify.
 *
 * Configure with private environment variables (Oxygen secrets in
 * production, .env locally):
 *   PRIVATE_RESEND_API_KEY    Resend API key ("re_...")
 *   CONTACT_FORM_TO_EMAIL     inbox that receives messages
 *   CONTACT_FORM_FROM_EMAIL   sender on a domain verified in Resend,
 *                             e.g. "Store <contact@yourdomain.com>"
 *
 * The message only counts as sent when Resend accepts it (HTTP 2xx).
 * `.server.js` keeps this module, and the API key, out of browser code.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export class ContactFormConfigError extends Error {
  name = 'ContactFormConfigError';
}

export class ContactFormDeliveryError extends Error {
  name = 'ContactFormDeliveryError';
}

/**
 * @param {Record<string, string | undefined>} env
 * @return {ResendConfig | null} null when Resend is not fully configured
 */
export function getResendConfig(env) {
  const apiKey = env.PRIVATE_RESEND_API_KEY?.trim();
  const to = env.CONTACT_FORM_TO_EMAIL?.trim();
  const from = env.CONTACT_FORM_FROM_EMAIL?.trim();
  return apiKey && to && from ? {apiKey, to, from} : null;
}

/**
 * Emails a validated contact message. Resolves with the Resend email id once
 * Resend has accepted it; throws otherwise.
 * @param {ContactMessage} message
 * @param {{
 *   env: Record<string, string | undefined>;
 *   pageUrl?: string;
 *   fetch?: typeof fetch;
 * }} options
 * @return {Promise<{id?: string}>}
 */
export async function sendContactMessage(message, options) {
  const config = getResendConfig(options.env);
  if (!config) {
    throw new ContactFormConfigError(
      `Contact form email is not configured. Missing: ${missingVariables(options.env).join(', ')}.`,
    );
  }

  const submittedAt = new Date().toISOString();
  const fetchImpl = options.fetch ?? fetch;

  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      // Replying to the email goes straight to the customer.
      reply_to: message.email,
      subject: singleLine(`Contact form: ${message.subject}`),
      text: formatPlainText(message, {submittedAt, pageUrl: options.pageUrl}),
      html: formatHtml(message, {submittedAt, pageUrl: options.pageUrl}),
    }),
  });

  if (!response.ok) {
    // Resend explains the problem in the body (e.g. unverified domain).
    const detail = await response
      .json()
      .then((body) => body?.message ?? body?.name)
      .catch(() => undefined);
    throw new ContactFormDeliveryError(
      `Resend rejected the message with HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }

  const body = await response.json().catch(() => ({}));
  return {id: body?.id};
}

/** @param {Record<string, string | undefined>} env */
function missingVariables(env) {
  return [
    'PRIVATE_RESEND_API_KEY',
    'CONTACT_FORM_TO_EMAIL',
    'CONTACT_FORM_FROM_EMAIL',
  ].filter((name) => !env[name]?.trim());
}

/**
 * @param {ContactMessage} message
 * @param {{submittedAt: string; pageUrl?: string}} meta
 * @return {Array<[label: string, value: string]>}
 */
function emailRows(message, {submittedAt, pageUrl}) {
  return [
    ['Customer Name', message.name],
    ['Customer Email', message.email],
    ['Phone', message.phone || '-'],
    ['Subject', singleLine(message.subject)],
    ['Page URL', pageUrl || '-'],
    ['Submitted', submittedAt],
  ];
}

/**
 * @param {ContactMessage} message
 * @param {{submittedAt: string; pageUrl?: string}} meta
 */
function formatPlainText(message, meta) {
  const rows = emailRows(message, meta);
  return [
    ...rows.slice(0, 4).map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    message.message,
    '',
    '---',
    ...rows.slice(4).map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
}

/**
 * Simple HTML version; every submitted value is escaped.
 * @param {ContactMessage} message
 * @param {{submittedAt: string; pageUrl?: string}} meta
 */
function formatHtml(message, meta) {
  const rows = emailRows(message, meta)
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:4px 16px 4px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return [
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#16150f">',
    '<h2 style="margin:0 0 12px">New contact form message</h2>',
    `<table cellpadding="0" cellspacing="0">${rows}</table>`,
    '<h3 style="margin:20px 0 8px">Message</h3>',
    `<p style="white-space:pre-wrap;margin:0">${escapeHtml(message.message)}</p>`,
    '</div>',
  ].join('');
}

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Removes line breaks so user input cannot add extra header lines. */
function singleLine(value) {
  return value
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * @typedef {{
 *   name: string;
 *   email: string;
 *   phone?: string;
 *   subject: string;
 *   message: string;
 * }} ContactMessage
 */
/** @typedef {{apiKey: string; to: string; from: string}} ResendConfig */
