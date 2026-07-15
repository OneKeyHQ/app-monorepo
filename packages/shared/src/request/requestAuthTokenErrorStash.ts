/**
 * Module-private side-channel passing the failed request's auth token
 * (X-Onekey-Request-Token) from the global axios response interceptor to the
 * ServiceBase prime invalid-token handler WITHOUT writing it onto the Error
 * object. Errors escape into arbitrary catch blocks, `console.error(e)`
 * logging, and error-collection contexts, none of which may capture a
 * still-usable bearer token as an enumerable own property.
 *
 * A WeakMap keyed by the error object keeps the token invisible to
 * JSON/spread/console serialization, releases it together with the error,
 * and the taker deletes the entry eagerly so the token lives no longer than
 * the single read that needs it.
 *
 * Runtime note: stash and take must run in the SAME JS runtime (they do —
 * both the global axios interceptor and the ServiceBase response
 * interceptor run in the runtime that constructed the client, i.e. bg).
 * The token intentionally cannot cross the bg/main bridge.
 */
const requestAuthTokenByError = new WeakMap<object, string>();

export function stashRequestAuthTokenOfError({
  error,
  requestAuthToken,
}: {
  error: object;
  requestAuthToken: string;
}): void {
  requestAuthTokenByError.set(error, requestAuthToken);
}

/**
 * Read-and-delete: returns the stashed token ('' when absent) and removes
 * the entry so no later reader — or long-lived reference to the error —
 * can recover it.
 */
export function takeRequestAuthTokenOfError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const requestAuthToken = requestAuthTokenByError.get(error) ?? '';
  requestAuthTokenByError.delete(error);
  return requestAuthToken;
}
