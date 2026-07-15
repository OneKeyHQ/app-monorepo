import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import {
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { isRetryableSupabaseAuthError } from '@onekeyhq/shared/src/utils/supabaseAuthErrorUtils';
import {
  getKeylessSupabaseClient,
  getSupabaseClient,
} from '@onekeyhq/shared/src/utils/supabaseClientUtils';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Prime / OneKey ID auth session access (bg runtime).
 *
 * This module owns the LIVE Supabase SDK session operations for the
 * Prime/OneKey ID login: reading the access token via `auth.getSession()`
 * (which may trigger a NETWORK token refresh) and clearing sessions via
 * `auth.signOut()` plus the shared native session storage keys. It also owns
 * the per-source (legacy email vs Keyless OAuth) client/storage-key
 * branching. `SimpleDbEntityPrime` keeps only persisted markers
 * (authSessionSource, throttle timestamps) and delegates here.
 *
 * SINGLE error policy for token reads:
 * - a retryable auth error (`isRetryableSupabaseAuthError`: fetch-level
 *   failure, 5xx / 408 / 429) is THROWN — the session may still be valid, so
 *   callers must NOT treat it as "logged out";
 * - any other auth error means "no session" and yields an empty token.
 *
 * Callers that must degrade gracefully on retryable errors should use
 * `readAuthTokenAllowingRetryableAuthError` instead of hand-rolling
 * try/catch; opportunistic callers where the token is optional should use
 * `readAuthTokenOrNull`.
 *
 * Runtime note: the Supabase clients here are bg-runtime JS instances. The
 * underlying native session storage is shared with the main runtime, but
 * main-runtime clients keep their own in-memory session and must be signed
 * out separately by UI call sites.
 */

function getSupabaseClientBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): SupabaseClient {
  return authSessionSource === EPrimeAuthSessionSource.KeylessOAuth
    ? getKeylessSupabaseClient().client
    : getSupabaseClient().client;
}

function getSupabaseAuthSessionKeyBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): string {
  return authSessionSource === EPrimeAuthSessionSource.KeylessOAuth
    ? getKeylessSupabaseAuthSessionKey()
    : getSupabaseAuthSessionKey();
}

async function getSupabaseSdkAuthToken(
  client: SupabaseClient,
): Promise<string> {
  const session = await client.auth.getSession();
  if (session.error) {
    if (isRetryableSupabaseAuthError(session.error)) {
      throw session.error;
    }
    return '';
  }
  return session.data.session?.access_token || '';
}

/**
 * Read the access token of the given session source. May hit the network
 * (SDK token refresh). Throws retryable auth errors; returns '' when there
 * is no session (see the module error policy above).
 */
export async function getAuthTokenBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<string> {
  return getSupabaseSdkAuthToken(
    getSupabaseClientBySessionSource(authSessionSource),
  );
}

export interface IPrimeAuthTokenReadResult {
  token: string;
  // Always truthy when set: isRetryableSupabaseAuthError only matches
  // non-null error objects.
  retryableError?: unknown;
}

/**
 * Run a token read applying the module error policy for callers that must
 * degrade gracefully: a retryable auth error is caught and returned as
 * `{ token: '', retryableError }` so the caller can keep its local state;
 * any other error is rethrown.
 */
export async function readAuthTokenAllowingRetryableAuthError(
  read: () => Promise<string>,
): Promise<IPrimeAuthTokenReadResult> {
  try {
    return { token: await read() };
  } catch (error) {
    if (isRetryableSupabaseAuthError(error)) {
      return { token: '', retryableError: error };
    }
    throw error;
  }
}

/**
 * Opportunistic token read: ANY failure — including retryable refresh
 * errors — degrades to null instead of failing the caller. Use only where
 * the token is optional (e.g. per-request opportunistic auth headers).
 */
export async function readAuthTokenOrNull(
  read: () => Promise<string>,
): Promise<string | null> {
  try {
    return (await read()) || null;
  } catch {
    return null;
  }
}

/**
 * Clear the shared Supabase session storage read cache (bg runtime copy).
 */
export function clearSupabaseStorageCache() {
  supabaseStorageInstance.clearCache();
}

/**
 * Sign out the given session source locally and remove its persisted
 * session storage key.
 */
export async function clearAuthSessionBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<void> {
  const client = getSupabaseClientBySessionSource(authSessionSource);
  const sessionKey =
    getSupabaseAuthSessionKeyBySessionSource(authSessionSource);
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // Local storage is cleared below even if the SDK session is already invalid.
  }
  await supabaseStorageInstance.removeItem(sessionKey);
  supabaseStorageInstance.clearCache();
}

/**
 * Destroy every local Supabase auth session: sign out both sources, sweep
 * all known session storage keys (including PKCE helper keys), and clear
 * the whole session storage as a fallback.
 */
export async function clearAllSupabaseAuthSessions(): Promise<void> {
  await clearAuthSessionBySessionSource(
    EPrimeAuthSessionSource.LegacyEmailSupabase,
  );
  await clearAuthSessionBySessionSource(EPrimeAuthSessionSource.KeylessOAuth);
  try {
    const sessionKeys = [
      getSupabaseAuthSessionKey(),
      getKeylessSupabaseAuthSessionKey(),
    ];
    await Promise.all(
      sessionKeys.flatMap((sessionKey) => [
        supabaseStorageInstance.removeItem(sessionKey),
        supabaseStorageInstance.removeItem(`${sessionKey}-user`),
        supabaseStorageInstance.removeItem(`${sessionKey}-code-verifier`),
      ]),
    );
  } catch {
    // The fallback clear below handles cached keys seen by this runtime.
  }
  try {
    await supabaseStorageInstance.clear();
  } catch {
    // Cache clearing below keeps the runtime from reusing a stale token.
  }
  supabaseStorageInstance.clearCache();
}
