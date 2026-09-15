/**
 * Browser realms (web, desktop renderer, extension pages and service worker)
 * read synchronous getters at record time. Desktop Chromium exposes no
 * connection type, so it reports only offline or unknown.
 */
export function getAvailabilityNetworkType(): unknown {
  const navigator = (
    globalThis as {
      navigator?: { onLine?: boolean; connection?: { type?: unknown } };
    }
  ).navigator;
  return navigator?.onLine === false ? 'none' : navigator?.connection?.type;
}

export function startAvailabilityNetworkTypeTracking() {
  // Nothing to subscribe to.
}
