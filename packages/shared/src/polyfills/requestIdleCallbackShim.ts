// Safari < 18.4 does not support requestIdleCallback / cancelIdleCallback.
// Provide a setTimeout-based fallback so call-sites work everywhere.

// eslint-disable-next-line unicorn/prefer-global-this
const _global = typeof globalThis !== 'undefined' ? globalThis : (self as any);

if (typeof _global.requestIdleCallback !== 'function') {
  _global.requestIdleCallback = (
    cb: IdleRequestCallback,
    _options?: IdleRequestOptions,
  ): number =>
    setTimeout(() => {
      const start = Date.now();
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1) as unknown as number;
}

if (typeof _global.cancelIdleCallback !== 'function') {
  _global.cancelIdleCallback = (id: number): void => {
    clearTimeout(id);
  };
}
