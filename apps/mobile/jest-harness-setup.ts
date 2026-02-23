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
  // Two issues prevent LocalDbIndexed tests from running on Hermes:
  //
  // 1. globalThis mismatch: fake-indexeddb/auto sets indexedDB on `window`,
  //    but in Hermes `window !== globalThis`, so `typeof indexedDB` returns
  //    "undefined". Fixable by manually setting globalThis.indexedDB.
  //
  // 2. Transaction auto-commit timing (blocking): FDBTransaction._start()
  //    uses queueTask (setImmediate/setTimeout) to process requests. After
  //    the last request completes, the next _start() call finds an empty
  //    queue and marks the transaction "finished". But _initDBRecords uses
  //    `await store.get()` → `await store.add()` chains within Promise.all,
  //    and the promise continuations that queue new requests run as microtasks
  //    AFTER _start() has already auto-committed the transaction, causing
  //    InvalidStateError. This happens even with RN's setImmediate polyfill
  //    because Hermes flushes microtasks differently than V8/Node.js.
  //
  // Fixing #2 requires patching FDBTransaction._start() to defer the
  // "finished" transition until after microtasks drain, or restructuring
  // LocalDbIndexed._initDBRecords to avoid async gaps within a transaction.
  // These 2 tests (getContext, getBackupUUID) pass in Jest/Node.js.
} catch (e) {
  console.warn('[harness-compat] fake-indexeddb/auto failed:', e);
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

// ---- Snapshot collection & test name tracking ----
// The harness runner does not set expect.getState().currentTestName,
// so we track the full hierarchical test name ourselves by wrapping
// describe/test/it. This is needed to build correct snapshot keys.

const describeStack: string[] = [];
const snapshotCounts = new Map<string, number>();
const collectedSnapshots: Array<{ key: string; received: unknown }> = [];

(globalThis as any).__harness_collected_snapshots__ = collectedSnapshots;
(globalThis as any).__harness_reset_snapshots__ = () => {
  describeStack.length = 0;
  snapshotCounts.clear();
  collectedSnapshots.length = 0;
};

// Wrap describe to track the describe stack (fn runs synchronously during collection)
type DescribeFn = (name: string, fn: () => void) => void;
const wrapDescribe = (original: DescribeFn): DescribeFn => {
  return (name: string, fn: () => void) => {
    describeStack.push(name);
    try {
      original(name, fn);
    } finally {
      describeStack.pop();
    }
  };
};

const wrappedDescribe = Object.assign(wrapDescribe(describe), {
  skip: wrapDescribe(describe.skip),
  only: wrapDescribe(describe.only),
}) as typeof describe;

// Wrap test/it to capture the full test name at registration time
type TestFn = (name: string, fn: () => void | Promise<void>, timeout?: number) => void;
const wrapTest = (original: TestFn): TestFn => {
  return (name: string, fn: () => void | Promise<void>, timeout?: number) => {
    const capturedAncestors = [...describeStack];
    original(
      name,
      async () => {
        const fullTestName = [...capturedAncestors, name].join(' ');
        (globalThis as any).__harness_current_test_name__ = fullTestName;
        try {
          await fn();
        } finally {
          (globalThis as any).__harness_current_test_name__ = undefined;
        }
      },
      timeout,
    );
  };
};

const wrappedTest = Object.assign(wrapTest(test), {
  skip: test.skip,
  only: wrapTest(test.only),
  todo: test.todo,
}) as typeof test;

// Inject test primitives as globals (matching Jest's behavior)
(globalThis as any).describe = wrappedDescribe;
(globalThis as any).test = wrappedTest;
(globalThis as any).it = wrappedTest;
(globalThis as any).expect = expect;
(globalThis as any).beforeAll = beforeAll;
(globalThis as any).afterAll = afterAll;
(globalThis as any).beforeEach = beforeEach;
(globalThis as any).afterEach = afterEach;

// ---- Module mock auto-restore mechanism ----
// Metro shares a single module registry across all test files (unlike Jest
// which isolates each file). When jest.mock() mutates a module in-place,
// the mutation persists for the lifetime of the harness session.
//
// To prevent mock leakage between test files, we save a shallow snapshot
// of each module before the first mutation, and restore all snapshots after
// each test file finishes (triggered by the runtime patch).

type ModSnapshot = {
  top: Record<string, unknown>;
  defaultObj?: Record<string, unknown>;
};

const mockSnapshots = new Map<Record<string, unknown>, ModSnapshot>();

const saveSnapshot = (mod: Record<string, unknown>) => {
  if (mockSnapshots.has(mod)) return;
  const snapshot: ModSnapshot = { top: {} };
  for (const key of Object.keys(mod)) {
    snapshot.top[key] = mod[key];
  }
  if (
    (mod as any).__esModule &&
    mod.default &&
    typeof mod.default === 'object'
  ) {
    const defaultObj = mod.default as Record<string, unknown>;
    snapshot.defaultObj = {};
    for (const key of Object.keys(defaultObj)) {
      snapshot.defaultObj[key] = defaultObj[key];
    }
  }
  mockSnapshots.set(mod, snapshot);
};

const restoreAllMocks = () => {
  for (const [mod, snapshot] of mockSnapshots) {
    // Restore default export object
    if (
      snapshot.defaultObj &&
      (mod as any).__esModule &&
      mod.default &&
      typeof mod.default === 'object'
    ) {
      const defaultObj = mod.default as Record<string, unknown>;
      for (const key of Object.keys(defaultObj)) {
        if (!(key in snapshot.defaultObj)) {
          delete defaultObj[key];
        }
      }
      Object.assign(defaultObj, snapshot.defaultObj);
    }

    // Restore top-level exports
    for (const key of Object.keys(mod)) {
      if (key !== '__esModule' && !(key in snapshot.top)) {
        delete mod[key];
      }
    }
    for (const key of Object.keys(snapshot.top)) {
      if (key !== '__esModule') {
        mod[key] = snapshot.top[key];
      }
    }
  }
  mockSnapshots.clear();
};

// Exposed for the harness runtime to call between test files.
(globalThis as any).__harness_restore_mocks__ = restoreAllMocks;

// Runtime module mock via in-place mutation.
// The babel plugin transforms jest.mock('mod', factory) into:
//   globalThis.__harness_mock_module__(require('mod'), factory)
// so the module object is already resolved (static require).
// We mutate its exports in-place so property-access patterns
// (e.g. `uuid.v4()`) see the mocked values.
//
// After each test file, __harness_restore_mocks__() restores all mutated
// modules to their pre-mock state, preventing cross-file mock leakage.
(globalThis as any).__harness_mock_module__ = (
  mod: Record<string, unknown>,
  factory: () => unknown,
): void => {
  try {
    // Save original state before first mutation
    saveSnapshot(mod);

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
    setTimeout: (_ms: number) => {
      // no-op: timeout configuration is not applicable in harness mode.
    },
  },
  writable: true,
  configurable: true,
});

