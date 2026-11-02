/**
 * Classification of API request outcomes for availability metrics.
 *
 * Only allowlisted hosts are counted. Only enums, digit-free route segments
 * and normalized error codes are recorded: never URLs, query strings,
 * hostnames, proxy settings or free-form messages. Travel mode leaves no
 * trace: analytics is not initialized while it is on, so nothing is sent, and
 * the aggregator's `appStorage` writes are masked to no-ops, so nothing is
 * stored to be sent after switching back.
 */
import { EServiceEndpointEnum } from '../../types/endpoint';
import { ANALYTICS_EVENT_PATH } from '../analytics';
import { ONEKEY_API_HOST, ONEKEY_TEST_API_HOST } from '../config/appConfig';
import platformEnv, { ERuntimeRole } from '../platformEnv';

import {
  AVAILABILITY_SLOW_MS,
  recordAvailabilityOutcome,
} from './availabilityAggregator';
import {
  getAvailabilityNetworkType,
  startAvailabilityNetworkTypeTracking,
} from './availabilityNetworkType';

declare module 'axios' {
  interface AxiosRequestConfig {
    $oneKeyAvailabilityTiming?: IApiAvailabilityTiming;
  }
}

type IApiAvailabilityStatus =
  | 'api_error'
  | 'http_error'
  | 'network_error'
  | 'ok'
  | 'timeout';

/**
 * - direct: the request did not pass through the IP Table adapter (failure
 *   details only)
 * - domain: the adapter used the domain (DNS) route
 * - sni: the adapter sent an IP-direct SNI request
 * - fallback: SNI failed and the domain route was used
 * - bypass: the selected IP was stepping aside after repeated failures, so
 *   the domain route was used without trying SNI
 * - none: the request ended before the adapter picked a route
 */
export type IAvailabilityRoute =
  | 'bypass'
  | 'direct'
  | 'domain'
  | 'fallback'
  | 'none'
  | 'sni';

export type IAvailabilityIpTableState =
  | 'disabled'
  | 'enabled'
  | 'noConfig'
  | 'unknown';

export type IApiAvailabilityTiming = {
  startedAt: number;
  service: string;
  routeGroup: string;
  /** Set for the critical endpoints, which also get their own counters. */
  endpoint?: string;
  testEndpoint?: true;
  route?: IAvailabilityRoute;
  /** Result of the adapter's proxy preflight for this request. */
  proxyActive?: boolean | null;
  reported?: boolean;
};

const ONEKEY_API_SERVICES = new Set<string>(
  Object.values(EServiceEndpointEnum),
);

// Endpoints with their own success denominator, from the blocking criteria
// of the availability requirements (transfer, fiat, swap, earn, perps, KYT,
// login, IP Table config).
const CRITICAL_ENDPOINTS: Record<string, string> = {
  '/wallet/v1/account/token/list': 'tokenList',
  '/wallet/v1/account/estimate-fee': 'estimateFee',
  '/wallet/v1/account/estimate-fee-batch': 'estimateFee',
  '/wallet/v1/account/send-transaction': 'sendTransaction',
  '/wallet/v1/fiat-pay/list': 'fiatPay',
  '/wallet/v1/fiat-pay/url': 'fiatPay',
  '/swap/v1/quote/events': 'swapQuote',
  '/swap/v1/build-tx': 'swapBuildTx',
  '/earn/v2/stake': 'earnStake',
  '/earn/v2/unstake': 'earnWithdraw',
  '/earn/v2/claim': 'earnWithdraw',
  '/utility/v1/perp-config': 'perpConfig',
  '/utility/v1/transaction/check': 'txSecurityCheck',
  '/prime/v1/user/login': 'primeLogin',
  '/prime/v1/account/oauth/login': 'primeLogin',
  '/data.json': 'ipTableConfig',
};

// OneKeyError instances created without an explicit code carry this default.
const ONEKEY_DEFAULT_ERROR_CODE = -99_999;

let ipTableState: IAvailabilityIpTableState = 'unknown';

function getNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Service label, or undefined when the host is not counted. Hyperliquid is
 * measured for reachability only: it rejects orders with HTTP 200, which
 * counts as ok.
 */
function getService(host: string) {
  if (
    host.endsWith(`.${ONEKEY_API_HOST}`) ||
    host.endsWith(`.${ONEKEY_TEST_API_HOST}`)
  ) {
    const label = host.split('.')[0];
    return ONEKEY_API_SERVICES.has(label) ? label : 'onekeyApiOther';
  }
  if (host === 'api.hyperliquid.xyz') return 'hyperliquid';
  if (host.endsWith('.supabase.co')) return 'supabase';
  if (host === 'onekey.so' || host.endsWith('.onekey.so')) return 'onekeyWeb';
  return undefined;
}

// Ids (hex, base58, numbers, uuids) almost always contain digits: keep only
// short letter-only segments and version segments such as `v1`.
function sanitizeRouteSegment(segment: string) {
  return /^[a-z][a-z._-]{0,31}$/i.test(segment) || /^v\d{1,2}$/i.test(segment)
    ? segment.toLowerCase()
    : ':id';
}

function normalizeErrorCode(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && /^[a-z\d_-]{1,32}$/i.test(value)) {
    return value.toLowerCase();
  }
  return 'unknown';
}

// Transport failures arrive with a code that says only "the network failed":
// axios reports ERR_NETWORK with the literal message "Network Error", and a
// React Native fetch rejection carries no code at all. For a metric whose
// purpose is spotting network-level interference, a TLS reset, a poisoned DNS
// answer and an IP that never answers are three different findings.
const LOW_INFO_ERROR_CODES = new Set([
  'err_bad_request',
  'err_network',
  'error',
  'typeerror',
  'unknown',
]);

// Fixed tokens only: matched text is never echoed, so no host, address or
// free-form message can reach the snapshot.
const NETWORK_CAUSE_TOKENS: [RegExp, string][] = [
  [/ssl[_\s]?handshake|handshake_fail|tls[_\s]?handshake/i, 'sslhandshake'],
  [/cert(ificate|path|_)|untrusted|pinning/i, 'certificate'],
  [/unknown[_\s]?host|name_not_resolved|enotfound|dns/i, 'unknownhost'],
  [/connection[_\s]?refused|econnrefused/i, 'connectionrefused'],
  [/econnreset|connection (reset|closed|abort)|socket closed/i, 'econnreset'],
  [/enetunreach|net(work)?[_\s]?unreach|no route to host/i, 'netunreach'],
  [/failed to fetch|networkerror when attempting/i, 'failedtofetch'],
  [/sockettimeout|timed? ?out/i, 'sockettimeout'],
];

// Per part, not for the joined text: a long generic message must not push the
// fields that carry the real cause out of the budget.
const MAX_CAUSE_TEXT_LENGTH = 512;

/**
 * Everything the platforms put the underlying failure in. The generic message
 * is usually "Network Error" or "Network request failed"; the cause lives in
 * `cause.message` (undici) or `request._response` (React Native's Java/ObjC
 * text). Read by both the status and the error code, so the two agree.
 */
function getCauseText(error: unknown) {
  const { message, cause, request } = (error ?? {}) as {
    message?: unknown;
    cause?: { message?: unknown };
    request?: { _response?: unknown };
  };
  return [message, cause?.message, request?._response]
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.slice(0, MAX_CAUSE_TEXT_LENGTH))
    .join(' ');
}

function classifyNetworkCause(causeText: string) {
  if (!causeText) return undefined;
  return NETWORK_CAUSE_TOKENS.find(([pattern]) => pattern.test(causeText))?.[1];
}

function getErrorCode(error: unknown, causeText: string) {
  const { code, className, name } = (error ?? {}) as {
    code?: unknown;
    className?: unknown;
    name?: unknown;
  };
  const errorCode = normalizeErrorCode(
    code === undefined || code === ONEKEY_DEFAULT_ERROR_CODE
      ? (className ?? name)
      : code,
  );
  if (!LOW_INFO_ERROR_CODES.has(errorCode)) return errorCode;
  return classifyNetworkCause(causeText) ?? errorCode;
}

