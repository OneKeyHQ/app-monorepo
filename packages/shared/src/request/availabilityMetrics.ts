/**
 * Classification of API request outcomes for availability metrics.
 *
 * Only allowlisted hosts are counted. Only enums, digit-free route segments
 * and normalized error codes are recorded: never URLs, query strings,
 * hostnames, proxy settings or free-form messages. Travel mode is not a
 * dimension because analytics is not initialized while it is on.
 */
import { EServiceEndpointEnum } from '../../types/endpoint';
import { ANALYTICS_EVENT_PATH } from '../analytics';
import {
  ONEKEY_API_HOST,
  ONEKEY_HEALTH_CHECK_URL,
  ONEKEY_TEST_API_HOST,
} from '../config/appConfig';

import { recordAvailabilityOutcome } from './availabilityAggregator';
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
 * - none: the request ended before the adapter picked a route
 */
export type IAvailabilityRoute =
  | 'direct'
  | 'domain'
  | 'fallback'
  | 'none'
  | 'sni';

export type IAvailabilityIpTableState =
  | 'disabled'
  | 'enabled'
  | 'no_config'
  | 'unknown';

export type IApiAvailabilityTiming = {
  startedAt: number;
  service: string;
  routeGroup: string;
  route?: IAvailabilityRoute;
  /** Result of the adapter's proxy preflight for this request. */
  proxyActive?: boolean | null;
  reported?: boolean;
};

const ONEKEY_API_SERVICES = new Set<string>(
  Object.values(EServiceEndpointEnum),
);

// OneKeyError instances created without an explicit code carry this default.
const ONEKEY_DEFAULT_ERROR_CODE = -99_999;

let ipTableState: IAvailabilityIpTableState = 'unknown';

function getNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getService(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host.endsWith(`.${ONEKEY_API_HOST}`) ||
    host.endsWith(`.${ONEKEY_TEST_API_HOST}`)
  ) {
    const label = host.split('.')[0];
    return ONEKEY_API_SERVICES.has(label) ? label : 'onekey-api-other';
  }
  if (host === 'api.hyperliquid.xyz') return 'hyperliquid';
  if (host.endsWith('.supabase.co')) return 'supabase';
  if (host === 'onekey.so' || host.endsWith('.onekey.so')) return 'onekey-web';
  if (host === 'onekey-asset.com' || host.endsWith('.onekey-asset.com')) {
    return 'onekey-asset';
  }
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

function getErrorCode(error: unknown) {
  const { code, className, name } = (error ?? {}) as {
    code?: unknown;
    className?: unknown;
    name?: unknown;
  };
  return normalizeErrorCode(
    code === undefined || code === ONEKEY_DEFAULT_ERROR_CODE
      ? (className ?? name)
      : code,
  );
}

function getNetworkType() {
  const type = getAvailabilityNetworkType();
  switch (typeof type === 'string' ? type.toLowerCase() : 'unknown') {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'ethernet':
      return 'ethernet';
    case 'none':
      return 'offline';
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
    const parsed = new URL(text ?? '');
    const service = getService(parsed.hostname);
    // Analytics delivery and reachability probes are not API traffic.
    if (
      !service ||
      parsed.pathname.includes(ANALYTICS_EVENT_PATH) ||
      parsed.pathname === ONEKEY_HEALTH_CHECK_URL
    ) {
      return undefined;
    }
    // Started on the first counted request so the async native seed usually
    // resolves before that request settles.
    startAvailabilityNetworkTypeTracking();
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .slice(0, 3)
      .map(sanitizeRouteSegment);
    return {
      startedAt: getNow(),
      service,
      routeGroup: `/${segments.join('/')}`,
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
    failure:
      status === 'ok'
        ? undefined
        : {
            detail: `${route}:${timing.routeGroup}`,
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
  recordAvailabilityOutcome({
    source: 'api_net',
    target: getNetworkType(),
    status: result,
  });
  // Route, proxy and IP Table state only apply to requests the IP Table
  // adapter handled; it always sets a route.
  if (!timing.route) return;
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
  } else if (isOneKeyApi && apiCode !== 0) {
    reportApiOutcome(timing, 'api_error', `api_${normalizeErrorCode(apiCode)}`);
  } else {
    reportApiOutcome(timing, 'ok');
  }
}

/** A rejected request. Cancellations are not availability outcomes. */
export function reportApiAvailabilityError(
  timing: IApiAvailabilityTiming | undefined,
  error: unknown,
) {
  const { code, name, message, response } = (error ?? {}) as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
    response?: { status?: number };
  };
  if (
    code === 'ERR_CANCELED' ||
    code === 'SNI_CANCELLED' ||
    name === 'CanceledError' ||
    name === 'AbortError'
  ) {
    return;
  }
  if (response?.status) {
    reportApiOutcome(timing, 'http_error', `http_${response.status}`);
    return;
  }
  const isTimeout =
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    String(message ?? '')
      .toLowerCase()
      .includes('timeout');
  reportApiOutcome(
    timing,
    isTimeout ? 'timeout' : 'network_error',
    getErrorCode(error),
  );
}
