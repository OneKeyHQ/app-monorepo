// https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth?queryGroups=auth-store&auth-store=async-storage
import { createClient } from '@supabase/supabase-js';

import { ONEKEY_API_HOST } from '@onekeyhq/shared/src/config/appConfig';
import { getOneKeyIdAuthConfig } from '@onekeyhq/shared/src/config/oneKeyIdAuth';
import {
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv, { ERuntimeRole } from '@onekeyhq/shared/src/platformEnv';
import {
  isProxyActiveForUrl,
  isSniSupported,
  sniRequest,
} from '@onekeyhq/shared/src/request/helpers/sniRequest';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import {
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';

import {
  getSharedDomainIpTableCandidates,
  isSupportIpTablePlatform,
} from './ipTableUtils';
import { isDefinitiveSupabaseRefreshTokenRejectionError } from './supabaseAuthErrorUtils';

import type { ISniResponse } from '../request/types/ipTable';
import type { SupabaseClient } from '@supabase/supabase-js';

// do not add this on web env
// import 'react-native-url-polyfill/auto'; // TODO move to shared polyfill

const emailClients = new Map<string, SupabaseClient>();
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
 * Definitive refresh-token verdicts pass through untouched. Ambiguous refresh
 * 4xx responses are rejected at the fetch layer too, so destroying a session
 * stays constrained to explicit token rejection or an explicit sign-out.
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
 * Responses from the IP route (see supabaseSniFallbackFetch) are relayed by a
 * CN CDN endpoint that keeps `cf-ray` but may rewrite `server`, so
 * `server!=cloudflare` there does not single out the origin gateway.
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

function getSupabaseRequestUrl(input: RequestInfo | URL): URL | undefined {
  let requestUrl = '';
  if (typeof input === 'string') {
    requestUrl = input;
  } else if (typeof (input as { url?: unknown })?.url === 'string') {
    requestUrl = (input as { url: string }).url;
  } else {
    requestUrl = String(input);
  }
  try {
    return new URL(requestUrl);
  } catch {
    return undefined;
  }
}

function isEmailOtpRequest(input: RequestInfo | URL): boolean {
  return (
    getSupabaseRequestUrl(input)?.pathname.endsWith('/auth/v1/otp') ?? false
  );
}

function isRefreshTokenRequest(input: RequestInfo | URL): boolean {
  const url = getSupabaseRequestUrl(input);
  return Boolean(
    url?.pathname.endsWith('/auth/v1/token') &&
    url.searchParams.get('grant_type') === 'refresh_token',
  );
}

function isDefinitiveEmailOtpCooldownResponse({
  input,
  response,
  bodyText,
}: {
  input: RequestInfo | URL;
  response: Response;
  bodyText: string | undefined;
}): boolean {
  if (response.status !== 429 || !isEmailOtpRequest(input)) {
    return false;
  }

  // If cloning the exact OTP response fails, preserve the original body for
  // auth-js. signInWithOtp handles its own AuthError without removing the
  // persisted login session, while converting the response to TypeError here
  // would irreversibly discard the server's cooldown code and retry delay.
  if (bodyText === undefined) {
    return true;
  }

  try {
    const payload = JSON.parse(bodyText) as {
      code?: unknown;
      error_code?: unknown;
    };
    return (
      payload.code === 'over_email_send_rate_limit' ||
      payload.error_code === 'over_email_send_rate_limit'
    );
  } catch {
    return false;
  }
}

// The only Supabase host that the IP table's CN CDN endpoints serve.
const SUPABASE_SNI_FALLBACK_HOST = 'auth.onekey.so';
const SUPABASE_SNI_FALLBACK_MAX_CANDIDATES = 3;
const SUPABASE_SNI_FALLBACK_TIMEOUT_MS = 10_000;
// The native fetch has no request timeout: when the connection is silently
// dropped, the OS takes over a minute to report the failure.
const SUPABASE_SNI_FALLBACK_DOMAIN_TIMEOUT_MS = 5000;

// The route that answered last: `null` for the domain, otherwise the index of
// the IP-table candidate. One copy per JS runtime.
let supabaseSniFallbackIndex: number | null = null;

function setSupabaseSniFallbackIndex(index: number | null, reason: string) {
  supabaseSniFallbackIndex = index;
  defaultLogger.ipTable.request.info({
    info: `[SupabaseSniFallback] route=${
      index === null ? 'domain' : `sni candidate=${index}`
    } reason=${reason}`,
  });
}

function getSupabaseSniFallbackUrl(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): URL | undefined {
  if (
    !isSupportIpTablePlatform() ||
    !isSniSupported() ||
    typeof Headers !== 'function' ||
    typeof Response !== 'function'
  ) {
    return undefined;
  }
  // The SNI transport carries string bodies only.
  if (typeof input !== 'string' && !(input instanceof URL)) {
    return undefined;
  }
  if (
    init?.body !== undefined &&
    init.body !== null &&
    typeof init.body !== 'string'
  ) {
    return undefined;
  }
  const url = getSupabaseRequestUrl(input);
  return url?.protocol === 'https:' && url.host === SUPABASE_SNI_FALLBACK_HOST
    ? url
    : undefined;
}

async function getSupabaseSniFallbackCandidates(url: URL): Promise<string[]> {
  try {
    // Only a confirmed direct route may pin an IP. A proxy reaches the domain
    // on its own, and this path carries tokens with no legacy SNI behavior to
    // keep when the preflight cannot tell (null).
    if ((await isProxyActiveForUrl(url.origin)) !== false) {
      return [];
    }
    const devSettings = await requestHelper.getDevSettingsPersistAtom();
    if (devSettings.settings?.disableIpTableInProd) {
      return [];
    }
    const activeConfig = await requestHelper.getIpTableConfig();
    if (activeConfig?.runtime?.enabled === false) {
      return [];
    }
    return getSharedDomainIpTableCandidates({
      hostname: url.hostname,
      // Always the production table: this host is the production project
      // even when the app points at the test API.
      configKey: ONEKEY_API_HOST,
      // The table's runtime preference is ranked against the API hosts and
      // moves with every speed test. A fixed order keeps the working
      // candidate where the stored index points.
      activeConfig: null,
      maxCandidates: SUPABASE_SNI_FALLBACK_MAX_CANDIDATES,
    });
  } catch {
    return [];
  }
}

// Whether sending the request twice is harmless: a read, or one of the two
// token grants GoTrue accepts again. A refresh token one generation behind
// the active one is answered with the active one at any time (the direct
// parent rule of the v1 algorithm, a counter difference of 1 in v2; the
// reuse interval only governs older tokens), and a copy sent here is never
// further behind, because the stored token only advances on a response. An
// ID token is not single-use. One-time codes (OTP, PKCE) are: a second copy
// fails after the first was accepted.
function isSupabaseRequestRepeatable(
  url: URL,
  init: RequestInit | undefined,
): boolean {
  if ((init?.method ?? 'GET').toUpperCase() === 'GET') {
    return true;
  }
  const grantType = url.pathname.endsWith('/auth/v1/token')
    ? url.searchParams.get('grant_type')
    : null;
  return grantType === 'refresh_token' || grantType === 'id_token';
}

// Sends to the domain and gives up after the timeout, so the next route can
// be tried. The caller's own abort still cancels the request.
async function fetchSupabaseDomainWithin(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init?.signal;
  const forwardAbort = () => controller.abort();
  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener?.('abort', forwardAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    // Once the headers are in, the small JSON body is read without an abort.
    // Keeping the listener would hold this request for as long as a reused
    // caller signal lives.
    callerSignal?.removeEventListener?.('abort', forwardAbort);
  }
}

function buildSupabaseAbortError(): Error {
  const abortError = new Error('Aborted');
  abortError.name = 'AbortError';
  return abortError;
}

type ISupabaseAuthRoute = { index: number | null; ip?: string };

// The route to try first, then the others: the domain before the candidates,
// or after them once a candidate is in use.
function getSupabaseAuthRoutes(
  candidates: string[],
  pointer: number | null,
): ISupabaseAuthRoute[] {
  const domainRoute: ISupabaseAuthRoute = { index: null };
  const candidateRoutes = candidates.map((ip, index) => ({ index, ip }));
  const lastRoute = candidateRoutes.find((route) => route.index === pointer);
  return lastRoute
    ? [
        lastRoute,
        ...candidateRoutes.filter((route) => route !== lastRoute),
        domainRoute,
      ]
    : [domainRoute, ...candidateRoutes];
}

function buildSupabaseSniResponse(
  sniResponse: ISniResponse,
  method: string,
): Response {
  const status = sniResponse.statusCode;
  const hasBody = method !== 'HEAD' && ![204, 205, 304].includes(status);
  // An out-of-range status throws; the caller treats that as a transport
  // failure.
  return new Response(hasBody ? sniResponse.body : null, {
    status,
    statusText: sniResponse.statusText,
    headers: sniResponse.headers,
  });
}

type ISupabaseRouteAnswer = {
  response: Response;
  // False for a non-JSON answer that is not a success: an error page, or a
  // redirect, which the SNI transport never follows. That comes from an
  // intermediary, not from GoTrue, so the route counts as failed.
  fromAuthServer: boolean;
};

async function fetchSupabaseSniCandidate(
  url: URL,
  init: RequestInit | undefined,
  ip: string,
): Promise<ISupabaseRouteAnswer> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const sniResponse = await sniRequest(
    {
      ip,
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
      body: typeof init?.body === 'string' ? init.body : null,
      timeout: SUPABASE_SNI_FALLBACK_TIMEOUT_MS,
    },
    init?.signal ? { signal: init.signal } : undefined,
  );
  if (!sniResponse) {
    throw new TypeError('SNI transport returned no response');
  }
  const response = buildSupabaseSniResponse(sniResponse, method);
  return {
    response,
    fromAuthServer: response.ok || isJsonParseableBody(sniResponse.body),
  };
}

// A one-time request is sent once, like a plain fetch, and its outcome is
// returned as is. A failure only moves the NEXT request to the next route
// (domain -> each candidate -> domain); concurrent failures move it once.
async function fetchSupabaseRouteOnce({
  url,
  input,
  init,
  route,
  pointer,
  candidateCount,
}: {
  url: URL;
  input: RequestInfo | URL;
  init: RequestInit | undefined;
  route: ISupabaseAuthRoute;
  pointer: number | null;
  candidateCount: number;
}): Promise<Response> {
  const moveOn = (reason: string) => {
    if (supabaseSniFallbackIndex !== pointer) {
      return;
    }
    const nextIndex = route.index === null ? 0 : route.index + 1;
    setSupabaseSniFallbackIndex(
      nextIndex < candidateCount ? nextIndex : null,
      reason,
    );
  };
  if (!route.ip) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (!init?.signal?.aborted) {
        moveOn('domain_failed');
      }
      throw error;
    }
  }
  try {
    const answer = await fetchSupabaseSniCandidate(url, init, route.ip);
    if (!answer.fromAuthServer) {
      moveOn('sni_error_page');
    }
    return answer.response;
  } catch {
    if (init?.signal?.aborted) {
      throw buildSupabaseAbortError();
    }
    moveOn('sni_failed');
    // No transport detail: this message reaches logs and the failure toast.
    throw new TypeError('Network request failed');
  }
}

