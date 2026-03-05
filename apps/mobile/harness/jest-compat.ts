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

// test.each: table-driven tests (used by ServiceAppUpdate.test.ts)
const testEach =
  (baseFn: TestFn) =>
  (table: ReadonlyArray<unknown>) =>
  (
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-shadow
    testFn: (...args: any[]) => void | Promise<void>,
    timeout?: number,
  ) => {
    for (const row of table) {
      const args = Array.isArray(row) ? row : [row];
      let title = name;
      let argIdx = 0;
      title = title.replace(/%[sijp]/g, () => {
        const val = args[argIdx];
        argIdx += 1;
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      });
      if (!Array.isArray(row) && row && typeof row === 'object') {
        for (const [key, val] of Object.entries(
          row as Record<string, unknown>,
        )) {
          title = title.replace(
            new RegExp(`\\$${key}`, 'g'),
            typeof val === 'object' ? JSON.stringify(val) : String(val),
          );
        }
      }
      baseFn(title, () => testFn(...args), timeout);
    }
  };

const wrappedTest = Object.assign(wrapTest(test), {
  skip: test.skip,
  only: wrapTest(test.only),
  todo: test.todo,
  each: testEach(wrapTest(test)),
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
  descriptors: Record<string, PropertyDescriptor>;
  defaultDescriptors?: Record<string, PropertyDescriptor>;
};

const mockSnapshots = new Map<Record<string, unknown>, ModSnapshot>();

// Force-set a property on an object, handling read-only and getter-only props.
// Metro marks __esModule as non-writable and re-exports as getter-only,
// so plain assignment / Object.assign would throw.
const forceSet = (
  obj: Record<string, unknown>,
  key: string,
  value: unknown,
) => {
  try {
    obj[key] = value;
  } catch {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
};

const forceDelete = (obj: Record<string, unknown>, key: string) => {
  try {
    delete obj[key];
  } catch {
    try {
      Object.defineProperty(obj, key, {
        value: undefined,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch {
      // Property is non-configurable — nothing we can do
    }
  }
};

const saveSnapshot = (mod: Record<string, unknown>) => {
  if (mockSnapshots.has(mod)) return;
  const snapshot: ModSnapshot = {
    descriptors: Object.getOwnPropertyDescriptors(mod),
  };
  if (
    (mod as any).__esModule &&
    mod.default &&
    typeof mod.default === 'object'
  ) {
    const defaultObj = mod.default as Record<string, unknown>;
    snapshot.defaultDescriptors = Object.getOwnPropertyDescriptors(defaultObj);
  }
  mockSnapshots.set(mod, snapshot);
};

const restoreAllMocks = () => {
  for (const [mod, snapshot] of mockSnapshots) {
    // Restore default export object
    if (
      snapshot.defaultDescriptors &&
      (mod as any).__esModule &&
      mod.default &&
      typeof mod.default === 'object'
    ) {
      const defaultObj = mod.default as Record<string, unknown>;
      for (const key of Object.keys(defaultObj)) {
        if (!(key in snapshot.defaultDescriptors)) {
          forceDelete(defaultObj, key);
        }
      }
      for (const [key, desc] of Object.entries(snapshot.defaultDescriptors)) {
        try {
          Object.defineProperty(defaultObj, key, desc);
        } catch {
          // Best effort restore
        }
      }
    }

    // Restore top-level exports
    for (const key of Object.keys(mod)) {
      if (key !== '__esModule' && !(key in snapshot.descriptors)) {
        forceDelete(mod, key);
      }
    }
    for (const [key, desc] of Object.entries(snapshot.descriptors)) {
      if (key !== '__esModule') {
        try {
          Object.defineProperty(mod, key, desc);
        } catch {
          // Best effort restore
        }
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
            forceDelete(defaultObj, key);
          }
          for (const [key, value] of Object.entries(mockExports)) {
            forceSet(defaultObj, key, value);
          }
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
            forceSet(defaultObj, key, mockExports[key]);
          }
          return;
        }
      }

      // Mutate the module exports directly.
      // Use forceSet/forceDelete to handle read-only __esModule and
      // getter-only re-export properties that Metro generates.
      const keys = Object.keys(mod).filter((k) => k !== '__esModule');
      for (const key of keys) {
        forceDelete(mod, key);
      }
      for (const [key, value] of Object.entries(mockExports)) {
        if (key !== '__esModule') {
          forceSet(mod, key, value);
        }
      }
    }
  } catch (e) {
    console.warn('[harness-compat] __harness_mock_module__ failed:', e);
  }
};

// ---- Fake timer implementation ----
// Minimal fake timer support for harness. Used by ServiceAppUpdate.test.ts,
// hooks.test.ts, and SplashProvider.test.ts.

// eslint-disable-next-line @typescript-eslint/naming-convention
type TimerEntry = {
  cb: (...a: unknown[]) => void;
  delay: number;
  at: number;
  kind: 'timeout' | 'interval';
  args: unknown[];
};

let fakeNow = 0;
let nextId = 1;
const timers = new Map<number, TimerEntry>();

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
const realDateNow = Date.now;

const fakeSetTimeout = (
  cb: (...a: unknown[]) => void,
  delay = 0,
  ...args: unknown[]
): number => {
  nextId += 1;
  timers.set(nextId, { cb, delay, at: fakeNow, kind: 'timeout', args });
  return nextId;
};

const fakeSetInterval = (
  cb: (...a: unknown[]) => void,
  delay = 0,
  ...args: unknown[]
): number => {
  nextId += 1;
  timers.set(nextId, { cb, delay, at: fakeNow, kind: 'interval', args });
  return nextId;
};

const findEarliest = (max?: number): [number, TimerEntry] | null => {
  let best: [number, TimerEntry] | null = null;
  timers.forEach((e, id) => {
    const t = e.at + e.delay;
    if (max !== undefined && t > max) return;
    if (!best || t < best[1].at + best[1].delay) best = [id, e];
  });
  return best;
};

const fireOne = (entry: [number, TimerEntry]) => {
  const [id, e] = entry;
  fakeNow = e.at + e.delay;
  if (e.kind === 'timeout') {
    timers.delete(id);
  } else {
    e.at = fakeNow;
  }
  e.cb(...e.args);
};

const advanceTimersByTime = (ms: number) => {
  const target = fakeNow + ms;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const e = findEarliest(target);
    if (!e) {
      fakeNow = target;
      break;
    }
    fireOne(e);
  }
};

const runAllTimers = () => {
  let safety = 10_000;
  while (timers.size > 0 && safety > 0) {
    safety -= 1;
    const e = findEarliest();
    if (!e) break;
    fireOne(e);
  }
};

const installFakeTimers = () => {
  fakeNow = realDateNow();
  timers.clear();
  nextId = 1;
  (globalThis as any).setTimeout = fakeSetTimeout;
  (globalThis as any).clearTimeout = (id: number) => timers.delete(id);
  (globalThis as any).setInterval = fakeSetInterval;
  (globalThis as any).clearInterval = (id: number) => timers.delete(id);
  Date.now = () => fakeNow;
};

const uninstallFakeTimers = () => {
  timers.clear();
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
  globalThis.setInterval = realSetInterval;
  globalThis.clearInterval = realClearInterval;
  Date.now = realDateNow;
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
    doMock: (_moduleName: string, _factory?: () => unknown) => {
      // jest.doMock is not supported in harness — exclude such tests via
      // testPathIgnorePatterns in jest.harness.config.mjs
      console.warn(
        '[harness-compat] jest.doMock() is not supported in harness mode',
      );
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
    // Fake timer support
    useFakeTimers: () => {
      installFakeTimers();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return (globalThis as any).jest;
    },
    useRealTimers: () => {
      uninstallFakeTimers();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return (globalThis as any).jest;
    },
    advanceTimersByTime,
    advanceTimersByTimeAsync: async (ms: number) => {
      advanceTimersByTime(ms);
    },
    runAllTimers,
    runAllTimersAsync: async () => {
      runAllTimers();
    },
    runOnlyPendingTimers: () => {
      const snapshot = Array.from(timers.entries());
      for (const [id, entry] of snapshot) {
        fakeNow = Math.max(fakeNow, entry.at + entry.delay);
        if (entry.kind === 'timeout') {
          timers.delete(id);
        } else {
          entry.at = fakeNow;
        }
        entry.cb(...entry.args);
      }
    },
    clearAllTimers: () => {
      timers.clear();
    },
    getTimerCount: () => timers.size,
    setSystemTime: (now: number | Date) => {
      fakeNow = typeof now === 'number' ? now : now.getTime();
    },
    isolateModules: (callback: () => void) => {
      callback();
    },
  },
  writable: true,
  configurable: true,
});
