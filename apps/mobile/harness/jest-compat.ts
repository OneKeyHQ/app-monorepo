// Jest API compatibility layer for react-native-harness.
// Bridges describe/test/it/expect globals, module mock mechanism,
// and the jest global object shim.

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

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

// Implements the `.each(table)(name, fn, timeout)` pattern — registers one test per entry.
// Supports 1D arrays (each entry is a single arg) and 2D arrays (each row is spread).
const makeEach =
  (testFn: TestFn) =>
  (table: ReadonlyArray<unknown>) =>
  (
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-shadow
    fn: (...args: any[]) => void | Promise<void>,
    timeout?: number,
  ) => {
    for (let i = 0; i < table.length; i += 1) {
      const entry = table[i];
      const args = Array.isArray(entry) ? entry : [entry];
      let testName = name;
      let argIdx = 0;
      testName = testName.replace(/%[sdifjo#p]/g, (match) => {
        if (match === '%#') return String(i);
        if (argIdx < args.length) {
          const val = args[argIdx];
          argIdx += 1;
          if (match === '%j') {
            try {
              return JSON.stringify(val);
            } catch {
              return String(val);
            }
          }
          return String(val);
        }
        return match;
      });
      testFn(testName, () => fn(...args), timeout);
    }
  };

const wrappedTest = Object.assign(wrapTest(test), {
  skip: test.skip,
  only: wrapTest(test.only),
  todo: test.todo,
  each: makeEach(wrapTest(test)),
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
const registeredModuleMocks = new Map<number, () => unknown>();

// Sentinel value for keys whose getter threw during snapshot.
// These keys existed on the module but couldn't be read, so restoreAllMocks
// must skip them (neither delete nor overwrite) to avoid state corruption.
const GETTER_THREW = Symbol('GETTER_THREW');

// ---- Safe property mutation helpers ----
// Metro's `export *` re-exports create getter-only (non-writable, non-configurable)
// property descriptors. Direct assignment / delete throws on these. We use
// Object.getOwnPropertyDescriptor to check before mutating.

const safeDelete = (obj: Record<string, unknown>, key: string): boolean => {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (!desc) return true;
  if (desc.configurable) {
    delete obj[key];
    return true;
  }
  if (desc.writable) {
    obj[key] = undefined;
    return true;
  }
  return false;
};

const safeSet = (
  obj: Record<string, unknown>,
  key: string,
  value: unknown,
): boolean => {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (!desc) {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return true;
  }
  if (desc.configurable) {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: desc.enumerable,
      configurable: true,
    });
    return true;
  }
  if (desc.writable) {
    obj[key] = value;
    return true;
  }
  return false;
};

const saveSnapshot = (mod: Record<string, unknown>) => {
  if (mockSnapshots.has(mod)) return;
  const snapshot: ModSnapshot = { top: {} };
  for (const key of Object.keys(mod)) {
    try {
      snapshot.top[key] = mod[key];
    } catch {
      // Getter threw — mark with sentinel so restoreAllMocks knows to skip it
      snapshot.top[key] = GETTER_THREW;
    }
  }
  if (
    (mod as any).__esModule &&
    mod.default &&
    typeof mod.default === 'object'
  ) {
    const defaultObj = mod.default as Record<string, unknown>;
    snapshot.defaultObj = {};
    for (const key of Object.keys(defaultObj)) {
      try {
        snapshot.defaultObj[key] = defaultObj[key];
      } catch {
        // Getter threw — mark with sentinel so restoreAllMocks knows to skip it
        snapshot.defaultObj[key] = GETTER_THREW;
      }
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
          safeDelete(defaultObj, key);
        }
      }
      for (const key of Object.keys(snapshot.defaultObj)) {
        // Skip keys whose getter threw during snapshot — don't restore unknown state
        if (snapshot.defaultObj[key] !== GETTER_THREW) {
          safeSet(defaultObj, key, snapshot.defaultObj[key]);
        }
      }
    }

    // Restore top-level exports
    for (const key of Object.keys(mod)) {
      if (key !== '__esModule' && !(key in snapshot.top)) {
        safeDelete(mod, key);
      }
    }
    for (const key of Object.keys(snapshot.top)) {
      // Skip keys whose getter threw during snapshot — don't restore unknown state
      if (key !== '__esModule' && snapshot.top[key] !== GETTER_THREW) {
        safeSet(mod, key, snapshot.top[key]);
      }
    }
  }
  mockSnapshots.clear();
};

