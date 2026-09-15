import { normalizeAvailabilityConnectionType } from './availabilityNetworkTypeUtils';

import type { IAvailabilityNetworkType } from './availabilityNetworkTypeUtils';

export type { IAvailabilityNetworkType } from './availabilityNetworkTypeUtils';

type IBrowserNavigator = {
  onLine?: boolean;
  connection?: { type?: unknown };
};

/**
 * Web, desktop renderer and extension realms (including the MV3 service
 * worker) read cheap synchronous getters at record time. Desktop Chromium
 * exposes no connection type, so those runtimes report only `offline` or
 * `unknown`; `offline` is high precision but misses VPN/captive portals.
 */
export function getAvailabilityNetworkType(): IAvailabilityNetworkType {
  try {
    const navigator = (globalThis as { navigator?: IBrowserNavigator })
      .navigator;
    if (navigator?.onLine === false) {
      return 'offline';
    }
    return normalizeAvailabilityConnectionType(navigator?.connection?.type);
  } catch {
    return 'unknown';
  }
}

export function startAvailabilityNetworkTypeTracking() {
  // Browser getters are read on demand; nothing to subscribe to.
}
