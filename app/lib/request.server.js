/**
 * Server-only request helpers shared by form actions.
 */

/**
 * True when a POST comes from this storefront's own pages. Browsers send
 * `Origin` on cross-site POSTs; requests without it are allowed. Behind a
 * proxy or dev tunnel the public host may differ from request.url, so the
 * Host / X-Forwarded-Host headers are accepted too.
 * @param {Request} request
 */
export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const hosts = [
    new URL(request.url).host,
    request.headers.get('Host'),
    request.headers.get('X-Forwarded-Host'),
  ].filter(Boolean);
  return hosts.includes(originHost);
}
