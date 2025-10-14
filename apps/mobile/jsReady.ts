globalThis.$$onekeyJsReadyAt = Date.now();
if (typeof globalThis.nativePerformanceNow === 'function') {
  globalThis.$$onekeyJsReadyFromPerformanceNow =
    globalThis.nativePerformanceNow();
}
