// Compatibility shim that bridges Jest globals to react-native-harness equivalents.
// This runs on the Hermes device (via setupFilesAfterEnv) before each test file,
// allowing existing *.test.ts files to work unchanged in the harness environment.

// Polyfill Node.js globals that don't exist in Hermes
import { Buffer } from 'buffer';

(globalThis as any).Buffer = Buffer;
(globalThis as any).process = (globalThis as any).process || { env: {} };

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
});
