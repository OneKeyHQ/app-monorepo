/**
 * Browser realms (web, desktop renderer, extension pages and service worker)
 * read synchronous getters at record time.
 *
 * Chromium implements `NetworkInformation.type` only on Android and ChromeOS,
 * so desktop and web report `unsupported` rather than a transport: the field
 * is absent there, and reporting it as an unread type would hide the native
 * tracker's own failures in the same bucket.
 */
export function getAvailabilityNetworkType(): unknown {
  try {
    const navigator = (
      globalThis as {
        navigator?: { onLine?: boolean; connection?: { type?: unknown } };
      }
    ).navigator;
    if (!navigator) return undefined;
    if (navigator.onLine === false) return 'none';
    const type = navigator.connection?.type;
    return typeof type === 'string' ? type : 'unsupported';
  } catch {
    // A realm without navigator, or one that throws on access.
    return undefined;
  }
}

export function startAvailabilityNetworkTypeTracking() {
  // Nothing to subscribe to.
}
