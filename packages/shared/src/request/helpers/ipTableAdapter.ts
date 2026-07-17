import axios, { AxiosHeaders } from 'axios';

import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import platformEnv from '../../platformEnv';
import { memoizee } from '../../utils/cacheUtils';
import {
  DEFAULT_IP_TABLE_CONFIG,
  IP_TABLE_ADAPTER_FAILOVER_TTL_MS,
  IP_TABLE_DOMAIN_FAILOVER_THRESHOLD,
} from '../constants/ipTableDefaults';
import { getRequestHeaders } from '../Interceptor';
import requestHelper from '../requestHelper';

import { isSniFailClosedError } from './sniFailClosedError';
import { redactIpLiterals, safeSniLogValue } from './sniLogRedaction';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

import type {
  AxiosAdapter,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

/**
 * Debug logging helper - only logs in development mode
 */
const debugLog = (..._args: any[]) => {
  // Intentionally no-op. Production diagnostics must go through defaultLogger.
};
const debugWarn = (..._args: any[]) => {
  // Intentionally no-op. Production diagnostics must go through defaultLogger.
};
const debugError = (..._args: any[]) => {
  // Intentionally no-op. Production diagnostics must go through defaultLogger.
};

type IpTableLogLevel = 'info' | 'warn' | 'error';

function hashForLog(value: string | null | undefined): string {
  if (!value) return 'none';
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function getSniLogPlatform(): string {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  if (platformEnv.isDesktop) return 'desktop';
  if (platformEnv.isExtension) return 'extension';
  if (platformEnv.isRuntimeBrowser) return 'web';
  return 'unknown';
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'none';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatLogEvent(
  event: string,
  fields: Record<string, unknown> = {},
): string {
  return Object.entries({ event, ...fields })
    .map(([key, value]) => `${key}=${safeSniLogValue(value)}`)
    .join(' ');
}

function logIpTableEvent(
  level: IpTableLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const info = `[IpTableAdapter] ${formatLogEvent(event, fields)}`;
  if (level === 'error') {
    defaultLogger.ipTable.request.error({ info });
  } else if (level === 'warn') {
    defaultLogger.ipTable.request.warn({ info });
  } else {
    defaultLogger.ipTable.request.info({ info });
  }
}

/**
 * Request failure callback parameters
 */
interface IRequestFailureParams {
  /** Root domain (e.g., "onekey.so") */
  domain: string;
  /** 'ip' for SNI request failure, 'domain' for direct domain request failure */
  requestType: 'ip' | 'domain';
  /** IP address for SNI request, or hostname for domain request */
  target: string;
  /** Error message */
  error: string;
}

let reportRequestFailureCallback:
  | ((params: IRequestFailureParams) => void)
  | null = null;

/**
 * Request success callback parameters. Successes must flow to the service so
 * its consecutive-failure counters reset on real recovery instead of only
 * ever incrementing.
 */
interface IRequestSuccessParams {
  domain: string;
  requestType: 'ip' | 'domain';
  target: string;
}

let reportRequestSuccessCallback:
  | ((params: IRequestSuccessParams) => void)
  | null = null;

export function setReportRequestSuccessCallback(
  callback: (params: IRequestSuccessParams) => void,
) {
  reportRequestSuccessCallback = callback;
}

/**
 * Once a request has been handed to the SNI transport it may have reached
 * the server even when we got no usable response back. Re-sending it over
 * the domain is only safe for idempotent methods, or when the error code
 * proves the connection was never established (nothing was written).
 */
const IDEMPOTENT_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const SNI_PRE_WRITE_ERROR_CODES = new Set([
  'SNI_CONNECTION_REFUSED',
  'SNI_DNS_FAILED',
  'SNI_NETWORK_UNREACHABLE',
  'SNI_INVALID_URL',
]);

function canFallbackAfterSniStarted(method: string, error?: unknown): boolean {
  if (IDEMPOTENT_HTTP_METHODS.has(method.toUpperCase())) {
    return true;
  }
  if (error && SNI_PRE_WRITE_ERROR_CODES.has(getErrorCode(error))) {
    return true;
  }
  return false;
}

/**
 * Extract root domain from hostname
 * Example: wallet.example.com -> example.com
 * Example: api.example.so -> example.so
 */
function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

/**
 * Domains that should use the current API environment's IP configuration
 * These domains don't have their own IP Table config, but share the same
 * infrastructure as the main API domains (onekeycn.com/onekeytest.com)
 */
const SHARED_IP_DOMAINS = new Set(['onekey.so']);

/**
 * Get the mapped domain for IP lookup
 * For domains in SHARED_IP_DOMAINS, use the current API environment's domain
 */
async function getMappedDomainForIpLookup(
  rootDomain: string,
): Promise<string | null> {
  if (!SHARED_IP_DOMAINS.has(rootDomain)) {
    return null;
  }

  try {
    const { getEndpointsMap } = await import('../../config/endpointsMap');
    const { ONEKEY_API_HOST, ONEKEY_TEST_API_HOST } =
      await import('../../config/appConfig');
    const endpointsMap = await getEndpointsMap();
    const isTestEnv = endpointsMap.wallet?.includes(ONEKEY_TEST_API_HOST);
    return isTestEnv ? ONEKEY_TEST_API_HOST : ONEKEY_API_HOST;
  } catch {
    return null;
  }
}

// getSelectedIpForHostInternal is a hoisted function declaration, so wiring
// the memoized wrapper up here (before the fail-open helpers that clear its
// cache) is safe at module-evaluation time.
const getSelectedIpForHost = memoizee(getSelectedIpForHostInternal, {
  promise: true,
  maxAge: 5000, // 5 seconds cache
  max: 100, // Max 100 hostname cached
  primitive: true, // hostname is a string primitive, use simple equality check
});

// ========== Fail-open on domain network failures ==========
//
// When real requests on the direct domain keep failing at the transport
// level (timeouts, resets — NOT HTTP error responses or cancellations), the
// adapter opens a time-boxed window during which hosts of that root domain
// resolve to a fallback IP (runtime last-best IP when available, builtin
// config otherwise). This is the only protection available in runtimes where
// the simpleDb-backed config is absent: the main runtime on split-runtime
// targets and the cold-start window before background init completes.
// The request that trips the threshold is never replayed — only subsequent
// requests take the fail-open route — and once a request has been handed to
// the SNI transport, falling back to the domain (which re-sends it) is
// restricted to idempotent methods or provably-unsent errors; see
// canFallbackAfterSniStarted.

interface IHostFailureRecord {
  consecutive: number;
  lastFailureAt: number;
}

interface IAdapterFailoverState {
  /** Consecutive transport failures tracked per hostname, not per root domain */
  hostFailures: Map<string, IHostFailureRecord>;
  failOpenUntil: number;
  activatedAt: number;
  /** Hostnames whose failures opened the circuit; only they may close it early */
  activatedHostnames: Set<string>;
  /** Rotates across activations so a dead builtin endpoint is not retried forever */
  fallbackIpIndex: number;
}

const adapterFailoverStates = new Map<string, IAdapterFailoverState>();

/** Test-only helper: clears fail-open state and the selection memo cache. */
export function resetAdapterFailoverStatesForTesting(): void {
  adapterFailoverStates.clear();
  getSelectedIpForHost.clear();
}

/**
 * Transport-level failure allowlist. Only errors that prove the network path
 * itself is broken may open the circuit. Cancellations (AbortController,
 * axios dedup, page unload) and HTTP error responses must never count: a
 * cancel says nothing about the network, and a response proves it works.
 */
const TRANSPORT_ERROR_CODES = new Set([
  'ERR_NETWORK', // axios v1 generic network failure (xhr/fetch)
  'ECONNABORTED', // axios timeout
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
]);

function isTransportLevelError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  if (axios.isCancel(error)) {
    return false;
  }
  if ('response' in error && (error as { response?: unknown }).response) {
    return false;
  }
  const code = getErrorCode(error);
  return TRANSPORT_ERROR_CODES.has(code);
}

async function isFailoverDisabledByDevSettings(): Promise<boolean> {
  try {
    const devSettings = await requestHelper.getDevSettingsPersistAtom();
    return !!devSettings.settings?.disableIpTableFailover;
  } catch {
    // Default to enabled when dev settings are unreadable.
    return false;
  }
}

function getFailoverState(lookupDomain: string): IAdapterFailoverState {
  let state = adapterFailoverStates.get(lookupDomain);
  if (!state) {
    state = {
      hostFailures: new Map(),
      failOpenUntil: 0,
      activatedAt: 0,
      activatedHostnames: new Set(),
      fallbackIpIndex: 0,
    };
    adapterFailoverStates.set(lookupDomain, state);
  }
  return state;
}

function isFailoverActive(lookupDomain: string): boolean {
  const state = adapterFailoverStates.get(lookupDomain);
  return Boolean(state && state.failOpenUntil > Date.now());
}

function deactivateFailover(lookupDomain: string, cause: string): void {
  const state = adapterFailoverStates.get(lookupDomain);
  if (!state) {
    return;
  }
  if (state.failOpenUntil > Date.now()) {
    logIpTableEvent('info', 'adapter_failover_deactivated', {
      lookupDomain,
      cause,
    });
    defaultLogger.ipTable.metrics.adapterFailover({
      lookupDomain,
      action: 'deactivated',
    });
  }
  state.hostFailures.clear();
  state.failOpenUntil = 0;
  state.activatedAt = 0;
  state.activatedHostnames.clear();
  getSelectedIpForHost.clear();
}

async function resolveFailoverLookupDomain(
  rootDomain: string,
): Promise<string> {
  const mappedDomain = await getMappedDomainForIpLookup(rootDomain);
  return mappedDomain || rootDomain;
}

async function recordDomainRequestOutcome(options: {
  rootDomain: string;
  hostname: string;
  ok: boolean;
  /** Date.now() captured when the request was handed to the transport */
  startedAtMs: number;
  error?: unknown;
}): Promise<void> {
  const { rootDomain, hostname, ok, startedAtMs, error } = options;
  const lookupDomain = await resolveFailoverLookupDomain(rootDomain);
  const state = getFailoverState(lookupDomain);

  if (ok) {
    const hostFailure = state.hostFailures.get(hostname);
    // A success only proves the path that was exercised: it resets its own
    // hostname's counter, and it may close the circuit only when it comes
    // from a hostname that opened it AND started after activation (a
    // long-in-flight request resolving late says nothing about recovery).
    if (hostFailure && startedAtMs >= hostFailure.lastFailureAt) {
      state.hostFailures.delete(hostname);
    }
    if (
      state.failOpenUntil > Date.now() &&
      state.activatedHostnames.has(hostname) &&
      startedAtMs >= state.activatedAt
    ) {
      deactivateFailover(lookupDomain, 'domain_recovered');
    }
    return;
  }

  if (!isTransportLevelError(error)) {
    return;
  }
  if (await isFailoverDisabledByDevSettings()) {
    return;
  }

  const now = Date.now();
  const hostFailure = state.hostFailures.get(hostname) ?? {
    consecutive: 0,
    lastFailureAt: 0,
  };
  hostFailure.consecutive += 1;
  hostFailure.lastFailureAt = now;
  state.hostFailures.set(hostname, hostFailure);

  if (hostFailure.consecutive >= IP_TABLE_DOMAIN_FAILOVER_THRESHOLD) {
    state.activatedHostnames.add(hostname);
    if (state.failOpenUntil <= now) {
      state.failOpenUntil = now + IP_TABLE_ADAPTER_FAILOVER_TTL_MS;
      state.activatedAt = now;
      state.fallbackIpIndex += 1;
      getSelectedIpForHost.clear();
      logIpTableEvent('warn', 'adapter_failover_activated', {
        lookupDomain,
        hostname,
        consecutiveNetworkFailures: hostFailure.consecutive,
        ttlMs: IP_TABLE_ADAPTER_FAILOVER_TTL_MS,
      });
      defaultLogger.ipTable.metrics.adapterFailover({
        lookupDomain,
        action: 'activated',
      });
    }
  }
}

function getFailoverFallbackIp(lookupDomain: string): string | null {
  const endpoints = DEFAULT_IP_TABLE_CONFIG.domains[lookupDomain]?.endpoints;
  if (!endpoints || endpoints.length === 0) {
    return null;
  }
  const state = getFailoverState(lookupDomain);
  return endpoints[state.fallbackIpIndex % endpoints.length].ip;
}

/**
 * Resolve the fail-open IP for a lookup domain when the circuit is open.
 * Prefers the last-best IP measured by the background speed test when a
 * runtime is available. Honors the kill switch immediately: flipping
 * `disableIpTableFailover` while a circuit is open clears the state instead
 * of waiting for the TTL to expire.
 */
async function getActiveFailoverIp(
  lookupDomain: string,
  runtimeLastBestIp: string | undefined,
): Promise<string | null> {
  if (!isFailoverActive(lookupDomain)) {
    return null;
  }
  if (await isFailoverDisabledByDevSettings()) {
    deactivateFailover(lookupDomain, 'kill_switch');
    return null;
  }
  return runtimeLastBestIp || getFailoverFallbackIp(lookupDomain);
}

/**
 * Check if IP Table should be used based on environment and dev settings
 * @returns true if IP Table should be used, false otherwise
 */
async function shouldUseIpTable(): Promise<boolean> {
  const defaultEnabled = true;
  try {
    const devSettings = await requestHelper.getDevSettingsPersistAtom();

    const disabledInProd = !!devSettings.settings?.disableIpTableInProd;
    if (disabledInProd) {
      debugLog(
        `[IpTableAdapter] Dev settings disabled IP Table (disableIpTableInProd)`,
      );
      return false;
    }

    return true;
  } catch (error) {
    debugWarn('[IpTableAdapter] Failed to check IP Table permission:', error);
    defaultLogger.ipTable.request.warn({
      info: redactIpLiterals(
        `[IpTableAdapter] Failed to check IP Table permission: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      ),
    });
    return defaultEnabled;
  }
}

/**
 * Internal implementation of IP selection logic
 * This function is memoized for performance optimization
 *
 * Selection priority:
 * 1. runtime.selections[domain] - User selected IP or explicit domain choice (empty string)
 * 2. Strict mode fallback - First IP from config.domains[domain].endpoints (if forceIpTableStrict enabled)
 * 3. null - Use original axios adapter (domain request)
 *
 * @returns IP address if found and enabled, null otherwise (empty string in selections means use domain directly)
 */
async function getSelectedIpForHostInternal(
  hostname: string,
): Promise<string | null> {
  const rootDomain = extractRootDomain(hostname);
  try {
    // Check environment-based permission first
    const hasPermission = await shouldUseIpTable();
    if (!hasPermission) {
      debugLog('[IpTableAdapter] IP Table disabled by dev settings');
      logIpTableEvent('info', 'iptable_selection', {
        hostname,
        rootDomain,
        lookupDomain: rootDomain,
        mapped: false,
        strictMode: false,
        runtimeEnabled: false,
        decision: 'disabled',
      });
      return null;
    }

    const configWithRuntime = await requestHelper.getIpTableConfig();

    // Check if config exists and is enabled
    if (!configWithRuntime || configWithRuntime.runtime?.enabled === false) {
      // No config = the main runtime or the cold-start window before the
      // background init completes. When the domain is failing at transport
      // level, fail-open to a builtin IP so those runtimes have protection
      // too. runtime.enabled === false is explicit user intent: no fail-open.
      if (!configWithRuntime) {
        const lookupDomain = await resolveFailoverLookupDomain(rootDomain);
        const failoverIp = await getActiveFailoverIp(lookupDomain, undefined);
        if (failoverIp) {
          logIpTableEvent('warn', 'iptable_selection', {
            hostname,
            rootDomain,
            lookupDomain,
            mapped: lookupDomain !== rootDomain,
            strictMode: false,
            runtimeEnabled: false,
            decision: 'fail_open',
            selectedIpHash: hashForLog(failoverIp),
          });
          return failoverIp;
        }
      }
      logIpTableEvent('info', 'iptable_selection', {
        hostname,
        rootDomain,
        lookupDomain: rootDomain,
        mapped: false,
        strictMode: false,
        runtimeEnabled: configWithRuntime?.runtime?.enabled === true,
        decision: configWithRuntime ? 'disabled' : 'no_config',
      });
      return null;
    }

    const { config, runtime } = configWithRuntime;

    // For shared IP domains (e.g., onekey.so), use the current API environment's domain
    const mappedDomain = await getMappedDomainForIpLookup(rootDomain);
    const lookupDomain = mappedDomain || rootDomain;

    if (mappedDomain) {
      debugLog(
        `[IpTableAdapter] Mapped domain for IP lookup: ${rootDomain} -> ${mappedDomain}`,
      );
    }

    // Check strict mode first
    const devSettings = await requestHelper.getDevSettingsPersistAtom();
    const strictMode = devSettings?.settings?.forceIpTableStrict;

    // First, try to get selected IP from runtime.selections
    const selectedIp = runtime?.selections[lookupDomain];

    // If selectedIp exists (not undefined), use it
    if (selectedIp) {
      debugLog(
        `[IpTableAdapter] Using selected IP from runtime: ${lookupDomain} -> ${selectedIp}`,
      );
      logIpTableEvent('info', 'iptable_selection', {
        hostname,
        rootDomain,
        lookupDomain,
        mapped: Boolean(mappedDomain),
        strictMode: Boolean(strictMode),
        runtimeEnabled: runtime?.enabled !== false,
        decision: 'selected_ip',
        selectedIpHash: hashForLog(selectedIp),
      });
      return selectedIp;
    }

    // Empty string means explicitly use domain (not IP)
    // In strict mode, override this and use fallback IP from config
    if (selectedIp === '') {
      if (!strictMode) {
        const failoverIp = await getActiveFailoverIp(
          lookupDomain,
          runtime?.lastBestIp?.[lookupDomain],
        );
        if (failoverIp) {
          logIpTableEvent('warn', 'iptable_selection', {
            hostname,
            rootDomain,
            lookupDomain,
            mapped: Boolean(mappedDomain),
            strictMode: false,
            runtimeEnabled: runtime?.enabled !== false,
            decision: 'fail_open',
            selectedIpHash: hashForLog(failoverIp),
          });
          return failoverIp;
        }
        debugLog(
          `[IpTableAdapter] Explicitly using domain for: ${lookupDomain}`,
        );
        logIpTableEvent('info', 'iptable_selection', {
          hostname,
          rootDomain,
          lookupDomain,
          mapped: Boolean(mappedDomain),
          strictMode: false,
          runtimeEnabled: runtime?.enabled !== false,
          decision: 'domain',
        });
        return null;
      }
      debugLog(
        `[IpTableAdapter] Strict mode: overriding domain choice for ${lookupDomain}`,
      );
      // Fall through to strict mode fallback logic below
    }

    // If no selection (or strict mode overriding domain choice), fallback to first available IP from config
    if (strictMode && config.domains[lookupDomain]) {
      const endpoints = config.domains[lookupDomain].endpoints;
      if (endpoints && endpoints.length > 0) {
        const fallbackIp = endpoints[0].ip;
        logIpTableEvent('info', 'iptable_selection', {
          hostname,
          rootDomain,
          lookupDomain,
          mapped: Boolean(mappedDomain),
          strictMode: true,
          runtimeEnabled: runtime?.enabled !== false,
          decision: 'strict_fallback',
          selectedIpHash: hashForLog(fallbackIp),
        });
        return fallbackIp;
      }
    }

    const noSelectionFailoverIp = await getActiveFailoverIp(
      lookupDomain,
      runtime?.lastBestIp?.[lookupDomain],
    );
    if (noSelectionFailoverIp) {
      logIpTableEvent('warn', 'iptable_selection', {
        hostname,
        rootDomain,
        lookupDomain,
        mapped: Boolean(mappedDomain),
        strictMode: Boolean(strictMode),
        runtimeEnabled: runtime?.enabled !== false,
        decision: 'fail_open',
        selectedIpHash: hashForLog(noSelectionFailoverIp),
      });
      return noSelectionFailoverIp;
    }

    logIpTableEvent('info', 'iptable_selection', {
      hostname,
      rootDomain,
      lookupDomain,
      mapped: Boolean(mappedDomain),
      strictMode: Boolean(strictMode),
      runtimeEnabled: runtime?.enabled !== false,
      decision: 'domain',
      reason: 'no_selection',
    });
    return null;
  } catch (error) {
    debugWarn('[IpTableAdapter] Failed to get IP table config:', error);
    logIpTableEvent('warn', 'iptable_selection', {
      hostname,
      rootDomain,
      lookupDomain: rootDomain,
      mapped: false,
      strictMode: false,
      runtimeEnabled: 'unknown',
      decision: 'domain',
      reason: 'config_error',
      errorCode: getErrorCode(error),
      errorMessage: getErrorMessage(error),
    });
    defaultLogger.ipTable.request.warn({
      info: redactIpLiterals(
        `[IpTableAdapter] Failed to get IP table config: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      ),
    });
    return null;
  }
}

/**
 * Convert AxiosHeaders to plain object
 */
function axiosHeadersToPlainObject(
  headers: AxiosHeaders | Record<string, string> | undefined,
): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof AxiosHeaders) {
    const plainHeaders: Record<string, string> = {};
    // Check if forEach method exists before calling it
    if (typeof headers.forEach === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      headers.forEach((value: any, key: string) => {
        if (typeof value === 'string') {
          plainHeaders[key] = value;
        } else if (value !== undefined) {
          plainHeaders[key] = String(value);
        }
      });
    } else {
      // Fallback: iterate over headers as object
      Object.keys(headers).forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const value = (headers as any)[key];
        if (typeof value === 'string') {
          plainHeaders[key] = value;
        } else if (value !== undefined && value !== null) {
          plainHeaders[key] = String(value);
        }
      });
    }
    return plainHeaders;
  }

  // If it's a plain object, return it directly
  if (typeof headers === 'object') {
    return headers;
  }

  return {};
}

