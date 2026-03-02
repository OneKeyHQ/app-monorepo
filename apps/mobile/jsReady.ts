globalThis.$$onekeyJsReadyAt = Date.now();
if (typeof globalThis.nativePerformanceNow === 'function') {
  globalThis.$$onekeyJsReadyFromPerformanceNow =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    globalThis.nativePerformanceNow();
}
