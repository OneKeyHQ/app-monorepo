const {
  parseModuleDefs,
  transitiveClosure,
  buildModuleIndex,
  buildModuleIndexFromManifest,
  buildEagerIdSet,
} = require('../check-split-bundle-integrity');

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------
//
// Real build artifacts split module ownership across two files:
//   segment-manifest.json : { segments: { segKey: { dependsOn, relativePath, … } } }
//   module-id-map.json    : { common, main, background, segments: { segKey: { modules: {id:path} } } }
//
// Earlier fixtures in this file embedded `modules` under manifest entries,
// which didn't match reality and caused the integrity check's main index
// lookup to silently return empty. `buildSegFixtures` keeps the two shapes
// separate the same way the real build does, so regressions in either side
// surface immediately.
function buildSegFixtures(segs) {
  const manifestSegments = {};
  const idMapSegments = {};
  for (const [segKey, spec] of Object.entries(segs)) {
    manifestSegments[segKey] = {
      relativePath: spec.relativePath,
      dependsOn: spec.dependsOn || [],
    };
    idMapSegments[segKey] = {
      modules: spec.modules || {},
    };
  }
  return { manifestSegments, idMapSegments };
}

describe('parseModuleDefs', () => {
  it('parses a single Metro __d() call', () => {
    const js = `__d(function (global, require) {
      var x = require(_dependencyMap[0]);
    },3480,[922,6438,3340,7702]);`;
    const defs = parseModuleDefs(js);
    expect(defs).toEqual([{ moduleId: 3480, deps: [922, 6438, 3340, 7702] }]);
  });

  it('handles bodies with nested braces and quoted strings', () => {
    const js = `__d(function () {
      var s = "}}{{"; var t = '{}'; if (true) { return {a: 1}; }
    },7777,[1,2,3]);
    __d(function () { /* another */ },8888,[]);`;
    const defs = parseModuleDefs(js);
    expect(defs).toEqual([
      { moduleId: 7777, deps: [1, 2, 3] },
      { moduleId: 8888, deps: [] },
    ]);
  });

  it('handles escaped quotes inside strings', () => {
    const js = `__d(function () { var s = "a \\"b\\" c"; },100,[5]);`;
    const defs = parseModuleDefs(js);
    expect(defs).toEqual([{ moduleId: 100, deps: [5] }]);
  });

  it('ignores `__d(` inside string literals', () => {
    // No real __d call — should produce empty output.
    const js = `const doc = "call __d( somewhere";`;
    const defs = parseModuleDefs(js);
    expect(defs).toEqual([]);
  });

  it('returns empty array when no __d calls present', () => {
    expect(parseModuleDefs('')).toEqual([]);
    expect(parseModuleDefs('// no modules here')).toEqual([]);
  });
});

describe('transitiveClosure', () => {
  const manifest = {
    segments: {
      'seg:a': { dependsOn: ['seg:b', 'seg:c'] },
      'seg:b': { dependsOn: ['seg:d'] },
      'seg:c': { dependsOn: [] },
      'seg:d': { dependsOn: [] },
      'seg:orphan': { dependsOn: [] },
    },
  };

  it('includes the start segment', () => {
    expect(transitiveClosure(manifest, 'seg:a').has('seg:a')).toBe(true);
  });

  it('follows deep dependsOn chains', () => {
    const closure = transitiveClosure(manifest, 'seg:a');
    expect(closure.has('seg:b')).toBe(true);
    expect(closure.has('seg:c')).toBe(true);
    expect(closure.has('seg:d')).toBe(true);
  });

  it('excludes unrelated segments', () => {
    expect(transitiveClosure(manifest, 'seg:a').has('seg:orphan')).toBe(false);
  });

  it('handles cycles without hanging', () => {
    const cyclic = {
      segments: {
        'seg:x': { dependsOn: ['seg:y'] },
        'seg:y': { dependsOn: ['seg:x'] },
      },
    };
    const closure = transitiveClosure(cyclic, 'seg:x');
    expect(closure.has('seg:x')).toBe(true);
    expect(closure.has('seg:y')).toBe(true);
  });

  it('returns only the start when it has no dependsOn', () => {
    const closure = transitiveClosure(manifest, 'seg:orphan');
    expect([...closure]).toEqual(['seg:orphan']);
  });
});