/**
 * auth.onekey.so is DNS-poisoned on some networks, where only the IP table's
 * CN CDN endpoints can reach it.
 *
 * A request that is harmless to repeat (see isSupabaseRequestRepeatable)
 * tries the route that answered last, then the others (the domain, where it
 * waits a few seconds at most, then each IP-table candidate; the domain goes
 * last once a candidate is in use), and the route that answers is kept. Any
 * other request is sent once, to the route in use, and a failure moves the
 * next request on. Without a candidate to fall back to, every request goes
 * to the domain untouched.
 */
const supabaseSniFallbackFetch: typeof fetch = async (input, init) => {
  const url = getSupabaseSniFallbackUrl(input, init);
  const candidates = url ? await getSupabaseSniFallbackCandidates(url) : [];
  if (!url || !candidates.length) {
    if (url && supabaseSniFallbackIndex !== null) {
      setSupabaseSniFallbackIndex(null, 'no_candidate');
    }
    return fetch(input, init);
  }
  const pointer = supabaseSniFallbackIndex;
  const routes = getSupabaseAuthRoutes(candidates, pointer);
  if (!isSupabaseRequestRepeatable(url, init)) {
    return fetchSupabaseRouteOnce({
      url,
      input,
      init,
      route: routes[0],
      pointer,
      candidateCount: candidates.length,
    });
  }
  let firstFailure: string | undefined;
  for (const route of routes) {
    let failure = 'sni_error_page';
    try {
      let response: Response | undefined;
      if (route.ip) {
        const answer = await fetchSupabaseSniCandidate(url, init, route.ip);
        response = answer.fromAuthServer ? answer.response : undefined;
      } else {
        response = await fetchSupabaseDomainWithin(
          input,
          init,
          SUPABASE_SNI_FALLBACK_DOMAIN_TIMEOUT_MS,
        );
      }
      if (response) {
        if (supabaseSniFallbackIndex !== route.index) {
          setSupabaseSniFallbackIndex(route.index, firstFailure ?? 'answered');
        }
        return response;
      }
    } catch (error) {
      if (init?.signal?.aborted) {
        throw route.ip ? buildSupabaseAbortError() : error;
      }
      failure = route.ip ? 'sni_failed' : 'domain_failed';
    }
    firstFailure ??= failure;
  }
  // No transport detail: this message reaches logs and the failure toast.
  throw new TypeError('Network request failed');
};

