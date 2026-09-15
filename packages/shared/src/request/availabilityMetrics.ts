/**
 * Classification and sanitization helpers for client availability metrics.
 *
 * Every helper here only records into availabilityAggregator; none of them
 * emits an analytics event directly. See availabilityAggregator.ts for the
 * aggregation, budget and runtime-scope rules.
 */
import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { ANALYTICS_EVENT_PATH } from '../analytics';
import errorToastUtils from '../errors/utils/errorToastUtils';

import {
  recordAvailabilityOutcome,
  startAvailabilityFlow,
} from './availabilityAggregator';
import {
  getAvailabilityHostname,
  getAvailabilityIpTableState,
  getAvailabilityNetworkType,
  getAvailabilityProxyState,
  isAvailabilityIpTableRuntime,
  startAvailabilityContextTracking,
  toAvailabilityProxyState,
} from './availabilityContext';

import type {
  IAvailabilityFlow,
  IAvailabilityFlowResult,
  IAvailabilityStatus,
} from './availabilityAggregator';
import type {
  IAvailabilityProxyState,
  IAvailabilityRoute,
} from './availabilityContext';

export {
  normalizeAvailabilityToken,
  startAvailabilityFlow,
} from './availabilityAggregator';
export type {
  IAvailabilityFlow,
  IAvailabilityFlowHandle,
  IAvailabilityFlowResult,
  IAvailabilityStatus,
} from './availabilityAggregator';

declare module 'axios' {
  interface AxiosRequestConfig {
    $oneKeyAvailabilityTiming?: IApiAvailabilityTiming;
  }
}

const API_AVAILABILITY_ROUTE_SEGMENT_LIMIT = 3;

/**
 * Set on axios `fetchOptions` by the axios interceptor. The axios fetch
 * adapter (used where XMLHttpRequest is missing, e.g. the MV3 extension
 * service worker) forwards it to the patched global fetch, which then skips
 * counting the same request a second time.
 */
export const AVAILABILITY_TRACKED_FETCH_OPTION = '$oneKeyAvailabilityTracked';

export type IApiAvailabilityStatus =
  | 'api_error'
  | 'cancelled'
  | 'http_error'
  | 'network_error'
  | 'ok'
  | 'timeout';

export type IApiAvailabilityTarget = {
  routeGroup: string;
  service: string;
};

export type IApiAvailabilityTiming = {
  reported?: boolean;
  startedAt: number;
  target: IApiAvailabilityTarget;
  /** Set by the IP Table adapter; requests without it took the direct path. */
  route?: IAvailabilityRoute;
  /** Proxy preflight of this request, when the IP Table adapter ran one. */
  proxy?: IAvailabilityProxyState;
  /** In memory only, to look up a same-host proxy preflight; never reported. */
  hostname?: string;
};

export type IWebViewAvailabilityStatus =
  | 'cancelled'
  | 'http_error'
  | 'network_error'
  | 'ok'
  | 'timeout';

export type IWebViewAvailabilityTiming = {
  reported?: boolean;
  service: string;
  startedAt: number;
  url: string;
};

export type IIpTableAvailabilityStatus =
  | 'blocked'
  | 'cancelled'
  | 'fail_closed'
  | 'fallback_failed'
  | 'fallback_ok'
  | 'ok';

export type IIpTableAvailabilityTiming = {
  reported?: boolean;
  routeGroup: string;
  service: string;
  startedAt: number;
};

function getTimingNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getElapsedMs(startedAt: number) {
  return Math.max(0, Math.round(getTimingNow() - startedAt));
}

function getUrlText({ baseURL, url }: { baseURL?: string; url?: string }) {
  const rawUrl = String(url ?? '');
  const rawBaseURL = String(baseURL ?? '');
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  if (/^https?:\/\//i.test(rawBaseURL)) {
    try {
      return new URL(rawUrl, `${rawBaseURL.replace(/\/$/, '')}/`).href;
    } catch {
      return rawUrl || rawBaseURL;
    }
  }
  return rawUrl || rawBaseURL;
}

