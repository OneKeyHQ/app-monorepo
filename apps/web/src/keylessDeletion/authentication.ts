import { createClient } from '@supabase/supabase-js';

import { createAuthFetch } from './authTransport';
import { OAuthCancelledError } from './oauthCancelledError';

import type { IAuthProject } from './authTransport';
import type { IProvider } from './protocol';

const POPUP_TIMEOUT_MS = 180_000;

async function createEphemeralAuth(project: IAuthProject, signal: AbortSignal) {
  const { auth } = createClient(project.origin, project.publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storageKey: `keyless-deletion-${globalThis.crypto.randomUUID()}`,
    },
    global: { fetch: createAuthFetch(project, signal) },
  });
  await auth.getSession();
  await auth.stopAutoRefresh();
  signal.throwIfAborted();
  return auth;
}

function waitForAuthorizationCode(
  popup: Window,
  callback: URL,
  provider: IProvider,
  signal: AbortSignal,
  callbackMarker: string,
) {
  const expectedState = callback.searchParams.get('onekey_oauth_state');
  let cleanup: (() => void) | undefined;
  const authorization = new Promise<string>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    const interval = globalThis.setInterval(() => {
      if (popup.closed) {
        reject(new OAuthCancelledError());
        return;
      }
      let current: URL;
      try {
        current = new URL(popup.location.href);
      } catch {
        return;
      }
      if (
        current.origin === callback.origin &&
        current.pathname === callback.pathname
      ) {
        const code = current.searchParams.get('code');
        if (
          current.searchParams.get('onekey_oauth_state') !== expectedState ||
          current.searchParams.get(callbackMarker) !== '1'
        ) {
          reject(
            new DOMException('OAuth callback was invalid.', 'OperationError'),
          );
          return;
        }
        const error = current.searchParams.get('error');
        if (
          provider === 'apple' &&
          !current.searchParams.has('code') &&
          error === 'user_cancelled_authorize' &&
          !current.searchParams.has('error_code')
        ) {
          reject(new OAuthCancelledError());
          return;
        }
        if (!code || error || current.searchParams.has('error_code')) {
          reject(
            new DOMException('OAuth callback was invalid.', 'OperationError'),
          );
          return;
        }
        resolve(code);
      }
    }, 200);
    const timeout = globalThis.setTimeout(() => {
      reject(new DOMException('OAuth callback timed out.', 'TimeoutError'));
    }, POPUP_TIMEOUT_MS);
    cleanup = () => {
      globalThis.clearInterval(interval);
      globalThis.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      if (!popup.closed) {
        popup.close();
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
    }
  });
  return authorization.finally(() => cleanup?.());
}

export async function exchangeOAuthAccessToken(
  project: IAuthProject,
  provider: IProvider,
  popup: Window,
  signal: AbortSignal,
  callbackMarker: string,
) {
  const auth = await createEphemeralAuth(project, signal);
  const callback = new URL('/oauth_callback_web/', globalThis.location.origin);
  callback.searchParams.set(
    'onekey_oauth_state',
    globalThis.crypto.randomUUID(),
  );
  callback.searchParams.set(callbackMarker, '1');
  const oauth = await auth.signInWithOAuth({
    provider,
    options: {
      skipBrowserRedirect: true,
      redirectTo: callback.toString(),
      queryParams:
        provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
  signal.throwIfAborted();
  if (oauth.error || !oauth.data.url) {
    return undefined;
  }
  const destination = new URL(oauth.data.url);
  if (
    destination.origin !== project.origin ||
    destination.pathname !== '/auth/v1/authorize'
  ) {
    return undefined;
  }
  if (popup.closed) throw new OAuthCancelledError();
  popup.location.href = destination.href;
  const code = await waitForAuthorizationCode(
    popup,
    callback,
    provider,
    signal,
    callbackMarker,
  );
  const result = await auth.exchangeCodeForSession(code);
  signal.throwIfAborted();
  return result.error ? undefined : result.data.session?.access_token;
}
