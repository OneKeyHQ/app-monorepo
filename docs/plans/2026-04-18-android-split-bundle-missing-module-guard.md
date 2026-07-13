# Android split-bundle missing-module build-layer guards

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent `Error: Requiring unknown module "<id>"` runtime crashes by making the build **fail fast** when the union-build split-bundle output has an uncovered sync dependency, and prove the resulting APK actually boots on an emulator.

**Architecture:**
The union build (`apps/mobile/scripts/unionBuild.js`) emits `common/main/background` eager bundles plus per-segment `.seg.js/.hbc`. Two post-build guards exist but both have silent escape hatches:
1. `validateBundleCompleteness` in `unionBuildHelpers.js` detects modules reachable via sync edges that are not covered by any eager bundle or segment — but the call site only `console.error`s a WARNING and continues.
2. `check-split-bundle-integrity.js` walks every segment's `__d(fn, id, [deps])` and checks each dep is either in eager, in the same segment, or in its `dependsOn` closure — but silently `continue`s when the dep is not in any segment of this runtime (the *orphan* case), which is exactly the "will crash at runtime" scenario.

We close both gaps, add a cross-runtime shared-segment coverage check, and add an **emulator boot smoke test** that `adb install`s a real APK, launches it, and `adb pull`s the native-logger file to prove the JS VM actually executed past the prologue without the "Requiring unknown module" exception.

**Tech Stack:**
- Node scripts (`apps/mobile/scripts/*.js`) under Jest — see `apps/mobile/scripts/__tests__/` for the existing harness (`tmpDir` + `writeSegJs` fixtures).
- Bash + `adb` for the emulator smoke test, invoked from `development/scripts/`.
- Metro / Hermes split-bundle runtime in `apps/mobile/src/splitBundle/`.

**Scope boundary:**
This plan does **not** change allocator behavior to make the currently-missing module 3340 non-orphan — that is a per-incident fix the developer must do after the new guard fails the build. The plan only makes the bug **visible and blocking** at build time, so it cannot ship again, and gives a reproducible emulator verification path. The final task runs the hardened build to surface the concrete allocation bug that caused the current crash; fixing that bug is a follow-up constrained by the plan's new error message.

---

## Context files to read first

Before writing any code, the executor should skim these to understand data shapes:

- `apps/mobile/scripts/unionBuild.js:1618-1681` — call site of `validateBundleCompleteness`, the warn-not-throw gap.
- `apps/mobile/scripts/unionBuildHelpers.js:481-526` — the completeness walker itself.
- `apps/mobile/scripts/check-split-bundle-integrity.js:226-302` — `scanRuntime`, orphan skip at line 285.
- `apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js:380-498` — existing Jest patterns (`tmpDir`, `writeSegJs`, fixture shape of `idMap.segments[key].modules`).
- `apps/mobile/scripts/__tests__/unionBuildHelpers.test.js` — look for `validateBundleCompleteness` tests (`missingAbsPaths`) around lines 680-790.
- `apps/mobile/plugins/segmentPaths.js` — directory layout (`apps/mobile/dist/segments*`, manifest, id-map).
- `apps/mobile/build-bundle.js:733-779` — where integrity check is invoked after unionBuild.
- `apps/mobile/src/splitBundle/installProdBundleLoader.ts` — runtime segment loader, for background on what the crash actually means.
- `development/scripts/android-release-build-deploy.sh` — the reproduction script the user reported the crash with.

**Do NOT skip this reading.** The tests use specific fixture shapes (e.g. `idMap.segments[key].modules` maps `idStr → relPath`) that must be matched exactly.

---

## Task 1: Add a failing regression test for the `validateBundleCompleteness` escape hatch

**Problem:** `apps/mobile/scripts/unionBuild.js:1671-1680` only warns when `result.valid === false`. A module reachable via sync edges that is absent from all eager buckets and all segments will cause `Requiring unknown module` at runtime, but the build exits 0.

**Files:**
- Create: `apps/mobile/scripts/__tests__/validateBundleCompleteness.fail-fast.test.js`
- Modify (later task): `apps/mobile/scripts/unionBuild.js:1639-1681`

**Step 1: Write the failing test**

