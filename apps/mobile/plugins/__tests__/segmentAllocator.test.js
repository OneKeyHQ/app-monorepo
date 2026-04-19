const path = require('path');

const { reassignDescendantsToSegments } = require('../segmentAllocator');
const { monorepoRoot } = require('../segmentUtils');

// ---------------------------------------------------------------------------
// Test harness: build a fake Metro-style graph and a fileToIdMap lookup.
// We only need the fields the allocator reads: `inverseDependencies`.
// ---------------------------------------------------------------------------

function abs(relPath) {
  return path.join(monorepoRoot, relPath);
}

function buildFixture({ files, inverseEdges }) {
  // files: { [absPath]: moduleId }
  // inverseEdges: { [childAbsPath]: [parentAbsPath, ...] }
  const dependencies = new Map();
  for (const p of Object.keys(files)) {
    dependencies.set(p, {
      inverseDependencies: inverseEdges[p] || [],
    });
  }
  return {
    graph: { dependencies },
    fileToIdMap: {
      get: (p) => files[p],
    },
  };
}

describe('reassignDescendantsToSegments', () => {
  it('puts a single-parent descendant into its parent segment', () => {
    const rootPath = abs('packages/kit/src/views/A/index.tsx');
    const childPath = abs('packages/kit/src/views/A/helpers.ts');
    const { graph, fileToIdMap } = buildFixture({
      files: { [rootPath]: 100, [childPath]: 101 },
      inverseEdges: { [childPath]: [rootPath] },
    });

    const mainModuleIds = new Set();
    const segmentModules = new Map([['seg:kit.views.A.index', new Set([100])]]);
    const moduleToSegment = new Map([[100, 'seg:kit.views.A.index']]);

    const { promotedSharedModules } = reassignDescendantsToSegments({
      graph,
      fileToIdMap,
      mainModuleIds,
      segmentModules,
      moduleToSegment,
    });

    expect(moduleToSegment.get(101)).toBe('seg:kit.views.A.index');
    expect(segmentModules.get('seg:kit.views.A.index').has(101)).toBe(true);
    expect(promotedSharedModules.size).toBe(0);
  });

  it('pulls a descendant into main if any parent is main-reachable', () => {
    const rootPath = abs('packages/kit/src/views/A/index.tsx');
    const eagerParent = abs('apps/mobile/index.ts');
    const childPath = abs('packages/shared/src/utils/x.ts');
    const { graph, fileToIdMap } = buildFixture({
      files: {
        [rootPath]: 100,
        [eagerParent]: 1,
        [childPath]: 200,
      },
      inverseEdges: { [childPath]: [rootPath, eagerParent] },
    });

    const mainModuleIds = new Set([1]);
    const segmentModules = new Map([['seg:kit.views.A.index', new Set([100])]]);
    const moduleToSegment = new Map([[100, 'seg:kit.views.A.index']]);

    reassignDescendantsToSegments({
      graph,
      fileToIdMap,
      mainModuleIds,
      segmentModules,
      moduleToSegment,
    });

    expect(mainModuleIds.has(200)).toBe(true);
    expect(moduleToSegment.has(200)).toBe(false);
  });

  it('promotes to shared segment when two async roots sync-depend on same module', () => {
    // This mirrors the real APK bug: MobileTokenSelector + MarketDetailV2
    // both sync-import TokenSelector/constants.
    const mobileRoot = abs(
      'packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileTokenSelector.tsx',
    );
    const detailRoot = abs(
      'packages/kit/src/views/Market/MarketDetailV2/index.ts',
    );
    const sibling = abs(
      'packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelector.tsx',
    );
    const shared = abs(
      'packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/constants.ts',
    );
    const { graph, fileToIdMap } = buildFixture({
      files: {
        [mobileRoot]: 3480,
        [detailRoot]: 3000,
        [sibling]: 3335,
        [shared]: 3340,
      },
      inverseEdges: {
        [sibling]: [detailRoot],
        [shared]: [mobileRoot, sibling],
      },
    });

    const mobileSeg =
      'seg:kit.views.Market.MarketDetailV2.components.TokenSelector.MobileTokenSelector';
    const detailSeg = 'seg:kit.views.Market.MarketDetailV2.index';

    const mainModuleIds = new Set();
    const segmentModules = new Map([
      [mobileSeg, new Set([3480])],
      [detailSeg, new Set([3000])],
    ]);
    const moduleToSegment = new Map([
      [3480, mobileSeg],
      [3000, detailSeg],
    ]);

    const { promotedSharedModules } = reassignDescendantsToSegments({
      graph,
      fileToIdMap,
      mainModuleIds,
      segmentModules,
      moduleToSegment,
    });

    // `sibling` sees only detailRoot → goes to detailSeg
    expect(moduleToSegment.get(3335)).toBe(detailSeg);

    // `shared` sees mobileRoot (in mobileSeg) AND sibling (in detailSeg) →
    // multi-segment sync share → promoted to its own shared segment
    const sharedAssignment = moduleToSegment.get(3340);
    expect(sharedAssignment).toMatch(/^seg:shared\./);
    expect(sharedAssignment).toContain('TokenSelector.constants');

    // The shared segment actually contains the module
    expect(segmentModules.get(sharedAssignment).has(3340)).toBe(true);

    // And it is NOT inside either of the two original roots
    expect(segmentModules.get(mobileSeg).has(3340)).toBe(false);
    expect(segmentModules.get(detailSeg).has(3340)).toBe(false);

    // The promotion record should list both original segments as consumers
    const record = promotedSharedModules.get(3340);
    expect(record).toBeDefined();
    expect(record.consumers.has(mobileSeg)).toBe(true);
    expect(record.consumers.has(detailSeg)).toBe(true);
  });

  it('classification is deterministic across different graph insertion orders', () => {
    // Same 4 modules, same edges, two different Map insertion orders.
    // The shared segment key must match in both runs.
    const rootA = abs('packages/kit/src/views/A/index.ts');
    const rootB = abs('packages/kit/src/views/B/index.ts');
    const shared = abs('packages/kit/src/shared/util.ts');

    const run = (insertOrder) => {
      const files = { [rootA]: 10, [rootB]: 20, [shared]: 30 };
      const deps = new Map();
      for (const p of insertOrder) {
        deps.set(p, {
          inverseDependencies: p === shared ? [rootA, rootB] : [],
        });
      }
      const segmentModules = new Map([
        ['seg:kit.views.A.index', new Set([10])],
        ['seg:kit.views.B.index', new Set([20])],
      ]);
      const moduleToSegment = new Map([
        [10, 'seg:kit.views.A.index'],
        [20, 'seg:kit.views.B.index'],
      ]);
      reassignDescendantsToSegments({
        graph: { dependencies: deps },
        fileToIdMap: { get: (p) => files[p] },
        mainModuleIds: new Set(),
        segmentModules,
        moduleToSegment,
      });
      return moduleToSegment.get(30);
    };

    const r1 = run([rootA, rootB, shared]);
    const r2 = run([shared, rootB, rootA]);
    const r3 = run([rootB, shared, rootA]);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(r1).toMatch(/^seg:shared\./);
  });

  it('fixpoint: grandchildren are resolved after parents are placed', () => {
    // root → barrel → leaf
    const root = abs('packages/kit/src/views/A/index.ts');
    const barrel = abs('packages/kit/src/views/A/sub/index.ts');
    const leaf = abs('packages/kit/src/views/A/sub/leaf.ts');

    const { graph, fileToIdMap } = buildFixture({
      files: { [root]: 100, [barrel]: 101, [leaf]: 102 },
      inverseEdges: {
        [barrel]: [root],
        [leaf]: [barrel],
      },
    });

    const seg = 'seg:kit.views.A.index';
    const segmentModules = new Map([[seg, new Set([100])]]);
    const moduleToSegment = new Map([[100, seg]]);

    reassignDescendantsToSegments({
      graph,
      fileToIdMap,
      mainModuleIds: new Set(),
      segmentModules,
      moduleToSegment,
    });

    expect(moduleToSegment.get(101)).toBe(seg);
    expect(moduleToSegment.get(102)).toBe(seg);
  });

  it('does not touch modules already in mainModuleIds or moduleToSegment', () => {
    const root = abs('packages/kit/src/views/A/index.ts');
    const alreadyMain = abs('apps/mobile/index.ts');
    const alreadyInSeg = abs('packages/kit/src/views/A/other.ts');

    const { graph, fileToIdMap } = buildFixture({
      files: { [root]: 100, [alreadyMain]: 1, [alreadyInSeg]: 101 },
      inverseEdges: {},
    });

    const mainModuleIds = new Set([1]);
    const segmentModules = new Map([
      ['seg:kit.views.A.index', new Set([100, 101])],
    ]);
    const moduleToSegment = new Map([
      [100, 'seg:kit.views.A.index'],
      [101, 'seg:kit.views.A.index'],
    ]);

    reassignDescendantsToSegments({
      graph,
      fileToIdMap,
      mainModuleIds,
      segmentModules,
      moduleToSegment,
    });

    expect(mainModuleIds.has(1)).toBe(true);
    expect(moduleToSegment.get(100)).toBe('seg:kit.views.A.index');
    expect(moduleToSegment.get(101)).toBe('seg:kit.views.A.index');
  });
});
