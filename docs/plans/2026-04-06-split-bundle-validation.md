# Split Bundle Module Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add build-time validation to unionBuild that catches missing modules before they cause runtime crashes ("Requiring unknown module X"), and add comprehensive tests for cross-runtime module completeness.

**Architecture:** Add a `validateBundleCompleteness` function in `unionBuildHelpers.js` that runs after bundle assembly but before writing output. It compares each runtime's eager module set + segment manifest against the full dependency graph to find modules that were referenced but not assigned to any bundle. On failure, the build errors with a detailed report.

**Tech Stack:** Node.js (jest for testing), Metro bundler internals

---

### Task 1: Add `validateBundleCompleteness` function with failing test

**Files:**
- Modify: `apps/mobile/scripts/unionBuildHelpers.js`
- Modify: `apps/mobile/scripts/__tests__/unionBuildHelpers.test.js`

**Step 1: Write the failing test**

Add to `apps/mobile/scripts/__tests__/unionBuildHelpers.test.js`:

```javascript
it('detects modules that are referenced but not in any bundle or segment', () => {
  // Module A (eager) depends on Module B (sync dep),
  // but B is not in eager set and not in any segment → missing
  const graph = new Map([
    ['/a.js', createModuleData({
      code: 'module A',
      dependencies: [{ key: 'b', absolutePath: '/b.js' }],
    })],
    ['/b.js', createModuleData({ code: 'module B' })],
  ]);

  const eagerAbsPaths = new Set(['/a.js']); // only A is eager
  const segmentAbsPaths = new Set();         // B is not in any segment
  const allGraphAbsPaths = new Set(['/a.js', '/b.js']);

  const result = validateBundleCompleteness({
    graph,
    eagerAbsPaths,
    segmentAbsPaths,
    allGraphAbsPaths,
  });

  expect(result.valid).toBe(false);
  expect(result.missingAbsPaths).toContain('/b.js');
});

it('passes when all referenced modules are in eager or segment', () => {
  const graph = new Map([
    ['/a.js', createModuleData({
      code: 'module A',
      dependencies: [{ key: 'b', absolutePath: '/b.js' }],
    })],
    ['/b.js', createModuleData({ code: 'module B' })],
  ]);

  const eagerAbsPaths = new Set(['/a.js', '/b.js']);
  const segmentAbsPaths = new Set();
  const allGraphAbsPaths = new Set(['/a.js', '/b.js']);

  const result = validateBundleCompleteness({
    graph,
    eagerAbsPaths,
    segmentAbsPaths,
    allGraphAbsPaths,
  });

  expect(result.valid).toBe(true);
  expect(result.missingAbsPaths).toHaveLength(0);
});

it('accepts modules in segments as covered', () => {
  const graph = new Map([
    ['/a.js', createModuleData({
      code: 'module A',
      dependencies: [
        { key: 'b', absolutePath: '/b.js', asyncType: 'async' },
      ],
    })],
    ['/b.js', createModuleData({ code: 'module B' })],
  ]);

  const eagerAbsPaths = new Set(['/a.js']);
  const segmentAbsPaths = new Set(['/b.js']); // B is in a segment
  const allGraphAbsPaths = new Set(['/a.js', '/b.js']);

  const result = validateBundleCompleteness({
    graph,
    eagerAbsPaths,
    segmentAbsPaths,
    allGraphAbsPaths,
  });

  expect(result.valid).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest apps/mobile/scripts/__tests__/unionBuildHelpers.test.js --no-coverage -t "detects modules that are referenced"`
Expected: FAIL — `validateBundleCompleteness is not a function`

**Step 3: Write minimal implementation**

Add to `apps/mobile/scripts/unionBuildHelpers.js`:

```javascript
function validateBundleCompleteness({
  graph,
  eagerAbsPaths,
  segmentAbsPaths,
  allGraphAbsPaths,
}) {
  const coveredAbsPaths = new Set([...eagerAbsPaths, ...segmentAbsPaths]);
  const missingAbsPaths = [];

  for (const absolutePath of allGraphAbsPaths) {
    if (!coveredAbsPaths.has(absolutePath)) {
      // Check: is this module reachable from any eager module via sync deps?
      const moduleData = graph.get(absolutePath);
      if (moduleData) {
        missingAbsPaths.push(absolutePath);
      }
    }
  }

  return {
    valid: missingAbsPaths.length === 0,
    missingAbsPaths,
  };
}
```

Export it in `module.exports`.
Update the import in the test file.

**Step 4: Run tests to verify they pass**

Run: `npx jest apps/mobile/scripts/__tests__/unionBuildHelpers.test.js --no-coverage`
Expected: 22 passed (19 existing + 3 new)

**Step 5: Commit**