// Register snapshot matchers that collect values for host-side comparison.
// The device has no filesystem access to .snap files. Instead, we collect
// {key, received} pairs here and the harness runtime sends them to the host
// after each test file. The host loads the .snap.web file, re-serializes
// received values with pretty-format, and compares.
expect.extend({
  toMatchSnapshot(received: unknown, snapshotName?: string) {
    const currentTestName =
      (globalThis as any).__harness_current_test_name__ || 'unknown test';

    // Build key: "{testName}: {hint} {count}" or "{testName} {count}"
    const baseName = snapshotName
      ? `${currentTestName}: ${snapshotName}`
      : currentTestName;

    const count = (snapshotCounts.get(baseName) || 0) + 1;
    snapshotCounts.set(baseName, count);

    const key = `${baseName} ${count}`;
    collectedSnapshots.push({ key, received });

    // Always pass on device — host will do the real comparison
    return {
      pass: true,
      message: () => `Snapshot "${key}" collected for host-side comparison`,
    };
  },
  toMatchInlineSnapshot(received: unknown, inlineSnapshot?: string) {
    if (inlineSnapshot !== undefined) {
      const receivedStr = JSON.stringify(received);
      const pass = receivedStr === inlineSnapshot.trim();
      if (pass) {
        // Count inline matches so host snapshot stats stay in sync with Jest
        collectedSnapshots.push({
          key: '__inline_matched__',
          received: '__inline_matched__',
        });
      }
      return {
        pass,
        message: () =>
          `Expected inline snapshot to match.\n` +
          `Received: ${receivedStr}\nExpected: ${inlineSnapshot.trim()}`,
      };
    }
    // No inline value provided — in real Jest this writes the value back
    // into the source file. The harness cannot do that, so fail loudly
    // instead of silently passing without any comparison.
    return {
      pass: false,
      message: () =>
        `toMatchInlineSnapshot() called without an inline snapshot value. ` +
        `The harness cannot write snapshots back to source files. ` +
        `Run this test in Jest first to generate the inline snapshot, ` +
        `then re-run in the harness.`,
    };
  },
});
