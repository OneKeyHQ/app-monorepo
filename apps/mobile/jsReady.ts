globalThis.$$onekeyJsReadyAt = Date.now();
globalThis.$$isNativeUiThread = true;
if (typeof globalThis.nativePerformanceNow === 'function') {
  globalThis.$$onekeyJsReadyFromPerformanceNow =
    globalThis.nativePerformanceNow();
}
