import { ANALYTICS_EVENT_PATH } from '../analytics';
import { defaultLogger } from '../logger/logger';

import type {
  IApiAvailabilityResultParams,
  IWebViewAvailabilityResultParams,
} from '../logger/scopes/app/types';

declare module 'axios' {
  interface AxiosRequestConfig {
    $oneKeyAvailabilityTiming?: IApiAvailabilityTiming;
  }
}

export const API_AVAILABILITY_SAMPLE_RATE = 0.01;
export const IP_TABLE_AVAILABILITY_SAMPLE_RATE = 0.1;
export const WEBVIEW_AVAILABILITY_SAMPLE_RATE = 0.1;

const API_AVAILABILITY_MAX_EVENTS_PER_RUNTIME = 500;
const API_AVAILABILITY_ROUTE_SEGMENT_LIMIT = 3;
const IP_TABLE_AVAILABILITY_MAX_EVENTS_PER_RUNTIME = 200;
const WEBVIEW_AVAILABILITY_MAX_EVENTS_PER_RUNTIME = 200;

let availabilityEventsReported = 0;
let ipTableAvailabilityEventsReported = 0;
let webViewAvailabilityEventsReported = 0;

export type IApiAvailabilityTiming = {
  reported?: boolean;
  startedAt: number;
  target: Pick<IApiAvailabilityResultParams, 'routeGroup' | 'service'>;
};

export type IWebViewAvailabilityTiming = {
  attemptId: string;
  reported?: boolean;
  service: string;
  startedAt: number;
  url: string;
};

export type IIpTableAvailabilityTiming = {
  reported?: boolean;
  service: string;
  startedAt: number;
};

function getTimingNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function normalizeMethod(method: string | undefined) {
  const normalizedMethod = (method ?? 'GET').toUpperCase();
  if (
    normalizedMethod === 'DELETE' ||
    normalizedMethod === 'GET' ||
    normalizedMethod === 'HEAD' ||
    normalizedMethod === 'OPTIONS' ||
    normalizedMethod === 'PATCH' ||
    normalizedMethod === 'POST' ||
    normalizedMethod === 'PUT'
  ) {
    return normalizedMethod;
  }
  return 'OTHER';
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

function getKnownService(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  const firstLabel = normalizedHostname.split('.')[0];

  if (
    normalizedHostname.endsWith('.onekeycn.com') ||
    normalizedHostname.endsWith('.onekeytest.com')
  ) {
    const knownOneKeyServices = new Set([
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
    return knownOneKeyServices.has(firstLabel)
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
  if (/^[a-z][a-z\d._-]{0,31}$/i.test(decodedSegment)) {
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
}): IApiAvailabilityTiming['target'] | undefined {
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

  const service = getKnownService(hostname);
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

export function createApiAvailabilityTiming({
  baseURL,
  url,
}: {
  baseURL?: string;
  url?: string;
}): IApiAvailabilityTiming | undefined {
  if (
    Math.random() >= API_AVAILABILITY_SAMPLE_RATE ||
    availabilityEventsReported >= API_AVAILABILITY_MAX_EVENTS_PER_RUNTIME
  ) {
    return undefined;
  }

  const target = getApiAvailabilityTarget({ baseURL, url });
  if (!target) {
    return undefined;
  }

  return {
    startedAt: getTimingNow(),
    target,
  };
}

export function createWebViewAvailabilityTiming({
  attemptId,
  url,
}: {
  attemptId: string;
  url?: string;
}): IWebViewAvailabilityTiming | undefined {
  if (
    Math.random() >= WEBVIEW_AVAILABILITY_SAMPLE_RATE ||
    webViewAvailabilityEventsReported >=
      WEBVIEW_AVAILABILITY_MAX_EVENTS_PER_RUNTIME
  ) {
    return undefined;
  }
  const urlText = String(url ?? '');
  if (
    !/^https?:\/\//i.test(urlText) ||
    urlText.includes(ANALYTICS_EVENT_PATH)
  ) {
    return undefined;
  }
  let service = 'external-web';
  try {
    service = getKnownService(new URL(urlText).hostname) ?? service;
  } catch {
    return undefined;
  }
  return {
    attemptId,
    service,
    startedAt: getTimingNow(),
    url: urlText,
  };
}

export function createIpTableAvailabilityTiming({
  hostname,
}: {
  hostname: string;
}): IIpTableAvailabilityTiming | undefined {
  if (
    Math.random() >= IP_TABLE_AVAILABILITY_SAMPLE_RATE ||
    ipTableAvailabilityEventsReported >=
      IP_TABLE_AVAILABILITY_MAX_EVENTS_PER_RUNTIME
  ) {
    return undefined;
  }
  const service = getKnownService(hostname);
  if (!service) return undefined;
  return {
    service,
    startedAt: getTimingNow(),
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

export function getAvailabilityErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'unknown';
  }
  const errorDetails = error as {
    className?: unknown;
    code?: unknown;
    name?: unknown;
  };
  return normalizeAvailabilityErrorCode(
    errorDetails.code ?? errorDetails.className ?? errorDetails.name,
  );
}

export function getAvailabilityFailureStatus(error: unknown) {
  const errorDetails = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
  };
  const code = getAvailabilityErrorCode(error);
  const name = String(errorDetails?.name ?? '').toLowerCase();
  const message = String(errorDetails?.message ?? '').toLowerCase();

  if (
    code === 'err_canceled' ||
    name === 'cancelederror' ||
    name === 'aborterror'
  ) {
    return 'cancelled' as const;
  }
  if (
    code === 'econnaborted' ||
    code === 'etimedout' ||
    message.includes('timeout')
  ) {
    return 'timeout' as const;
  }
  return 'network_error' as const;
}

export function reportApiAvailabilityResult({
  errorCode,
  httpStatusCode,
  method,
  responseCode,
  status,
  timing,
}: {
  errorCode?: unknown;
  httpStatusCode?: number;
  method?: string;
  responseCode?: unknown;
  status: IApiAvailabilityResultParams['status'];
  timing: IApiAvailabilityTiming | undefined;
}) {
  if (
    !timing ||
    timing.reported ||
    availabilityEventsReported >= API_AVAILABILITY_MAX_EVENTS_PER_RUNTIME
  ) {
    return;
  }
  timing.reported = true;
  availabilityEventsReported += 1;

  defaultLogger.app.network.apiAvailabilityResult({
    ...timing.target,
    durationMs: Math.max(0, Math.round(getTimingNow() - timing.startedAt)),
    errorCode: normalizeAvailabilityErrorCode(errorCode),
    httpStatusCode: httpStatusCode ?? 0,
    method: normalizeMethod(method),
    responseCode: normalizeAvailabilityErrorCode(responseCode),
    sampleRate: API_AVAILABILITY_SAMPLE_RATE,
    status,
  });
}

export function reportWebViewAvailabilityResult({
  errorCode,
  status,
  timing,
}: {
  errorCode?: unknown;
  status: IWebViewAvailabilityResultParams['status'];
  timing: IWebViewAvailabilityTiming | undefined;
}) {
  if (
    !timing ||
    timing.reported ||
    webViewAvailabilityEventsReported >=
      WEBVIEW_AVAILABILITY_MAX_EVENTS_PER_RUNTIME
  ) {
    return;
  }
  timing.reported = true;
  webViewAvailabilityEventsReported += 1;
  defaultLogger.app.network.webViewAvailabilityResult({
    attemptId: timing.attemptId,
    durationMs: Math.max(0, Math.round(getTimingNow() - timing.startedAt)),
    errorCode: normalizeAvailabilityErrorCode(errorCode),
    sampleRate: WEBVIEW_AVAILABILITY_SAMPLE_RATE,
    service: timing.service,
    status,
  });
}

export function reportIpTableAvailabilityResult({
  errorCode,
  fallbackStatus,
  sniErrorCode,
  sniStatus,
  status,
  timing,
}: {
  errorCode?: unknown;
  fallbackStatus: 'failed' | 'not_attempted' | 'success';
  sniErrorCode?: unknown;
  sniStatus: 'failed' | 'fail_closed' | 'null' | 'success';
  status: 'failed' | 'success';
  timing: IIpTableAvailabilityTiming | undefined;
}) {
  if (
    !timing ||
    timing.reported ||
    ipTableAvailabilityEventsReported >=
      IP_TABLE_AVAILABILITY_MAX_EVENTS_PER_RUNTIME
  ) {
    return;
  }
  timing.reported = true;
  ipTableAvailabilityEventsReported += 1;
  defaultLogger.ipTable.request.availabilityResult({
    durationMs: Math.max(0, Math.round(getTimingNow() - timing.startedAt)),
    errorCode: normalizeAvailabilityErrorCode(errorCode),
    fallbackStatus,
    sampleRate: IP_TABLE_AVAILABILITY_SAMPLE_RATE,
    service: timing.service,
    sniErrorCode: normalizeAvailabilityErrorCode(sniErrorCode),
    sniStatus,
    status,
  });
}