```bash
git add apps/mobile/scripts/unionBuildHelpers.js apps/mobile/scripts/__tests__/unionBuildHelpers.test.js
git commit -m "feat(split-bundle): add validateBundleCompleteness with tests"
```

---

### Task 2: Add cross-runtime validation test

**Files:**
- Modify: `apps/mobile/scripts/__tests__/unionBuildHelpers.test.js`

**Step 1: Write cross-runtime tests**

```javascript
it('detects modules missing from one runtime but present in another', () => {
  // Module C is in main's eager set but not in background's
  // Background references C via sync dependency
  const mainGraph = new Map([
    ['/entry-main.js', createModuleData({
      dependencies: [{ key: 'shared', absolutePath: '/shared.js' }],
    })],
    ['/shared.js', createModuleData({
      dependencies: [{ key: 'c', absolutePath: '/c.js' }],
    })],
    ['/c.js', createModuleData({ code: 'module C' })],
  ]);

  const bgGraph = new Map([
    ['/entry-bg.js', createModuleData({
      dependencies: [{ key: 'shared', absolutePath: '/shared.js' }],
    })],
    ['/shared.js', createModuleData({
      dependencies: [{ key: 'c', absolutePath: '/c.js' }],
    })],
    ['/c.js', createModuleData({ code: 'module C' })],
  ]);

  // Simulate: C is in common (shared eager) for main,
  // but accidentally excluded from background's eager set
  const mainEager = new Set(['/entry-main.js', '/shared.js', '/c.js']);
  const bgEager = new Set(['/entry-bg.js', '/shared.js']); // C missing!

  const mainResult = validateBundleCompleteness({
    graph: mainGraph,
    eagerAbsPaths: mainEager,
    segmentAbsPaths: new Set(),
    allGraphAbsPaths: new Set(mainGraph.keys()),
  });

  const bgResult = validateBundleCompleteness({
    graph: bgGraph,
    eagerAbsPaths: bgEager,
    segmentAbsPaths: new Set(),
    allGraphAbsPaths: new Set(bgGraph.keys()),
  });

  expect(mainResult.valid).toBe(true);
  expect(bgResult.valid).toBe(false);
  expect(bgResult.missingAbsPaths).toContain('/c.js');
});
```

**Step 2: Run test**

Run: `npx jest apps/mobile/scripts/__tests__/unionBuildHelpers.test.js --no-coverage -t "detects modules missing from one runtime"`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/mobile/scripts/__tests__/unionBuildHelpers.test.js
git commit -m "test(split-bundle): add cross-runtime module completeness test"
```

---

### Task 3: Integrate validation into unionBuild.js

**Files:**
- Modify: `apps/mobile/scripts/unionBuild.js`

**Step 1: Add validation after bundle assembly**

Find the section after all three bundles are assembled (after `writeBundle` calls) and before the final output. Add:

```javascript
const { validateBundleCompleteness } = require('./unionBuildHelpers');

// Validate: every module in each runtime's graph must be in an eager bundle or segment
for (const [runtimeLabel, { graph, eagerAbsPaths, segmentAbsPaths }] of [
  ['main', {
    graph: mainGraph.dependencies,
    eagerAbsPaths: mainSelectedAbsPaths,      // union of common + main eager
    segmentAbsPaths: mainSegmentAbsPaths,
  }],
  ['background', {
    graph: backgroundGraph.dependencies,
    eagerAbsPaths: bgSelectedAbsPaths,        // union of common + bg eager
    segmentAbsPaths: bgSegmentAbsPaths,
  }],
]) {
  const result = validateBundleCompleteness({
    graph,
    eagerAbsPaths,
    segmentAbsPaths,
    allGraphAbsPaths: new Set(graph.keys()),
  });

  if (!result.valid) {
    const sample = result.missingAbsPaths.slice(0, 10);
    console.error(
      `\n[unionBuild] ERROR: ${result.missingAbsPaths.length} modules in ` +
      `${runtimeLabel} runtime are not in any bundle or segment:\n` +
      sample.map((p) => `  - ${p}`).join('\n') +
      (result.missingAbsPaths.length > 10 ? `\n  ... and ${result.missingAbsPaths.length - 10} more` : '') +
      '\n'
    );
    process.exitCode = 1;
  }
}
```

**Note:** The exact variable names (`mainSelectedAbsPaths`, etc.) depend on the current unionBuild.js code. The implementer should trace the actual variables that hold each runtime's eager + segment sets. Read the `writeBundle` function and its callers to find the correct variable names.

**Step 2: Run unionBuild to verify validation catches issues**

```bash
cd apps/mobile
ENABLE_NATIVE_BACKGROUND_THREAD=true UNION_BUILD=true \
  node --max-old-space-size=8192 scripts/unionBuild.js \
  --platform ios \
  --common-bundle-output ios-bundle/common.jsbundle \
  --common-sourcemap-output ios-bundle/common.jsbundle.map \
  --main-bundle-output ios-bundle/main.jsbundle \
  --main-sourcemap-output ios-bundle/main.jsbundle.map \
  --background-bundle-output ios-bundle/background.bundle.js \
  --background-sourcemap-output ios-bundle/background.bundle.map \
  --assets-dest ios-bundle/assets