```js
// apps/mobile/scripts/__tests__/validateBundleCompleteness.fail-fast.test.js
const { validateBundleCompleteness } = require('../unionBuildHelpers');

describe('validateBundleCompleteness — build-time guard', () => {
  it('returns valid=false when a sync dep is reachable but not covered', () => {
    // Graph: /a.js sync-requires /b.js. /a.js is in the eager bundle.
    // /b.js is neither eager nor in any segment → orphan → runtime crash.
    const graph = new Map([
      [
        '/a.js',
        {
          dependencies: new Map([
            [
              'b',
              { absolutePath: '/b.js', data: { data: { asyncType: null } } },
            ],
          ]),
        },
      ],
      ['/b.js', { dependencies: new Map() }],
    ]);

    const result = validateBundleCompleteness({
      graph,
      eagerAbsPaths: new Set(['/a.js']),
      segmentAbsPaths: new Set(),
    });

    expect(result.valid).toBe(false);
    expect(result.missingAbsPaths).toContain('/b.js');
  });

  it('returns valid=true when every reachable sync dep is covered', () => {
    const graph = new Map([
      [
        '/a.js',
        {
          dependencies: new Map([
            [
              'b',
              { absolutePath: '/b.js', data: { data: { asyncType: null } } },
            ],
          ]),
        },
      ],
      ['/b.js', { dependencies: new Map() }],
    ]);
    const result = validateBundleCompleteness({
      graph,
      eagerAbsPaths: new Set(['/a.js', '/b.js']),
      segmentAbsPaths: new Set(),
    });
    expect(result.valid).toBe(true);
    expect(result.missingAbsPaths).toHaveLength(0);
  });
});
```

**Step 2: Run the test to confirm it passes today (baseline)**

```bash
cd /Users/huhuanming/Project/app-monorepo
yarn jest apps/mobile/scripts/__tests__/validateBundleCompleteness.fail-fast.test.js
```
Expected: **PASS** (the helper is already correct; the bug is at the call site — Task 2 adds the failing test for that).

**Step 3: Commit**

```bash
git add apps/mobile/scripts/__tests__/validateBundleCompleteness.fail-fast.test.js
git commit -m "test(mobile): lock in validateBundleCompleteness orphan detection"
```

---

## Task 2: Make unionBuild.js throw on completeness violations

**Files:**
- Modify: `apps/mobile/scripts/unionBuild.js:1639-1681`
- Create: `apps/mobile/scripts/__tests__/unionBuild.fail-fast.test.js`

**Step 1: Write the failing test**

Invoke the relevant section by importing a small helper we will extract. Since `unionBuild.js` is a 1900-line script, we extract the post-check reporter into a testable function.

```js
// apps/mobile/scripts/__tests__/unionBuild.fail-fast.test.js
const { assertBundleCompleteness } = require('../unionBuildHelpers');

describe('assertBundleCompleteness', () => {
  it('throws when any runtime has missing modules', () => {
    expect(() =>
      assertBundleCompleteness([
        {
          runtimeLabel: 'main',
          result: { valid: false, missingAbsPaths: ['/x.js', '/y.js'] },
        },
        {
          runtimeLabel: 'background',
          result: { valid: true, missingAbsPaths: [] },
        },
      ]),
    ).toThrow(/main runtime.*2 module/);
  });

  it('returns quietly when all runtimes are valid', () => {
    expect(() =>
      assertBundleCompleteness([
        {
          runtimeLabel: 'main',
          result: { valid: true, missingAbsPaths: [] },
        },
        {
          runtimeLabel: 'background',
          result: { valid: true, missingAbsPaths: [] },
        },
      ]),
    ).not.toThrow();
  });
});
```

**Step 2: Run the test; expect FAIL** because `assertBundleCompleteness` does not exist yet.

```bash
yarn jest apps/mobile/scripts/__tests__/unionBuild.fail-fast.test.js
```
Expected: FAIL — `assertBundleCompleteness is not a function`.

**Step 3: Implement the helper in `unionBuildHelpers.js`**

Add this function near `validateBundleCompleteness`:

```js
// apps/mobile/scripts/unionBuildHelpers.js (new export)
function assertBundleCompleteness(reports) {
  const failures = reports.filter(({ result }) => !result.valid);
  if (failures.length === 0) return;
  const messages = failures.map(({ runtimeLabel, result }) => {
    const sample = result.missingAbsPaths.slice(0, 20);
    const extra =
      result.missingAbsPaths.length > 20
        ? `\n  ... and ${result.missingAbsPaths.length - 20} more`
        : '';
    return (
      `[unionBuild] ${runtimeLabel} runtime: ${result.missingAbsPaths.length} module(s) ` +
      `reachable via sync edges but not in any eager bundle or segment — ` +
      `this will crash with "Requiring unknown module <N>" at runtime:\n` +
      sample.map((p) => `  - ${p}`).join('\n') +
      extra
    );
  });
  throw new Error(
    [
      'Split-bundle build is incomplete. Fix the allocator or add the module to',
      'apps/mobile/bundle-groups.config.js `promotedSegments` / `allocationRules`,',
      'or keep it in the eager bundle. Never silently continue.',
      '',
      ...messages,
    ].join('\n'),
  );
}

module.exports = {
  // ...existing exports...
  assertBundleCompleteness,
};
```

