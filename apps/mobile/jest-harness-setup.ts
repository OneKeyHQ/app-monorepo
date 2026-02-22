// Compatibility shim that bridges Jest globals to react-native-harness equivalents.
// This runs on the Hermes device (via setupFilesAfterEnv) before each test file,
// allowing existing *.test.ts files to work unchanged in the harness environment.

// Polyfill Node.js globals that don't exist in Hermes
import { Buffer } from 'buffer';

(globalThis as any).Buffer = Buffer;
(globalThis as any).process = (globalThis as any).process || { env: {} };

// Load WHATWG-compliant URL polyfill. The normal app loads this via
// polyfillsPlatform.js, but the harness entry point skips app polyfills.
// Without this, RN's built-in regex-based URL class is used, which only
// parses HTTP/HTTPS URLs and breaks all custom scheme parsing (onekey-wallet://,
// solana:, wc:, bitcoin:, etc.).
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('react-native-url-polyfill/auto');

// Trigger cross-crypto initialization which properly sets up
// globalThis.crypto.getRandomValues via react-native-get-random-values.
// IMPORTANT: Do NOT import react-native-get-random-values directly here.
// cross-crypto deletes getRandomValues then re-requires the polyfill;
// if we pre-load it, the require becomes a cached no-op and getRandomValues
// stays deleted, causing "Cannot read property 'apply' of undefined".
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('crypto');

// Mark harness as Jest-like so platformEnv.isJest checks pass.
// This prevents "Passing raw password is not allowed" errors in tests
// and disables intl formatting fallbacks that change error messages.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const platformEnv = require('@onekeyhq/shared/src/platformEnv');
const platformEnvObj = platformEnv?.default ?? platformEnv;
if (platformEnvObj && typeof platformEnvObj === 'object') {
  platformEnvObj.isJest = true;
}

// Polyfill TextDecoder/TextEncoder for Hermes.
// Hermes may have a native TextDecoder that doesn't support the `fatal` option,
// which causes "Failed to construct 'TextDecoder': the 'fatal' option is unsupported"
// errors in @solana/web3.js and other libraries. Wrap it to accept `fatal`.
{
  const NativeTD = (globalThis as any).TextDecoder;
  let needsWrap = !NativeTD;
  if (NativeTD && !needsWrap) {
    try {
      new NativeTD('utf-8', { fatal: true });
    } catch {
      needsWrap = true;
    }
  }
  if (needsWrap && NativeTD) {
    // Wrap native TextDecoder using a class so `new TextDecoder()` works
    // correctly in Hermes (function-based constructors that return a different
    // object can cause "Cannot read property 'prototype' of undefined" in Hermes).
    // NOTE: Do NOT require('fast-text-encoding') here even as a fallback.
    // Including it in the bundle causes Metro to resolve all TextDecoder
    // references to fast-text-encoding's non-fatal-supporting polyfill,
    // breaking @solana/web3.js and other libraries that use { fatal: true }.
    const WrappedTD = class TextDecoder {
      _inner: any;
      constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean }) {
        const safeOptions = options ? { ignoreBOM: options.ignoreBOM } : undefined;
        this._inner = new NativeTD(label, safeOptions);
      }
      decode(input?: ArrayBufferView | ArrayBuffer, options?: { stream?: boolean }): string {
        return this._inner.decode(input, options);
      }
      get encoding(): string {
        return this._inner.encoding;
      }
      get fatal(): boolean {
        return false;
      }
      get ignoreBOM(): boolean {
        return this._inner.ignoreBOM ?? false;
      }
    };
    (globalThis as any).TextDecoder = WrappedTD;
    // Also set on `global` — in Metro's module wrapper, bare `TextDecoder`
    // may resolve through `global` rather than `globalThis`. Without this,
    // Hermes throws "Property 'TextDecoder' doesn't exist" for code that
    // uses `new TextDecoder()` without an explicit `globalThis.` prefix.
    if (typeof global !== 'undefined') {
      (global as any).TextDecoder = WrappedTD;
    }
  }
}

// Polyfill structuredClone for Hermes (needed by fake-indexeddb and other libs).
// Mirrors the polyfill in jest-setup.js for the Node.js Jest environment.
if (typeof (globalThis as any).structuredClone === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (globalThis as any).structuredClone = require('@ungap/structured-clone').default;
  } catch {
    // @ungap/structured-clone not available in bundle
  }
}

// Polyfill IndexedDB for Hermes (needed by LocalDbIndexed tests).
// fake-indexeddb is a pure-JS in-memory implementation that works once
// structuredClone is available. Without this, LocalDbIndexed tests are skipped.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('fake-indexeddb/auto');
} catch {
  // fake-indexeddb may not resolve in all Metro configurations
}

// Polyfill ES2023 Array methods not yet available in Hermes
if (!Array.prototype.toSorted) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toSorted = function <T>(
    this: T[],
    compareFn?: (a: T, b: T) => number,
  ): T[] {
    return [...this].sort(compareFn);
  };
}
if (!Array.prototype.toReversed) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toReversed = function <T>(this: T[]): T[] {
    return [...this].reverse();
  };
}
if (!Array.prototype.toSpliced) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toSpliced = function <T>(
    this: T[],
    start: number,
    deleteCount?: number,
    ...items: T[]
  ): T[] {
    const copy = [...this];
    copy.splice(start, deleteCount ?? 0, ...items);
    return copy;
  };
}

import {
  describe,
  test,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  fn,
  spyOn,
  harness,
} from 'react-native-harness';