```

Expected: If module 12873 is truly missing, the build should now error with:
```
[unionBuild] ERROR: N modules in <runtime> runtime are not in any bundle or segment:
  - /path/to/module12873.js
```

If no errors → the missing module is a runtime-only issue (not a build-time issue), which narrows the investigation.

**Step 3: Commit**

```bash
git add apps/mobile/scripts/unionBuild.js
git commit -m "feat(split-bundle): integrate validation into unionBuild pipeline"
```

---

### Task 4: Add `expandSyncDependencyClosure` cross-runtime test

Tests that when module A (in common) has sync dep on B, and B is assigned to a segment in main but expected as eager in background, the validation catches it.

**Files:**
- Modify: `apps/mobile/scripts/__tests__/unionBuildHelpers.test.js`

**Step 1: Write the test**

```javascript
it('catches sync dependency of eager module that was incorrectly segmented', () => {
  // A is eager, B is A's sync dep, but B got put in a segment
  // This means at runtime, require(B) will fail in eager context
  const graph = new Map([
    ['/a.js', createModuleData({
      code: 'module A',
      dependencies: [{ key: 'b', absolutePath: '/b.js' }], // sync dep
    })],
    ['/b.js', createModuleData({ code: 'module B' })],
  ]);

  const eagerAbsPaths = new Set(['/a.js']); // A is eager
  const segmentAbsPaths = new Set(['/b.js']); // B in segment — wrong! A needs it eagerly

  // expandSyncDependencyClosure should pull B into eager
  const serializedEntries = [
    { absolutePath: '/a.js', moduleData: graph.get('/a.js'), moduleId: 1, moduleCode: '' },
    { absolutePath: '/b.js', moduleData: graph.get('/b.js'), moduleId: 2, moduleCode: '' },
  ];

  const expanded = expandSyncDependencyClosure({
    serializedEntries,
    initialIncludedAbsPaths: eagerAbsPaths,
    externalAbsPaths: new Set(),
  });

  // B should be pulled in because A depends on it synchronously
  expect(expanded.has('/b.js')).toBe(true);
});
```

**Step 2: Run test**

Run: `npx jest apps/mobile/scripts/__tests__/unionBuildHelpers.test.js --no-coverage -t "catches sync dependency"`
Expected: PASS (expandSyncDependencyClosure already handles this)

**Step 3: Commit**

```bash
git add apps/mobile/scripts/__tests__/unionBuildHelpers.test.js
git commit -m "test(split-bundle): add sync-dep-in-segment validation test"
```

---

### Task 5: Debug module 12873 — identify which module it is

**Files:**
- No code changes — diagnostic step

**Step 1: Add a module ID dump to unionBuild**

Temporarily add after module index creation in `unionBuild.js`:

```javascript
// Debug: dump module ID → path mapping
const fs = require('fs');
const idDump = {};
for (const [id, path] of mainModuleIndex.moduleIdToAbsPath) {
  idDump[id] = path;
}
fs.writeFileSync('dist/module-id-map.json', JSON.stringify(idDump, null, 2));
console.log('[unionBuild] Module ID map written to dist/module-id-map.json');
```

**Step 2: Run unionBuild and look up module 12873**

```bash
cd apps/mobile
ENABLE_NATIVE_BACKGROUND_THREAD=true UNION_BUILD=true \
  node --max-old-space-size=8192 scripts/unionBuild.js [args...]

cat dist/module-id-map.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('12873', 'NOT FOUND'))"
```

**Step 3: Check which bundle contains (or doesn't contain) that module**

```bash
MODULE_PATH=$(cat dist/module-id-map.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('12873',''))")
echo "Module 12873 = $MODULE_PATH"
grep -c "$MODULE_PATH" ios-bundle/common.jsbundle
grep -c "$MODULE_PATH" ios-bundle/main.jsbundle  
grep -c "$MODULE_PATH" ios-bundle/background.bundle.js
```

This reveals whether the module is in any bundle, and which runtime needs it but doesn't have it.

**Step 4: Remove the debug dump and commit findings**

---

## Execution Order

1. **Task 1** — Core validation function + tests (pure, testable)
2. **Task 2** — Cross-runtime test (extends coverage)
3. **Task 4** — Sync-dep edge case test (extends coverage)
4. **Task 3** — Integration into unionBuild (uses the function)
5. **Task 5** — Debug specific module 12873 (diagnostic)

After Task 3's unionBuild run, the validation output will tell us exactly which modules are missing and in which runtime, which directly informs the fix for the splitting logic.
