// https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth?queryGroups=auth-store&auth-store=async-storage
import { createClient } from '@supabase/supabase-js';

import {
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import platformEnv, { ERuntimeRole } from '@onekeyhq/shared/src/platformEnv';
import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import {
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';

import type { SupabaseClient } from '@supabase/supabase-js';

// do not add this on web env
// import 'react-native-url-polyfill/auto'; // TODO move to shared polyfill

let client: SupabaseClient | undefined;
let keylessClient: SupabaseClient | undefined;
const storage = supabaseStorageInstance;

/**
 * Transient-failure guard for the two persistent Supabase auth clients.
 *
 * Verified against @supabase/auth-js@2.86.2: the SDK classifies only
 * fetch-level rejections and HTTP 502/503/504 as retryable
 * (`AuthRetryableFetchError`). Every other token-refresh failure — 500, 408,
 * 429, other 5xx, or a proxy/CDN challenge page whose non-JSON body becomes
 * a non-retryable `AuthUnknownError` — makes `_callRefreshToken()` /
 * `_recoverAndRefresh()` call `_removeSession()`, permanently destroying the
 * persisted single-use rotating refresh token over a transient outage (our
 * own `isRetryableSupabaseAuthError` treats all of these as retryable, but
 * it only guards OUR call sites — the SDK removes the session internally
 * before any wrapper sees the error). Reject such responses at the fetch
 * layer instead: auth-js `_handleRequest()` converts fetcher rejections into
 * `AuthRetryableFetchError`, so the SDK keeps the session and retries later.
 * Definitive GoTrue verdicts (4xx with a parseable JSON body, e.g.
 * invalid_grant) pass through untouched — destroying a session stays
 * constrained to the issuer's explicit rejection or an explicit sign-out.
 */
const isTransientSupabaseHttpStatus = (status: number) =>
  status === 408 || status === 429 || (status >= 500 && status < 600);

const sessionPreservingSupabaseFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok) {
    return response;
  }
  if (isTransientSupabaseHttpStatus(response.status)) {
    throw new TypeError(
      `Supabase transient HTTP ${response.status} treated as network failure to preserve the persisted session`,
    );
  }
  // A non-OK response whose body is not JSON is an intermediary error page
  // (corporate proxy / CDN bot challenge), never a GoTrue verdict on the
  // credential — treat it as transient too, otherwise auth-js turns it into
  // a non-retryable AuthUnknownError and drops the persisted session.
  try {
    await response.clone().json();
  } catch {
    throw new TypeError(
      `Supabase non-JSON HTTP ${response.status} error response treated as network failure to preserve the persisted session ${await buildInterceptedResponseFingerprint(
        response,
      )}`,
    );
  }
  return response;
};

/**
 * Identify WHICH intermediary produced a non-JSON error page. Supabase auth
 * hosts sit behind Cloudflare, so every response that genuinely traversed
 * the edge carries a `cf-ray` header:
 * - no `cf-ray`            -> produced by a local proxy/VPN on the device's
 *                             network path (never reached Cloudflare);
 * - `cf-ray` + cf-mitigated/challenge markers -> blocked by Cloudflare
 *                             itself (WAF / bot management);
 * - `cf-ray` + server!=cloudflare -> passed the edge, rejected by the origin
 *                             gateway/reverse proxy in front of GoTrue.
 * The fingerprint is embedded in the thrown error message so it reaches the
 * login-failure toast and exported logs without extra plumbing. It carries
 * response headers and a body CLASSIFICATION only — never raw body content:
 * this string flows into server-side failure logging, and intermediary
 * pages (captive portals, corporate proxies) can embed user- or
 * network-identifying details.
 */
async function buildInterceptedResponseFingerprint(
  response: Response,
): Promise<string> {
  const header = (name: string) => response.headers?.get?.(name) || 'none';
  return `[server=${header('server')} content-type=${header(
    'content-type',
  )} cf-ray=${header('cf-ray')} cf-mitigated=${header(
    'cf-mitigated',
  )} body=${await classifyInterceptedResponseBody(response)}]`;
}