**Step 4: Rerun test; expect PASS.**

```bash
yarn jest apps/mobile/scripts/__tests__/unionBuild.fail-fast.test.js
```

**Step 5: Wire it into `unionBuild.js`.** Replace the current `for (const [runtimeLabel, ...] of [...]) { ... console.error(...) }` at lines 1639-1681 with:

```js
const { validateBundleCompleteness, assertBundleCompleteness } = require('./unionBuildHelpers');

const completenessReports = [
  ['main', mainGraph, new Set([...commonEagerAbsPaths, ...moduleIdsToAbsPaths(mainBundleResult.startupModuleIds, mainModuleIndex.moduleIdToAbsPath)]), mainSegmentAbsPaths],
  ['background', backgroundGraph, new Set([...commonEagerAbsPaths, ...moduleIdsToAbsPaths(backgroundBundleResult.startupModuleIds, backgroundModuleIndex.moduleIdToAbsPath)]), bgSegmentAbsPaths],
].map(([runtimeLabel, runtimeGraph, eagerAbsPaths, segAbsPaths]) => ({
  runtimeLabel,
  result: validateBundleCompleteness({
    graph: runtimeGraph.dependencies,
    eagerAbsPaths,
    segmentAbsPaths: segAbsPaths,
  }),
}));

assertBundleCompleteness(completenessReports);
```

Provide an explicit opt-out only via a loud env var (keep symmetrical to the existing `ONEKEY_SKIP_SPLIT_INTEGRITY_CHECK` escape hatch — but this one should default OFF and require explicit intent):

```js
if (process.env.ONEKEY_ALLOW_INCOMPLETE_BUNDLE === '1') {
  // Keep old warn-only behavior for local experiments. CI must never set this.
  for (const r of completenessReports) {
    if (!r.result.valid) {
      console.error(`[unionBuild] WARNING (opt-out active): ${r.runtimeLabel}: ${r.result.missingAbsPaths.length} missing`);
    }
  }
} else {
  assertBundleCompleteness(completenessReports);
}
```

**Step 6: Run the unit tests + a fast smoke.**

```bash
yarn jest apps/mobile/scripts/__tests__/ --silent
```
All existing tests must still pass.

**Step 7: Commit**

```bash
git add apps/mobile/scripts/unionBuildHelpers.js \
        apps/mobile/scripts/unionBuild.js \
        apps/mobile/scripts/__tests__/unionBuild.fail-fast.test.js
git commit -m "fix(mobile/union-build): throw on uncovered sync deps instead of warning

Previously, validateBundleCompleteness detected modules that are reachable
via sync edges but not present in any eager bundle or segment, yet the
call site only printed a WARNING via console.error and the build
continued. Shipping such a bundle produces 'Requiring unknown module'
crashes at runtime. Make it a hard failure, with ONEKEY_ALLOW_INCOMPLETE_BUNDLE=1
as an explicit local-only opt-out."
```

---

## Task 3: Close the orphan-dep silent skip in check-split-bundle-integrity.js

**Problem:** `scanRuntime` at `apps/mobile/scripts/check-split-bundle-integrity.js:285` does `if (!depSeg) continue;` — if a segment's `__d(fn, srcId, [...deps])` references a `depId` that is neither in the runtime's eager bucket nor owned by any segment in this runtime's manifest, the check silently accepts it. This is exactly the crash signal we want to flag.

**Files:**
- Modify: `apps/mobile/scripts/check-split-bundle-integrity.js:226-302`
- Modify: `apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js`

**Step 1: Write the failing test**

Append to `apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js` (inside the existing `scanRuntime` `describe` block):

