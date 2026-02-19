// Compatibility shim that bridges Jest globals to react-native-harness equivalents.
// This runs on the Hermes device (via setupFilesAfterEnv) before each test file,
// allowing existing *.test.ts files to work unchanged in the harness environment.

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

// Runtime module mock implementation.
// Unlike Jest's babel-jest hoisting, Metro bundles don't support hoisting.
// Instead, we mutate the module's exports object in-place after it has been
// loaded. Since all importers hold a reference to the same exports object,
// property-access patterns (e.g. `uuid.v4()`) will see the mocked values.
// Note: destructured imports captured at import-time won't be affected,
// but most module patterns in this codebase use namespace/default imports.
function runtimeMockModule(moduleName: string, factory: () => unknown): void {
  try {
    const mod = require(moduleName) as Record<string, unknown>;
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
        // If the mock factory returns an object without __esModule,
        // treat it as a replacement for the default export
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
    console.warn(
      `[harness-compat] jest.mock('${moduleName}') runtime mutation failed:`,
      e,
    );
  }
}

// Override the harness jest-mock Proxy with a compat shim.
// The patch to @react-native-harness/runtime makes the property configurable,
// allowing this override.
Object.defineProperty(globalThis, 'jest', {
  value: {
    fn,
    spyOn,
    mock: (moduleName: string, factory?: () => unknown) => {
      if (factory) {
        runtimeMockModule(moduleName, factory);
      }
      // jest.mock('module') without factory is a no-op (auto-mock not supported)
    },
    unmock: (_moduleName: string) => {
      // no-op
    },
    requireActual: (moduleName: string) => {
      // In Metro, require() already returns the real module
      return require(moduleName);
    },
    requireMock: (moduleName: string) => {
      // In harness mode, requireMock returns the (possibly mutated) module
      return require(moduleName);
    },
    clearAllMocks: harness.clearAllMocks,
    resetAllMocks: harness.resetAllMocks,
    restoreAllMocks: harness.restoreAllMocks,
    resetModules: harness.resetModules,
    // Provide mockImplementation/mockReturnValue support via fn()
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
