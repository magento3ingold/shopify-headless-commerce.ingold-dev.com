/**
 * Newsletter sign-up backed by Shopify customer email marketing consent.
 *
 * The email is stored as a Shopify customer whose email marketing consent is
 * SUBSCRIBED (single opt-in), which is how Shopify Email and marketing apps
 * know who may receive campaigns. Customers appear in Admin > Customers and
 * can be segmented by "Email subscription status".
 *
 * - Existing customer: consent is updated to SUBSCRIBED.
 * - New email: a customer is created with consent SUBSCRIBED.
 *
 * Server-only (`.server.js`): uses the Admin API (see ~/lib/admin-api.server).
 */
import {
  AdminApiConfigError,
  AdminApiError,
  adminGraphql,
  getAdminApiConfig,
} from './admin-api.server.js';
import {
  NEWSLETTER_CONSENT_UPDATE_MUTATION,
  NEWSLETTER_CUSTOMER_BY_EMAIL_QUERY,
  NEWSLETTER_CUSTOMER_CREATE_MUTATION,
} from '../graphql/admin/NewsletterSubscription.js';

/**
 * @param {string} rawEmail an address that already passed validation
 * @param {{
 *   env: Record<string, string | undefined>;
 *   fetch?: typeof fetch;
 * }} options
 * @return {Promise<{status: 'subscribed' | 'already_subscribed'}>}
 * @throws {AdminApiConfigError} when Admin API access is not configured
 * @throws {AdminApiError} when Shopify rejects the request
 */
export async function subscribeToNewsletter(rawEmail, {env, fetch}) {
  const config = getAdminApiConfig(env);
  if (!config) {
    throw new AdminApiConfigError(
      'Newsletter sign-up needs Admin API access: set PRIVATE_ADMIN_API_CLIENT_ID and PRIVATE_ADMIN_API_CLIENT_SECRET (or PRIVATE_ADMIN_API_ACCESS_TOKEN).',
    );
  }

  const email = rawEmail.trim().toLowerCase();
  const run = (query, variables) =>
    adminGraphql(config, query, variables, {fetch});

  const existing = await findCustomer(run, email);
  if (existing) {
    if (existing.emailMarketingConsent?.marketingState === 'SUBSCRIBED') {
      return {status: 'already_subscribed'};
    }
    await subscribeExistingCustomer(run, existing.id);
    return {status: 'subscribed'};
  }

  const data = await run(NEWSLETTER_CUSTOMER_CREATE_MUTATION, {
    input: {email, emailMarketingConsent: newConsent()},
  });
  const {customer, userErrors} = data.customerCreate;

  if (customer && !userErrors.length) return {status: 'subscribed'};

  // Another request may have created the customer in the meantime.
  if (userErrors.some((error) => error.field?.includes('email'))) {
    const created = await findCustomer(run, email);
    if (created) {
      await subscribeExistingCustomer(run, created.id);
      return {status: 'subscribed'};
    }
  }

  throw new AdminApiError(
    `customerCreate failed: ${userErrors.map((error) => error.message).join('; ')}`,
  );
}

/**
 * @param {(query: string, variables: object) => Promise<any>} run
 * @param {string} email
 */
async function findCustomer(run, email) {
  // Quote the value so the search matches the exact address.
  const escaped = email.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const data = await run(NEWSLETTER_CUSTOMER_BY_EMAIL_QUERY, {
    query: `email:"${escaped}"`,
  });
  return data.customers.nodes[0] ?? null;
}

/**
 * @param {(query: string, variables: object) => Promise<any>} run
 * @param {string} customerId
 */
async function subscribeExistingCustomer(run, customerId) {
  const data = await run(NEWSLETTER_CONSENT_UPDATE_MUTATION, {
    input: {customerId, emailMarketingConsent: newConsent()},
  });
  const {userErrors} = data.customerEmailMarketingConsentUpdate;
  if (userErrors.length) {
    throw new AdminApiError(
      `customerEmailMarketingConsentUpdate failed: ${userErrors
        .map((error) => error.message)
        .join('; ')}`,
    );
  }
}

function newConsent() {
  return {
    marketingState: 'SUBSCRIBED',
    marketingOptInLevel: 'SINGLE_OPT_IN',
    consentUpdatedAt: new Date().toISOString(),
  };
}

export {AdminApiConfigError, AdminApiError};