```js
it('flags a dep that is orphan — not in eager and not in any segment', () => {
  const segmentsDir = path.join(tmpDir, 'segments');
  // Segment A defines module 4001 whose sync dep is 4999.
  // 4999 is NOT in idMap.common/main and NOT in any segment → runtime crash waiting to happen.
  writeSegJs(segmentsDir, 'seg-a', [
    { moduleId: 4001, deps: [4999] },
  ]);

  const manifest = {
    segments: {
      'seg:a': {
        id: 2001,
        key: 'seg:a',
        runtime: 'main',
        relativePath: 'segments/seg-a.seg.hbc',
        sha256: 'a',
        dependsOn: [],
        size: 100,
      },
    },
  };
  const idMap = {
    common: {},
    main: {},
    background: {},
    segments: {
      'seg:a': { id: 2001, runtime: 'main', modules: { 4001: 'a.tsx' } },
      // Intentionally no entry for 4999 anywhere.
    },
  };

  const { violations } = scanRuntime({
    runtimeLabel: 'main',
    segmentsDir,
    manifest,
    idMap,
    runtimeBucketNames: ['common', 'main'],
  });

  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatchObject({
    kind: 'orphan_dep',
    runtime: 'main',
    srcSegment: 'seg:a',
    srcModuleId: 4001,
    depModuleId: 4999,
  });
});
```

**Step 2: Run the test; expect FAIL**

```bash
yarn jest apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js
```
Expected: the new test fails — current code silently skips the orphan.

**Step 3: Implement the fix**

Edit `apps/mobile/scripts/check-split-bundle-integrity.js`. Replace the orphan-skip block (~line 281-298) with:

```js
for (const { moduleId, deps } of moduleDefs) {
  for (const depId of deps) {
    if (eager.has(depId)) continue; // eager — always available
    const depSeg = moduleToSegment.get(depId);
    if (depSeg === segKey) continue; // same segment — OK
    if (depSeg) {
      // The dep is owned by another segment in THIS runtime.
      if (closure.has(depSeg)) continue; // covered by transitive dependsOn — OK
      violations.push({
        kind: 'cross_segment_sync',
        runtime: runtimeLabel,
        srcSegment: segKey,
        srcModuleId: moduleId,
        srcModulePath: idToPath.get(moduleId) || `<unknown ${moduleId}>`,
        depSegment: depSeg,
        depModuleId: depId,
        depModulePath: idToPath.get(depId) || `<unknown ${depId}>`,
      });
      continue;
    }
    // Orphan: dep isn't in eager and isn't owned by any segment in this
    // runtime's manifest. At runtime this becomes
    // "Requiring unknown module <depId>" — flag it.
    violations.push({
      kind: 'orphan_dep',
      runtime: runtimeLabel,
      srcSegment: segKey,
      srcModuleId: moduleId,
      srcModulePath: idToPath.get(moduleId) || `<unknown ${moduleId}>`,
      depModuleId: depId,
      depModulePath: idToPath.get(depId) || `<unknown ${depId}>`,
    });
  }
}
```

Then update `printViolations` so the new kind prints cleanly:

```js
function printViolations(violations) {
  const groups = new Map();
  const structural = [];
  const orphans = [];
  for (const v of violations) {
    if (v.kind === 'cross_segment_sync') {
      const key = `${v.runtime}::${v.srcSegment} -> ${v.depSegment}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
      continue;
    }
    if (v.kind === 'orphan_dep') {
      orphans.push(v);
      continue;
    }
    structural.push(v);
  }

  for (const s of structural) {
    console.error(`[integrity][${s.runtime}] ${s.kind}: ${s.message}`);
  }

  const keys = [...groups.keys()].sort();
  for (const key of keys) {
    const list = groups.get(key);
    const sample = list[0];
    console.error(`[integrity][${sample.runtime}] ${sample.srcSegment}`);
    console.error(`    → ${sample.depSegment}`);
    console.error(`    ${list.length} sync edge(s) not covered by dependsOn. First 3:`);
    for (const v of list.slice(0, 3)) {
      console.error(`      module ${v.srcModuleId} (${formatPath(v.srcModulePath)})`);
      console.error(`        → module ${v.depModuleId} (${formatPath(v.depModulePath)})`);
    }
  }

  if (orphans.length > 0) {
    console.error('');
    console.error(`[integrity] ORPHAN DEPS (${orphans.length}) — will crash at runtime:`);
    for (const v of orphans.slice(0, 10)) {
      console.error(
        `  [${v.runtime}] ${v.srcSegment} id=${v.srcModuleId} (${formatPath(v.srcModulePath)})`,
      );
      console.error(
        `    → id=${v.depModuleId} (${formatPath(v.depModulePath)}) NOT in any bundle/segment`,
      );
    }
    if (orphans.length > 10) {
      console.error(`  ... and ${orphans.length - 10} more`);
    }
  }
}
```

**Step 4: Rerun; expect PASS**

```bash
yarn jest apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js
```

**Step 5: Commit**

```bash
git add apps/mobile/scripts/check-split-bundle-integrity.js \
        apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js
