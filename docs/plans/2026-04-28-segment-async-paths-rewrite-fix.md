# Segment Async-Paths Rewrite Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop iOS production builds from crashing with `Requiring unknown module "<id>"` when entering the Send recipient page (and any other page reached from a segment via dynamic `import(...)`), by rewriting Metro async-require paths inside segment modules — not just inside the main bundle — and add layered safeguards (build-time integrity check, runtime fallback, contract tests) so this regression cannot ship again.

**Architecture:**
1. **Build fix (root cause):** Extract Step 10's path-rewrite into a pure helper, run it across both `mainModules` and every segment's modules **before** Step 7 writes segments to disk. This guarantees every async path inside a `.seg.js` file is rewritten from the Metro default URL (`/packages/.../X.bundle?modulesOnly=true&runModule=false`) to the production segment key (`seg:kit.views.X`).
2. **Build-time guard:** Extend `check-split-bundle-integrity.js` to scan every emitted `.seg.js` for the un-rewritten Metro URL pattern; fail the CI job before any `.hbc` is produced if even one slips through.
3. **Runtime guard (defense in depth):** In `installProdBundleLoader.ts`, when an eager-fallback key resolves but the subsequent `require(<id>)` throws "unknown module", convert it from a FATAL into a recoverable error with structured telemetry (segment key, runtime, bundle version) so future bundle-corruption issues do not crash the JS host.
4. **Test coverage:** Each of the three layers has its own test that fails on the unfixed code and passes on the fixed code, locking the regression in.
5. **OTA recovery doc:** A short runbook so on-call can take down a broken OTA without code changes.

**Tech Stack:** Node + Metro serializer plugins (CommonJS), Jest unit tests, React Native runtime TS, Bash for OTA control. No production dependencies added.

---

## Working Branch

Continue on `fix/native-bundle-sentry-and-split` (already in flight). All tasks below land here as additional commits.

## Reference Material

- Sentry issue: `REACT-NATIVE-4AX` (162 events / 90 users, escalating)
- Crash log path: `/Users/huhuanming/Downloads/onekey-log-staging 3/app-2026-04-28.0.log` (lines 87466 et seq.)
- OTA artifact dir: `/Users/huhuanming/Downloads/release-native-bundle-ios-zips-6/ios-bundle/` (bundleVersion `10069276`)
- Affected module IDs (verified via `module-id-map.json`): `777, 791, 797, 798, 3904`
- Bug location: `apps/mobile/plugins/segmentSerializer.js:650-673` ("Step 10")
- Existing test scaffolds: `apps/mobile/plugins/__tests__/`, `apps/mobile/scripts/__tests__/`

## Out of Scope

- Switching the asyncRequire transport (HTTP / native bridge) — orthogonal.
- The `dispatchEvent` polyfill issue — it is a *secondary* failure inside `ExceptionsManager.reportException`. Tracked separately; this plan does not touch `polyfillsPlatform.js`.
- Any allocation-rule change in `bundle-groups.config.js`. This fix is correctness, not policy.

---

## Phase 1 — Reproduce with a failing serializer test

The first thing we do is encode the bug as a Jest test that reads from a tiny synthetic graph and asserts that **every** `.seg` module's async-paths object has been rewritten. This test must FAIL against the current code on `main`.

### Task 1.1: Add a focused test for the rewrite helper (red)

**Files:**
- Create: `apps/mobile/plugins/__tests__/segmentSerializer.rewriteAsyncPaths.test.js`

**Why a separate file:** The serializer is too large to easily mount in a unit test; we'll first extract a pure helper (Task 2.1), then test it. This task creates the test that will drive that extraction.

**Step 1: Write the failing test**