const KNOWN_ONEKEY_API_SERVICES = new Set([
  'earn',
  'lightning',
  'notification',
  'prime',
  'rebate',
  'swap',
  'transfer',
  'utility',
  'wallet',
]);

function getKnownAvailabilityService(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  const firstLabel = normalizedHostname.split('.')[0];

  if (
    normalizedHostname.endsWith('.onekeycn.com') ||
    normalizedHostname.endsWith('.onekeytest.com')
  ) {
    return KNOWN_ONEKEY_API_SERVICES.has(firstLabel)
      ? firstLabel
      : 'onekey-api-other';
  }
  if (normalizedHostname === 'relay.walletconnect.com') {
    return 'walletconnect';
  }
  if (normalizedHostname === 'api.hyperliquid.xyz') {
    return 'hyperliquid';
  }
  if (normalizedHostname.endsWith('.supabase.co')) {
    return 'supabase';
  }
  if (
    normalizedHostname === 'onekey.so' ||
    normalizedHostname.endsWith('.onekey.so')
  ) {
    return 'onekey-web';
  }
  if (
    normalizedHostname === 'onekey-asset.com' ||
    normalizedHostname.endsWith('.onekey-asset.com')
  ) {
    return 'onekey-asset';
  }
  return undefined;
}

function sanitizeRouteSegment(segment: string) {
  const decodedSegment = (() => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  })();
  // Ids (hex, base58, numeric, uuid) almost always contain digits and must
  // not reach analytics: keep only short letter-only literals plus version
  // segments such as `v1`.
  if (
    /^[a-z][a-z._-]{0,31}$/i.test(decodedSegment) ||
    /^v\d{1,2}$/i.test(decodedSegment)
  ) {
    return decodedSegment.toLowerCase();
  }
  return ':id';
}

export function getApiAvailabilityTarget({
  baseURL,
  url,
}: {
  baseURL?: string;
  url?: string;
}): IApiAvailabilityTarget | undefined {
  const urlText = getUrlText({ baseURL, url });
  if (!urlText || urlText.includes(ANALYTICS_EVENT_PATH)) {
    return undefined;
  }

  let hostname = '';
  let pathname = urlText.split(/[?#]/, 1)[0];
  try {
    const parsedUrl = new URL(urlText);
    hostname = parsedUrl.hostname;
    pathname = parsedUrl.pathname;
  } catch {
    if (/^https?:\/\//i.test(urlText)) {
      return undefined;
    }
  }

  const service = getKnownAvailabilityService(hostname);
  if (!service) {
    return undefined;
  }

  const routeSegments = pathname
    .split('/')
    .filter(Boolean)
    .slice(0, API_AVAILABILITY_ROUTE_SEGMENT_LIMIT)
    .map(sanitizeRouteSegment);

  return {
    routeGroup: routeSegments.length ? `/${routeSegments.join('/')}` : '/',
    service,
  };
}

export function normalizeAvailabilityErrorCode(errorCode: unknown) {
  if (typeof errorCode === 'number' && Number.isFinite(errorCode)) {
    return String(errorCode);
  }
  if (typeof errorCode === 'string' && /^[a-z\d_-]{1,32}$/i.test(errorCode)) {
    return errorCode.toLowerCase();
  }
  return 'unknown';
}

// OneKeyError instances created without an explicit code carry this default.
const ONEKEY_DEFAULT_ERROR_CODE = -99_999;

export function getAvailabilityErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'unknown';
  }
  const errorDetails = error as {
    className?: unknown;
    code?: unknown;
    name?: unknown;
  };
  const code =
    errorDetails.code === ONEKEY_DEFAULT_ERROR_CODE
      ? undefined
      : errorDetails.code;
  return normalizeAvailabilityErrorCode(
    code ?? errorDetails.className ?? errorDetails.name ?? errorDetails.code,
  );
}

const HARDWARE_TIMEOUT_ERROR_CODES = new Set<unknown>([
  HardwareErrorCode.IframeTimeout,
  HardwareErrorCode.BleTimeoutError,
  HardwareErrorCode.BridgeTimeoutError,
  HardwareErrorCode.PollingTimeout,
]);

