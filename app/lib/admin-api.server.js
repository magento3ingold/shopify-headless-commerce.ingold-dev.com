/**
 * Minimal, server-only Shopify Admin GraphQL API client.
 *
 * The `.server.js` suffix makes the build fail if this module is ever
 * imported into browser code, so Admin credentials cannot leak to clients.
 *
 * Credentials are read from private environment variables (Oxygen
 * "secret" variables in production, .env locally), in this order:
 *
 * 1. PRIVATE_ADMIN_API_CLIENT_ID + PRIVATE_ADMIN_API_CLIENT_SECRET
 *    For an app created in the Shopify Dev Dashboard (or Shopify CLI) that
 *    belongs to the same organization as the store. A 24-hour access token
 *    is obtained with the OAuth client credentials grant and cached.
 * 2. PRIVATE_ADMIN_API_ACCESS_TOKEN
 *    For an existing admin-created custom app ("shpat_..." token).
 *
 * The store is PUBLIC_STORE_DOMAIN (the *.myshopify.com domain).
 */

export const ADMIN_API_VERSION = '2026-04';

/** Refresh cached tokens this long before they expire. */
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

/** @type {Map<string, {token: string; expiresAt: number}>} */
const tokenCache = new Map();

export class AdminApiConfigError extends Error {
  name = 'AdminApiConfigError';
}

export class AdminApiError extends Error {
  name = 'AdminApiError';
}

/**
 * @param {Record<string, string | undefined>} env
 * @return {AdminApiConfig | null} null when Admin API access is not configured
 */
export function getAdminApiConfig(env) {
  const shop = env.PUBLIC_STORE_DOMAIN?.trim();
  if (!shop) return null;

  const clientId = env.PRIVATE_ADMIN_API_CLIENT_ID?.trim();
  const clientSecret = env.PRIVATE_ADMIN_API_CLIENT_SECRET?.trim();
  if (clientId && clientSecret) return {shop, clientId, clientSecret};

  const accessToken = env.PRIVATE_ADMIN_API_ACCESS_TOKEN?.trim();
  if (accessToken) return {shop, accessToken};

  return null;
}

/**
 * Runs an Admin GraphQL operation and returns its `data`.
 * Throws AdminApiError on HTTP or top-level GraphQL errors. Mutation
 * `userErrors` are part of `data` and must be checked by the caller.
 * @param {AdminApiConfig} config
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 * @param {{fetch?: typeof fetch}} [options]
 */
export async function adminGraphql(
  config,
  query,
  variables = {},
  options = {},
) {
  const fetchImpl = options.fetch ?? fetch;
  const endpoint = `https://${config.shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  const send = async () =>
    fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Shopify-Access-Token': await getAccessToken(config, fetchImpl),
      },
      body: JSON.stringify({query, variables}),
    });

  let response = await send();

  // A cached client-credentials token may have been revoked; retry once.
  if (response.status === 401 && 'clientId' in config) {
    tokenCache.delete(cacheKey(config));
    response = await send();
  }

  if (!response.ok) {
    throw new AdminApiError(
      `Admin API request failed with HTTP ${response.status}`,
    );
  }

  const body = await response.json();
  if (body.errors?.length) {
    throw new AdminApiError(
      `Admin API error: ${body.errors.map((error) => error.message).join('; ')}`,
    );
  }

  return body.data;
}

/**
 * @param {AdminApiConfig} config
 * @param {typeof fetch} fetchImpl
 */
async function getAccessToken(config, fetchImpl) {
  if ('accessToken' in config) return config.accessToken;

  const key = cacheKey(config);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return cached.token;
  }

  const response = await fetchImpl(
    `https://${config.shop}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    },
  );

  if (!response.ok) {
    throw new AdminApiError(
      `Admin API token request failed with HTTP ${response.status}`,
    );
  }

  const {access_token: token, expires_in: expiresIn} = await response.json();
  if (!token) {
    throw new AdminApiError('Admin API token response had no access_token');
  }

  tokenCache.set(key, {
    token,
    expiresAt: Date.now() + (Number(expiresIn) || 0) * 1000,
  });
  return token;
}

/** @param {{shop: string; clientId: string}} config */
function cacheKey(config) {
  return `${config.shop}:${config.clientId}`;
}

/**
 * @typedef {(
 *   | {shop: string; clientId: string; clientSecret: string}
 *   | {shop: string; accessToken: string}
 * )} AdminApiConfig
 */
