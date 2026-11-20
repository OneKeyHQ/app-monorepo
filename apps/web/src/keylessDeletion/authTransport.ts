export interface IAuthProject {
  origin: string;
  publicKey: string;
}

export function createAuthFetch(
  { origin }: IAuthProject,
  signal: AbortSignal,
  send: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input, init) => {
    signal.throwIfAborted();
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (
      request.method !== 'POST' ||
      url.origin !== origin ||
      url.pathname !== '/auth/v1/token' ||
      url.search !== '?grant_type=pkce'
    ) {
      throw new DOMException(
        'Invalid deletion OAuth request.',
        'SecurityError',
      );
    }
    return send(request, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
  };
}
