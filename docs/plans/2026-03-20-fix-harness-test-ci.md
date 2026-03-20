# Fix Harness Test CI Failures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Android harness test CI (`03-harness-test`) so all tests pass — no skips, no ignored failures, no bypassed execution.

**Architecture:** Three targeted fixes in `apps/mobile/harness/jest-compat.ts`: (1) implement `test.each` polyfill, (2) make module mock mutation robust against read-only property descriptors from Metro's `export *` re-exports, (3) make mock restoration robust against the same. These are all in one file.

**Tech Stack:** TypeScript, react-native-harness, Metro bundler, Hermes runtime

---

## Root Cause Analysis

The CI run `23319048009` fails with a 30-minute timeout. The sequence:

1. `ServiceAppUpdate.test.ts` crashes during collection: `TypeError: test.each is not a function (it is undefined)` — the harness compat layer never added `test.each` to the wrapped test function.
2. Mock setup warnings: `Cannot assign to property 'appUpdatePersistAtom' which has only a getter` and `Cannot assign to read-only property '__esModule'` — Metro's `export *` re-exports create getter-only property descriptors. `Object.assign()` and direct `delete`/assignment fail on these.
3. After the one passing test (`secret.test.ts`) completes, the app restarts but no more tests load, causing a hang until the 30-minute timeout.

Fix (1) and (2) resolve the root causes. Fix (3) — the hang — is a consequence that goes away once `ServiceAppUpdate.test.ts` loads and runs correctly.

---

### Task 1: Implement `test.each` in the harness compat layer

**Files:**
- Modify: `apps/mobile/harness/jest-compat.ts:56-80`

**Context:** The `test.each(table)(name, fn, timeout)` API takes an array of test data and registers one `test()` call per entry. In the codebase it's only used with 1D arrays (each entry is a single argument). The `%s` placeholder in the test name is replaced with `String(entry)`.

**Step 1: Add `test.each` implementation**

After the `wrapTest` function (line 74), before the `wrappedTest` assignment (line 76), add:

```typescript
// test.each(table)(name, fn, timeout) — registers one test per entry.
// Supports 1D arrays (each entry is a single arg) and 2D arrays (each row is spread).
// %s in name is replaced with String(entry) for 1D, or positional args for 2D.
const makeEach =
  (testFn: TestFn) =>
  (table: ReadonlyArray<unknown>) =>
  (
    name: string,
    fn: (...args: any[]) => void | Promise<void>,
    timeout?: number,
  ) => {
    for (let i = 0; i < table.length; i++) {
      const entry = table[i];
      const args = Array.isArray(entry) ? entry : [entry];
      let testName = name;
      // Replace %s, %d, %i, %f, %j, %p, %o, %# placeholders
      let argIdx = 0;
      testName = testName.replace(/%[sdifjo#p]/g, (match) => {
        if (match === '%#') return String(i);
        if (argIdx < args.length) {
          const val = args[argIdx++];
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
```

Then modify the `wrappedTest` assignment to include `each`:

```typescript
const wrappedTest = Object.assign(wrapTest(test), {
  skip: test.skip,
  only: wrapTest(test.only),
  todo: test.todo,
  each: makeEach(wrapTest(test)),
}) as typeof test;
```

**Step 2: Verify locally that TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit harness/jest-compat.ts` (or just check via IDE).

**Step 3: Commit**

```
fix: implement test.each in harness jest-compat layer
```

---

### Task 2: Make `__harness_mock_module__` robust against read-only properties

**Files:**
- Modify: `apps/mobile/harness/jest-compat.ts:174-234`

**Context:** Metro's `export *` re-exports create getter-only (non-writable, non-configurable) property descriptors on the barrel module object. `Object.assign()` and `delete` fail silently or throw on these. We need to check `Object.getOwnPropertyDescriptor` before mutating and use `Object.defineProperty` to forcefully overwrite configurable properties.

**Step 1: Add a safe property mutation helper**

Add above the `__harness_mock_module__` definition (before line 174):

```typescript
// Safely delete a property, respecting its descriptor.
// Returns true if the property was removed.
const safeDelete = (obj: Record<string, unknown>, key: string): boolean => {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (!desc) return true; // already gone
  if (desc.configurable) {
    delete obj[key];
    return true;
  }
  // Non-configurable: try to zero it out if writable
  if (desc.writable) {
    obj[key] = undefined;
    return true;
  }
  return false; // truly immutable
};

