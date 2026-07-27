import { Semaphore } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
 * underlying native session storage is shared with the main runtime. Main
 * clients are configured with persistSession:false and only project these
 * BG-owned slots; they never sign out or write persistent credentials.
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

export function allowAuthSessionStorageWritesBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): void {
  supabaseStorageInstance.allowWritesForKey(
    getSupabaseAuthSessionKeyBySessionSource(authSessionSource),
  );
}

async function blockAuthSessionStorageWritesBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<void> {
  await supabaseStorageInstance.blockWritesForKey(
    getSupabaseAuthSessionKeyBySessionSource(authSessionSource),
  );
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
 * Clear ONLY this runtime's Supabase session storage read cache, without
 * emitting the cross-runtime cache-clear event. Use before a local read that
 * must not serve a stale (up-to-30s memoized) value — e.g. a pre-login guard
 * that would otherwise abort on a stale empty slot.
 */
export function clearSupabaseStorageLocalCache() {
  supabaseStorageInstance.clearCache({ syncRemote: false });
}

/**
 * Persist a freshly acquired Keyless OAuth session from the bg runtime.
 * Callers own any login-state serialization required before invoking this
 * helper; setSession may perform network I/O and must not run while holding
 * authStateWriteMutex.
 */
export async function persistKeylessAuthSession({
  accessToken,
  refreshToken,
}: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  if (!accessToken || !refreshToken) {
    throw new OneKeyLocalError(
      'Failed to persist Keyless OAuth session: missing token',
    );
  }
  allowAuthSessionStorageWritesBySessionSource(
    EPrimeAuthSessionSource.KeylessOAuth,
  );
  const { data, error } =
    await getKeylessSupabaseClient().client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  if (error || !data.session) {
    const statusPart =
      typeof error?.status === 'number' ? ` status=${error.status}` : '';
    const codePart = error?.code ? ` code=${error.code}` : '';
    throw new OneKeyLocalError({
      message: `Failed to persist Keyless OAuth session: ${
        error?.message || 'no session returned'
      }${statusPart}${codePart}`,
      httpStatusCode:
        typeof error?.status === 'number' ? error.status : undefined,
    });
  }
}

export type IPersistedAccessTokenStrictReadResult =
  | { status: 'empty' }
  | { status: 'corrupt' }
  | { status: 'ok'; accessToken: string };

/**
 * Strict variant of readPersistedAccessTokenBySessionSource for callers that
 * make a DESTRUCTIVE decision on the result. Unlike the best-effort reader
 * (which degrades EVERY failure to ''), this separates three definitive slot
 * states from a transient failure:
 * - `empty`   — no value persisted;
 * - `corrupt` — a value is persisted but is not a usable session (unparseable
 *   JSON or no access_token). DETERMINISTIC: re-reading yields the same
 *   bytes, and the auth-js commit read would fail on it the same way;
 * - `ok`      — a usable access token is persisted;
 * - transient storage failures (e.g. SupabaseStorageTransientError from the
 *   sealed codec) are RETHROWN — the slot state is unknown, and collapsing
 *   that into "no session" would let callers destroy a still-recoverable
 *   session.
 */
export async function readPersistedAccessTokenBySessionSourceStrict(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<IPersistedAccessTokenStrictReadResult> {
  const sessionKey =
    getSupabaseAuthSessionKeyBySessionSource(authSessionSource);
  // getItem rethrows transient device-key/storage failures — let them
  // propagate so the caller treats the slot as "unknown", not "empty".
  const rawValue = await supabaseStorageInstance.getItem(sessionKey);
  if (!rawValue) {
    return { status: 'empty' };
  }
  try {
    const parsed = JSON.parse(rawValue) as { access_token?: string } | null;
    const accessToken = parsed?.access_token || '';
    return accessToken ? { status: 'ok', accessToken } : { status: 'corrupt' };
  } catch {
    return { status: 'corrupt' };
  }
}

/**
 * Per-realm serial queue for session-slot DELETIONS (bg-owned). Every
 * destructive session-slot mutation — unconditional clears here and the
 * generation-gated clear in ServicePrime — runs inside the realm's
 * semaphore, so two deletions can never interleave, and a gated deletion's
 * generation validation and its storage removal belong to one serial
 * operation.
 *
 * Lock ordering: session slot queue (outer) -> authStateWriteMutex (inner,
 * taken by ServicePrime's gated clear for the validate+remove step).
 * Sections holding authStateWriteMutex must never wait on this queue.
 */
const sessionSlotMutexBySource: Record<EPrimeAuthSessionSource, Semaphore> = {
  [EPrimeAuthSessionSource.LegacyEmailSupabase]: new Semaphore(1),
  [EPrimeAuthSessionSource.KeylessOAuth]: new Semaphore(1),
};

export async function runExclusiveOnAuthSessionSlot<T>(
  authSessionSource: EPrimeAuthSessionSource,
  fn: () => Promise<T>,
): Promise<T> {
  return sessionSlotMutexBySource[authSessionSource].runExclusive(fn);
}

/**
 * Remove the persisted session storage key of the given source (local
 * storage write only — safe inside authStateWriteMutex).
 */
export async function removeAuthSessionStorageBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<void> {
  const sessionKey =
    getSupabaseAuthSessionKeyBySessionSource(authSessionSource);
  await blockAuthSessionStorageWritesBySessionSource(authSessionSource);
  await supabaseStorageInstance.removeItem(sessionKey);
  supabaseStorageInstance.clearCache();
}

/**
 * Sign out this runtime's SDK client of the given source (network-capable;
 * never call while holding authStateWriteMutex).
 *
 * WARNING: auth-js signOut RE-READS the shared session slot and ends with
 * `_removeSession()`, so it deletes WHATEVER currently occupies the slot —
 * including a fresh login persisted after the caller's own snapshot. Only
 * use it on unconditional teardown paths; generation-gated deletions must
 * use readPersistedAccessTokenBySessionSource +
 * revokeAuthSessionTokenOnServerBestEffort instead.
 */
export async function signOutAuthSessionClientBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<void> {
  const client = getSupabaseClientBySessionSource(authSessionSource);
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // Storage removal is handled by the callers even when the SDK session
    // is already invalid.
  }
}

/**
 * Read the access token currently persisted in the given source's session
 * slot — a pure LOCAL storage read (no SDK session load, no network, no
 * refresh), safe inside authStateWriteMutex. Returns '' when the slot is
 * empty, unparseable, or transiently unreadable: the caller only uses the
 * token for best-effort server revocation, so degrading to "no revocation"
 * is always acceptable.
 */
export async function readPersistedAccessTokenBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<string> {
  try {
    const sessionKey =
      getSupabaseAuthSessionKeyBySessionSource(authSessionSource);
    const rawValue = await supabaseStorageInstance.getItem(sessionKey);
    if (!rawValue) {
      return '';
    }
    const parsed = JSON.parse(rawValue) as { access_token?: string } | null;
    return parsed?.access_token || '';
  } catch {
    return '';
  }
}

/**
 * Best-effort server-side revocation of a CAPTURED access token: a direct
 * POST /logout with the given JWT (the same call auth-js signOut performs
 * internally), WITHOUT any session storage interaction — so it can never
 * delete a session persisted after the caller captured the token.
 * Network-capable; never call while holding authStateWriteMutex.
 */
export async function revokeAuthSessionTokenOnServerBestEffort({
  authSessionSource,
  accessToken,
}: {
  authSessionSource: EPrimeAuthSessionSource;
  accessToken: string;
}): Promise<void> {
  if (!accessToken) {
    return;
  }
  try {
    const client = getSupabaseClientBySessionSource(authSessionSource);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        client.auth.admin.signOut(accessToken, 'local'),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error('Supabase session revocation timed out after 10000ms.'),
            );
          }, 10_000);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  } catch {
    // Best-effort: the local deletion already happened; an unreachable
    // revocation endpoint must not fail the teardown.
  }
}

/**
 * Unconditionally sign out the given session source locally and remove its
 * persisted session storage key, serialized on the realm's slot queue.
 */
export async function clearAuthSessionBySessionSource(
  authSessionSource: EPrimeAuthSessionSource,
): Promise<void> {
  await runExclusiveOnAuthSessionSlot(authSessionSource, async () => {
    await blockAuthSessionStorageWritesBySessionSource(authSessionSource);
    await signOutAuthSessionClientBySessionSource(authSessionSource);
    await removeAuthSessionStorageBySessionSource(authSessionSource);
  });
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