const HARDWARE_CANCEL_ERROR_CODES = new Set<unknown>([
  HardwareErrorCode.ActionCancelled,
  HardwareErrorCode.PinCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
]);

/**
 * True for user-initiated cancellations: aborted requests (axios, fetch, SNI),
 * dismissed password / login / QR dialogs, and hardware-side rejections.
 * These are not availability failures. Never mutates the error.
 */
export function isAvailabilityCancelError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const errorDetails = error as { code?: unknown; name?: unknown };
  const code = getAvailabilityErrorCode(error);
  const name = String(errorDetails.name ?? '').toLowerCase();
  return (
    code === 'err_canceled' ||
    code === 'sni_cancelled' ||
    name === 'cancelederror' ||
    name === 'aborterror' ||
    HARDWARE_CANCEL_ERROR_CODES.has(errorDetails.code) ||
    errorToastUtils.hasUserCancelStyleClassName(error)
  );
}

export function getAvailabilityFailureStatus(
  error: unknown,
): 'cancelled' | 'network_error' | 'timeout' {
  if (isAvailabilityCancelError(error)) {
    return 'cancelled';
  }
  const errorDetails = error as
    | { code?: unknown; error?: unknown; message?: unknown }
    | undefined;
  const code = getAvailabilityErrorCode(error);
  // Hardware SDK failure payloads carry their text in `error`.
  const message = String(
    errorDetails?.message ?? errorDetails?.error ?? '',
  ).toLowerCase();
  if (
    code === 'econnaborted' ||
    code === 'etimedout' ||
    HARDWARE_TIMEOUT_ERROR_CODES.has(errorDetails?.code) ||
    message.includes('timeout')
  ) {
    return 'timeout';
  }
  return 'network_error';
}

export function getAvailabilityFlowFailureStatus(
  error: unknown,
): 'cancelled' | 'failed' | 'timeout' {
  const status = getAvailabilityFailureStatus(error);
  return status === 'network_error' ? 'failed' : status;
}

export function getAvailabilityFlowErrorResult(
  error: unknown,
  detail?: string,
): IAvailabilityFlowResult {
  return {
    status: getAvailabilityFlowFailureStatus(error),
    errorCode: getAvailabilityErrorCode(error),
    detail,
  };
}

/**
 * Wraps an async user flow with started/outcome counters. The flow result and
 * error are passed through unchanged; classification callbacks and recording
 * can never throw into the flow.
 */
export async function withAvailabilityFlow<T>(
  flow: IAvailabilityFlow,
  run: () => Promise<T>,
  options?: {
    detail?: string;
    trackUnfinished?: boolean;
    onSuccess?: (result: T) => IAvailabilityFlowResult | undefined;
    onError?: (error: unknown) => IAvailabilityFlowResult | undefined;
  },
): Promise<T> {
  const handle = startAvailabilityFlow(flow, {
    detail: options?.detail,
    trackUnfinished: options?.trackUnfinished,
  });
  let result: T;
  try {
    result = await run();
  } catch (error) {
    let errorResult: IAvailabilityFlowResult | undefined;
    try {
      errorResult = options?.onError?.(error);
    } catch {
      errorResult = undefined;
    }
    handle.finish(
      errorResult ?? getAvailabilityFlowErrorResult(error, options?.detail),
    );
    throw error;
  }
  let successResult: IAvailabilityFlowResult | undefined;
  try {
    successResult = options?.onSuccess?.(result);
  } catch {
    successResult = undefined;
  }
  handle.finish(successResult ?? { status: 'ok' });
  return result;
}

export function createApiAvailabilityTiming({
  baseURL,
  url,
}: {
  baseURL?: string;
  url?: string;
}): IApiAvailabilityTiming | undefined {
  try {
    const target = getApiAvailabilityTarget({ baseURL, url });
    if (!target) {
      return undefined;
    }
    // Start context tracking when the first request starts, so the async
    // network type seed usually resolves before that request settles.
    startAvailabilityContextTracking();
    return {
      startedAt: getTimingNow(),
      target,
      hostname: getAvailabilityHostname(getUrlText({ baseURL, url })),
    };
  } catch {
    return undefined;
  }
}