const sessionPreservingSupabaseFetch: typeof fetch = async (input, init) => {
  const response = await supabaseSniFallbackFetch(input, init);
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
    // The OTP cooldown is a definitive, user-actionable GoTrue verdict, not
    // a refresh-session failure. Pass only this exact endpoint + parseable
    // JSON code through so the UI can show the server retry delay. Do not
    // depend on content-type: browser CORS and intermediaries may hide or
    // rewrite that header even when the body is the definitive GoTrue JSON.
    // If this exact OTP response cannot be cloned, leave its original body
    // for auth-js instead of replacing the actionable cooldown with a
    // synthetic network error. Every refresh-token 429 and readable
    // intermediary/non-cooldown 429 remains a fetch rejection, preserving the
    // persisted rotating refresh-token session.
    if (
      isDefinitiveEmailOtpCooldownResponse({
        input,
        response,
        bodyText: bodyPrefix,
      })
    ) {
      return response;
    }
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
  // Non-refresh JSON errors must reach auth-js unchanged. Refresh-token
  // responses are different: auth-js removes the persisted session for every
  // non-retryable 4xx, so only the issuer's explicit token-rejection codes may
  // pass through. Keep unknown refresh failures retryable so the UI's Retry
  // action still has a session to refresh.
  if (bodyText !== undefined && isJsonParseableBody(bodyText)) {
    if (isRefreshTokenRequest(input)) {
      const body = JSON.parse(bodyText) as unknown;
      if (!isDefinitiveSupabaseRefreshTokenRejectionError(body)) {
        throw new TypeError(
          `Supabase ambiguous refresh-token HTTP ${
            response.status
          } treated as network failure to preserve the persisted session ${buildInterceptedResponseFingerprint(
            response,
            bodyText,
          )}`,
        );
      }
    }
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
 * GoTrue answers a rotated refresh token that is one generation behind with
 * the active one, but allows re-using an older one only within a short (~10s)
 * window; a second refresh with such a stale token after that window revokes
 * the whole token family, and auth-js then removes the
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

export async function getSupabaseClient() {
  const { projectUrl, publicKey } = await getOneKeyIdAuthConfig();
  const sessionKey = getSupabaseAuthSessionKey(projectUrl);
  let client = emailClients.get(projectUrl);
  if (!client) {
    client = createClient(projectUrl, publicKey, {
      global: {
        // See sessionPreservingSupabaseFetch: transient HTTP failures must
        // reach auth-js as fetch rejections, or its internal
        // _removeSession() destroys the persisted session.
        fetch: sessionPreservingSupabaseFetch,
      },
      auth: {
        storage,
        storageKey: sessionKey,
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
    });
    emailClients.set(projectUrl, client);
  }
  return { client, storage, sessionKey };
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
      global: {
        // Sign-in must reach the auth host where only the IP route works.
        // There is no persisted session here for the guarded fetch to protect.
        fetch: supabaseSniFallbackFetch,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false, // Don't persist session automatically
        detectSessionInUrl: false,
        flowType: 'pkce', // Use PKCE flow for better security - tokens are never exposed in URL
      },
    },
  );
}