// Safely set a property, respecting its descriptor.
const safeSet = (
  obj: Record<string, unknown>,
  key: string,
  value: unknown,
): boolean => {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (!desc) {
    // New property — define as writable+configurable so future restores work
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
  // Has a getter but no setter and is non-configurable — skip silently
  return false;
};
```

**Step 2: Replace direct mutations in `__harness_mock_module__` and `restoreAllMocks`**

In `__harness_mock_module__` (the function assigned at line 174), replace all `delete mod[key]`, `delete defaultObj[key]`, `Object.assign(defaultObj, mockExports)`, and `Object.assign(mod, mockExports)` with safe equivalents:

Replace lines 199-203 (default export mutation):
```typescript
        if (!(mockExports as any).__esModule && !mockExports.default) {
          const keys = Object.keys(defaultObj);
          for (const key of keys) {
            safeDelete(defaultObj, key);
          }
          for (const key of Object.keys(mockExports)) {
            safeSet(defaultObj, key, mockExports[key]);
          }
          return;
        }
```

Replace lines 217-218 (spread pattern extra keys):
```typescript
          for (const key of extraKeys) {
            safeSet(defaultObj, key, mockExports[key]);
          }
```

Replace lines 225-229 (direct module mutation):
```typescript
      const keys = Object.keys(mod).filter((k) => k !== '__esModule');
      for (const key of keys) {
        safeDelete(mod, key);
      }
      for (const key of Object.keys(mockExports)) {
        if (key !== '__esModule') {
          safeSet(mod, key, mockExports[key]);
        }
      }
```

**Step 3: Replace direct mutations in `restoreAllMocks`**

Replace lines 139-144 (default restore):
```typescript
      for (const key of Object.keys(defaultObj)) {
        if (!(key in snapshot.defaultObj)) {
          safeDelete(defaultObj, key);
        }
      }
      for (const key of Object.keys(snapshot.defaultObj)) {
        safeSet(defaultObj, key, snapshot.defaultObj[key]);
      }
```

Replace lines 148-157 (top-level restore):
```typescript
    for (const key of Object.keys(mod)) {
      if (key !== '__esModule' && !(key in snapshot.top)) {
        safeDelete(mod, key);
      }
    }
    for (const key of Object.keys(snapshot.top)) {
      if (key !== '__esModule') {
        safeSet(mod, key, snapshot.top[key]);
      }
    }
```

**Step 4: Also fix `saveSnapshot` to read through getters properly**

Replace lines 112-113 (top-level snapshot):
```typescript
  for (const key of Object.keys(mod)) {
    try {
      snapshot.top[key] = mod[key];
    } catch {
      // Getter threw — skip this key in snapshot
    }
  }
```

Replace lines 122-123 (default obj snapshot):
```typescript
    for (const key of Object.keys(defaultObj)) {
      try {
        snapshot.defaultObj[key] = defaultObj[key];
      } catch {
        // Getter threw — skip
      }
    }
```

**Step 5: Commit**

```
fix: handle read-only property descriptors in harness mock module
```

---

### Task 3: Verify all tests pass locally (if possible) and in CI

**Step 1: Run the Jest unit tests locally to verify no regressions**

```bash
yarn jest packages/kit-bg/src/services/ServiceAppUpdate.test.ts --no-cache
```

Expected: All tests pass, including the `test.each` parameterized tests.

**Step 2: Run full test suite**

```bash
yarn test
```

**Step 3: Commit any remaining fixes and push**

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `apps/mobile/harness/jest-compat.ts` | Add `makeEach` + attach to `wrappedTest.each` | `test.each` support |
| `apps/mobile/harness/jest-compat.ts` | Add `safeDelete`/`safeSet` helpers | Handle read-only descriptors |
| `apps/mobile/harness/jest-compat.ts` | Update `__harness_mock_module__` to use safe helpers | Fix mock mutation for `export *` modules |
| `apps/mobile/harness/jest-compat.ts` | Update `restoreAllMocks` to use safe helpers | Fix mock restore for `export *` modules |
| `apps/mobile/harness/jest-compat.ts` | Wrap `saveSnapshot` reads in try/catch | Handle getters that throw |