```js
// apps/mobile/plugins/__tests__/segmentSerializer.rewriteAsyncPaths.test.js
const {
  rewriteAsyncPathsInModules,
} = require('../segmentSerializer.rewriteAsyncPaths');

// Simulates Metro's serialized output for one module that does
//   import('@onekeyhq/kit/src/views/Receive/pages/ReceiveToken')
// with module id 777, before Step 10 rewrite.
function makeModuleWithUnrewrittenPaths(modId, asyncIds) {
  const pathsObject = asyncIds
    .map(
      (id) =>
        `"${id}":"/packages/kit/src/views/X${id}/index.bundle?modulesOnly=true&runModule=false"`,
    )
    .join(',');
  return [
    modId,
    `__d(function (g, r, i, a, m, e, d) { asyncRequire(${asyncIds[0]}, {${pathsObject}}); }, ${modId}, [${asyncIds.join(',')}]);`,
  ];
}

describe('rewriteAsyncPathsInModules', () => {
  it('replaces every async-id value with its seg: key', () => {
    const moduleToSegment = new Map([
      [777, 'seg:kit.views.Receive.pages.ReceiveToken'],
      [791, 'seg:kit.views.ScanQrCode.pages.ScanQrCodeModal'],
    ]);
    const modules = [
      makeModuleWithUnrewrittenPaths(1000, [777]),
      makeModuleWithUnrewrittenPaths(1001, [791]),
    ];

    rewriteAsyncPathsInModules(modules, moduleToSegment);

    expect(modules[0][1]).toContain(
      '"777":"seg:kit.views.Receive.pages.ReceiveToken"',
    );
    expect(modules[0][1]).not.toContain('ReceiveToken.bundle');
    expect(modules[1][1]).toContain(
      '"791":"seg:kit.views.ScanQrCode.pages.ScanQrCodeModal"',
    );
  });

  it('is idempotent — already-rewritten modules are not double-rewritten', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [[1000, '__d(function(){asyncRequire(777,{"777":"seg:foo"});},1000,[777]);']];

    const before = modules[0][1];
    rewriteAsyncPathsInModules(modules, moduleToSegment);

    expect(modules[0][1]).toBe(before);
  });

  it('skips entries with non-string module code (defensive)', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [
      [1000, null],
      [1001, undefined],
      [1002, 42],
    ];
    expect(() => rewriteAsyncPathsInModules(modules, moduleToSegment)).not.toThrow();
  });

  it('does nothing when moduleToSegment is empty', () => {
    const modules = [makeModuleWithUnrewrittenPaths(1000, [777])];
    const before = modules[0][1];
    rewriteAsyncPathsInModules(modules, new Map());
    expect(modules[0][1]).toBe(before);
  });

  it('matches paths that appear with both `{ "id":` and `, "id":` prefix shapes', () => {
    const moduleToSegment = new Map([[777, 'seg:foo']]);
    const modules = [
      [
        1000,
        `__d(fn,1000,[777]); /* sentinel */ var p = {"777":"/x/y.bundle?modulesOnly=true&runModule=false","999":"/z.bundle"};`,
      ],
      [
        1001,
        `__d(fn,1001,[777]); var q = {"a":1,"777":"/x/y.bundle?modulesOnly=true&runModule=false"};`,
      ],
    ];
    rewriteAsyncPathsInModules(modules, moduleToSegment);
    expect(modules[0][1]).toContain('"777":"seg:foo"');
    expect(modules[1][1]).toContain('"777":"seg:foo"');
  });
});
```

**Step 2: Run to verify it fails**

Run: `yarn jest apps/mobile/plugins/__tests__/segmentSerializer.rewriteAsyncPaths.test.js`

Expected: FAIL — `Cannot find module '../segmentSerializer.rewriteAsyncPaths'`. This proves the helper does not exist yet.

**Step 3: Commit the red test**

```bash
git add apps/mobile/plugins/__tests__/segmentSerializer.rewriteAsyncPaths.test.js
git commit -m "test(serializer): add red test for async-paths rewrite helper"
```

---

## Phase 2 — Fix the root cause (extract helper, apply to segment modules)

### Task 2.1: Extract the rewrite into a pure module (green)

**Files:**
- Create: `apps/mobile/plugins/segmentSerializer.rewriteAsyncPaths.js`

**Step 1: Create the helper**

```js
// apps/mobile/plugins/segmentSerializer.rewriteAsyncPaths.js
/**
 * Rewrite Metro's default async-require URL strings into stable production
 * segment keys (`seg:<key>`).
 *
 * Why this is a separate file: the rewrite must run identically on the main
 * bundle's modules AND on every segment's modules. Keeping it inline in
 * segmentSerializer made it trivially easy to forget the segment side
 * (which is exactly the regression that crashed iOS 6.3.0+10069276 OTA).
 *
 * Contract:
 *   - Mutates `modules` in place. Each entry is `[moduleId, codeString]`.
 *   - For every (asyncModuleId, segKey) in moduleToSegment, replaces
 *     `,"<id>":"<anything>"` and `{"<id>":"<anything>"` with
 *     `,"<id>":"<segKey>"` / `{"<id>":"<segKey>"`.
 *   - Idempotent: rewriting an already-rewritten module is a no-op.
 */
function buildRewritePattern(moduleToSegment) {
  const ids = [...moduleToSegment.keys()];
  if (ids.length === 0) return null;
  const idAlternation = ids.map(String).join('|');
  return new RegExp(
    `([{,]\\s*)"(${idAlternation})"(\\s*:\\s*)"[^"]*"`,
    'g',
  );
}

function rewriteAsyncPathsInModules(modules, moduleToSegment) {
  const pattern = buildRewritePattern(moduleToSegment);
  if (!pattern) return;
  for (const mod of modules) {
    if (!mod || typeof mod[1] !== 'string') continue;
    mod[1] = mod[1].replace(pattern, (match, prefix, modId, colon) => {
      const segKey = moduleToSegment.get(Number(modId));
      return segKey ? `${prefix}"${modId}"${colon}"${segKey}"` : match;
    });
  }
}

module.exports = { buildRewritePattern, rewriteAsyncPathsInModules };
```

**Step 2: Run the test from Task 1.1**

Run: `yarn jest apps/mobile/plugins/__tests__/segmentSerializer.rewriteAsyncPaths.test.js`

Expected: PASS — all 5 cases.

**Step 3: Commit**

```bash
git add apps/mobile/plugins/segmentSerializer.rewriteAsyncPaths.js
git commit -m "feat(serializer): extract pure async-paths rewrite helper"
```

### Task 2.2: Wire the helper into segmentSerializer for both main + segment modules

**Files:**
- Modify: `apps/mobile/plugins/segmentSerializer.js`

**Step 1: Add a failing serializer-level test first**

Create `apps/mobile/plugins/__tests__/segmentSerializer.segmentPathsRewrite.test.js`:

```js
// apps/mobile/plugins/__tests__/segmentSerializer.segmentPathsRewrite.test.js
//
// Regression test for the iOS 6.3.0-10069276 OTA crash: segment modules
// that contain async-require paths must have those paths rewritten to
// `seg:` keys before the segment is written to disk. Without this,
// runtime hits installProdBundleLoader's eager-fallback short-circuit
// for the unrewritten Metro URL, then crashes with
// "Requiring unknown module <id>" because the actual segment was never
// loaded.
const {
  rewriteAsyncPathsInModules,
} = require('../segmentSerializer.rewriteAsyncPaths');

describe('segment serializer — segment async-path rewrite', () => {
  it('rewrites async paths inside segment modules (regression: ios 10069276)', () => {
    const moduleToSegment = new Map([
      [777, 'seg:kit.views.Receive.pages.ReceiveToken'],
      [3904, 'seg:kit.views.Send.pages.SendConfirm.SendConfirmContainer'],
    ]);

    // Simulates a single segment's `[id, code]` array — what segmentOutputs
    // hands to bundleToString in Step 7.
    const segModules = [
      [
        2500, // SendDataInputContainer module
        `__d(fn,2500,[777,3904]);var p={"777":"/packages/kit/src/views/Receive/pages/ReceiveToken.bundle?modulesOnly=true&runModule=false","3904":"/packages/kit/src/views/Send/pages/SendConfirm/SendConfirmContainer.bundle?modulesOnly=true&runModule=false"};`,
      ],
    ];

    rewriteAsyncPathsInModules(segModules, moduleToSegment);

    expect(segModules[0][1]).toContain(
      '"777":"seg:kit.views.Receive.pages.ReceiveToken"',
    );
    expect(segModules[0][1]).toContain(
      '"3904":"seg:kit.views.Send.pages.SendConfirm.SendConfirmContainer"',
    );
    // Hard guarantee: no Metro default URL leaks past rewrite
    expect(segModules[0][1]).not.toMatch(/\.bundle\?modulesOnly=true&runModule=false/);
  });
});
```

Run it now — it should PASS already because Task 2.1 made the helper available. The point of this file is *contract assertion*: a future refactor that reintroduces in-line rewrite logic in `segmentSerializer.js` must keep this contract intact.

**Step 2: Modify `segmentSerializer.js`**

In `apps/mobile/plugins/segmentSerializer.js`:

1. Near the top imports, add:
```js
const {
  rewriteAsyncPathsInModules,
} = require('./segmentSerializer.rewriteAsyncPaths');
```

2. Locate the existing Step 10 block (lines ~650-673) and **delete** it.

3. Insert a new Step 6e *before* Step 7 (around line ~505, right after the `startupViolations` check, before `// Step 7: Write segment files and build manifest`):

```js
  // Step 6e: Rewrite asyncRequire paths for production (#49 + #regression-fix)
  //
  // Metro's babel-plugin-transform-metro-async-require emits async-require
  // calls with a `paths` map keyed by module id and valued by the dev-server
  // URL (`/packages/.../X.bundle?modulesOnly=true&runModule=false`).  In
  // production we replace those URLs with stable segment keys (`seg:<key>`)
  // so installProdBundleLoader can route them through the native segment
  // loader instead of taking the eager-fallback short-circuit.
  //
  // CRITICAL: this rewrite must run on BOTH the main entry's modules AND
  // every segment's modules.  An older revision only rewrote main —
  // segments still shipped raw Metro URLs, the runtime fell into eager
  // fallback, and `require(<id>)` then crashed because the target segment
  // was never loaded.  See iOS 6.3.0-10069276 OTA crash for evidence.
  if (!bundleOptions.dev) {
    for (const [, segModules] of segmentOutputs) {
      rewriteAsyncPathsInModules(segModules, moduleToSegment);
    }
    rewriteAsyncPathsInModules(mainModules, moduleToSegment);
  }
```

**Why before Step 7 not after:** Step 7 calls `bundleToString` on each segment and writes the result to disk. If we rewrite after Step 7, the on-disk file is already wrong.

**Step 3: Run the existing serializer integration suite**

Run: `yarn jest apps/mobile/plugins/__tests__/`

Expected: PASS, no regressions in `segmentAllocator.test.js`, `segmentUtils.test.js`, etc.

**Step 4: Commit**

```bash
git add apps/mobile/plugins/segmentSerializer.js apps/mobile/plugins/__tests__/segmentSerializer.segmentPathsRewrite.test.js
git commit -m "fix(serializer): rewrite async-require paths inside segment modules

Metro async-require paths inside segment .seg.js were never rewritten to
seg: keys, so the runtime hit installProdBundleLoader's eager-fallback
short-circuit and then crashed with 'Requiring unknown module <id>'
because the actual segment was never loaded.  See REACT-NATIVE-4AX,
ios bundle 6.3.0-10069276."
```

---

## Phase 3 — Build-time integrity guard (catch this at CI, not at runtime)

The serializer fix is necessary but not sufficient: nothing today asserts that no segment ships a raw Metro URL. We add that assertion to the existing integrity-check job.

### Task 3.1: Red test for segment-paths integrity scan

**Files:**
- Modify: `apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js`

**Step 1: Add a new describe block at the bottom of the test file**

```js
// Append to apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js
const {
  scanSegmentForUnrewrittenAsyncPaths,
} = require('../check-split-bundle-integrity');

describe('scanSegmentForUnrewrittenAsyncPaths', () => {
  it('returns empty for a fully-rewritten segment', () => {
    const segJs =
      '__d(fn,2500,[777]);var p={"777":"seg:kit.views.Receive.pages.ReceiveToken"};';
    expect(scanSegmentForUnrewrittenAsyncPaths(segJs)).toEqual([]);
  });

  it('flags an unrewritten Metro URL in a segment (regression: ios 10069276)', () => {
    const segJs =
      '__d(fn,2500,[777]);var p={"777":"/packages/kit/src/views/Receive/pages/ReceiveToken.bundle?modulesOnly=true&runModule=false"};';
    const violations = scanSegmentForUnrewrittenAsyncPaths(segJs);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      moduleId: '777',
      url: expect.stringContaining(
        '/packages/kit/src/views/Receive/pages/ReceiveToken.bundle',
      ),
    });
  });

  it('lists multiple unrewritten paths separately', () => {
    const segJs = `__d(fn,2500,[777,3904]);
      var p={"777":"/a.bundle?modulesOnly=true&runModule=false",
             "3904":"/b.bundle?modulesOnly=true&runModule=false"};`;
    expect(scanSegmentForUnrewrittenAsyncPaths(segJs)).toHaveLength(2);
  });
});
```

**Step 2: Run to verify failure**

Run: `yarn jest apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js -t "scanSegmentForUnrewrittenAsyncPaths"`

Expected: FAIL — `scanSegmentForUnrewrittenAsyncPaths is not a function`. The export does not exist yet.

**Step 3: Commit the red test**

```bash
git add apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js
git commit -m "test(integrity): add red test for unrewritten async-path scanner"
```

### Task 3.2: Implement the scanner + wire it into the main integrity flow

**Files:**
- Modify: `apps/mobile/scripts/check-split-bundle-integrity.js`

**Step 1: Add the scanner export**

Insert after `parseModuleDefs`:

```js
/**
 * Detect Metro default async-require URLs that the production serializer
 * should have rewritten to `seg:<key>` form. Any match here means the
 * runtime will hit installProdBundleLoader's eager-fallback path for that
 * id and crash with "Requiring unknown module <id>" (see iOS bundle
 * 6.3.0-10069276 regression).
 *
 * The matcher is deliberately narrow: it only flags strings that match the
 * Metro default-async-require shape ending in `.bundle?modulesOnly=true&runModule=false`,
 * so unrelated `.bundle` strings (e.g. CDN URLs) do not false-positive.
 */
const UNREWRITTEN_ASYNC_PATH = /"(\d+)"\s*:\s*"(\/[^"]*\.bundle\?modulesOnly=true&runModule=false)"/g;

function scanSegmentForUnrewrittenAsyncPaths(segmentJs) {
  const violations = [];
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = UNREWRITTEN_ASYNC_PATH.exec(segmentJs)) !== null) {
    violations.push({ moduleId: m[1], url: m[2] });
  }
  return violations;
}
```

Add to module exports near the bottom of the file:

```js
module.exports = {
  // ...existing exports,
  scanSegmentForUnrewrittenAsyncPaths,
};
```

**Step 2: Wire it into `scanRuntime`**

Inside `scanRuntime` (after `parseModuleDefs(segJs)` returns), add:

```js
    // Catch the Metro default URL → seg:key rewrite slipping past the
    // serializer (Step 6e in segmentSerializer.js). A single hit is fatal
    // because runtime will FATAL with "Requiring unknown module" the first
    // time anyone navigates into the affected page.
    const unrewritten = scanSegmentForUnrewrittenAsyncPaths(segJs);
    for (const u of unrewritten) {
      violations.push({
        kind: 'unrewritten_async_path',
        runtime: runtimeLabel,
        srcSegment: segKey,
        moduleId: Number(u.moduleId),
        url: u.url,
      });
    }
```

**Step 3: Print these violations clearly**

Extend `printViolations` to handle `kind === 'unrewritten_async_path'`:

```js
  const unrewritten = violations.filter(
    (v) => v.kind === 'unrewritten_async_path',
  );
  if (unrewritten.length > 0) {
    console.error('');
    console.error(
      `[integrity] UNREWRITTEN ASYNC PATHS (${unrewritten.length}) — segments will crash on lazy import:`,
    );
    for (const v of unrewritten.slice(0, 10)) {
      console.error(
        `  [${v.runtime}] ${v.srcSegment}: id=${v.moduleId} → ${v.url}`,
      );
    }
    if (unrewritten.length > 10) {
      console.error(`  ... and ${unrewritten.length - 10} more`);
    }
  }
```

And ensure the main exit code includes this violation kind in the failure path (no special handling needed — any violation triggers exit 1 today; verify by reading the main() function and confirming no `.filter` excludes our kind).

**Step 4: Run the test from Task 3.1**

Run: `yarn jest apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js`

Expected: PASS — all three new cases.

**Step 5: Sanity-check against the broken OTA bundle**

This is an out-of-band verification. The broken `.seg.hbc` file lives in the `Downloads/` artifact dir; we cannot scan `.hbc` directly (it is Hermes bytecode). But the *source* `.seg.js` files would live in `apps/mobile/dist/segments/` after a fresh build. Run:

```bash
cd apps/mobile && SPLIT_BUNDLE_SEGMENTS=true \
  yarn metro-bundle:ios:release  # or whatever the existing release-mode command is
node apps/mobile/scripts/check-split-bundle-integrity.js
```

Expected on the **fixed** code: `[integrity] OK`. Without the Phase 2 fix (revert it temporarily): `UNREWRITTEN ASYNC PATHS` violations on the same 5 segments (`SendDataInputContainer`, `ReceiveSelector`, etc.).

**Step 6: Commit**

```bash
git add apps/mobile/scripts/check-split-bundle-integrity.js
git commit -m "feat(integrity): fail build if a segment ships an unrewritten Metro URL

Catches the Phase-2 regression at CI time, not at runtime: any .seg.js
that still carries '/packages/.../X.bundle?modulesOnly=true&runModule=false'
makes the integrity check exit 1 with a clear message naming the
segment, module id, and offending URL."
```

### Task 3.3: Confirm CI runs the integrity check on every release-bundle build

**Files:**
- Inspect: `.github/workflows/` (whatever invokes `release-native-bundle`)
- Inspect: `apps/mobile/package.json` (build scripts)

**Step 1:** Verify `node apps/mobile/scripts/check-split-bundle-integrity.js` runs as a hard step (exit non-zero on failure) in the same CI job that produces `ios-bundle.zip` / `android-bundle.zip`.

**Step 2:** If it is not wired in, add it:

```yaml
- name: Validate split-bundle integrity
  run: node apps/mobile/scripts/check-split-bundle-integrity.js
  working-directory: ${{ github.workspace }}
```

placed BEFORE the artifact-upload step.

**Step 3: Commit (only if changes made)**

```bash
git add .github/workflows/<file>.yml
git commit -m "ci: run split-bundle integrity check before publishing OTA"
```

---

## Phase 4 — Runtime defense in depth

Even with a green CI, future bundles can still arrive corrupt (downgrade attack, partial download, OTA misconfig). When that happens we want a soft-fail with telemetry, not a SIGABRT.

### Task 4.1: Red test for the loader's hard-error-on-eager-fallback path

**Files:**
- Modify: `apps/mobile/src/splitBundle/__tests__/installProdBundleLoader.test.ts`

**Step 1:** Read the existing tests in this file to match their style. Then append:

```ts
// At the bottom of installProdBundleLoader.test.ts
import {
  loadSegment,
  setNativeLoader,
  getEagerFallbackKeys,
} from '../installProdBundleLoader';
import { LogLevel } from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

describe('installProdBundleLoader — eager fallback diagnostics', () => {
  it('returns the un-rewritten Metro URL key in getEagerFallbackKeys', async () => {
    setNativeLoader({
      loadSegment: jest.fn(),
    } as any);

    await loadSegment(
      '/packages/kit/src/views/Receive/pages/ReceiveToken.bundle?modulesOnly=true&runModule=false',
    );

    const keys = getEagerFallbackKeys();
    expect(
      keys.some((k) =>
        k.includes('/packages/kit/src/views/Receive/pages/ReceiveToken.bundle'),
      ),
    ).toBe(true);
  });
});
```

**Step 2:** Run.

Run: `yarn jest apps/mobile/src/splitBundle/__tests__/installProdBundleLoader.test.ts`

Expected: PASS. (This test locks in the existing behaviour; we'll add new assertions next.)

### Task 4.2: Add structured telemetry when an eager-fallback key looks like a missed segment URL

**Files:**
- Modify: `apps/mobile/src/splitBundle/installProdBundleLoader.ts`
- Modify: `apps/mobile/src/splitBundle/__tests__/installProdBundleLoader.test.ts`

**Why:** Today the eager-fallback log is a `Warning` and has no structured fields. If a Metro URL like `/packages/.../X.bundle?modulesOnly=true&runModule=false` shows up in eager fallback, that is **always** a bug — either a serializer regression or a corrupt OTA. We want it logged at `Error` level with a stable tag so it shows up in our log dashboards immediately.

**Step 1: Add a failing test**

```ts
// Append to installProdBundleLoader.test.ts
describe('installProdBundleLoader — Metro-URL eager fallback is loud', () => {
  it('logs at ERROR level for paths matching the Metro async-require URL shape', async () => {
    const writeSpy = jest.spyOn(NativeLogger, 'write').mockImplementation(() => {});

    setNativeLoader({
      loadSegment: jest.fn(),
    } as any);

    await loadSegment(
      '/packages/kit/src/views/Receive/pages/ReceiveToken.bundle?modulesOnly=true&runModule=false',
    );

    const errorLogs = writeSpy.mock.calls.filter(([level]) => level === LogLevel.Error);
    expect(
      errorLogs.some(([, msg]) =>
        msg.includes('[SplitBundle][BUG] missing-rewrite eager fallback'),
      ),
    ).toBe(true);
    writeSpy.mockRestore();
  });

  it('still logs at WARNING for benign eager-fallback (non-Metro-URL) keys', async () => {
    const writeSpy = jest.spyOn(NativeLogger, 'write').mockImplementation(() => {});

    setNativeLoader({ loadSegment: jest.fn() } as any);

    await loadSegment('some-non-metro-key');

    const warnLogs = writeSpy.mock.calls.filter(
      ([level]) => level === LogLevel.Warning,
    );
    expect(
      warnLogs.some(([, msg]) => msg.includes('[SplitBundle] eager fallback')),
    ).toBe(true);
    writeSpy.mockRestore();
  });
});
```

**Step 2: Run — expect failure**

`yarn jest apps/mobile/src/splitBundle/__tests__/installProdBundleLoader.test.ts -t "Metro-URL"`

Expected: FAIL on the first new case.

**Step 3: Modify `installProdBundleLoader.ts`**

In the eager-fallback branch (~line 167 today), replace the existing single-level log with a two-tier log:

```ts
        const isMetroAsyncRequireUrl =
          /\.bundle\?modulesOnly=true&runModule=false/.test(segmentKey);
        loadedSegments.add(segmentKey);
        segmentStates.set(segmentKey, 'ready');
        if (!eagerFallbackWarned.has(segmentKey)) {
          eagerFallbackWarned.add(segmentKey);
          if (isMetroAsyncRequireUrl) {
            // The serializer was supposed to rewrite this to `seg:<key>`.
            // It didn't, so the require() that follows will FATAL.  Log
            // loud and structured so we can spot a corrupted OTA in
            // production logs immediately.
            safeNativeLog(
              LogLevel.Error,
              `[SplitBundle][BUG] missing-rewrite eager fallback: key="${segmentKey}" runtime=${getRuntimeKind()}`,
            );
          } else {
            safeNativeLog(
              LogLevel.Warning,
              `[SplitBundle] eager fallback: key="${segmentKey}" runtime=${getRuntimeKind()}`,
            );
          }
        }
        return;
```

**Step 4: Run all loader tests**

`yarn jest apps/mobile/src/splitBundle/__tests__/`

Expected: PASS on every test, including new ones.

**Step 5: Commit**

```bash
git add apps/mobile/src/splitBundle/installProdBundleLoader.ts apps/mobile/src/splitBundle/__tests__/installProdBundleLoader.test.ts
git commit -m "feat(splitBundle): tag missing-rewrite eager fallback at ERROR level

When a Metro default async-require URL hits the eager-fallback path it
is always a bug (serializer regression or corrupt OTA) and the next
require() call will FATAL.  Distinguish it from benign eager fallback
with a [BUG] prefix and ERROR level so on-call sees it in logs."
```

### Task 4.3: Convert the FATAL into a recoverable error at the require boundary

**Files:**
- Modify: `apps/mobile/index.ts` (or whatever installs the global error handler — confirm via `grep -rn "ErrorUtils.setGlobalHandler" apps/mobile`)

**Step 1: Confirm the install site**

Run: `grep -rn "ErrorUtils\|setGlobalHandler" apps/mobile/src apps/mobile/index.ts apps/mobile/background.ts | head`

**Step 2:** Decide *based on the grep result* whether we extend an existing handler or install a new wrap-and-rethrow boundary. Two acceptable shapes:

- If a global handler already exists, intercept errors whose `.message` matches `/^Requiring unknown module/` and re-classify them as a structured "split-bundle integrity violation" before forwarding to the existing handler. Do NOT swallow them (keep the user-visible failure) — the goal is structured telemetry + a clean message, not silent recovery.
- If no global handler exists yet, install a minimal one that does the above.

The exact diff is small but must match the existing handler shape, so we author it after Step 1's grep. **Do not skip Step 1.**

**Step 3: Add a Jest test that simulates the global handler being invoked with the unknown-module error**

Sketch (adapt to the install-site shape):

```ts
// apps/mobile/src/splitBundle/__tests__/unknownModuleHandler.test.ts
import { classifyUnknownModuleError } from '../unknownModuleHandler'; // new file

describe('classifyUnknownModuleError', () => {
  it('marks "Requiring unknown module 777" as a split-bundle integrity violation', () => {
    const err = new Error('Requiring unknown module "777"');
    const meta = classifyUnknownModuleError(err);
    expect(meta).toEqual({ kind: 'split_bundle_integrity', moduleId: '777' });
  });

  it('returns null for unrelated errors', () => {
    expect(classifyUnknownModuleError(new Error('boom'))).toBeNull();
  });
});
```

**Step 4: Implement the classifier and wire it in.**

```ts
// apps/mobile/src/splitBundle/unknownModuleHandler.ts
const PATTERN = /^Requiring unknown module ["']?(\d+)["']?/;

export function classifyUnknownModuleError(err: unknown):
  | { kind: 'split_bundle_integrity'; moduleId: string }
  | null {
  if (!(err instanceof Error)) return null;
  const m = PATTERN.exec(err.message);
  if (!m) return null;
  return { kind: 'split_bundle_integrity', moduleId: m[1] };
}
```

In the existing global handler (or a new one installed at app entry), call `classifyUnknownModuleError(err)` and, if non-null:
1. Log to `NativeLogger` at ERROR level with the bundle version (use `bundleVersion` already exported by `BundleUpdate`).
2. Forward the original error to the previous handler so the user-visible failure remains visible. **Do not swallow.**
3. Set a Sentry tag `split_bundle_integrity=true` so the issue is grouped separately from the unrelated `dispatchEvent` issue we identified earlier.

**Step 5: Run.**

`yarn jest apps/mobile/src/splitBundle/__tests__/unknownModuleHandler.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/mobile/src/splitBundle/unknownModuleHandler.ts \
        apps/mobile/src/splitBundle/__tests__/unknownModuleHandler.test.ts \
        apps/mobile/index.ts  # or wherever the global handler lives
git commit -m "feat(splitBundle): tag 'Requiring unknown module' errors with bundle version

Gives Sentry a stable fingerprint for split-bundle integrity violations,
separate from the secondary dispatchEvent fault that ate the original
stack trace in REACT-NATIVE-4AX."
```

---

## Phase 5 — OTA recovery runbook

A code fix doesn't help users who already downloaded the broken `6.3.0-10069276` bundle. We document the manual recovery path so on-call doesn't have to invent it.

### Task 5.1: Write the runbook

**Files:**
- Create: `docs/runbooks/ota-bundle-recovery.md`

**Step 1: Write**

```markdown
# OTA Bundle Recovery Runbook

## When to use this runbook

A native bundle has been published to the OTA CDN that crashes on a known
device path (current example: iOS 6.3.0-10069276 crashes on entering the
Send recipient page with `Requiring unknown module "777"`). Until users
upgrade to a newer build that ships a corrected built-in bundle, every
launch of the affected version pulls the broken OTA and re-crashes.

## Decision matrix

| Severity                        | Action                              |
| ------------------------------- | ----------------------------------- |
| ≥ 1% of sessions crash on entry | Take the OTA offline immediately    |
| Specific page only              | Take the OTA offline + ship hotfix  |
| Edge case (rare device)         | Ship hotfix on next normal release  |

## Step 1 — Take the broken OTA offline

1. Identify the bad bundleVersion (from Sentry `dist:` tag or BundleUpdate
   log line `currentBundleVersion: <ver>`).
2. In the bundle CDN dashboard
   (`https://bundle-test.onekey-asset.com` → admin), mark the bundle as
   `disabled` for that `appVersion`. Verify by `curl`-ing the manifest
   endpoint and confirming it no longer references the disabled version.
3. Devices on launch will re-fetch the manifest, see no eligible OTA, and
   fall back to the built-in bundle that shipped with the .ipa/.apk
   (`builtinBundleVersion` in BundleUpdate logs).

## Step 2 — Confirm devices are recovering

Watch:
- Sentry release-health page for the affected `release:` tag — the new
  events/hour line should drop within ~10 min as launches pick up the
  built-in bundle.
- The same log line `[BundleUpdate] bundleURL(RELEASE):` should now read
  `fallback common.bundle=...app/common.bundle` instead of OTA.

## Step 3 — Build and publish the corrected OTA

1. Land the underlying fix on `x` (or the active hotfix branch).
2. Trigger `release-native-bundle` workflow with `appVersion=<n>` and a
   new `bundleVersion` (monotonic; this is the
   `${commit_count}${YYMMDD}${rev}` convention).
3. Block the publish step on the integrity check passing (Phase 3 of the
   segment async-paths fix plan).
4. Publish to CDN.

## Step 4 — Postmortem

Record:
- Bad bundleVersion, good bundleVersion replacing it.
- Time-to-detect, time-to-mitigate.
- Any safeguards that should have caught it (likely: a build-time check
  was missing — add it).
```

**Step 2: Commit**

```bash
git add docs/runbooks/ota-bundle-recovery.md
git commit -m "docs: OTA bundle recovery runbook"
```

---

## Phase 6 — End-to-end verification on real artifacts

### Task 6.1: Reproduce on the broken bundle (sanity check before / after)

**Why:** All Phases 1-4 use synthetic strings. We need to confirm the real `.seg.js` from a fresh build no longer carries Metro URLs.

**Step 1: Build a release iOS bundle with the fix**

```bash
cd apps/mobile
SPLIT_BUNDLE_SEGMENTS=true yarn build:bundle:ios:release  # use the actual script name
```

**Step 2: Grep emitted segments**

```bash
grep -rE 'modulesOnly=true&runModule=false' apps/mobile/dist/segments/ apps/mobile/dist/segments-background/ | head
```

Expected: empty output.

**Step 3: Run the integrity check**

```bash
node apps/mobile/scripts/check-split-bundle-integrity.js
```

Expected: exit 0 with `OK` summary.

**Step 4: Negative control**

Temporarily revert just the `Step 6e` block in `segmentSerializer.js`. Re-run Step 1 + 3. Expected: integrity check exits 1 with `UNREWRITTEN ASYNC PATHS` listing the 5+ affected segments. Restore the fix.

**Step 5: No commit needed** (verification step).

### Task 6.2: Smoke-test on a real device

**Step 1:** Install the new build on an iOS 26.4.1 device (matches Sentry crash environment).

**Step 2:** Reproduce the user flow:
- Cold start
- Tab Home → tap Send → choose a token → land on the 收款方 page

**Step 3:** Confirm:
- No FATAL JS error in the OneKey debug log file (path: `~/Library/.../onekey-log/app-<date>.0.log`).
- Page renders, all three tabs (最近 / 账户 / 地址簿) populate.
- Background the app, wait 1 minute, foreground it. No crash.

**Step 4:** Repeat the same flow with airplane mode toggled mid-session, since the original crash's breadcrumbs included the network-failure path. No crash.

**Step 5: No commit needed** (verification step).

---

## Phase 7 — Final commit and PR description

### Task 7.1: Open the PR

**Step 1:** Push the branch:

```bash
git push -u origin fix/native-bundle-sentry-and-split
```

**Step 2:** Open the PR with a summary that links every layer to the evidence it covers:

Title: `fix(serializer): rewrite async-require paths inside segment modules + add layered guards`

Body (paraphrase, not copy verbatim):

```
Fixes Sentry REACT-NATIVE-4AX (162 events / 90 users), which crashed iOS
6.3.0-10069276 OTA users on entering the Send recipient page with
"Requiring unknown module 777" (and 791 / 797 / 798 / 3904).

Root cause: segmentSerializer.js Step 10 only rewrote async-require
paths in main bundle modules. Segment modules shipped with raw Metro
URLs, runtime hit the eager-fallback short-circuit, then require()
crashed because the actual segment was never loaded.

Layers added (all with tests):
1. Pure rewrite helper, applied to BOTH main + segment modules
2. Build-time integrity check that fails CI on any unrewritten URL
3. Runtime tagging of the failure mode (so future regressions surface
   at ERROR level with a stable Sentry fingerprint)
4. OTA recovery runbook for on-call

Verification:
- New unit tests (red→green): 4 files
- Manual: iOS 26.4.1 device, full Send flow, airplane-mode toggle
- Negative control: reverting the Step 6e fix triggers the integrity
  check failure as expected
```

**Step 3:** Tag relevant reviewers (the same set as on prior PRs in this branch).

**Step 4:** **Do not** merge until the OTA dashboard confirms the broken `10069276` is offline (Phase 5 step 1). Otherwise the PR's good bundle and the bad OTA can race.

---

## Risk Notes

- **Risk A:** The rewrite regex `[{,]\\s*"<id>"\\s*:\\s*"[^"]*"` could match unrelated object literals that happen to use a numeric key in `moduleToSegment.keys()`. Mitigation: the integrity scanner in Phase 3 only flags paths matching the *Metro async-require URL shape* (`.bundle?modulesOnly=true&runModule=false`), which is the only string the build will ever emit for these IDs. False positives in unrelated code would not match this shape and so would not be flagged.
- **Risk B:** Hermes bytecode optimisation could elide the string. Phase 6 step 1-2 verifies on the actual `.seg.js` (pre-Hermes), which is what the integrity check scans. If a future Metro upgrade changes the URL shape we want the integrity check to fail loudly, not silently pass — the regex is intentionally narrow.
- **Risk C:** Regression on the background runtime. Phase 6 step 3 runs the integrity check across both `dist/segments/` and `dist/segments-background/`, so any miss shows up immediately.
- **Risk D:** The downloaded log shows a parallel `dispatchEvent` second-fault that we are *not* fixing in this PR. That's intentional — the dispatchEvent issue surfaces only because the FATAL above forces ExceptionsManager.reportException to run; eliminating the FATAL eliminates the dispatchEvent second-fault for these users. We should still file a follow-up for it (see Phase 4 task 4.3 — the Sentry tag splits the fingerprints, so the dispatchEvent issue will not be hidden by ours).

---

## Done Definition

- [ ] All Jest tests pass, including the 4 new files.
- [ ] `node apps/mobile/scripts/check-split-bundle-integrity.js` exits 0 on the new build.
- [ ] Manual repro on iOS 26.4.1 confirms no crash on Send recipient page (Phase 6.2).
- [ ] CI integrity-check step is wired in front of the OTA-publish step.
- [ ] Broken OTA `10069276` is taken offline.
- [ ] PR merged to `x` and a fresh OTA published.
- [ ] Sentry REACT-NATIVE-4AX events/hour drops to ~0 within 1 hour after publish.
