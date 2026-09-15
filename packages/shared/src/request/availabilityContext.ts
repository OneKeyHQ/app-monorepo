/**
 * Synchronous per-runtime context attached to API availability outcomes:
 * network type (via ./availabilityNetworkType), recent proxy preflight
 * results per hostname, and IP Table state. It also defines the route enum;
 * the route itself is marked per request on the timing object
 * (markApiAvailabilityRoute in availabilityMetrics.ts). Every reported value
 * is a small enum; proxy hosts, PAC rules, selected IPs and network
 * identifiers must never be stored or reported.
 *
 * Travel mode is deliberately not a dimension: analytics is not initialized
 * while it is on, so it could only ever report "off", and an "on" value
 * would reveal use of a concealment feature.
 */
import platformEnv from '../platformEnv';

import {
  getAvailabilityNetworkType,
  startAvailabilityNetworkTypeTracking,
} from './availabilityNetworkType';

export type { IAvailabilityNetworkType } from './availabilityNetworkTypeUtils';

/**
 * - direct: no IP Table adapter in the request path
 * - domain: the IP Table adapter chose the domain (DNS) route
 * - sni: an IP-direct SNI request was made
 * - fallback: SNI was attempted, then the domain was used
 * - none: the request ended before the adapter picked a route
 */
export type IAvailabilityRoute =
  | 'direct'
  | 'domain'
  | 'fallback'
  | 'none'
  | 'sni';

export type IAvailabilityProxyState = 'off' | 'on' | 'unknown';

export type IAvailabilityIpTableState =
  | 'disabled'
  | 'enabled'
  | 'no_config'
  | 'unknown'
  | 'unsupported';

export const AVAILABILITY_PROXY_STATE_TTL_MS = 5 * 60 * 1000;
export const AVAILABILITY_PROXY_STATE_MAX_HOSTS = 32;

/**
 * Proxy preflight is per URL (PAC and bypass rules can differ per host), so
 * results are cached per exact hostname and only reused for that hostname.
 * Hostnames stay in memory and are never reported.
 */
const proxyPreflightByHostname = new Map<
  string,
  { state: IAvailabilityProxyState; at: number }
>();

let ipTableState: IAvailabilityIpTableState = 'unknown';

export function toAvailabilityProxyState(
  result: boolean | null | undefined,
): IAvailabilityProxyState {
  if (result === true) return 'on';
  if (result === false) return 'off';
  return 'unknown';
}

export function getAvailabilityHostname(url: string | undefined) {
  try {
    return url ? new URL(url).hostname.toLowerCase() || undefined : undefined;
  } catch {
    return undefined;
  }
}

/** Records the latest proxy preflight outcome for one hostname (enum only). */
export function noteAvailabilityProxyPreflight(
  hostname: string | undefined,
  result: boolean | null | undefined,
  now = Date.now(),
) {
  const key = typeof hostname === 'string' ? hostname.toLowerCase() : '';
  if (!key) return;
  proxyPreflightByHostname.delete(key);
  proxyPreflightByHostname.set(key, {
    state: toAvailabilityProxyState(result),
    at: now,
  });
  while (proxyPreflightByHostname.size > AVAILABILITY_PROXY_STATE_MAX_HOSTS) {
    const oldest = proxyPreflightByHostname.keys().next().value;
    if (oldest === undefined) break;
    proxyPreflightByHostname.delete(oldest);
  }
}

export function getAvailabilityProxyState(
  hostname: string | undefined,
  now = Date.now(),
): IAvailabilityProxyState {
  const entry =
    typeof hostname === 'string' && hostname
      ? proxyPreflightByHostname.get(hostname.toLowerCase())
      : undefined;
  if (
    !entry ||
    now < entry.at ||
    now - entry.at > AVAILABILITY_PROXY_STATE_TTL_MS
  ) {
    return 'unknown';
  }
  return entry.state;
}

/**
 * Whether this runtime can run the IP Table adapter at all. Same platform
 * rule as isSupportIpTablePlatform(); duplicated to avoid importing
 * ipTableUtils (logger, signature helpers) into the request layer.
 */
export function isAvailabilityIpTableRuntime() {
  return Boolean(platformEnv.isNative || platformEnv.isDesktop);
}

export function setAvailabilityIpTableState(state: IAvailabilityIpTableState) {
  ipTableState = state;
}

export function getAvailabilityIpTableState(): IAvailabilityIpTableState {
  return isAvailabilityIpTableRuntime() ? ipTableState : 'unsupported';
}

export { getAvailabilityNetworkType };

export function startAvailabilityContextTracking() {
  try {
    startAvailabilityNetworkTypeTracking();
  } catch {
    // Context is best effort; outcomes still record with unknown values.
  }
}

export function resetAvailabilityContextForTest() {
  proxyPreflightByHostname.clear();
  ipTableState = 'unknown';
}