// Whitelist classification of an intercepted error-page body. Only fixed
// labels leave this function (see the privacy note above); the labels keep
// the Cloudflare-vs-other discrimination the raw snippet used to provide.
async function classifyInterceptedResponseBody(
  response: Response,
): Promise<string> {
  let text = '';
  try {
    text = (await response.clone().text()).slice(0, 2048);
  } catch {
    return 'unreadable';
  }
  if (!text.trim()) {
    return 'empty';
  }
  const lowerText = text.toLowerCase();
  if (
    lowerText.includes('cloudflare') ||
    lowerText.includes('cf-error') ||
    lowerText.includes('just a moment') ||
    lowerText.includes('attention required')
  ) {
    return 'cloudflare-page';
  }
  if (lowerText.includes('<html') || lowerText.includes('<!doctype')) {
    return 'html';
  }
  return 'text';
}

/**
 * Whether THIS JS runtime is allowed to perform Supabase refresh-token
 * rotations (the auth-js auto-refresh ticker and the initialize-time
 * `_recoverAndRefresh` refresh).
 *
 * Why UNATTENDED auto-refresh is a hard requirement (and, consequently, why
 * the persisted session is NOT passcode-encrypted — do not "fix" this):
 * The Supabase access token is a ~1h JWT. Without refresh, every OneKey ID
 * backend call starts failing with 90002/90003 after expiry, the
 * invalid-token cleanup logs the user out, and because the refresh token is
 * single-use rotating with a server-side validity window, a long-enough
 * refresh gap makes recovery impossible without a full re-OAuth. Refresh
 * runs in the bg runtime on timers/request paths where NO user is present
 * to type a passcode, so the refresh token must be readable without user
 * interaction. Passcode-encrypting it (like the pre-unification legacy
 * keyless blob, which was only decrypted at explicit PIN-verify moments)
 * is architecturally incompatible with this flow. At-rest protection is
 * instead provided by the storage layer: OS secure storage on native/prod
 * desktop, and a non-extractable IndexedDB device key on ext/web (see
 * SupabaseStorage/sealedValueCodec.ts). Note the pre-unification legacy
 * EMAIL session had exactly this treatment in production (v6.4.0:
 * autoRefreshToken + persistSession into the same storage, plaintext on the
 * ext/web fallback) — the sealed codec upgraded both sessions.
 *
 * Refresh-token rotation race rationale:
 * Production runs multiple isolated JS runtimes over ONE shared native
 * session store (supabaseStorageInstance). Every runtime used to construct
 * its Supabase client with `autoRefreshToken: true`, so two runtimes'
 * auto-refresh tickers could independently rotate the SAME refresh token.
 * GoTrue's reuse detection allows re-using a rotated refresh token only
 * within a short (~10s) window; a second refresh with the stale token after
 * that window revokes the whole token family, and auth-js then removes the
 * session from the shared store — a spurious full logout. Therefore exactly
 * one runtime per platform — the background runtime — owns token refresh.
 *
 * Platform matrix (see platformEnv.runtimeRole / computeRuntimeRole):
 * - ext service worker (MV3) / background html (MV2) -> Background -> true
 * - ext UI (popup / sidepanel / expanded tab / passkey) -> Main -> false
 * - ext offscreen -> Main -> false
 * - native bg Hermes runtime (__ONEKEY_RUNTIME_KIND__ === 'background')
 *   -> Background -> true
 * - native main (UI) Hermes runtime -> Main -> false
 * - native without a bg thread (dev single-runtime) -> Standalone -> true
 * - desktop / web (main == bg in one JS context) -> Standalone -> true
 * - webembed -> Main -> false
 *
 * `platformEnv.runtimeRole` is computed at platformEnv module load from
 * build-time flags plus the `__ONEKEY_RUNTIME_KIND__` global, which the
 * native entrypoints (apps/mobile/index.ts, apps/mobile/background.ts) set
 * before any import runs — so it is reliable at client-construction time in
 * every context and no explicit init parameter is needed.
 *
 * IMPORTANT (verified against @supabase/auth-js@2.86.2):
 * `autoRefreshToken: false` only disables the 30s refresh ticker and the
 * initialize-time `_recoverAndRefresh()` network refresh. It does NOT
 * disable the on-demand refresh inside `getSession()` (`__loadSession()`
 * calls `_callRefreshToken()` for an expired session regardless of the
 * flag). UI runtimes must therefore route steady-state token READS through
 * the bg bridge (`backgroundApiProxy.simpleDb.prime.getSupabaseAuthToken`
 * etc.) instead of calling `client.auth.getSession()` on a possibly-expired
 * session.
 *
 * Known residual (not fixable without patching supabase-js): the
 * SupabaseClient constructor subscribes `onAuthStateChange` internally
 * (`_listenForAuthEvents`), and every subscription asynchronously runs
 * `_emitInitialSession()` -> `__loadSession()`, which refreshes an
 * already-expired stored session once at client construction even with
 * `autoRefreshToken: false`. This only fires when the stored session is
 * expired at construction (cold start after a long sleep), where bg and UI
 * refresh within seconds of each other — inside GoTrue's ~10s refresh-token
 * reuse grace window — unlike the >10s ticker drift this flag eliminates.
 */