function appendParamsToPath(
  path: string,
  params: InternalAxiosRequestConfig['params'],
): string {
  if (!params) {
    return path;
  }

  const filteredParams: Record<string, string> = {};
  Object.entries(params as Record<string, any>).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      filteredParams[key] = String(value);
    }
  });

  const searchParams = new URLSearchParams(filteredParams);
  const queryString = searchParams.toString();
  if (!queryString) {
    return path;
  }
  return `${path}${path.includes('?') ? '&' : '?'}${queryString}`;
}

function buildRelativeSniPath(
  baseURL: string,
  url: string,
  params: InternalAxiosRequestConfig['params'],
): string {
  const baseUrlObj = new URL(baseURL);
  const basePath = baseUrlObj.pathname.endsWith('/')
    ? baseUrlObj.pathname.slice(0, -1)
    : baseUrlObj.pathname;
  const relativePath = url.startsWith('/') ? url : `/${url}`;
  return appendParamsToPath(basePath + relativePath, params);
}

/**
 * IP Table Axios Adapter
 * Intercepts axios requests and performs direct IP connection with SNI when applicable
 * Falls back to default axios request if IP direct connection is not available or fails
 */
export function createIpTableAdapter(
  _fallbackConfig: AxiosRequestConfig,
): AxiosAdapter {
  // Get the original axios default adapters BEFORE any modification
  // This ensures we capture the platform's native adapters (xhr/http/fetch)
  const originalDefaultAdapters = axios.defaults.adapter;

  debugLog(
    '[IpTableAdapter] Captured original default adapters:',
    originalDefaultAdapters,
  );

  // Helper function to call original adapter and avoid infinite loop
  /**
   * Call the original axios adapter (bypassing IP Table logic)
   *
   * @param options.config - Axios request config
   * @param options.isFallback - If true, this is a fallback request after SNI failure (won't count as domain failure)
   * @param options.hostname - Hostname for failure reporting (optional)
   * @param options.rootDomain - Root domain for failure reporting (optional)
   */
  const callOriginalAdapter = async (options: {
    config: InternalAxiosRequestConfig;
    isFallback?: boolean;
    hostname?: string;
    rootDomain?: string;
  }): Promise<AxiosResponse> => {
    const { config, isFallback = false, hostname, rootDomain } = options;
    const startedAtMs = Date.now();
    debugLog('[IpTableAdapter] About to call original adapter...');
    debugLog(
      '[IpTableAdapter] Original adapter type:',
      typeof originalDefaultAdapters,
    );

    try {
      let response: AxiosResponse;

      // If originalDefaultAdapters is a function, call it directly
      if (typeof originalDefaultAdapters === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        response = await originalDefaultAdapters(config);
      }
      // If originalDefaultAdapters is an array (axios 1.x style like ["xhr", "http", "fetch"]),
      // we need to use axios internal adapter resolution
      else if (Array.isArray(originalDefaultAdapters)) {
        debugLog(
          '[IpTableAdapter] Original adapter is array, using axios.getAdapter()',
        );

        // Try to use axios.getAdapter() to resolve the adapter array
        if (typeof axios.getAdapter === 'function') {
          const resolvedAdapter = axios.getAdapter(originalDefaultAdapters);
          if (typeof resolvedAdapter === 'function') {
            debugLog('[IpTableAdapter] Successfully resolved adapter function');
            response = await resolvedAdapter(config);
          } else {
            throw new OneKeyLocalError('Unable to resolve adapter function');
          }
        } else {
          // Fallback: Create a new axios instance with the original adapter array
          // This is safe because we're explicitly passing the original adapters
          debugLog(
            '[IpTableAdapter] axios.getAdapter not available, creating temp instance',
          );
          const tempAxios = axios.create({
            adapter: originalDefaultAdapters,
          });

          response = await tempAxios.request(config);
        }
      } else {
        // Last resort: throw error to let caller handle it
        debugError(
          '[IpTableAdapter] Unable to resolve adapter, type:',
          typeof originalDefaultAdapters,
        );
        defaultLogger.ipTable.request.error({
          info: `[IpTableAdapter] Unable to resolve adapter, type: ${typeof originalDefaultAdapters}`,
        });
        throw new OneKeyLocalError(
          'IP Table Adapter: Unable to perform fallback request on this platform',
        );
      }

      if (rootDomain && hostname) {
        // A completed domain request (any HTTP status) proves the network
        // path works for THIS hostname: reset its fail-open counter and
        // notify the service so its health stats reset too.
        await recordDomainRequestOutcome({
          rootDomain,
          hostname,
          ok: true,
          startedAtMs,
        });
        if (reportRequestSuccessCallback) {
          reportRequestSuccessCallback({
            domain: rootDomain,
            requestType: 'domain',
            target: hostname,
          });
        }
      }

      return response;
    } catch (error) {
      if (rootDomain && hostname) {
        // Track transport-level failures for adapter fail-open. The failing
        // request itself is never replayed (no double-send of POSTs); only
        // subsequent requests take the fail-open route.
        await recordDomainRequestOutcome({
          rootDomain,
          hostname,
          ok: false,
          startedAtMs,
          error,
        });
      }

      // Only report domain failures if this is NOT a fallback request, and
      // only for transport-level failures: HTTP responses prove the network
      // path works and cancellations say nothing about it, so neither may
      // drive the service's failover/speed-test counters.
      if (
        !isFallback &&
        hostname &&
        rootDomain &&
        reportRequestFailureCallback &&
        isTransportLevelError(error)
      ) {
        debugLog(
          `[IpTableAdapter] Domain request failed (not fallback): ${hostname}`,
        );
        reportRequestFailureCallback({
          domain: rootDomain,
          requestType: 'domain',
          target: hostname,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  };

  return async (config: InternalAxiosRequestConfig) => {
    const sniSupported = isSniSupported();
    // Check if SNI is supported on current platform
    if (!sniSupported) {
      debugLog(
        '[IpTableAdapter] SNI not supported, using fallback for:',
        config.url,
      );

      // This is a direct domain request (not a fallback from SNI failure)
      // We need to extract hostname for failure reporting
      const url = config.url || '';
      let hostname: string | null = null;
      try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          hostname = new URL(url).hostname;
        } else if (config.baseURL) {
          hostname = new URL(config.baseURL).hostname;
        }
      } catch {
        // Ignore parsing errors for reporting
      }

      const rootDomain = hostname ? extractRootDomain(hostname) : undefined;
      logIpTableEvent('info', 'sni_preflight_decision', {
        platform: getSniLogPlatform(),
        hostname: hostname ?? 'none',
        rootDomain: rootDomain ?? 'none',
        method: (config.method || 'GET').toUpperCase(),
        sniSupported: false,
        proxyActive: 'skipped',
        decision: 'fallback',
        fallbackReason: 'sni_unsupported',
      });

      return callOriginalAdapter({
        config,
        isFallback: false,
        hostname: hostname || undefined,
        rootDomain,
      });
    }

    // Parse URL to extract hostname
    const url = config.url || '';
    let hostname: string | null = null;

    try {
      // Handle full URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
      }
      // Handle relative URL with baseURL
      else if (config.baseURL) {
        const baseUrlObj = new URL(config.baseURL);
        hostname = baseUrlObj.hostname;
      }
    } catch (_error) {
      // If URL parsing fails, use original adapter (direct request, not fallback)
      debugLog('[IpTableAdapter] URL parsing failed, using fallback');
      return callOriginalAdapter({ config, isFallback: false });
    }

    // If no hostname extracted, use original adapter (direct request, not fallback)
    if (!hostname) {
      debugLog('[IpTableAdapter] No hostname extracted, using fallback');
      return callOriginalAdapter({ config, isFallback: false });
    }

    // Extract root domain for config lookup
    const rootDomain = extractRootDomain(hostname);

    let targetUrl: string;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        targetUrl = new URL(url).toString();
      } else if (config.baseURL) {
        const baseUrlObj = new URL(config.baseURL);
        const path = buildRelativeSniPath(config.baseURL, url, config.params);
        targetUrl = `${baseUrlObj.origin}${path}`;
      } else {
        return callOriginalAdapter({
          config,
          isFallback: false,
          hostname,
          rootDomain,
        });
      }
    } catch (_error) {
      debugLog('[IpTableAdapter] Target URL build failed, using fallback');
      return callOriginalAdapter({
        config,
        isFallback: false,
        hostname,
        rootDomain,
      });
    }

    let proxyActive: boolean | null;
    let preflightError: unknown;
    try {
      proxyActive = await isProxyActiveForUrl(targetUrl);
    } catch (error) {
      debugWarn(
        '[IpTableAdapter] Proxy preflight failed, using fallback:',
        error,
      );
      preflightError = error;
      proxyActive = null;
    }
    const shouldUseSni = proxyActive !== true && !preflightError;
    let fallbackReason = 'none';
    let preflightReason = 'confirmed_direct';
    if (proxyActive === true) {
      fallbackReason = 'proxy_active';
      preflightReason = 'proxy_active';
    } else if (proxyActive === null) {
      if (preflightError) {
        fallbackReason = 'preflight_error';
        preflightReason = 'preflight_error';
      } else {
        preflightReason = 'preflight_unsupported_legacy';
      }
    }
    logIpTableEvent(shouldUseSni ? 'info' : 'warn', 'sni_preflight_decision', {
      platform: getSniLogPlatform(),
      hostname,
      rootDomain,
      method: (config.method || 'GET').toUpperCase(),
      sniSupported,
      proxyActive: proxyActive === null ? 'null' : proxyActive,
      decision: shouldUseSni ? 'sni' : 'fallback',
      fallbackReason,
      preflightReason,
      errorCode: preflightError ? getErrorCode(preflightError) : 'none',
      errorMessage: preflightError ? getErrorMessage(preflightError) : 'none',
    });
    if (!shouldUseSni) {
      let debugReason = 'unsupported';
      if (proxyActive) {
        debugReason = 'active';
      } else if (preflightError) {
        debugReason = 'error';
      }
      debugLog(
        `[IpTableAdapter] Proxy preflight ${debugReason} for ${targetUrl}, using fallback`,
      );
      return callOriginalAdapter({
        config,
        isFallback: false,
        hostname,
        rootDomain,
      });
    }

    // Get selected IP for this hostname (async call)
    const selectedIp = await getSelectedIpForHost(hostname);

    // If no IP mapping found, use original adapter (direct domain request, not fallback)
    if (!selectedIp) {
      debugLog(
        `[IpTableAdapter] No IP mapping found for hostname: ${hostname}`,
      );
      return callOriginalAdapter({
        config,
        isFallback: false,
        hostname,
        rootDomain,
      });
    }

    debugLog(
      `[IpTableAdapter] Using IP direct connection: ${hostname} -> ${selectedIp}`,
    );

    // Construct full path for SNI request
    let fullPath = url;
    if (config.baseURL && !url.startsWith('http')) {
      // Combine baseURL and relative path
      const baseUrlObj = new URL(config.baseURL);
      fullPath = buildRelativeSniPath(
        baseUrlObj.toString(),
        url,
        config.params,
      );
    } else if (url.startsWith('http')) {
      // Extract path from full URL
      const urlObj = new URL(url);
      fullPath = urlObj.pathname + urlObj.search;
    }

    // Prepare request body
    let requestBody: string | null = null;
    if (config.data) {
      if (typeof config.data === 'string') {
        requestBody = config.data;
      } else {
        try {
          requestBody = JSON.stringify(config.data);
        } catch (stringifyError) {
          logIpTableEvent('warn', 'sni_request_prepare', {
            hostname,
            rootDomain,
            selectedIpHash: hashForLog(selectedIp),
            result: 'body_stringify_failed',
            errorMessage: getErrorMessage(stringifyError),
          });
          requestBody = String(config.data);
        }
      }
    }

    const requestHeaders = axiosHeadersToPlainObject(config.headers);

    // Ensure Content-Type is set for POST/PUT requests with body
    if (
      requestBody &&
      ['POST', 'PUT', 'PATCH'].includes(
        (config.method || 'GET').toUpperCase(),
      ) &&
      !requestHeaders['content-type'] &&
      !requestHeaders['Content-Type']
    ) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    debugLog(
      `[IpTableAdapter] Request details - URL: ${url}, BaseURL: ${
        config.baseURL || 'N/A'
      }, FullPath: ${fullPath}, Method: ${config.method || 'GET'}`,
    );
    debugLog('[IpTableAdapter] Request headers:', requestHeaders);
    debugLog(
      '[IpTableAdapter] Request body:',
      requestBody ? requestBody.substring(0, 200) : 'null',
    );

    try {
      const sniResponse = await sniRequest({
        ip: selectedIp,
        hostname,
        path: fullPath,
        headers: requestHeaders,
        method: (config.method || 'GET').toUpperCase(),
        body: requestBody,
        timeout: config.timeout || 60_000,
      });

      // If SNI request fails, use original adapter
      if (!sniResponse) {
        debugLog('[IpTableAdapter] SNI request returned null, using fallback');
        // Report IP failure
        if (reportRequestFailureCallback) {
          reportRequestFailureCallback({
            domain: rootDomain,
            requestType: 'ip',
            target: selectedIp,
            error: 'SNI response null',
          });
        }
        // A null response is ambiguous — the request may have reached the
        // server. Re-sending over the domain is only safe for idempotent
        // methods; anything else must surface the failure to the caller.
        const method = (config.method || 'GET').toUpperCase();
        if (!canFallbackAfterSniStarted(method)) {
          logIpTableEvent('warn', 'sni_fallback_blocked', {
            hostname,
            rootDomain,
            method,
            reason: 'non_idempotent_after_sni_started',
          });
          throw new OneKeyLocalError(
            'IP Table Adapter: SNI response missing and request is not idempotent',
          );
        }
        // Fallback to domain (isFallback = true, so domain failure won't be counted)
        return await callOriginalAdapter({
          config,
          isFallback: true,
          hostname,
          rootDomain,
        });
      }

      // Convert SNI response to Axios response format
      debugLog(
        `[IpTableAdapter] SNI request successful: ${sniResponse.statusCode}`,
      );

      if (reportRequestSuccessCallback) {
        reportRequestSuccessCallback({
          domain: rootDomain,
          requestType: 'ip',
          target: selectedIp,
        });
      }

      // Parse response body
      let responseData: any = null;
      const responseBody = sniResponse.body ?? sniResponse.data;
      if (responseBody) {
        try {
          // Check if body is already an object or a string
          if (typeof responseBody === 'string') {
            responseData = JSON.parse(responseBody);
          } else {
            responseData = responseBody;
          }
        } catch (parseError) {
          debugWarn(
            '[IpTableAdapter] Failed to parse response body:',
            parseError,
          );
          defaultLogger.ipTable.request.warn({
            info: `[IpTableAdapter] Failed to parse response body: ${
              parseError instanceof Error ? parseError.message : 'Unknown error'
            }`,
          });
          responseData = responseBody;
        }
      }

      debugLog('[IpTableAdapter] Response data:', responseData);

      return {
        data: responseData,
        status: sniResponse.statusCode ?? sniResponse.status ?? 0,
        statusText: sniResponse.statusText ?? '',
        headers: sniResponse.headers,
        config,
        request: {},
      };
    } catch (error) {
      if (isSniFailClosedError(error)) {
        debugError('[IpTableAdapter] SNI fail-closed error:', error);
        logIpTableEvent('error', 'sni_fail_closed', {
          hostname,
          rootDomain,
          selectedIpHash: hashForLog(selectedIp),
          code: getErrorCode(error),
          messageClass: error instanceof Error ? error.name : typeof error,
          decision: 'throw_no_fallback',
        });
        throw error;
      }

      // Report IP failure if callback is registered
      if (reportRequestFailureCallback) {
        reportRequestFailureCallback({
          domain: rootDomain,
          requestType: 'ip',
          target: selectedIp,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Once the request was handed to the SNI transport it may have been
      // written to the wire (e.g. SNI_TIMEOUT after send). Re-sending over
      // the domain risks double-executing mutating requests, so fallback is
      // restricted to idempotent methods or errors that prove the
      // connection was never established.
      const method = (config.method || 'GET').toUpperCase();
      if (!canFallbackAfterSniStarted(method, error)) {
        logIpTableEvent('warn', 'sni_fallback_blocked', {
          hostname,
          rootDomain,
          method,
          errorCode: getErrorCode(error),
          reason: 'non_idempotent_after_sni_started',
        });
        throw error;
      }

      // If SNI request throws error, use original adapter
      debugWarn(
        '[IpTableAdapter] SNI request failed, falling back to original adapter:',
        error,
      );
      defaultLogger.ipTable.request.error({
        info: redactIpLiterals(
          `[IpTableAdapter] SNI request failed for ${hostname} (ipHash=${hashForLog(selectedIp)}), falling back: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        ),
      });
      // Fallback to domain (isFallback = true, so domain failure won't be counted)
      return callOriginalAdapter({
        config,
        isFallback: true,
        hostname,
        rootDomain,
      });
    }
  };
}

/**
 * Create axios instance with IP Table adapter
 */
export function createAxiosWithIpTable(axiosConfig: AxiosRequestConfig = {}) {
  const ipTableAdapter = createIpTableAdapter(axiosConfig);

  return axios.create({
    ...axiosConfig,
    adapter: ipTableAdapter,
  });
}

// ========== Speed Test Utilities ==========

/**
 * Test endpoint speed using domain directly (no IP Table)
 */
export async function testDomainSpeed(
  domain: string,
  path: string,
  timeout = 3000,
): Promise<number> {
  const startTime = Date.now();

  try {
    // Create a plain axios instance without IP Table adapter
    const plainAxios = axios.create();

    const headers = await getRequestHeaders();

    // Build full URL: https://wallet.{domain}/wallet/v1/health
    const fullUrl = `https://wallet.${domain}${path}`;

    await plainAxios.get(fullUrl, {
      timeout,
      headers,
    });

    const latency = Date.now() - startTime;
    debugLog(`[IpTableAdapter] Domain test: ${fullUrl} -> ${latency}ms`);
    defaultLogger.ipTable.request.info({
      info: redactIpLiterals(
        `[IpTable] Domain speed test successful: ${fullUrl} : ${latency} ms`,
      ),
    });
    return latency;
  } catch (error) {
    debugWarn(`[IpTableAdapter] Domain test failed for ${domain}:`, error);
    defaultLogger.ipTable.request.warn({
      info: redactIpLiterals(
        `[IpTable] Domain speed test failed for ${domain}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      ),
    });
    return Infinity;
  }
}

/**
 * Test endpoint speed using IP with SNI
 */
export async function testIpSpeed(
  ip: string,
  domain: string,
  path: string,
  timeout = 3000,
): Promise<number> {
  const startTime = Date.now();

  try {
    // Check if SNI is supported
    if (!isSniSupported()) {
      debugLog('[IpTableAdapter] SNI not supported, cannot test IP speed');
      return Infinity;
    }

    // Get OneKey request headers
    const headers = await getRequestHeaders();

    // SNI hostname should be: wallet.{domain}
    const sniHostname = `wallet.${domain}`;
    const targetUrl = `https://${sniHostname}${path}`;

    let proxyActive: boolean | null;
    try {
      proxyActive = await isProxyActiveForUrl(targetUrl);
    } catch (error) {
      logIpTableEvent('warn', 'sni_speed_preflight_decision', {
        platform: getSniLogPlatform(),
        hostname: sniHostname,
        ipHash: hashForLog(ip),
        proxyActive: 'null',
        decision: 'skip_ip_speed',
        reason: 'preflight_error',
        errorCode: getErrorCode(error),
        errorMessage: getErrorMessage(error),
      });
      return Infinity;
    }

    if (proxyActive === true) {
      logIpTableEvent('warn', 'sni_speed_preflight_decision', {
        platform: getSniLogPlatform(),
        hostname: sniHostname,
        ipHash: hashForLog(ip),
        proxyActive,
        decision: 'skip_ip_speed',
        reason: 'proxy_active',
      });
      return Infinity;
    }

    logIpTableEvent('info', 'sni_speed_preflight_decision', {
      platform: getSniLogPlatform(),
      hostname: sniHostname,
      ipHash: hashForLog(ip),
      proxyActive: proxyActive === null ? 'null' : proxyActive,
      decision: 'test_ip_speed',
      reason:
        proxyActive === null
          ? 'preflight_unsupported_legacy'
          : 'confirmed_direct',
    });

    const response = await sniRequest({
      ip,
      hostname: sniHostname,
      path,
      method: 'GET',
      timeout,
      headers,
      body: null,
    });

    if (!response) {
      debugWarn(`[IpTableAdapter] IP test returned null for ${ip}`);
      defaultLogger.ipTable.request.warn({
        info: redactIpLiterals(
          `[IpTable] IP speed test returned null for ${ip}`,
        ),
      });
      return Infinity;
    }

    const latency = Date.now() - startTime;
    debugLog(
      `[IpTableAdapter] IP test: ${ip} -> ${sniHostname}${path} -> ${latency}ms`,
    );
    defaultLogger.ipTable.request.info({
      info: redactIpLiterals(
        `[IpTable] IP speed test successful: ${ip} -> ${sniHostname}${path} : ${latency} ms`,
      ),
    });
    return latency;
  } catch (error) {
    debugWarn(`[IpTableAdapter] IP test failed for ${ip}:`, error);
    defaultLogger.ipTable.request.warn({
      info: redactIpLiterals(
        `[IpTable] IP speed test failed for ${ip}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      ),
    });
    return Infinity;
  }
}

// ========== Request Failure Reporting ==========
export function setReportRequestFailureCallback(
  callback: (params: IRequestFailureParams) => void,
) {
  reportRequestFailureCallback = callback;
  debugLog('[IpTableAdapter] Request failure callback registered');
}

export { getSelectedIpForHost };
