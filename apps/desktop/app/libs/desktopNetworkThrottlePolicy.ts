import { NETWORK_THROTTLE_ONEKEY_HOSTS } from '@onekeyhq/shared/src/modules/NetworkThrottle/throttledHosts';

type IDesktopNetworkConditions = {
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
};

export type IDesktopNetworkConditionRule = IDesktopNetworkConditions & {
  urlPattern: string;
};

// The throttled hosts are shared with native so both platforms slow down the
// same traffic. CDP matches these with the URLPattern constructor syntax and
// silently drops entries it cannot parse, so the unit test asserts every
// pattern is constructible.
export const DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS =
  NETWORK_THROTTLE_ONEKEY_HOSTS.map((host) => `*://${host}/*`);

export function buildDesktopOneKeyOriginNetworkConditionRules(
  conditions: IDesktopNetworkConditions,
): IDesktopNetworkConditionRule[] {
  // No catch-all rule: requests that match nothing stay untouched.
  return DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS.map((urlPattern) => ({
    urlPattern,
    ...conditions,
  }));
}