/**
 * Every outcome the provider cannot type gets its own target, so a broken
 * reader is visible instead of hiding inside a platform's own `unknown`:
 * `unread` means no reading at all, `unsupported` a realm with no transport
 * API, `unknown` the platform reporting an unidentified transport.
 */
function getNetworkType() {
  const type = getAvailabilityNetworkType();
  if (typeof type !== 'string') return 'unread';
  switch (type.toLowerCase()) {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'ethernet':
      return 'ethernet';
    case 'vpn':
      return 'vpn';
    case 'none':
      return 'offline';
    case 'unsupported':
      return 'unsupported';
    case 'unknown':
      return 'unknown';
    default:
      return 'other';
  }
}

function getProxyState(proxyActive: boolean | null | undefined) {
  if (proxyActive === true) return 'on';
  if (proxyActive === false) return 'off';
  return 'unknown';
}

export function setAvailabilityIpTableState(state: IAvailabilityIpTableState) {
  ipTableState = state;
}

export function createApiAvailabilityTiming({
  baseURL,
  url,
}: {
  baseURL?: string;
  url?: string;
}): IApiAvailabilityTiming | undefined {
  try {
    // Joined like axios combineURLs, so a baseURL path is kept.
    const text =
      /^https?:\/\//i.test(url ?? '') || !baseURL
        ? url
        : `${baseURL.replace(/\/+$/, '')}/${(url ?? '').replace(/^\/+/, '')}`;
    const { hostname, pathname } = new URL(text ?? '');
    const host = hostname.toLowerCase();
    const service = getService(host);
    // Analytics delivery and reachability or diagnostic probes are not API
    // traffic.
    if (
      !service ||
      pathname.includes(ANALYTICS_EVENT_PATH) ||
      pathname.endsWith('/health') ||
      pathname.startsWith('/cdn-cgi/')
    ) {
      return undefined;
    }
    // Started on the first counted request so the async native seed usually
    // resolves before that request settles.
    startAvailabilityNetworkTypeTracking();
    const segments = pathname
      .split('/')
      .filter(Boolean)
      .slice(0, 3)
      .map(sanitizeRouteSegment);
    return {
      startedAt: getNow(),
      service,
      routeGroup: `/${segments.join('/')}`,
      endpoint: CRITICAL_ENDPOINTS[pathname],
      testEndpoint: host.endsWith(`.${ONEKEY_TEST_API_HOST}`) || undefined,
    };
  } catch {
    return undefined;
  }
}

export function markApiAvailabilityRoute(
  timing: IApiAvailabilityTiming | undefined,
  route: IAvailabilityRoute,
) {
  if (timing) timing.route = route;
}

export function markApiAvailabilityProxy(
  timing: IApiAvailabilityTiming | undefined,
  proxyActive: boolean | null,
) {
  if (timing) timing.proxyActive = proxyActive;
}

function reportApiOutcome(
  timing: IApiAvailabilityTiming | undefined,
  status: IApiAvailabilityStatus,
  errorCode?: string,
) {
  if (!timing || timing.reported) return;
  timing.reported = true;
  const durationMs = Math.max(0, getNow() - timing.startedAt);
  const route = timing.route ?? 'direct';
  recordAvailabilityOutcome({
    source: 'api',
    target: timing.service,
    status,
    durationMs,
    testEndpoint: timing.testEndpoint,
    failure:
      status === 'ok'
        ? undefined
        : {
            detail: `${route}:${timing.endpoint ?? timing.routeGroup}`,
            errorCode: errorCode ?? 'unknown',
          },
  });
  // Breakdowns: `error` means the server answered, `failed` means transport failure.
  let result = 'failed';
  if (status === 'ok') {
    result = 'ok';
  } else if (status === 'api_error' || status === 'http_error') {
    result = 'error';
  }
  if (timing.endpoint) {
    recordAvailabilityOutcome({
      source: 'api_endpoint',
      target: timing.endpoint,
      status: result,
      durationMs,
    });
  }
  recordAvailabilityOutcome({
    source: 'api_net',
    target: getNetworkType(),
    status: result,
  });
  // Route, proxy and IP Table state only apply to requests the IP Table
  // adapter handled (it always sets a route). The native main runtime has no
  // IP Table config, so its adapter state would only report `noConfig`.
  if (
    !timing.route ||
    (platformEnv.isNative && platformEnv.runtimeRole === ERuntimeRole.Main)
  ) {
    return;
  }
  recordAvailabilityOutcome({
    source: 'api_route',
    target: timing.route,
    status: result,
    durationMs,
  });
  recordAvailabilityOutcome({
    source: 'api_proxy',
    target: getProxyState(timing.proxyActive),
    status: result,
  });
  recordAvailabilityOutcome({
    source: 'api_ip_table',
    target: ipTableState,
    status: result,
  });
}