git commit -m "fix(mobile/integrity): flag orphan deps as violations

scanRuntime previously silently skipped __d deps that are neither in the
eager bucket nor owned by any segment in this runtime's manifest. That is
exactly the condition that causes 'Requiring unknown module <N>' at
runtime — the source segment's __d list references an id whose definition
never ships. Surface these as a new 'orphan_dep' violation and fail the
build."
```

---

## Task 4: Add cross-runtime shared-segment coverage check

**Problem (nuance):** A shared segment is emitted from main runtime's module graph. Its `__d` list contains module IDs that were resolved against **main's** eager/segment sets. When the same segment loads in the background runtime, the `__d` ids must also be covered by background's eager bundle + loaded segments. `check-split-bundle-integrity.js:scanRuntime` scans per-runtime, so when invoked for `background`, the shared segment is re-scanned against background's idMap. Task 3 catches orphans there — but only if `idMap.segments[sharedSeg].modules` is populated consistently for both runtimes.

We need a focused test asserting that a shared segment is validated against **both** runtime manifests.

**Files:**
- Modify: `apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js` (add one case)
- Modify: `apps/mobile/scripts/check-split-bundle-integrity.js:main()` — ensure every shared segment appears in both manifests (it should today; add an assertion).

**Step 1: Write the failing test**

```js
// in the `main()` / integration describe block
it('catches a shared segment whose sync dep is missing in the background runtime', () => {
  // seg:sh defines id=5000 that sync-requires id=5100.
  // seg:sh is 'shared', so it lives in both manifests.
  // In main, id=5100 is in main eager bucket → OK.
  // In background, id=5100 is NOT in background eager and NOT in any bg segment → orphan.
  const segmentsMainDir = path.join(tmpDir, 'segments');
  const segmentsBgDir = path.join(tmpDir, 'segments-background');
  writeSegJs(segmentsMainDir, 'shared-seg', [
    { moduleId: 5000, deps: [5100] },
  ]);
  writeSegJs(segmentsBgDir, 'shared-seg', [
    { moduleId: 5000, deps: [5100] },
  ]);

  const sharedEntry = {
    id: 9001,
    key: 'seg:sh',
    runtime: 'shared',
    sha256: 'x',
    dependsOn: [],
    size: 100,
  };
  const manifestMain = {
    segments: {
      'seg:sh': { ...sharedEntry, relativePath: 'segments/shared-seg.seg.hbc' },
    },
  };
  const manifestBg = {
    segments: {
      'seg:sh': {
        ...sharedEntry,
        relativePath: 'segments-background/shared-seg.seg.hbc',
      },
    },
  };
  const idMap = {
    common: {},
    main: { 5100: 'main-only-dep.ts' }, // present in main eager — OK there
    background: {},                      // NOT in background eager
    segments: {
      'seg:sh': {
        id: 9001,
        runtime: 'shared',
        modules: { 5000: 'shared.tsx' },
      },
    },
  };

  const mainRun = scanRuntime({
    runtimeLabel: 'main',
    segmentsDir: segmentsMainDir,
    manifest: manifestMain,
    idMap,
    runtimeBucketNames: ['common', 'main'],
  });
  const bgRun = scanRuntime({
    runtimeLabel: 'background',
    segmentsDir: segmentsBgDir,
    manifest: manifestBg,
    idMap,
    runtimeBucketNames: ['common', 'background'],
  });

  expect(mainRun.violations).toHaveLength(0);
  expect(bgRun.violations).toHaveLength(1);
  expect(bgRun.violations[0]).toMatchObject({
    kind: 'orphan_dep',
    runtime: 'background',
    depModuleId: 5100,
  });
});
```

**Step 2: Run; expect PASS** (Task 3 already covers the mechanics — this test just locks in the shared-segment scenario so a future refactor can't regress it).

```bash
yarn jest apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js
```

**Step 3: Commit**

```bash
git add apps/mobile/scripts/__tests__/check-split-bundle-integrity.test.js
git commit -m "test(mobile/integrity): lock in shared-segment cross-runtime orphan detection"
```

---

## Task 5: Wire the hardened guards into the deploy script and CI

**Files:**
- Modify: `development/scripts/android-release-build-deploy.sh` (`cmd_build` / `cmd_gradle`)
- Modify (sanity): `apps/mobile/build-bundle.js:766-779` — keep integrity-check invocation but now it will have richer failures.

**Step 1: Add a pre-flight to the deploy script**

Edit `development/scripts/android-release-build-deploy.sh`. At the top of `cmd_build`, before invoking `build-bundle.js`:

```bash
cmd_build() {
  echo "$(timestamp) 📦 Building HBC bundles..."
  cd "$MOBILE_DIR"

  # Clear previous outputs so stale module-id-map.json can't mask a regression.
  rm -rf out-dir-bundle out-dir-bundle-zip dist/segments dist/segments-background \
         dist/segment-manifest.json dist/segment-manifest-background.json \
         dist/module-id-map.json dist/module-id-map-main.json \
         dist/module-id-map-background.json

  # Guards must be ON by default. Setting these to 1 in CI is a BUG.
  unset ONEKEY_SKIP_SPLIT_INTEGRITY_CHECK
  unset ONEKEY_ALLOW_INCOMPLETE_BUNDLE

  SENTRY_DISABLE_AUTO_UPLOAD=true \
  ENABLE_NATIVE_BACKGROUND_THREAD=true \
  UNION_BUILD=true \
  SPLIT_BUNDLE=1 \
  SPLIT_BUNDLE_SEGMENTS=true \
  node --max-old-space-size=8192 build-bundle.js --platform android
  # ...existing tail...
}
```

**Step 2: Verify the script still works end-to-end (dry run — just check syntax)**

```bash
bash -n development/scripts/android-release-build-deploy.sh
```
Expected: exit 0, no stderr.

**Step 3: Commit**

```bash
git add development/scripts/android-release-build-deploy.sh
git commit -m "build(mobile): make deploy script fail fast on split-bundle gaps