export function isSupabaseTokenRefreshRuntime(): boolean {
  return platformEnv.runtimeRole !== ERuntimeRole.Main;
}

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      SUPABASE_PROJECT_URL ?? '',
      SUPABASE_PUBLIC_API_KEY ?? '',
      {
        global: {
          // See sessionPreservingSupabaseFetch: transient HTTP failures must
          // reach auth-js as fetch rejections, or its internal
          // _removeSession() destroys the persisted session.
          fetch: sessionPreservingSupabaseFetch,
        },
        auth: {
          storage,
          storageKey: getSupabaseAuthSessionKey(),
          // Only the bg/standalone runtime refreshes tokens; see
          // isSupabaseTokenRefreshRuntime for the rotation-race rationale.
          autoRefreshToken: isSupabaseTokenRefreshRuntime(),
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce', // Use PKCE flow for better security - tokens are never exposed in URL
        },
      },
    );
  }
  return { client, storage };
}

export function getKeylessSupabaseClient() {
  if (!keylessClient) {
    keylessClient = createClient(
      KEYLESS_SUPABASE_PROJECT_URL ?? '',
      KEYLESS_SUPABASE_PUBLIC_API_KEY ?? '',
      {
        global: {
          // See sessionPreservingSupabaseFetch: transient HTTP failures must
          // reach auth-js as fetch rejections, or its internal
          // _removeSession() destroys the persisted session.
          fetch: sessionPreservingSupabaseFetch,
        },
        auth: {
          storage,
          storageKey: getKeylessSupabaseAuthSessionKey(),
          // Only the bg/standalone runtime refreshes tokens; see
          // isSupabaseTokenRefreshRuntime for the rotation-race rationale.
          autoRefreshToken: isSupabaseTokenRefreshRuntime(),
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      },
    );
  }
  return { client: keylessClient, storage };
}

/**
 * Create a temporary Supabase client that does not persist sessions automatically.
 * This is useful for OAuth flows where you want to get session data without
 * automatically writing it to storage.
 *
 * @returns A Supabase client configured with persistSession: false
 */
export function createTemporarySupabaseClient() {
  return createClient(
    KEYLESS_SUPABASE_PROJECT_URL ?? '',
    KEYLESS_SUPABASE_PUBLIC_API_KEY ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false, // Don't persist session automatically
        detectSessionInUrl: false,
        flowType: 'pkce', // Use PKCE flow for better security - tokens are never exposed in URL
      },
    },
  );
}
