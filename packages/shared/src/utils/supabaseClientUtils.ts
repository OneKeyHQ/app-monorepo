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

// Whether an intercepted error-page body parses as JSON. A parseable JSON
// body on a non-OK response is a definitive GoTrue verdict (invalid_grant,
// rate-limit, ...) and must reach auth-js unchanged; a non-JSON body is an
// intermediary error page (proxy / CDN / WAF) that must be masked as a
// network failure so auth-js does not drop the persisted session.
function isJsonParseableBody(bodyText: string): boolean {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

const ERROR_BODY_FINGERPRINT_MAX_BYTES = 2048;
const ERROR_BODY_FINGERPRINT_TIMEOUT_MS = 1500;

/**
 * Bounded best-effort read of an error-page body prefix. A proxy/WAF error
 * response can be huge or stream forever, so cap the bytes via the stream
 * reader where one exists (web / desktop / extension) and cap the wall-clock
 * wait everywhere. React Native's fetch exposes no ReadableStream and its
 * native layer buffers the body regardless — there the timeout only bounds
 * how long WE wait, which is the part that matters for fast retryable
 * classification. Returns undefined when nothing could be read in time.
 */
async function readErrorBodyPrefixBestEffort(
  response: Response,
): Promise<string | undefined> {
  try {
    const clone = response.clone();
    const reader = clone.body?.getReader?.();
    if (reader) {
      const deadline = Date.now() + ERROR_BODY_FINGERPRINT_TIMEOUT_MS;
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      while (
        receivedBytes < ERROR_BODY_FINGERPRINT_MAX_BYTES &&
        Date.now() < deadline
      ) {
        const readResult = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value: undefined }>((resolve) => {
            setTimeout(
              () => resolve({ done: true, value: undefined }),
              Math.max(0, deadline - Date.now()),
            );
          }),
        ]);
        if (readResult.done) {
          break;
        }
        if (readResult.value) {
          chunks.push(readResult.value);
          receivedBytes += readResult.value.byteLength;
        }
      }
      void reader.cancel().catch(() => {});
      const merged = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new TextDecoder().decode(merged);
    }
    return await Promise.race([
      clone.text(),
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), ERROR_BODY_FINGERPRINT_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return undefined;
  }
}

// Whitelist classification of an intercepted error-page body from ALREADY-READ
// text (undefined = the body could not be read in time). Only fixed labels
// leave this function (see the privacy note on
// buildInterceptedResponseFingerprint); the labels keep the
// Cloudflare-vs-other discrimination the raw snippet used to provide.
function classifyInterceptedResponseBody(bodyText: string | undefined): string {
  if (bodyText === undefined) {
    return 'unreadable';
  }
  const text = bodyText.slice(0, 2048);
  if (!text.trim()) {
    return 'empty';
  }
  const lowerText = text.toLowerCase();
  // Anchor Cloudflare detection to markers that appear in CF's OWN block /
  // challenge pages — never the bare word 'cloudflare', which also appears
  // when an unrelated proxy / captive-portal page merely loads a
  // cdnjs.cloudflare.com asset (that would contradict the cf-ray header half
  // of the fingerprint).
  if (
    lowerText.includes('cloudflare ray id') ||
    lowerText.includes('cf-error') ||
    lowerText.includes('just a moment') ||
    lowerText.includes('attention required') ||
    lowerText.includes('performance & security by cloudflare')
  ) {
    return 'cloudflare-page';
  }
  if (lowerText.includes('<html') || lowerText.includes('<!doctype')) {
    return 'html';
  }
  return 'text';
}