Previously stale outputs from a prior interrupted build could keep the
integrity check pointing at a module-id-map whose contents didn't match
the HBC we were about to ship. Clear them, and explicitly unset the
opt-out env vars so local habits can't silently suppress the new guards."
```

---

## Task 6: Add an emulator boot smoke test

**Goal:** Prove at build time that the freshly-built APK boots past the JS prologue on an emulator — that there is no "Requiring unknown module" or other JS exception in the first N seconds — and `adb pull` the native-logger file to **prove** the JS VM actually executed (the file contains `[SplashProvider]` / `[StartupTiming]` / `[StartupProfile.*]` entries written from JS).

This is the runtime check the static guards cannot fully replace.

**Files:**
- Create: `development/scripts/android-emulator-boot-smoke.sh`
- Create: `apps/mobile/scripts/__tests__/emulator-boot-smoke.spec.md` (documentation, not a jest test — use `.spec.md` to avoid being picked up by Jest glob).

**Step 1: Read the native-logger file path**

Find where `react-native-file-logger` writes its file on Android:

```bash
grep -R "NativeLogger.write\|react-native-file-logger\|logDir\|file_logger" \
  apps/mobile/android apps/mobile/src 2>/dev/null | head -30
```

Record the on-device path (typically `/data/user/0/so.onekey.app.wallet/files/logs/` or similar). Record the exact path in the skill doc; the smoke script will pull from there.

**Step 2: Write the smoke script**

```bash
# development/scripts/android-emulator-boot-smoke.sh
#!/bin/bash
# ============================================================
# Android emulator boot smoke
#
# Installs a freshly-built APK on the attached emulator, launches it,
# waits up to STARTUP_TIMEOUT_S seconds for the app to settle, then:
#   - fails if logcat contains a JS crash signature
#   - fails if the native-logger file doesn't exist or is empty
#   - fails if the native-logger file doesn't contain at least one
#     [SplashProvider] / [StartupTiming] / [GlobalJotaiReady] /
#     [StartupProfile.*] entry (proof that JS actually ran)
#   - otherwise prints the pulled log file path and exits 0.
#
# Usage:
#   ./development/scripts/android-emulator-boot-smoke.sh [apk-path]
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
PACKAGE_NAME="so.onekey.app.wallet"
APK="${1:-$MOBILE_DIR/android/app/build/outputs/apk/prod/release/app-prod-release.apk}"
STARTUP_TIMEOUT_S="${STARTUP_TIMEOUT_S:-45}"
OUT_DIR="${OUT_DIR:-$MOBILE_DIR/out-dir-smoke-$(date +%Y%m%d-%H%M%S)}"
NATIVE_LOG_REMOTE_DIR="files/logs"   # verify in Step 1 above; update if different
LOGCAT_FILE="$OUT_DIR/logcat.txt"
NATIVE_LOG_LOCAL_DIR="$OUT_DIR/native-logs"