/** A response that reached the client. `apiCode` is the OneKey envelope code. */
export function reportApiAvailabilityResponse({
  timing,
  httpStatus,
  isOneKeyApi,
  apiCode,
}: {
  timing: IApiAvailabilityTiming | undefined;
  httpStatus: number;
  isOneKeyApi?: boolean;
  apiCode?: unknown;
}) {
  if (httpStatus >= 400) {
    reportApiOutcome(timing, 'http_error', `http_${httpStatus}`);
  } else if (isOneKeyApi && typeof apiCode === 'number' && apiCode !== 0) {
    // Bodies without a numeric code (text, CSV) are not envelope errors.
    reportApiOutcome(timing, 'api_error', `api_${apiCode}`);
  } else {
    reportApiOutcome(timing, 'ok');
  }
}

/**
 * A rejected request. Cancellations are not availability outcomes, but an
 * abort caused by a timeout signal is a timeout.
 */
export function reportApiAvailabilityError(
  timing: IApiAvailabilityTiming | undefined,
  error: unknown,
  signal?: unknown,
) {
  const { code, name, response } = (error ?? {}) as {
    code?: unknown;
    name?: unknown;
    response?: { status?: number };
  };
  const timedOut =
    name === 'TimeoutError' ||
    (signal as { reason?: { name?: unknown } } | undefined)?.reason?.name ===
      'TimeoutError';
  if (
    !timedOut &&
    (code === 'ERR_CANCELED' ||
      code === 'SNI_CANCELLED' ||
      name === 'CanceledError' ||
      name === 'AbortError')
  ) {
    return;
  }
  if (response?.status) {
    reportApiOutcome(timing, 'http_error', `http_${response.status}`);
    return;
  }
  // Read from the same text as the error code, so a failure cannot be counted
  // as a network_error while its own detail says the transport timed out.
  const causeText = getCauseText(error);
  const isTimeout =
    timedOut ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    causeText.toLowerCase().includes('timeout') ||
    classifyNetworkCause(causeText) === 'sockettimeout';
  reportApiOutcome(
    timing,
    isTimeout ? 'timeout' : 'network_error',
    timedOut ? 'timeouterror' : getErrorCode(error, causeText),
  );
}

/**
 * First result of a server-sent event stream: the first result message, or
 * the end of a stream without one, is ok. Later stream errors are not counted.
 * A stream the user abandons after the slow threshold counts as a timeout.
 */
export function reportApiAvailabilityStream(
  timing: IApiAvailabilityTiming | undefined,
  result: 'abandoned' | 'error' | 'ok' | 'timeout',
  httpStatus?: number,
) {
  if (result === 'ok') {
    reportApiOutcome(timing, 'ok');
  } else if (result === 'abandoned') {
    if (timing && getNow() - timing.startedAt >= AVAILABILITY_SLOW_MS) {
      reportApiOutcome(timing, 'timeout', 'sse_abandoned');
    }
  } else if (httpStatus && httpStatus >= 400) {
    reportApiOutcome(timing, 'http_error', `http_${httpStatus}`);
  } else {
    reportApiOutcome(
      timing,
      result === 'timeout' ? 'timeout' : 'network_error',
      `sse_${result}`,
    );
  }
}
