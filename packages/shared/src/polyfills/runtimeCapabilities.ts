/* eslint-disable onekey/no-raw-error */

export const RUNTIME_POLYFILLS_VERSION = 1;

export type IRuntimePolyfillScope = {
  __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  __ONEKEY_RUNTIME_POLYFILLS_READY__?: number;
  Array?: {
    prototype?: {
      flatMap?: unknown;
      toSorted?: unknown;
    };
  };
  Intl?: {
    Locale?: unknown;
    PluralRules?: unknown;
    getCanonicalLocales?: unknown;
  };
  Promise?: {
    allSettled?: unknown;
  };
  TextDecoder?: unknown;
  TextEncoder?: unknown;
  URL?: unknown;
  crypto?: {
    getRandomValues?: unknown;
  };
  requestIdleCallback?: unknown;
  setImmediate?: unknown;
};

type ICapabilityCheck = readonly [
  name: string,
  isAvailable: (scope: IRuntimePolyfillScope) => boolean,
];

const runtimeCapabilityChecks: readonly ICapabilityCheck[] = [
  [
    'Intl.getCanonicalLocales',
    (scope) => typeof scope.Intl?.getCanonicalLocales === 'function',
  ],
  ['Intl.Locale', (scope) => typeof scope.Intl?.Locale === 'function'],
  [
    'Intl.PluralRules',
    (scope) => typeof scope.Intl?.PluralRules === 'function',
  ],
  [
    'Promise.allSettled',
    (scope) => typeof scope.Promise?.allSettled === 'function',
  ],
  ['URL', (scope) => typeof scope.URL === 'function'],
  ['TextEncoder', (scope) => typeof scope.TextEncoder === 'function'],
  ['TextDecoder', (scope) => typeof scope.TextDecoder === 'function'],
  [
    'crypto.getRandomValues',
    (scope) => typeof scope.crypto?.getRandomValues === 'function',
  ],
  ['setImmediate', (scope) => typeof scope.setImmediate === 'function'],
  [
    'requestIdleCallback',
    (scope) => typeof scope.requestIdleCallback === 'function',
  ],
  [
    'Array.prototype.flatMap',
    (scope) => typeof scope.Array?.prototype?.flatMap === 'function',
  ],
  [
    'Array.prototype.toSorted',
    (scope) => typeof scope.Array?.prototype?.toSorted === 'function',
  ],
];

function getDefaultRuntimeScope(): IRuntimePolyfillScope {
  return globalThis as unknown as IRuntimePolyfillScope;
}

export function getMissingRuntimeCapabilities(
  scope: IRuntimePolyfillScope = getDefaultRuntimeScope(),
): string[] {
  return runtimeCapabilityChecks
    .filter(([, isAvailable]) => !isAvailable(scope))
    .map(([name]) => name);
}

export function markRuntimePolyfillsReady(
  scope: IRuntimePolyfillScope = getDefaultRuntimeScope(),
): void {
  const missing = getMissingRuntimeCapabilities(scope);
  if (missing.length > 0) {
    throw new Error(
      `[RuntimePolyfills] Cannot complete ${scope.__ONEKEY_RUNTIME_KIND__ ?? 'unknown'} runtime bootstrap. Missing: ${missing.join(', ')}`,
    );
  }
  scope.__ONEKEY_RUNTIME_POLYFILLS_READY__ = RUNTIME_POLYFILLS_VERSION;
}

export function assertRuntimePolyfillsReady(
  scope: IRuntimePolyfillScope = getDefaultRuntimeScope(),
): void {
  if (scope.__ONEKEY_RUNTIME_POLYFILLS_READY__ === RUNTIME_POLYFILLS_VERSION) {
    return;
  }

  const missing = getMissingRuntimeCapabilities(scope);
  const missingSuffix =
    missing.length > 0 ? ` Missing: ${missing.join(', ')}` : '';
  throw new Error(
    `[RuntimePolyfills] Runtime polyfill bootstrap has not completed for ${scope.__ONEKEY_RUNTIME_KIND__ ?? 'unknown'} runtime.${missingSuffix}`,
  );
}