// Exposed for the harness runtime to call between test files.
(globalThis as any).__harness_restore_mocks__ = () => {
  restoreAllMocks();
  registeredModuleMocks.clear();
  harness.resetModules();
};

(globalThis as any).__harness_mock_module_id__ = (
  moduleId: number,
  factory: () => unknown,
): void => {
  registeredModuleMocks.set(moduleId, factory);
  harness.mock(moduleId as unknown as string, factory);
};

(globalThis as any).__harness_mock_actual_module_id__ = (
  moduleId: number,
  factory: () => unknown,
): void => {
  const actual = harness.requireActual(moduleId as unknown as string);
  if (actual && typeof actual === 'object') {
    (globalThis as any).__harness_mock_module__(
      actual as Record<string, unknown>,
      factory,
    );
  }
};

(globalThis as any).__harness_require_actual__ = (moduleId: number): unknown =>
  harness.requireActual(moduleId as unknown as string);

const resetModules = () => {
  harness.resetModules();
  for (const [moduleId, factory] of registeredModuleMocks) {
    harness.mock(moduleId as unknown as string, factory);
  }
};

// Runtime module mock via in-place mutation.
// The babel plugin transforms jest.mock('mod', factory) into:
//   globalThis.__harness_mock_module_id__(require.resolveWeak('mod'), factory)
// so the module can be replaced before first require. This in-place mutation
// fallback is kept for older transformed bundles and edge cases where a module
// object is already resolved.
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
            if (!safeDelete(defaultObj, key)) {
              console.warn(
                `[harness-compat] Cannot remove read-only export "${key}" — original value persists`,
              );
            }
          }
          for (const key of Object.keys(mockExports)) {
            if (!safeSet(defaultObj, key, mockExports[key])) {
              console.warn(
                `[harness-compat] Cannot mock read-only export "${key}" — test may use unmocked value`,
              );
            }
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
            if (!safeSet(defaultObj, key, mockExports[key])) {
              console.warn(
                `[harness-compat] Cannot mock read-only export "${key}" — test may use unmocked value`,
              );
            }
          }
          return;
        }
      }

      // Mutate the module exports directly
      const keys = Object.keys(mod).filter((k) => k !== '__esModule');
      for (const key of keys) {
        if (!safeDelete(mod, key)) {
          console.warn(
            `[harness-compat] Cannot remove read-only export "${key}" — original value persists`,
          );
        }
      }
      for (const key of Object.keys(mockExports)) {
        if (key !== '__esModule') {
          if (!safeSet(mod, key, mockExports[key])) {
            console.warn(
              `[harness-compat] Cannot mock read-only export "${key}" — test may use unmocked value`,
            );
          }
        }
      }
    }
  } catch (e) {
    console.warn('[harness-compat] __harness_mock_module__ failed:', e);
  }
};

// ---- Fake timers ----
// Keep this implementation intentionally small: it covers the timer APIs used
// by repository unit tests without pulling Node-only Jest fake timer internals
// into the Hermes bundle.
type ITimerTask = {
  args: unknown[];
  callback: (...args: unknown[]) => void;
  interval?: number;
  time: number;
};

const realTimerGlobals = {
  Date: globalThis.Date,
  clearInterval: globalThis.clearInterval,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  setTimeout: globalThis.setTimeout,
};

let fakeTimersInstalled = false;
let fakeNow = realTimerGlobals.Date.now();
let nextTimerId = 1;
const fakeTimerTasks = new Map<number, ITimerTask>();

