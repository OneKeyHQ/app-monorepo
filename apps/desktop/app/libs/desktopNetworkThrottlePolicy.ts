type IDesktopNetworkConditions = {
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
};

export type IDesktopNetworkConditionRule = IDesktopNetworkConditions & {
  urlPattern: string;
};

// Weak-network simulation targets OneKey's own traffic only: API endpoints
// (wallet/swap/utility/... on the prod and test hosts, including the
// notification socket in both websocket and polling transports) and the asset
// CDNs that serve token and market images. Everything else — DApp pages,
// third-party RPC and price feeds, and the local dev server — keeps full
// speed.
//
// CDP matches these with the URLPattern constructor syntax and silently drops
// entries it cannot parse, so every pattern is asserted constructible in the
// unit test. A `*.` host wildcard matches sub-domains at any depth but not the
// apex, which is fine because every OneKey endpoint is a sub-domain.
export const DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS = [
  '*://*.onekeycn.com/*',
  '*://*.onekeytest.com/*',
  '*://*.onekey-asset.com/*',
  '*://app-assets.onekey.so/*',
] as const;

export function buildDesktopOneKeyOriginNetworkConditionRules(
  conditions: IDesktopNetworkConditions,
): IDesktopNetworkConditionRule[] {
  // No catch-all rule: requests that match nothing stay untouched.
  return DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS.map((urlPattern) => ({
    urlPattern,
    ...conditions,
  }));
}