describe('buildModuleIndex (idMap + manifest)', () => {
  // Regression: real segment-manifest has NO `modules` field — ownership
  // lives in idMap.segments[key].modules. Reading from the manifest silently
  // produced an empty index and made the whole integrity check a no-op.
  it('reads ownership from idMap.segments, filtered by manifest membership', () => {
    const idMap = {
      segments: {
        'seg:a': { modules: { 10: 'a/1.ts', 11: 'a/2.ts' } },
        'seg:b': { modules: { 20: 'b/1.ts' } },
        'seg:other-runtime': { modules: { 30: 'other/1.ts' } },
      },
    };
    // Only seg:a and seg:b belong to this manifest (this runtime).
    const manifest = {
      segments: {
        'seg:a': { dependsOn: [] },
        'seg:b': { dependsOn: [] },
      },
    };
    const idx = buildModuleIndex(idMap, manifest);
    expect(idx.get(10)).toBe('seg:a');
    expect(idx.get(11)).toBe('seg:a');
    expect(idx.get(20)).toBe('seg:b');
    expect(idx.has(30)).toBe(false);
    expect(idx.has(99)).toBe(false);
  });

  it('returns empty index when manifest has no segments', () => {
    const idMap = {
      segments: { 'seg:a': { modules: { 10: 'a.ts' } } },
    };
    expect(buildModuleIndex(idMap, { segments: {} }).size).toBe(0);
  });

  it('returns empty index when idMap has no segment ownership', () => {
    const manifest = { segments: { 'seg:a': { dependsOn: [] } } };
    expect(buildModuleIndex({ segments: {} }, manifest).size).toBe(0);
  });
});

describe('buildModuleIndexFromManifest (legacy shim)', () => {
  // Retained for any external callers; still works on embedded-modules
  // fixtures. New code should use buildModuleIndex(idMap, manifest).
  it('reads modules embedded directly on entries', () => {
    const embedded = {
      segments: {
        'seg:a': { modules: { 10: 'a/1.ts' } },
        'seg:b': { modules: { 20: 'b/1.ts' } },
      },
    };
    const idx = buildModuleIndexFromManifest(embedded);
    expect(idx.get(10)).toBe('seg:a');
    expect(idx.get(20)).toBe('seg:b');
  });

  it('gracefully handles entries without modules', () => {
    expect(
      buildModuleIndexFromManifest({ segments: { 'seg:empty': {} } }).size,
    ).toBe(0);
  });
});