const makeFakeDate = () => {
  const RealDate = realTimerGlobals.Date;
  const FakeDate = function fakeDate(this: unknown, ...args: unknown[]) {
    if (this instanceof FakeDate) {
      return args.length > 0
        ? Reflect.construct(RealDate, args)
        : new RealDate(fakeNow);
    }
    return new RealDate(fakeNow).toString();
  } as unknown as DateConstructor;

  Object.setPrototypeOf(FakeDate, RealDate);
  Object.defineProperty(FakeDate, 'prototype', {
    value: RealDate.prototype,
  });
  FakeDate.now = () => fakeNow;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  return FakeDate;
};

const runMicrotasks = async () => {
  await Promise.resolve();
};

const scheduleFakeTimer = (
  callback: TimerHandler,
  delay?: number,
  args: unknown[] = [],
  interval?: number,
) => {
  const id = nextTimerId;
  nextTimerId += 1;
  const timeout = Math.max(0, Number(delay) || 0);
  fakeTimerTasks.set(id, {
    args,
    callback:
      typeof callback === 'function'
        ? (...callbackArgs) => {
            callback(...callbackArgs);
          }
        : () => {
            // eslint-disable-next-line no-eval
            eval(String(callback));
          },
    interval,
    time: fakeNow + timeout,
  });
  return id as unknown as ReturnType<typeof setTimeout>;
};

const runDueTimers = (targetTime: number, onlyTimerIds?: Set<number>) => {
  let guard = 100_000;
  while (guard > 0) {
    guard -= 1;
    let due: [number, ITimerTask] | undefined;
    for (const entry of fakeTimerTasks.entries()) {
      const [id, task] = entry;
      const shouldRun =
        task.time <= targetTime && (!onlyTimerIds || onlyTimerIds.has(id));
      const shouldReplaceDue =
        shouldRun &&
        (!due ||
          task.time < due[1].time ||
          (task.time === due[1].time && id < due[0]));
      if (shouldReplaceDue) {
        due = entry;
      }
    }
    if (!due) break;

    const [id, task] = due;
    fakeNow = task.time;
    if (task.interval === undefined) {
      fakeTimerTasks.delete(id);
    }
    task.callback(...task.args);
    if (task.interval !== undefined && fakeTimerTasks.has(id)) {
      fakeTimerTasks.set(id, {
        ...task,
        time: fakeNow + Math.max(0, task.interval),
      });
    }
  }
  if (guard <= 0) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('[harness-compat] Aborting fake timers after 100000 runs');
  }
  fakeNow = targetTime;
};