export function markApiAvailabilityRoute(
  timing: IApiAvailabilityTiming | undefined,
  route: IAvailabilityRoute,
) {
  if (timing && !timing.reported) {
    timing.route = route;
  }
}

export function markApiAvailabilityProxy(
  timing: IApiAvailabilityTiming | undefined,
  proxyActive: boolean | null | undefined,
) {
  if (timing && !timing.reported) {
    timing.proxy = toAvailabilityProxyState(proxyActive);
  }
}

/**
 * Records one API outcome plus its context breakdowns. The per-service
 * series keeps every status (including cancelled) and the failure detail is
 * prefixed with the route. Context breakdowns count only settled requests as
 * `ok`, `error` (the server answered: api_error / http_error) or `failed`
 * (transport did not settle: network_error / timeout) per network type,
 * proxy state and IP Table state; the route breakdown keeps full statuses
 * and durations so SNI and domain latency can be compared. Route, proxy and
 * IP Table breakdowns are skipped where no IP Table adapter can run (web,
 * extension), because they would be constant there.
 */
export function reportApiAvailabilityResult({
  errorCode,
  httpStatusCode,
  responseCode,
  status,
  timing,
}: {
  errorCode?: unknown;
  httpStatusCode?: number;
  responseCode?: unknown;
  status: IApiAvailabilityStatus;
  timing: IApiAvailabilityTiming | undefined;
}) {
  if (!timing || timing.reported) {
    return;
  }
  timing.reported = true;
  let normalizedErrorCode: string | undefined;
  if (status === 'api_error') {
    normalizedErrorCode = `api_${normalizeAvailabilityErrorCode(responseCode)}`;
  } else if (status === 'http_error') {
    normalizedErrorCode = `http_${normalizeAvailabilityErrorCode(
      httpStatusCode,
    )}`;
  } else if (status !== 'ok') {
    normalizedErrorCode = normalizeAvailabilityErrorCode(errorCode);
  }
  const durationMs = getElapsedMs(timing.startedAt);
  const route = timing.route ?? 'direct';
  recordAvailabilityOutcome({
    source: 'api',
    target: timing.target.service,
    status,
    durationMs,
    detail: `${route}:${timing.target.routeGroup}`,
    errorCode: normalizedErrorCode,
  });
  const hasIpTableContext = isAvailabilityIpTableRuntime();
  if (hasIpTableContext) {
    recordAvailabilityOutcome({
      source: 'api_route',
      target: route,
      status,
      durationMs,
    });
  }
  if (status === 'cancelled') {
    return;
  }
  let settledStatus: Extract<IAvailabilityStatus, 'error' | 'failed' | 'ok'>;
  if (status === 'ok') {
    settledStatus = 'ok';
  } else if (status === 'api_error' || status === 'http_error') {
    settledStatus = 'error';
  } else {
    settledStatus = 'failed';
  }
  recordAvailabilityOutcome({
    source: 'api_net',
    target: getAvailabilityNetworkType(),
    status: settledStatus,
  });
  if (!hasIpTableContext) {
    return;
  }
  recordAvailabilityOutcome({
    source: 'api_proxy',
    target: timing.proxy ?? getAvailabilityProxyState(timing.hostname),
    status: settledStatus,
  });
  recordAvailabilityOutcome({
    source: 'api_ip_table',
    target: getAvailabilityIpTableState(),
    status: settledStatus,
  });
}

export function createWebViewAvailabilityTiming({
  url,
}: {
  url?: string;
}): IWebViewAvailabilityTiming | undefined {
  const urlText = String(url ?? '');
  if (
    !/^https?:\/\//i.test(urlText) ||
    urlText.includes(ANALYTICS_EVENT_PATH)
  ) {
    return undefined;
  }
  let service = 'external-web';
  try {
    service = getKnownAvailabilityService(new URL(urlText).hostname) ?? service;
  } catch {
    return undefined;
  }
  return {
    service,
    startedAt: getTimingNow(),
    url: urlText,
  };
}

