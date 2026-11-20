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
export const ONEKEY_REQUEST_TOKEN_HEADER = 'X-Onekey-Request-Token';

type IRequestAuthHeaders = {
  get?: (headerName: string) => unknown;
} & Record<string, unknown>;

export function readRequestAuthTokenHeader(headers: unknown): string {
  const h = headers as IRequestAuthHeaders | undefined;
  const value =
    h?.get?.(ONEKEY_REQUEST_TOKEN_HEADER) ||
    h?.[ONEKEY_REQUEST_TOKEN_HEADER] ||
    h?.[ONEKEY_REQUEST_TOKEN_HEADER.toLowerCase()];
  return value ? String(value) : '';
}

export type IRequestAuthContextOfError = {
  requestAuthToken: string;
  // Error conversions may record only the service origin; this keeps the
  // original request path.
  requestUrl?: string;
};

const requestAuthContextByError = new WeakMap<
  object,
  IRequestAuthContextOfError
>();

export function stashRequestAuthTokenOfError({
  error,
  requestAuthToken,
  requestUrl,
}: {
  error: object;
  requestAuthToken: string;
  requestUrl?: string;
}): void {
  requestAuthContextByError.set(error, { requestAuthToken, requestUrl });
}

/**
 * Read-and-delete: returns the stashed context (an empty token when absent)
 * and removes the entry so no later reader — or long-lived reference to the
 * error — can recover the token.
 */
export function takeRequestAuthContextOfError(
  error: unknown,
): IRequestAuthContextOfError {
  if (typeof error !== 'object' || error === null) {
    return { requestAuthToken: '' };
  }
  const context = requestAuthContextByError.get(error);
  requestAuthContextByError.delete(error);
  return context ?? { requestAuthToken: '' };
}