/**
 * Identify WHICH intermediary produced an intercepted error response. Supabase
 * auth hosts sit behind Cloudflare, so a response that genuinely traversed the
 * edge carries a `cf-ray` header:
 * - no `cf-ray`            -> produced by a local proxy/VPN on the device's
 *                             network path (never reached Cloudflare);
 * - `cf-ray` + cf-mitigated/challenge markers -> blocked by Cloudflare
 *                             itself (WAF / bot management);
 * - `cf-ray` + server!=cloudflare -> passed the edge, rejected by the origin
 *                             gateway/reverse proxy in front of GoTrue.
 *
 * IMPORTANT: header evidence is only authoritative on NATIVE. On browser-CORS
 * runtimes (web / desktop renderer / extension) `server`/`cf-ray`/`cf-mitigated`
 * are not exposed to page JS by CORS and read `none` even for responses that
 * DID traverse Cloudflare, so `cf-ray=none` there means "CORS-hidden", not
 * "local proxy". The emitted `platform` field lets log triage tell the two
 * apart; body classification and `content-type` (a CORS-exposed header) stay
 * trustworthy everywhere.
 *
 * The fingerprint is embedded in the thrown error message so it reaches the
 * login-failure toast and exported logs without extra plumbing. It carries
 * response headers and a body CLASSIFICATION only — never raw body content:
 * this string flows into server-side failure logging, and intermediary pages
 * (captive portals, corporate proxies) can embed user- or network-identifying
 * details.
 */
function buildInterceptedResponseFingerprint(
  response: Response,
  bodyText: string | undefined,
): string {
  const header = (name: string) => response.headers?.get?.(name) || 'none';
  return `[platform=${platformEnv.appPlatform} server=${header(
    'server',
  )} content-type=${header('content-type')} cf-ray=${header(
    'cf-ray',
  )} cf-mitigated=${header(
    'cf-mitigated',
  )} body=${classifyInterceptedResponseBody(bodyText)}]`;
}

const sessionPreservingSupabaseFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok) {
    return response;
  }
  if (isTransientSupabaseHttpStatus(response.status)) {
    // 408/429/5xx: the status ALONE decides the retryable verdict — classify
    // touching the body so a huge/streaming intermediary payload can never
    // delay the retryable failure, and read only a bounded prefix for the
    // fingerprint (Cloudflare's legacy 503 challenge / 429 rate-limit pages
    // are exactly the intermediary responses worth identifying).
    const bodyPrefix = await readErrorBodyPrefixBestEffort(response);
    throw new TypeError(
      `Supabase transient HTTP ${
        response.status
      } treated as network failure to preserve the persisted session ${buildInterceptedResponseFingerprint(
        response,
        bodyPrefix,
      )}`,
    );
  }
  // Non-transient statuses need FULL body fidelity: a truncated read could
  // misclassify a real GoTrue JSON verdict as an intermediary page. Read the
  // error body once from a clone (pre-existing behavior for this branch; the
  // original stays unread for the pass-through below) and reuse the text for
  // both the JSON check and the fingerprint.
  let bodyText: string | undefined;
  try {
    bodyText = await response.clone().text();
  } catch {
    bodyText = undefined;
  }
  // A non-OK response with a parseable JSON body is a definitive GoTrue verdict
  // — pass it through UNCHANGED so auth-js/callers surface the real error. Only
  // a non-JSON body is an intermediary error page (corporate proxy / CDN bot
  // challenge), which must be masked, otherwise auth-js turns it into a
  // non-retryable AuthUnknownError and drops the persisted session.
  if (bodyText !== undefined && isJsonParseableBody(bodyText)) {
    return response;
  }
  throw new TypeError(
    `Supabase non-JSON HTTP ${
      response.status
    } error response treated as network failure to preserve the persisted session ${buildInterceptedResponseFingerprint(
      response,
      bodyText,
    )}`,
  );
};

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
          // Main/UI runtimes never persist or refresh sessions. They read the
          // BG-owned storage projection directly; keeping auth-js read-only
          // also removes its constructor-time expired-session write race.
          persistSession: isSupabaseTokenRefreshRuntime(),
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
          persistSession: isSupabaseTokenRefreshRuntime(),
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