export function reportWebViewAvailabilityResult({
  errorCode,
  status,
  timing,
}: {
  errorCode?: unknown;
  status: IWebViewAvailabilityStatus;
  timing: IWebViewAvailabilityTiming | undefined;
}) {
  if (!timing || timing.reported) {
    return;
  }
  timing.reported = true;
  recordAvailabilityOutcome({
    source: 'webview',
    target: timing.service,
    status,
    durationMs: getElapsedMs(timing.startedAt),
    errorCode:
      status === 'ok' ? undefined : normalizeAvailabilityErrorCode(errorCode),
  });
}

/**
 * Render process loss is counted whether or not a navigation is in flight:
 * most crashes happen after a page finished loading.
 */
export function reportWebViewRenderProcessGone({
  didCrash,
  url,
}: {
  didCrash: boolean;
  url?: string;
}) {
  let service = 'external-web';
  try {
    if (url && /^https?:\/\//i.test(url)) {
      service = getKnownAvailabilityService(new URL(url).hostname) ?? service;
    }
  } catch {
    service = 'external-web';
  }
  recordAvailabilityOutcome({
    source: 'webview',
    target: service,
    status: 'render_process_gone',
    errorCode: didCrash ? 'crashed' : 'terminated',
  });
}

export function createIpTableAvailabilityTiming({
  baseURL,
  hostname,
  url,
}: {
  baseURL?: string;
  hostname: string;
  url?: string;
}): IIpTableAvailabilityTiming | undefined {
  try {
    const service = getKnownAvailabilityService(hostname);
    if (!service) {
      return undefined;
    }
    const pathText = `${baseURL ?? ''} ${url ?? ''}`;
    // The analytics client itself goes through the IP Table adapter; counting
    // its delivery requests would make the metric measure itself.
    if (pathText.includes(ANALYTICS_EVENT_PATH)) {
      return undefined;
    }
    const target = getApiAvailabilityTarget({
      baseURL: baseURL ?? `https://${hostname}`,
      url,
    });
    return {
      routeGroup: target?.routeGroup ?? '/',
      service,
      startedAt: getTimingNow(),
    };
  } catch {
    return undefined;
  }
}

export function reportIpTableAvailabilityResult({
  fallbackErrorCode,
  sniErrorCode,
  status,
  timing,
}: {
  fallbackErrorCode?: unknown;
  sniErrorCode?: unknown;
  status: IIpTableAvailabilityStatus;
  timing: IIpTableAvailabilityTiming | undefined;
}) {
  if (!timing || timing.reported) {
    return;
  }
  timing.reported = true;
  let errorCode: string | undefined;
  if (status === 'fallback_failed') {
    errorCode = `${normalizeAvailabilityErrorCode(
      sniErrorCode,
    )}-${normalizeAvailabilityErrorCode(fallbackErrorCode)}`;
  } else if (status !== 'ok') {
    errorCode = normalizeAvailabilityErrorCode(sniErrorCode);
  }
  recordAvailabilityOutcome({
    source: 'sni',
    target: timing.service,
    status,
    durationMs: getElapsedMs(timing.startedAt),
    detail: timing.routeGroup,
    errorCode,
  });
}

export function recordWebSocketConnectResult({
  durationMs,
  errorCode,
  status,
  transport,
  trigger,
}: {
  durationMs: number;
  errorCode?: unknown;
  status: Extract<
    IAvailabilityStatus,
    'cancelled' | 'failed' | 'ok' | 'timeout'
  >;
  transport: 'notification_market' | 'perps';
  trigger: 'initial' | 'reconnect';
}) {
  recordAvailabilityOutcome({
    source: 'ws_connect',
    target: transport,
    status,
    durationMs,
    detail: trigger,
    errorCode:
      status === 'ok' ? undefined : normalizeAvailabilityErrorCode(errorCode),
  });
}

export function recordWebSocketClosed({
  reason,
  transport,
}: {
  reason: Extract<
    IAvailabilityStatus,
    | 'client_disconnect'
    | 'ping_timeout'
    | 'server_disconnect'
    | 'transport_close'
    | 'transport_error'
    | 'unknown'
  >;
  transport: 'notification_market' | 'perps';
}) {
  recordAvailabilityOutcome({
    source: 'ws_close',
    target: transport,
    status: reason,
  });
}
