/**
 * `PRIVATE_SERVER_URL` must address the API container directly (`http://api:3081`).
 *
 * Pointing it at the dashboard's own public origin makes this process call itself:
 * every SSR render re-enters the layout load, and every `/proxy/*` and `/api/auth/*`
 * request loops back into the proxy. Nothing errors — requests simply hang until a
 * timeout, so the app reads as "slow" rather than misconfigured. This check turns that
 * silent failure into one obvious line in `docker logs` at boot.
 *
 * Reads `process.env` like `proxy-api-request.ts`, which consumes the same variable.
 */
function readOrigin(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);

    // `new URL('api:3081')` parses — 'api:' becomes the scheme — so a missing
    // http:// would otherwise slip through with an origin of "null".
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;

    return parsed.origin;
  } catch {
    return null;
  }
}

/** Returns the message that was logged, or null when the configuration is sound. */
export function getPrivateServerUrlMisconfiguration(): string | null {
  const privateServerUrl = process.env.PRIVATE_SERVER_URL;

  if (!privateServerUrl) {
    return (
      'PRIVATE_SERVER_URL is not set, so dashboard SSR and /proxy/* have no API to call. ' +
      'Set PRIVATE_SERVER_URL=http://api:3081'
    );
  }

  const privateOrigin = readOrigin(privateServerUrl);
  if (!privateOrigin) {
    return `PRIVATE_SERVER_URL is not a valid URL: ${privateServerUrl}`;
  }

  // The dashboard's own public origin, under either name the stack may set.
  const ownOrigins = [readOrigin(process.env.ORIGIN), readOrigin(process.env.DASHBOARD_ORIGIN)].filter(
    (origin): origin is string => origin !== null
  );

  if (!ownOrigins.includes(privateOrigin)) {
    return null;
  }

  return (
    `PRIVATE_SERVER_URL points at the dashboard itself (${privateOrigin}). ` +
    'Every SSR render and proxied request will loop back into this process and hang until it times out. ' +
    'It must address the API container instead, e.g. PRIVATE_SERVER_URL=http://api:3081 ' +
    '(PUBLIC_SERVER_URL is the one that stays on the public origin).'
  );
}

export function checkPrivateServerUrlIsInternal(): void {
  const misconfiguration = getPrivateServerUrlMisconfiguration();

  if (!misconfiguration) return;

  console.error(`[config] ${misconfiguration}`);
}
