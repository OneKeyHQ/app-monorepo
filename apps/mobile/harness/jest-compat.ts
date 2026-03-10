// Jest API compatibility layer for react-native-harness.
// Bridges describe/test/it/expect globals, module mock mechanism,
// and the jest global object shim.

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  fn,
  harness,
  spyOn,
  test,
} from 'react-native-harness';

// ---- Test name tracking ----
// The harness runner does not set expect.getState().currentTestName,
// so we track the full hierarchical test name ourselves by wrapping
// describe/test/it. This is needed to build correct snapshot keys.

const describeStack: string[] = [];

export const resetDescribeStack = () => {
  describeStack.length = 0;
};

// Wrap describe to track the describe stack (fn runs synchronously during collection)
// eslint-disable-next-line @typescript-eslint/naming-convention
type DescribeFn = (name: string, fn: () => void) => void;
const wrapDescribe = (original: DescribeFn): DescribeFn => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
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
// eslint-disable-next-line @typescript-eslint/naming-convention
type TestFn = (
  name: string,
  fn: () => void | Promise<void>,
  timeout?: number,
) => void;
const wrapTest = (original: TestFn): TestFn => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
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

// eslint-disable-next-line @typescript-eslint/naming-convention
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
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(
        '[harness-compat] jest.requireActual() was not transformed by babel plugin',
      );
    },
    requireMock: (_moduleName: string) => {
      // Handled by babel plugin -> require('module')
      // eslint-disable-next-line no-restricted-syntax
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
