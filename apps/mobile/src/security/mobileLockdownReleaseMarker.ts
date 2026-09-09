// Only dynamically imported by the explicitly enabled Release E2E check.
export function readMobileLockdownReleaseMarker() {
  return {
    marker: 'onekey-mobile-lockdown-release-segment-v1',
    arrayFrozen: Object.isFrozen(Array.prototype),
    promiseFrozen: Object.isFrozen(Promise.prototype),
  };
}