describe('buildEagerIdSet', () => {
  it('unions ids from the given runtime buckets', () => {
    const idMap = {
      common: { 1: 'a', 2: 'b' },
      main: { 3: 'c' },
      background: { 4: 'd' },
      segments: {},
    };
    const mainEager = buildEagerIdSet(idMap, ['common', 'main']);
    expect(mainEager.has(1)).toBe(true);
    expect(mainEager.has(3)).toBe(true);
    expect(mainEager.has(4)).toBe(false);
  });

  it('returns empty set for empty buckets', () => {
    expect(buildEagerIdSet({}, ['common']).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Real-world regression fixtures
// ---------------------------------------------------------------------------
//
// These describe the actual crash shapes users hit, translated into the
// minimal graph needed to reproduce. The integrity check must catch them.
// ---------------------------------------------------------------------------

describe('integration: cross-segment sync edge detection', () => {
  const { scanRuntime } = require('../check-split-bundle-integrity');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-check-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSegJs(segmentsDir, safeName, moduleDefs) {
    if (!fs.existsSync(segmentsDir)) {
      fs.mkdirSync(segmentsDir, { recursive: true });
    }
    const code = moduleDefs
      .map(
        ({ moduleId, deps }) =>
          `__d(function(){},${moduleId},[${deps.join(',')}]);`,
      )
      .join('\n');
    fs.writeFileSync(path.join(segmentsDir, `${safeName}.seg.js`), code);
  }

  it('reproduces the MobileTokenSelector → constants crash shape when dependsOn is missing', () => {
    // MarketDetailV2.index defines 3340 (constants)
    // MobileTokenSelector defines 3480 (MobileTokenSelector.tsx) which sync-deps 3340
    // If MobileTokenSelector.dependsOn does NOT include MarketDetailV2.index → latent crash
    const segmentsDir = path.join(tmpDir, 'segments');
    writeSegJs(segmentsDir, 'mobile-tokenselector', [
      { moduleId: 3480, deps: [3340] },
    ]);
    writeSegJs(segmentsDir, 'marketdetail-index', [
      { moduleId: 3340, deps: [] },
    ]);

    const { manifestSegments, idMapSegments } = buildSegFixtures({
      'seg:mtsel': {
        relativePath: 'segments/mobile-tokenselector.seg.hbc',
        modules: { 3480: 'MobileTokenSelector.tsx' },
        dependsOn: [], // <-- the bug: missing seg:mdv2-index
      },
      'seg:mdv2-index': {
        relativePath: 'segments/marketdetail-index.seg.hbc',
        modules: { 3340: 'constants.ts' },
        dependsOn: [],
      },
    });
    const manifest = { segments: manifestSegments };
    const idMap = {
      common: {},
      main: {},
      background: {},
      segments: idMapSegments,
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
      kind: 'cross_segment_sync',
      srcSegment: 'seg:mtsel',
      srcModuleId: 3480,
      depSegment: 'seg:mdv2-index',
      depModuleId: 3340,
    });
  });

  it('passes when dependsOn covers the cross-segment sync edge', () => {
    const segmentsDir = path.join(tmpDir, 'segments');
    writeSegJs(segmentsDir, 'mobile-tokenselector', [
      { moduleId: 3480, deps: [3340] },
    ]);
    writeSegJs(segmentsDir, 'marketdetail-index', [
      { moduleId: 3340, deps: [] },
    ]);

    const { manifestSegments, idMapSegments } = buildSegFixtures({
      'seg:mtsel': {
        relativePath: 'segments/mobile-tokenselector.seg.hbc',
        modules: { 3480: 'MobileTokenSelector.tsx' },
        dependsOn: ['seg:mdv2-index'], // covered now
      },
      'seg:mdv2-index': {
        relativePath: 'segments/marketdetail-index.seg.hbc',
        modules: { 3340: 'constants.ts' },
        dependsOn: [],
      },
    });
    const manifest = { segments: manifestSegments };
    const idMap = {
      common: {},
      main: {},
      background: {},
      segments: idMapSegments,
    };

    const { violations } = scanRuntime({
      runtimeLabel: 'main',
      segmentsDir,
      manifest,
      idMap,
      runtimeBucketNames: ['common', 'main'],
    });

    expect(violations).toHaveLength(0);
  });

  it('passes when dependsOn covers transitively (A depends B depends C; A sync-uses module in C)', () => {
    const segmentsDir = path.join(tmpDir, 'segments');
    writeSegJs(segmentsDir, 'a', [{ moduleId: 100, deps: [300] }]);
    writeSegJs(segmentsDir, 'b', [{ moduleId: 200, deps: [] }]);
    writeSegJs(segmentsDir, 'c', [{ moduleId: 300, deps: [] }]);

    const { manifestSegments, idMapSegments } = buildSegFixtures({
      'seg:a': {
        relativePath: 'segments/a.seg.hbc',
        modules: { 100: 'a.ts' },
        dependsOn: ['seg:b'],
      },
      'seg:b': {
        relativePath: 'segments/b.seg.hbc',
        modules: { 200: 'b.ts' },
        dependsOn: ['seg:c'],
      },
      'seg:c': {
        relativePath: 'segments/c.seg.hbc',
        modules: { 300: 'c.ts' },
        dependsOn: [],
      },
    });
    const manifest = { segments: manifestSegments };
    const idMap = {
      common: {},
      main: {},
      background: {},
      segments: idMapSegments,
    };

    const { violations } = scanRuntime({
      runtimeLabel: 'main',
      segmentsDir,
      manifest,
      idMap,
      runtimeBucketNames: ['common', 'main'],
    });

    expect(violations).toHaveLength(0);
  });

  it('ignores deps satisfied by the eager bundle', () => {
    const segmentsDir = path.join(tmpDir, 'segments');
    writeSegJs(segmentsDir, 'a', [{ moduleId: 100, deps: [42] }]);

    const { manifestSegments, idMapSegments } = buildSegFixtures({
      'seg:a': {
        relativePath: 'segments/a.seg.hbc',
        modules: { 100: 'a.ts' },
        dependsOn: [],
      },
    });
    const manifest = { segments: manifestSegments };
    const idMap = {
      common: { 42: 'eager.ts' }, // 42 is eager → OK
      main: {},
      background: {},
      segments: idMapSegments,
    };

    const { violations } = scanRuntime({
      runtimeLabel: 'main',
      segmentsDir,
      manifest,
      idMap,
      runtimeBucketNames: ['common', 'main'],
    });

    expect(violations).toHaveLength(0);
  });

  it('flags missing_manifest_entry when a .seg.js has no matching manifest', () => {
    const segmentsDir = path.join(tmpDir, 'segments');
    writeSegJs(segmentsDir, 'orphan', [{ moduleId: 999, deps: [] }]);

    const manifest = { segments: {} }; // orphan not in manifest
    const idMap = {
      common: {},
      main: {},
      background: {},
      segments: {},
    };

    const { violations } = scanRuntime({
      runtimeLabel: 'main',
      segmentsDir,
      manifest,
      idMap,
      runtimeBucketNames: ['common', 'main'],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe('missing_manifest_entry');
  });

  // Regression: previously this whole file silently passed because
  // buildModuleIndexFromManifest(manifest) returned an empty Map when the
  // manifest didn't embed `modules`. Ensures the crash fixture is flagged
  // when using the real separation (manifest only carries dependsOn).
  it('flags the MobileTokenSelector crash even when manifest has no `modules` field', () => {
    const segmentsDir = path.join(tmpDir, 'segments');
    writeSegJs(segmentsDir, 'mobile-tokenselector', [
      { moduleId: 3480, deps: [3340] },
    ]);
    writeSegJs(segmentsDir, 'marketdetail-index', [
      { moduleId: 3340, deps: [] },
    ]);

    // Manifest shape matching what segmentSerializer actually writes:
    // only id/key/runtime/relativePath/sha256/dependsOn/size — no modules.
    const manifest = {
      segments: {
        'seg:mtsel': {
          id: 1001,
          key: 'seg:mtsel',
          runtime: 'main',
          relativePath: 'segments/mobile-tokenselector.seg.hbc',
          sha256: 'x',
          dependsOn: [],
          size: 100,
        },
        'seg:mdv2-index': {
          id: 1002,
          key: 'seg:mdv2-index',
          runtime: 'main',
          relativePath: 'segments/marketdetail-index.seg.hbc',
          sha256: 'y',
          dependsOn: [],
          size: 100,
        },
      },
    };
    // Ownership lives only in idMap.segments[key].modules.
    const idMap = {
      common: {},
      main: {},
      background: {},
      segments: {
        'seg:mtsel': {
          id: 1001,
          runtime: 'main',
          modules: { 3480: 'MobileTokenSelector.tsx' },
        },
        'seg:mdv2-index': {
          id: 1002,
          runtime: 'main',
          modules: { 3340: 'constants.ts' },
        },
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
      kind: 'cross_segment_sync',
      srcSegment: 'seg:mtsel',
      depSegment: 'seg:mdv2-index',
      srcModuleId: 3480,
      depModuleId: 3340,
    });
  });

  it('flags a dep that is orphan — not in eager and not in any segment', () => {
    const segmentsDir = path.join(tmpDir, 'segments');
    // Segment A defines module 4001 whose sync dep is 4999.
    // 4999 is NOT in idMap.common/main and NOT in any segment →
    // runtime crash waiting to happen.
    writeSegJs(segmentsDir, 'seg-a', [{ moduleId: 4001, deps: [4999] }]);

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
    writeSegJs(segmentsBgDir, 'shared-seg', [{ moduleId: 5000, deps: [5100] }]);

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
        'seg:sh': {
          ...sharedEntry,
          relativePath: 'segments/shared-seg.seg.hbc',
        },
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
      background: {}, // NOT in background eager
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
    expect(bgRun.violations[0]).not.toHaveProperty('depSegment');
  });

  // Regression guard for the shared-segment @ledgerhq orphan incident:
  // when the same seg:nm.@foo is forced shared but carries DIFFERENT
  // module sets per runtime (main reaches 23 modules, bg reaches 300+),
  // the emitted .seg.js file must ship __d(...) for every module either
  // runtime needs. scanRuntime must then scope its walk to this-runtime's
  // ownership — otherwise main's scan traverses bg-only __d(...) whose
  // sync deps live only in bg's segment graph and falsely reports them.
  it("scopes shared-segment scan to this runtime's ownership (mainOwned / bgOwned)", () => {
    const segmentsMainDir = path.join(tmpDir, 'segments');
    const segmentsBgDir = path.join(tmpDir, 'segments-background');
    // Shared segment carries two main-owned modules (100, 101) and one
    // bg-only module (200). Module 200's sync dep 999 lives only in a
    // bg-runtime segment — main must NOT follow that edge.
    writeSegJs(segmentsMainDir, 'nm._shared', [
      { moduleId: 100, deps: [101] },
      { moduleId: 101, deps: [] },
      { moduleId: 200, deps: [999] },
    ]);
    writeSegJs(segmentsBgDir, 'bg-only', [{ moduleId: 999, deps: [] }]);

    // Shared segments only ever live on disk under SEGMENTS_MAIN. manifestBg
    // references that same path so the bg-scoped pass reads the real file.
    const sharedRelativePath = 'segments/nm._shared.seg.hbc';
    const manifestMain = {
      segments: {
        'seg:nm.@shared': {
          relativePath: sharedRelativePath,
          dependsOn: [],
        },
      },
    };
    const manifestBg = {
      segments: {
        'seg:nm.@shared': {
          relativePath: sharedRelativePath,
          dependsOn: ['seg:bg-only'],
        },
        'seg:bg-only': {
          relativePath: 'segments-background/bg-only.seg.hbc',
          dependsOn: [],
        },
      },
    };
    const idMap = {
      common: {},
      main: {},
      background: {},
      segments: {
        'seg:nm.@shared': {
          runtime: 'shared',
          modules: {
            100: 'main/a.ts',
            101: 'main/b.ts',
            200: 'bg/dmk.ts',
          },
          mainOwned: { 100: 'main/a.ts', 101: 'main/b.ts' },
          bgOwned: { 200: 'bg/dmk.ts' },
        },
        'seg:bg-only': {
          runtime: 'background',
          modules: { 999: 'bg/rxjs.js' },
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
    const bgOwnRun = scanRuntime({
      runtimeLabel: 'background',
      segmentsDir: segmentsBgDir,
      manifest: manifestBg,
      idMap,
      runtimeBucketNames: ['common', 'background'],
    });
    // Third pass: bg-scoped scan over SEGMENTS_MAIN, restricted to shared
    // segments. Mirrors main()'s production wiring so bg-owned modules
    // inside shared segments actually get their sync deps verified.
    const bgSharedRun = scanRuntime({
      runtimeLabel: 'background',
      segmentsDir: segmentsMainDir,
      manifest: manifestBg,
      idMap,
      runtimeBucketNames: ['common', 'background'],
      segmentKeyFilter: (_segKey, idMapEntry) =>
        idMapEntry?.runtime === 'shared',
    });

    // Main must not traverse module 200 (bg-owned), so its sync dep 999
    // is never checked — 0 violations. (Without the ownership scope the
    // old behavior reported 999 as orphan_dep from main's view.)
    expect(mainRun.violations).toHaveLength(0);
    // Bg's own (non-shared) segments pass have nothing to flag here.
    expect(bgOwnRun.violations).toHaveLength(0);
    // Crucially: the bg-shared pass actually read nm._shared.seg.js and
    // verified bg-owned module 200's sync dep 999 resolves via
    // seg:bg-only (covered by manifestBg's dependsOn). The pass actually
    // scanned the shared segment — not a vacuous zero.
    expect(bgSharedRun.scannedSegments).toBe(1);
    expect(bgSharedRun.violations).toHaveLength(0);
  });

  // Negative counterpart to the ownership-scoping test: when a bg-owned
  // module inside a shared segment sync-requires a module that lives in
  // another bg segment NOT listed in dependsOn, the bg-shared pass must
  // flag it as cross_segment_sync. Guards against dependsOn losing bg's
  // cross-segment edges after mergeSharedSegmentOutputs unions bg-only
  // modules into a force-shared segment.
  it('bg-shared pass flags cross_segment_sync when dependsOn misses a bg-only prerequisite', () => {
    const segmentsMainDir = path.join(tmpDir, 'segments');
    const segmentsBgDir = path.join(tmpDir, 'segments-background');
    writeSegJs(segmentsMainDir, 'nm._shared', [{ moduleId: 200, deps: [999] }]);
    writeSegJs(segmentsBgDir, 'bg-only', [{ moduleId: 999, deps: [] }]);

    const sharedRelativePath = 'segments/nm._shared.seg.hbc';
    const manifestBg = {
      segments: {
        'seg:nm.@shared': {
          relativePath: sharedRelativePath,
          // Intentionally missing 'seg:bg-only' — reproduces the bug.
          dependsOn: [],
        },
        'seg:bg-only': {
          relativePath: 'segments-background/bg-only.seg.hbc',
          dependsOn: [],
        },
      },
    };
    const idMap = {
      common: {},
      main: {},
      background: {},
      segments: {
        'seg:nm.@shared': {
          runtime: 'shared',
          modules: { 200: 'bg/dmk.ts' },
          mainOwned: {},
          bgOwned: { 200: 'bg/dmk.ts' },
        },
        'seg:bg-only': {
          runtime: 'background',
          modules: { 999: 'bg/rxjs.js' },
        },
      },
    };

    const bgSharedRun = scanRuntime({
      runtimeLabel: 'background',
      segmentsDir: segmentsMainDir,
      manifest: manifestBg,
      idMap,
      runtimeBucketNames: ['common', 'background'],
      segmentKeyFilter: (_segKey, idMapEntry) =>
        idMapEntry?.runtime === 'shared',
    });

    expect(bgSharedRun.violations).toHaveLength(1);
    expect(bgSharedRun.violations[0]).toMatchObject({
      kind: 'cross_segment_sync',
      runtime: 'background',
      srcSegment: 'seg:nm.@shared',
      srcModuleId: 200,
      depSegment: 'seg:bg-only',
      depModuleId: 999,
    });
  });
});