mkdir -p "$OUT_DIR" "$NATIVE_LOG_LOCAL_DIR"

DEVICE_ID=$(adb devices -l | grep -v "List of devices" | grep "device " | head -1 | awk '{print $1}')
if [ -z "$DEVICE_ID" ]; then
  echo "❌ No emulator/device attached."
  exit 1
fi
echo "device: $DEVICE_ID"
echo "apk: $APK"

adb -s "$DEVICE_ID" uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true
adb -s "$DEVICE_ID" install -r "$APK"

adb -s "$DEVICE_ID" logcat -c

adb -s "$DEVICE_ID" shell am start -n "$PACKAGE_NAME/.MainActivity" \
  -a android.intent.action.MAIN \
  -c android.intent.category.LAUNCHER \
  > /dev/null

# Collect logcat in background for the timeout window.
adb -s "$DEVICE_ID" logcat -v time > "$LOGCAT_FILE" &
LOGCAT_PID=$!

# Wait until settle or timeout.
SECONDS_ELAPSED=0
while [ $SECONDS_ELAPSED -lt $STARTUP_TIMEOUT_S ]; do
  sleep 3
  SECONDS_ELAPSED=$((SECONDS_ELAPSED + 3))

  # Early-abort on a known-bad signature.
  if grep -qE "Requiring unknown module|SegmentLoadError|JavascriptException" "$LOGCAT_FILE"; then
    echo "❌ JS crash detected in logcat at +${SECONDS_ELAPSED}s"
    kill "$LOGCAT_PID" 2>/dev/null || true
    grep -E "Requiring unknown module|SegmentLoadError|JavascriptException" "$LOGCAT_FILE" | head -5
    exit 2
  fi

  # Early-success if the app window is displayed and JS ran a bit.
  if grep -q "Displayed so.onekey.app.wallet" "$LOGCAT_FILE"; then
    break
  fi
done

kill "$LOGCAT_PID" 2>/dev/null || true
wait "$LOGCAT_PID" 2>/dev/null || true

# Pull native logs via run-as when debuggable, else from /sdcard mirror if
# you have one; release builds usually aren't run-as-able.
if adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME pwd" > /dev/null 2>&1; then
  adb -s "$DEVICE_ID" exec-out "run-as $PACKAGE_NAME tar c $NATIVE_LOG_REMOTE_DIR" \
    | tar x -C "$NATIVE_LOG_LOCAL_DIR"
else
  echo "⚠️  APK is not debuggable; trying /sdcard fallback."
  adb -s "$DEVICE_ID" pull "/sdcard/Android/data/$PACKAGE_NAME/files/logs" "$NATIVE_LOG_LOCAL_DIR" \
    || echo "⚠️  no /sdcard logs either"
fi

LOG_LINES=$(find "$NATIVE_LOG_LOCAL_DIR" -type f -exec cat {} + 2>/dev/null | wc -l | awk '{print $1}')
echo "native-log lines pulled: $LOG_LINES"

# Require concrete proof the JS side ran.
if ! find "$NATIVE_LOG_LOCAL_DIR" -type f -exec cat {} + 2>/dev/null \
     | grep -qE "SplashProvider|StartupTiming|GlobalJotaiReady|StartupProfile\."; then
  echo "❌ native-logger file has no JS-side markers — JS did not reach normal startup."
  echo "   logcat saved to: $LOGCAT_FILE"
  exit 3
fi

echo "✅ APK booted past JS prologue"
echo "   logcat:     $LOGCAT_FILE"
echo "   native log: $NATIVE_LOG_LOCAL_DIR"
```

Make it executable:

```bash
chmod +x development/scripts/android-emulator-boot-smoke.sh
```

**Step 3: Dry-run sanity check**

```bash
bash -n development/scripts/android-emulator-boot-smoke.sh
```
Expected: exit 0.

**Step 4: Commit**

```bash
git add development/scripts/android-emulator-boot-smoke.sh
git commit -m "test(mobile): add android emulator boot smoke script