// Inject test primitives as globals (matching Jest's behavior)
(globalThis as any).describe = describe;
(globalThis as any).test = test;
(globalThis as any).it = it;
(globalThis as any).expect = expect;
(globalThis as any).beforeAll = beforeAll;
(globalThis as any).afterAll = afterAll;
(globalThis as any).beforeEach = beforeEach;
(globalThis as any).afterEach = afterEach;

// Runtime module mock via in-place mutation.
// The babel plugin transforms jest.mock('mod', factory) into:
//   globalThis.__harness_mock_module__(require('mod'), factory)
// so the module object is already resolved (static require).
// We mutate its exports in-place so property-access patterns
// (e.g. `uuid.v4()`) see the mocked values.
//
// WARNING: Unlike Jest, Metro shares a single module registry across all test
// files. Mocks applied here mutate the module in-place and persist for the
// lifetime of the harness session. This means test file execution order can
// affect results — if file A mocks `crypto`, file B will see the mutated
// version. The canonical test verification runs in the standard Node.js Jest
// environment where each file has its own isolated module cache.
(globalThis as any).__harness_mock_module__ = (
  mod: Record<string, unknown>,
  factory: () => unknown,
): void => {
  try {
    const mockExports = factory() as Record<string, unknown>;

    if (
      mod &&
      typeof mod === 'object' &&
      mockExports &&
      typeof mockExports === 'object'
    ) {
      // If the module has a default export object, mutate it in-place
      // (covers `import uuid from 'react-native-uuid'` patterns)
      if (
        (mod as any).__esModule &&
        mod.default &&
        typeof mod.default === 'object'
      ) {
        const defaultObj = mod.default as Record<string, unknown>;
        if (!(mockExports as any).__esModule && !mockExports.default) {
          const keys = Object.keys(defaultObj);
          for (const key of keys) {
            delete defaultObj[key];
          }
          Object.assign(defaultObj, mockExports);
          return;
        }
        // Handle spread pattern: { ...require('esModule'), extraProp: true }
        // The spread includes __esModule and default from the original module.
        // Extra properties should be merged into the default export object
        // so that `import X from 'mod'` (which resolves to mod.default) sees them.
        if (
          (mockExports as any).__esModule &&
          mockExports.default === defaultObj
        ) {
          const extraKeys = Object.keys(mockExports).filter(
            (k) => k !== '__esModule' && k !== 'default',
          );
          for (const key of extraKeys) {
            defaultObj[key] = mockExports[key];
          }
          return;
        }
      }

      // Mutate the module exports directly
      const keys = Object.keys(mod).filter((k) => k !== '__esModule');
      for (const key of keys) {
        delete mod[key];
      }
      Object.assign(mod, mockExports);
    }
  } catch (e) {
    console.warn('[harness-compat] __harness_mock_module__ failed:', e);
  }
};

// Override the harness jest-mock Proxy with a compat shim.
// The patch to @react-native-harness/runtime makes the property configurable,
// allowing this override.
//
// NOTE: jest.mock() and jest.requireActual/requireMock are transformed by
// babel-plugin-jest-compat at compile time. The functions below are fallbacks
// that should rarely be called at runtime. They intentionally do NOT use
// dynamic require() since Metro forbids it.
Object.defineProperty(globalThis, 'jest', {
  value: {
    fn,
    spyOn,
    mock: (_moduleName: string, _factory?: () => unknown) => {
      // Handled by babel plugin -> __harness_mock_module__
      // This fallback is a no-op for edge cases the plugin doesn't catch
    },
    unmock: (_moduleName: string) => {
      // no-op
    },
    requireActual: (_moduleName: string) => {
      // Handled by babel plugin -> require('module')
      // This fallback should not be reached
      throw new Error(
        '[harness-compat] jest.requireActual() was not transformed by babel plugin',
      );
    },
    requireMock: (_moduleName: string) => {
      // Handled by babel plugin -> require('module')
      throw new Error(
        '[harness-compat] jest.requireMock() was not transformed by babel plugin',
      );
    },
    clearAllMocks: harness.clearAllMocks,
    resetAllMocks: harness.resetAllMocks,
    restoreAllMocks: harness.restoreAllMocks,
    resetModules: harness.resetModules,
    isMockFunction: (f: unknown): boolean => {
      return typeof f === 'function' && '_isMockFunction' in (f as any);
    },
  },
  writable: true,
  configurable: true,
});

// Register toMatchSnapshot fallback matcher.
// In harness mode there is no filesystem-based snapshot storage,
// so we degrade to a no-op pass. The real snapshot verification
// continues to run in the standard Node.js Jest environment.
expect.extend({
  toMatchSnapshot(received: unknown, _snapshotName?: string) {
    return {
      pass: received !== undefined && received !== null,
      message: () =>
        'toMatchSnapshot() is not supported in harness mode. ' +
        `Received value: ${String(received).slice(0, 100)}`,
    };
  },
  toMatchInlineSnapshot(received: unknown, inlineSnapshot?: string) {
    if (inlineSnapshot !== undefined) {
      const receivedStr = JSON.stringify(received);
      const pass = receivedStr === inlineSnapshot.trim();
      return {
        pass,
        message: () =>
          `Expected inline snapshot to match.\n` +
          `Received: ${receivedStr}\nExpected: ${inlineSnapshot.trim()}`,
      };
    }
    return {
      pass: received !== undefined && received !== null,
      message: () =>
        'toMatchInlineSnapshot() is not supported in harness mode (no inline snapshot provided). ' +
        `Received value: ${String(received).slice(0, 100)}`,
    };
  },
});
