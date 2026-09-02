import {
  RUNTIME_POLYFILLS_VERSION,
  assertRuntimePolyfillsReady,
  getMissingRuntimeCapabilities,
  markRuntimePolyfillsReady,
} from './runtimeCapabilities';

import type { IRuntimePolyfillScope } from './runtimeCapabilities';

function createCompleteRuntimeScope(): IRuntimePolyfillScope {
  return {
    Array: {
      prototype: {
        flatMap() {},
        toSorted() {},
      },
    },
    Buffer() {},
    Intl: {
      Locale() {},
      PluralRules() {},
      getCanonicalLocales() {},
    },
    Promise: {
      allSettled() {},
    },
    TextDecoder() {},
    TextEncoder() {},
    URL() {},
    crypto: {
      getRandomValues() {},
    },
    requestIdleCallback() {},
    setImmediate() {},
  };
}

describe('runtimeCapabilities', () => {
  it('marks a complete runtime as ready', () => {
    const scope = createCompleteRuntimeScope();

    markRuntimePolyfillsReady(scope);

    expect(scope.__ONEKEY_RUNTIME_POLYFILLS_READY__).toBe(
      RUNTIME_POLYFILLS_VERSION,
    );
    expect(() => assertRuntimePolyfillsReady(scope)).not.toThrow();
  });

  it('reports a missing constructor and never marks the runtime ready', () => {
    const scope = createCompleteRuntimeScope();
    delete scope.Intl?.PluralRules;

    expect(getMissingRuntimeCapabilities(scope)).toContain('Intl.PluralRules');
    expect(() => markRuntimePolyfillsReady(scope)).toThrow(/Intl\.PluralRules/);
    expect(scope.__ONEKEY_RUNTIME_POLYFILLS_READY__).toBeUndefined();
  });

  it('rejects access before bootstrap has marked the runtime ready', () => {
    const scope = createCompleteRuntimeScope();

    expect(() => assertRuntimePolyfillsReady(scope)).toThrow(
      /bootstrap has not completed/,
    );
  });
});