Installs a freshly-built APK on the attached emulator, launches it, and
fails unless the native-logger file contains at least one JS-side marker
(SplashProvider/StartupTiming/GlobalJotaiReady/StartupProfile). Also
scans logcat for JS crash signatures (Requiring unknown module,
SegmentLoadError, JavascriptException). Runs in under a minute."
```

---

## Task 7: Reproduce the current crash with the hardened build and capture the concrete allocation bug

**Files:**
- None modified in this task; this is verification.

**Step 1: Build with the new guards**

```bash
cd /Users/huhuanming/Project/app-monorepo
ONEKEY_STARTUP_PROFILE=1 bash development/scripts/android-release-build-deploy.sh build
```

Expected: **build FAILS** with one of:
- `[unionBuild] <runtime> runtime: <N> module(s) reachable via sync edges...` (Task 2)
- `[integrity] ORPHAN DEPS (<N>) — will crash at runtime:` (Task 3)

Whichever surfaces, copy the **first 3 offending modules + their source paths** into a scratch note. Those are the real allocation bug(s) the Apr-17 refactor (`5abdb538b5`) introduced.

**Step 2: Locate the module 3340 equivalent**

```bash
node -e 'const m = require("./apps/mobile/dist/module-id-map.json");
for (const b of ["common","main","background"]) {
  for (const [id, p] of Object.entries(m[b] || {})) {
    if (Number(id) === <OFFENDING_ID>) console.log("eager", b, id, "→", p);
  }
}
for (const [k, e] of Object.entries(m.segments || {})) {
  for (const [id, p] of Object.entries(e.modules || {})) {
    if (Number(id) === <OFFENDING_ID>) console.log("seg", k, "runtime=", e.runtime, id, "→", p);
  }
}'
```

Replace `<OFFENDING_ID>` with the id from Step 1's error. This prints the source file path (or nothing — confirming "orphan").

**Step 3: Record findings**

Create `docs/plans/notes/2026-04-18-missing-module-3340-repro.md` with the captured output. This note is **not** part of the committable artifact — it is scratch for the follow-up fix.

**Step 4: Allocation fix (follow-up — not in this plan)**

The allocator fix depends on what the captured output says. Typical fixes:
- Add the path to `promotedSegments` in `apps/mobile/bundle-groups.config.js` if it must be eager.
- Extend `expandSegmentsWithSyncDeps` if a sync edge between two segments was missed.
- Convert the offending `import` to `import()` if the refactor intended it to be lazy.

Do **not** change allocator logic in this plan — land the guards first so the follow-up fix has a failing test to drive it.

---

## Task 8: Run the full flow with the allocation fix + emulator smoke

(Executor runs this after the follow-up allocation fix from Task 7 is merged.)

**Step 1: Full build + gradle + deploy to emulator**

```bash
ONEKEY_STARTUP_PROFILE=1 bash development/scripts/android-release-build-deploy.sh all
```

Expected: all three phases (`cmd_gradle`, `cmd_build`, `cmd_deploy`) succeed.

**Step 2: Emulator smoke**

```bash
bash development/scripts/android-emulator-boot-smoke.sh
```

Expected: **exit 0**, prints the pulled native-log directory. Verify manually by opening the file and searching for `StartupProfile.js`, `StartupProfile.hbc`, `StartupProfile.seg` entries — confirming the build-time flag actually reached the running APK.

**Step 3: If smoke fails**

Do **not** suppress the failure. Re-read the captured logcat + native-log — they pinpoint the next allocation bug. Return to Task 7 Step 4 and repeat.

---

## Exit criteria

- [ ] `yarn jest apps/mobile/scripts/__tests__/` passes including 3 new tests (Tasks 1, 2, 3, 4).
- [ ] `bash development/scripts/android-release-build-deploy.sh build` on the current `codex/feat-split-background-thread` branch **fails** with an actionable error identifying the orphaned module(s).
- [ ] After the follow-up allocation fix, the same command succeeds.
- [ ] `bash development/scripts/android-emulator-boot-smoke.sh` exits 0 and the pulled native-log directory contains `StartupProfile.*` entries.
- [ ] One commit per task, with the commit messages specified above.

## Rollback

If the hardened guards produce too many false positives during CI stabilization, set `ONEKEY_ALLOW_INCOMPLETE_BUNDLE=1` in a single CI job (never in release jobs) and open an issue referencing each false-positive module path. Do not remove the guards.