const useFakeTimers = () => {
  if (!fakeTimersInstalled) {
    fakeNow = realTimerGlobals.Date.now();
    fakeTimerTasks.clear();
    fakeTimersInstalled = true;
    (globalThis as any).Date = makeFakeDate();
    (globalThis as any).setTimeout = (
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => scheduleFakeTimer(callback, delay, args);
    (globalThis as any).clearTimeout = (id: number) => {
      fakeTimerTasks.delete(Number(id));
    };
    (globalThis as any).setInterval = (
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) =>
      scheduleFakeTimer(callback, delay, args, Math.max(0, Number(delay) || 0));
    (globalThis as any).clearInterval = (id: number) => {
      fakeTimerTasks.delete(Number(id));
    };
  }
  return (globalThis as any).jest;
};

const useRealTimers = () => {
  if (fakeTimersInstalled) {
    fakeTimerTasks.clear();
    fakeTimersInstalled = false;
    globalThis.Date = realTimerGlobals.Date;
    globalThis.setTimeout = realTimerGlobals.setTimeout;
    globalThis.clearTimeout = realTimerGlobals.clearTimeout;
    globalThis.setInterval = realTimerGlobals.setInterval;
    globalThis.clearInterval = realTimerGlobals.clearInterval;
  }
  return (globalThis as any).jest;
};

const setSystemTime = (now?: number | Date) => {
  if (now instanceof realTimerGlobals.Date) {
    fakeNow = now.getTime();
  } else if (typeof now === 'number') {
    fakeNow = now;
  } else {
    fakeNow = realTimerGlobals.Date.now();
  }
  return (globalThis as any).jest;
};

(globalThis as any).__harness_use_real_timers__ = useRealTimers;

// Override the harness jest-mock Proxy with a compat shim.
// The patch to @react-native-harness/runtime makes the property configurable,
// allowing this override.
//
// NOTE: jest.mock() and jest.requireActual/requireMock are transformed by
// babel-plugin-jest-compat at compile time. The functions below are fallbacks
// that should rarely be called at runtime. They intentionally do NOT use
// dynamic require() since Metro forbids it.
const jestCompat = {
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
  useFakeTimers,
  useRealTimers,
  setSystemTime,
  getRealSystemTime: () => realTimerGlobals.Date.now(),
  now: () => fakeNow,
  advanceTimersByTime: (ms: number) => {
    runDueTimers(fakeNow + Math.max(0, Number(ms) || 0));
    return (globalThis as any).jest;
  },
  advanceTimersByTimeAsync: async (ms: number) => {
    runDueTimers(fakeNow + Math.max(0, Number(ms) || 0));
    await runMicrotasks();
    return (globalThis as any).jest;
  },
  runAllTimers: () => {
    let guard = 100_000;
    while (fakeTimerTasks.size > 0) {
      guard -= 1;
      if (guard <= 0) {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error(
          '[harness-compat] Aborting fake timers after 100000 runs',
        );
      }
      const nextTime = Math.min(
        ...[...fakeTimerTasks.values()].map((t) => t.time),
      );
      runDueTimers(nextTime);
    }
    return (globalThis as any).jest;
  },
  runOnlyPendingTimers: () => {
    const pendingIds = new Set(fakeTimerTasks.keys());
    const maxTime = Math.max(
      ...[...fakeTimerTasks.values()].map((t) => t.time),
    );
    if (Number.isFinite(maxTime)) {
      runDueTimers(maxTime, pendingIds);
    }
    return (globalThis as any).jest;
  },
  clearAllTimers: () => {
    fakeTimerTasks.clear();
    return (globalThis as any).jest;
  },
  getTimerCount: () => fakeTimerTasks.size,
  clearAllMocks: harness.clearAllMocks,
  resetAllMocks: harness.resetAllMocks,
  restoreAllMocks: harness.restoreAllMocks,
  resetModules,
  // jest.doMock / jest.isolateModules are not supported in the harness
  // environment (Metro shares a single module registry). Provide no-op
  // stubs to prevent crashes from undefined function calls.
  doMock: (_moduleName: string, _factory?: () => unknown) => {
    console.warn(
      `[harness-compat] jest.doMock('${_moduleName}') is not supported in harness mode`,
    );
  },
  dontMock: (_moduleName: string) => {
    // no-op
  },
  // eslint-disable-next-line @typescript-eslint/no-shadow
  isolateModules: (fn: () => void) => {
    console.warn(
      '[harness-compat] jest.isolateModules() is not supported in harness mode, running inline',
    );
    fn();
  },
  // eslint-disable-next-line @typescript-eslint/no-shadow
  isolateModulesAsync: async (fn: () => Promise<void>) => {
    console.warn(
      '[harness-compat] jest.isolateModulesAsync() is not supported in harness mode, running inline',
    );
    await fn();
  },
  isMockFunction: (f: unknown): boolean => {
    return typeof f === 'function' && '_isMockFunction' in (f as any);
  },
  mocked: <T>(source: T): T => source,
  setTimeout: (_ms: number) => {
    // no-op: timeout configuration is not applicable in harness mode.
  },
};

Object.defineProperty(globalThis, 'jest', {
  value: jestCompat,
  writable: true,
  configurable: true,
});
