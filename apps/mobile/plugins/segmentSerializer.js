/* eslint-disable onekey/no-raw-error, no-continue, no-plusplus */
/* cspell:ignore rescan symbolication */
/**
 * Segment serializer (Phase 2)
 *
 * Extends the existing dynamicImports plugin to support:
 * 1. Named segments (seg:feature.xxx) instead of hash-based chunks
 * 2. Stable segmentId allocation (sorted by segmentKey)
 * 3. Segment manifest output (JSON embedded in eager entry)
 * 4. Production-ready segment JS files (not dev URL based)
 *
 * This serializer is used when SPLIT_BUNDLE_SEGMENTS=true.
 * It replaces the old hash-chunk system with named, typed segments.
 */

const crypto = require('crypto');
const path = require('path');

const fs = require('fs-extra');

const {
  allocationRules,
  forbiddenInStartup,
  promotedSegments,
} = require('../bundle-groups.config');

const { fileToIdMap } = require('./map');
const { reassignDescendantsToSegments } = require('./segmentAllocator');
const {
  getSegmentsDir,
  getManifestPath,
  getModuleIdMapPath,
} = require('./segmentPaths');
const {
  rewriteAsyncPathsInModules,
} = require('./segmentSerializer.rewriteAsyncPaths');
const {
  deriveSegmentKey,
  allocateSegmentIds,
  monorepoRoot,
} = require('./segmentUtils');

const baseJSBundle = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/DeltaBundler/Serializers/baseJSBundle',
  ),
).default;
const bundleToString = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/lib/bundleToString',
  ),
).default;
const { sourceMapStringNonBlocking } = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/DeltaBundler/Serializers/sourceMapString',
  ),
);

// ---------------------------------------------------------------------------
// SHA-256 for segment integrity
// ---------------------------------------------------------------------------

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ---------------------------------------------------------------------------
// Segment source map generator (#32)
// ---------------------------------------------------------------------------

async function generateSegmentSourceMap(
  segModules,
  graph,
  _fileToIdMap,
  moduleIdToAbsPath,
) {
  const sorted = segModules.slice().toSorted((a, b) => a[0] - b[0]);
  const segmentGraphModules = [];

  for (const [moduleId] of sorted) {
    const absPath = moduleIdToAbsPath.get(moduleId);
    if (!absPath) {
      continue;
    }
    const modData = graph.dependencies.get(absPath);
    if (modData) {
      segmentGraphModules.push(modData);
    }
  }

  return sourceMapStringNonBlocking(segmentGraphModules, {
    excludeSource: false,
    processModuleFilter: () => true,
    shouldAddToIgnoreList: () => false,
    getSourceUrl: (module) => module.path,
  });
}

// ---------------------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------------------

// Per-target segment output dir (#51). Resolved at serializer call time
// based on METRO_RUNTIME_TARGET to isolate main/background outputs.
const runtimeTarget = process.env.METRO_RUNTIME_TARGET || 'main';
const outputSegmentDir = getSegmentsDir(runtimeTarget);

module.exports = async function segmentSerializer(
  entryPoint,
  prepend,
  graph,
  bundleOptions,
  options = {},
) {
  const { entryReachability } = options;
  const asyncFlag = 'async';

  // Step 1: Categorize modules into main vs async chunks.
  // This runs in a loop because barrel files (index.ts re-exports) create
  // multi-level indirection: async root → index.ts → RealModule.ts.
  // A single pass can't resolve grandchildren because the intermediate
  // barrel hasn't been classified yet when the grandchild is visited.
  const mainModuleIds = new Set();
  const asyncRoots = new Map(); // moduleId → absolutePath
  // Track sync children/grandchildren of async roots so findAsyncParent
  // can resolve multi-level barrel re-exports transitively.
  const asyncDescendants = new Map(); // moduleId → rootModuleId

  const findAsyncParent = (fatherId) => {
    if (asyncRoots.has(fatherId)) return fatherId;
    if (asyncDescendants.has(fatherId)) return asyncDescendants.get(fatherId);
    return null;
  };

  let step1Changed = true;
  while (step1Changed) {
    step1Changed = false;
    for (const [key, value] of graph.dependencies) {
      const moduleId = fileToIdMap.get(key);
      if (
        mainModuleIds.has(moduleId) ||
        asyncRoots.has(moduleId) ||
        asyncDescendants.has(moduleId)
      ) {
        continue;
      }

      const asyncTypes = [...value.inverseDependencies].map((absolutePath) => {
        const parentId = fileToIdMap.get(absolutePath);
        const parentModule = graph.dependencies.get(absolutePath);
        if (!parentModule) return undefined;
        for (const [, dep] of parentModule.dependencies) {
          if (dep.absolutePath === key) {
            const existingChunk = findAsyncParent(parentId);
            if (existingChunk && dep.data.data.asyncType === null) {
              return existingChunk;
            }
            return dep.data.data.asyncType;
          }
        }
        return undefined;
      });

      // Check if any parent that returned null is actually unclassified
      // (not yet in asyncRoots, asyncDescendants, or mainModuleIds).
      // If so, the null might turn into a rootId in a later iteration — defer.
      let hasUnclassifiedParentReturningNull = false;
      const parentPaths = [...value.inverseDependencies];
      for (let i = 0; i < parentPaths.length; i++) {
        const parentPath = parentPaths[i];
        const parentId = fileToIdMap.get(parentPath);
        if (
          asyncTypes[i] === null &&
          !asyncRoots.has(parentId) &&
          !asyncDescendants.has(parentId) &&
          !mainModuleIds.has(parentId)
        ) {
          hasUnclassifiedParentReturningNull = true;
          break;
        }
      }

      const hasUnresolved =
        asyncTypes.some((v) => v === undefined) ||
        hasUnclassifiedParentReturningNull;

      if (asyncTypes.length === 0) {
        mainModuleIds.add(moduleId);
        step1Changed = true;
      } else if (
        asyncTypes.some((v) => v === null) &&
        !hasUnclassifiedParentReturningNull
      ) {
        // At least one parent is genuinely eager (classified as eager) → eager.
        mainModuleIds.add(moduleId);
        step1Changed = true;
      } else if (asyncTypes.every((v) => v === asyncFlag)) {
        asyncRoots.set(moduleId, key);
        step1Changed = true;
      } else if (
        !hasUnresolved &&
        asyncTypes.length >= 1 &&
        asyncTypes.every((v) => v === asyncFlag || asyncRoots.has(v))
      ) {
        // All parents are async roots (or use import()) — this is a sync
        // child/grandchild of an async root. Track it as a descendant.
        const rootId = asyncTypes.find((v) => asyncRoots.has(v));
        asyncDescendants.set(moduleId, rootId);
        step1Changed = true;
      } else if (hasUnresolved) {
        // Skip — retry next iteration when parents may be resolved.
      } else {
        mainModuleIds.add(moduleId);
        step1Changed = true;
      }
    }
  }

  // Step 1b: Detect modules with mixed sync+async import edges.
  // When the same parent has both `import x from 'mod'` (sync) and
  // `await import('mod')` (async), the module is pulled into the eager
  // bundle by the sync edge, making the async import a runtime no-op.
  // However Metro still emits a __loadBundleAsync call for the async edge,
  // which will fail at runtime because the module has no segment manifest
  // entry. The production bundle loader handles this gracefully (resolves
  // silently when not in manifest), but these should ideally be cleaned up
  // so that each module is imported exclusively via sync OR async — not both.
  const mixedImportWarnings = [];
  for (const [key, value] of graph.dependencies) {
    for (const parentPath of value.inverseDependencies) {
      const parentModule = graph.dependencies.get(parentPath);
      if (!parentModule) continue;
      let hasSyncEdge = false;
      let hasAsyncEdge = false;
      for (const [, dep] of parentModule.dependencies) {
        if (dep.absolutePath === key) {
          if (dep.data.data.asyncType === 'async') {
            hasAsyncEdge = true;
          } else {
            hasSyncEdge = true;
          }
        }
      }
      if (hasSyncEdge && hasAsyncEdge) {
        const relChild = key.replace(monorepoRoot, '').replace(/^\//, '');
        const relParent = parentPath
          .replace(monorepoRoot, '')
          .replace(/^\//, '');
        mixedImportWarnings.push({ parent: relParent, child: relChild });
      }
    }
  }
  if (mixedImportWarnings.length > 0) {
    console.warn(
      `[segmentSerializer] WARNING: ${mixedImportWarnings.length} module(s) have both sync and async import() from the same parent.
  The sync edge pulls them into the eager bundle, making the async import() a no-op at build time.
  At runtime, __loadBundleAsync will silently skip these (not in manifest).
  Consider using only sync OR async import for each module to avoid confusion:
${mixedImportWarnings.map((w) => `    ${w.parent} → ${w.child}`).join('\n')}`,
    );
  }

  // Step 2: Build module allocation map
  const segmentModules = new Map(); // segmentKey → Set<moduleId>
  const moduleToSegment = new Map(); // moduleId → segmentKey

  for (const [moduleId, absolutePath] of asyncRoots) {
    const segmentKey = deriveSegmentKey(absolutePath);
    if (!segmentModules.has(segmentKey)) {
      segmentModules.set(segmentKey, new Set());
    }
    segmentModules.get(segmentKey).add(moduleId);
    moduleToSegment.set(moduleId, segmentKey);
  }

  // Re-scan descendants. Barrel files (index.ts re-exports) create multi-level
  // indirection so this runs to a fixpoint. See `segmentAllocator.js` for the
  // full rules — including multi-root sync-share promotion that prevents
  // cross-segment sync-require crashes at runtime.
  const { promotedSharedModules } = reassignDescendantsToSegments({
    graph,
    fileToIdMap,
    mainModuleIds,
    segmentModules,
    moduleToSegment,
  });

  if (promotedSharedModules.size > 0) {
    console.log(
      `info Promoted ${promotedSharedModules.size} module(s) to shared segments (multi-root sync-share):`,
    );
    const bySharedSeg = new Map();
    for (const { sharedSeg, consumers } of promotedSharedModules.values()) {
      if (!bySharedSeg.has(sharedSeg)) bySharedSeg.set(sharedSeg, consumers);
    }
    for (const [sharedSeg, consumers] of bySharedSeg) {
      console.log(`    ${sharedSeg} (consumers: ${[...consumers].join(', ')})`);
    }
  }

  // Step 3: Allocate stable segment IDs
  const segmentIdMap = allocateSegmentIds([...segmentModules.keys()]);

  // Step 4: Build bundle using Metro's baseJSBundle
  const { pre, post, modules } = baseJSBundle(
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  );

  // Step 5: Split modules into main entry and segment files
  const mainModules = [];
  const segmentOutputs = new Map(); // segmentKey → [moduleId, code][]

  // Promoted segments (Phase 4): merge their modules into main instead of segments
  const promotedSet = new Set(promotedSegments);

  for (const [moduleId, moduleCode] of modules) {
    const seg = moduleToSegment.get(moduleId);
    if (seg && !promotedSet.has(seg)) {
      if (!segmentOutputs.has(seg)) {
        segmentOutputs.set(seg, []);
      }
      segmentOutputs.get(seg).push([moduleId, moduleCode]);
    } else {
      mainModules.push([moduleId, moduleCode]);
    }
  }

  if (promotedSet.size > 0) {
    const promoted = [...promotedSet].filter((k) => segmentModules.has(k));
    if (promoted.length > 0) {
      console.log(
        `info Promoted ${promoted.length} segment(s) into eager entry: ${promoted.join(', ')}`,
      );
    }
  }

  // Step 6: Compute inter-segment dependencies
  // Build moduleId → absolutePath reverse index first to avoid O(n²) graph scan (#27)
  const moduleIdToAbsPath = new Map();
  for (const [absPath] of graph.dependencies) {
    const id = fileToIdMap.get(absPath);
    if (id !== undefined) {
      moduleIdToAbsPath.set(id, absPath);
    }
  }

  // Segment A dependsOn segment B if any module in A imports a module in B
  const segmentDeps = new Map(); // segmentKey → Set<segmentKey>
  for (const [segmentKey, modIds] of segmentModules) {
    const deps = new Set();
    for (const modId of modIds) {
      const absPath = moduleIdToAbsPath.get(modId);
      if (!absPath) continue;
      const modData = graph.dependencies.get(absPath);
      if (!modData) continue;
      for (const [, dep] of modData.dependencies) {
        const depId = fileToIdMap.get(dep.absolutePath);
        const depSeg = moduleToSegment.get(depId);
        if (depSeg && depSeg !== segmentKey) {
          deps.add(depSeg);
        }
      }
    }
    segmentDeps.set(segmentKey, deps);
  }

  // Step 6b: Detect cycles in segment dependency DAG (#28)
  // Topological sort — if we can't visit all segments, a cycle exists.
  {
    const visited = new Set();
    const inStack = new Set();
    const cyclePath = [];
    let hasCycle = false;

    const dfs = (node) => {
      if (hasCycle) return;
      if (inStack.has(node)) {
        hasCycle = true;
        cyclePath.push(node);
        return;
      }
      if (visited.has(node)) return;
      inStack.add(node);
      const neighbors = segmentDeps.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor);
          if (hasCycle) {
            cyclePath.push(node);
            return;
          }
        }
      }
      inStack.delete(node);
      visited.add(node);
    };

    for (const segKey of segmentDeps.keys()) {
      dfs(segKey);
      if (hasCycle) break;
    }

    if (hasCycle) {
      const cycle = cyclePath.toReversed().join(' → ');
      throw new Error(
        `[segmentSerializer] Circular segment dependency detected: ${cycle}\n` +
          'Segment dependsOn graph must be a DAG. Fix the import structure to break the cycle.',
      );
    }
  }

  // Step 6c: Derive runtime and allocation layer from bundle-groups.config (Phase 4)
  // Maps allocation layers to segment runtime:
  //   *.main → 'main', *.background → 'background', *.shared / kernel.shared → 'shared'
  // P1-1 fix: use startsWith only — includes('/' + p) causes substring false matches
  function getAllocationLayer(relPath) {
    for (const rule of allocationRules) {
      if (rule.paths.some((p) => relPath.startsWith(p))) {
        return rule.layer;
      }
    }
    return 'feature.shared';
  }

  function layerToRuntime(layer) {
    if (layer.endsWith('.main')) return 'main';
    if (layer.endsWith('.background')) return 'background';
    return 'shared'; // kernel.shared, feature.shared
  }

  // P1-2 fix: conservative runtime — use the most permissive (widest) runtime.
  // If ANY module is 'shared', the segment is 'shared'.
  // Only mark 'main' if ALL modules are main-only, same for 'background'.
  function deriveRuntime(segmentKey) {
    const modIds = segmentModules.get(segmentKey);
    if (!modIds) return 'shared';

    // Union build path: use actual graph reachability instead of config-driven heuristic
    if (entryReachability) {
      const { mainReachable, bgReachable } = entryReachability;
      let fromMain = false;
      let fromBg = false;
      for (const modId of modIds) {
        const absPath = moduleIdToAbsPath.get(modId);
        if (!absPath) continue;
        if (mainReachable.has(absPath)) fromMain = true;
        if (bgReachable.has(absPath)) fromBg = true;
      }
      if (fromMain && fromBg) return 'shared';
      if (fromMain) return 'main';
      if (fromBg) return 'background';
      return 'shared';
    }

    // Fallback: config-driven allocation
    let hasMain = false;
    let hasBackground = false;
    let hasShared = false;
    for (const modId of modIds) {
      const absPath = moduleIdToAbsPath.get(modId);
      if (!absPath) continue;
      const relPath = absPath.replace(monorepoRoot, '').replace(/^\//, '');
      const runtime = layerToRuntime(getAllocationLayer(relPath));
      if (runtime === 'shared') hasShared = true;
      else if (runtime === 'main') hasMain = true;
      else if (runtime === 'background') hasBackground = true;
    }
    // Mixed or any shared → shared (most permissive)
    if (hasShared || (hasMain && hasBackground)) return 'shared';
    if (hasMain) return 'main';
    if (hasBackground) return 'background';
    return 'shared';
  }

  // Step 6d: Validate forbidden modules in startup graph (Phase 4)
  // P1-3: STRICT_ALLOCATION=true throws instead of warning
  // Skip for background entry — BackgroundApi naturally requires services/vaults
  // at startup via require() getters; Metro statically collects these but they
  // are runtime-deferred. Only the main entry must exclude them.
  const strictAllocation = process.env.STRICT_ALLOCATION === 'true';
  const startupViolations = [];
  if (runtimeTarget !== 'background') {
    for (const moduleId of mainModuleIds) {
      const absPath = moduleIdToAbsPath.get(moduleId);
      if (!absPath) continue;
      const relPath = absPath.replace(monorepoRoot, '').replace(/^\//, '');
      if (forbiddenInStartup.some((fp) => relPath.startsWith(fp))) {
        startupViolations.push(relPath);
      }
    }
    if (startupViolations.length > 0) {
      const msg = `[segmentSerializer] ${startupViolations.length} forbidden module(s) in startup graph:\n${startupViolations.map((v) => `  - ${v}`).join('\n')}`;
      if (strictAllocation) {
        throw new Error(msg);
      }
      console.warn(`WARNING: ${msg}`);
    }
  }

  // Step 6e: Rewrite asyncRequire paths in main bundle modules (#49, REACT-NATIVE-4AX)
  //
  // Per-segment rewrite happens inline in Step 7 below (immediately before
  // bundleToString) so the ordering is enforced locally — without that,
  // a refactor that re-orders Step 7 would silently re-introduce the
  // iOS 6.3.0-10069276 regression. See REACT-NATIVE-4AX.
  if (!bundleOptions.dev) {
    rewriteAsyncPathsInModules(mainModules, moduleToSegment);
  }

  // Step 7: Write segment files and build manifest
  const manifest = { segments: {} };

  if (segmentOutputs.size > 0) {
    // Clean and recreate to remove stale segments from prior builds (#54)
    await fs.remove(outputSegmentDir);
    await fs.ensureDir(outputSegmentDir);
  }

  for (const [segmentKey, segModules] of segmentOutputs) {
    const segmentId = segmentIdMap.get(segmentKey);
    if (!bundleOptions.dev) {
      rewriteAsyncPathsInModules(segModules, moduleToSegment);
    }
    const { code } = bundleToString({
      pre: '',
      post: '',
      modules: segModules,
    });

    const segHash = sha256(Buffer.from(code));
    const safeName = segmentKey
      .replace(/^seg:/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativeDir =
      runtimeTarget === 'background' ? 'segments-background' : 'segments';
    const relativePath = `${relativeDir}/${safeName}.seg.hbc`;
    const outputPath = path.resolve(outputSegmentDir, `${safeName}.seg.js`);

    await fs.writeFile(outputPath, code);

    // Write packager source map for Sentry symbolication (#32)
    const packagerMapPath = path.resolve(
      outputSegmentDir,
      `${safeName}.seg.packager.map`,
    );
    const sourceMap = await generateSegmentSourceMap(
      segModules,
      graph,
      fileToIdMap,
      moduleIdToAbsPath,
    );
    await fs.writeFile(packagerMapPath, sourceMap);

    console.log(
      `info Writing segment: ${segmentKey} (id=${segmentId}, modules=${segModules.length}) → ${outputPath}`,
    );

    const deps = segmentDeps.get(segmentKey);
    manifest.segments[segmentKey] = {
      id: segmentId,
      key: segmentKey,
      runtime: deriveRuntime(segmentKey),
      relativePath,
      sha256: segHash,
      dependsOn: deps ? [...deps].toSorted() : [],
      size: Buffer.byteLength(code),
    };
  }

  // Step 8: Inject manifest into main bundle as __SEGMENT_MANIFEST__
  const manifestCode = `globalThis.__SEGMENT_MANIFEST__=${JSON.stringify(manifest)};`;
  // Prepend manifest before the first module
  const preWithManifest = `${pre}\n${manifestCode}\n`;

  // Step 9: Write manifest to disk for build-bundle.js consumption
  const manifestPath = getManifestPath(runtimeTarget);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`info Writing segment manifest → ${manifestPath}`);

  // Step 9b: Write allocation report (Phase 4)
  const allocationReport = {
    runtimeTarget,
    startup: {
      moduleCount: mainModuleIds.size,
      estimatedSizeBytes: 0,
      modules: [],
    },
    segments: {},
    violations: startupViolations,
  };
  // Estimate startup size
  for (const moduleId of mainModuleIds) {
    const absPath = moduleIdToAbsPath.get(moduleId);
    if (absPath) {
      allocationReport.startup.modules.push(
        absPath.replace(monorepoRoot, '').replace(/^\//, ''),
      );
      const modData = graph.dependencies.get(absPath);
      if (modData && modData.output) {
        for (const o of modData.output) {
          if (o.data && o.data.code)
            allocationReport.startup.estimatedSizeBytes += o.data.code.length;
        }
      }
    }
  }
  for (const [segmentKey, entry] of Object.entries(manifest.segments)) {
    const modIds = segmentModules.get(segmentKey);
    allocationReport.segments[segmentKey] = {
      runtime: entry.runtime,
      moduleCount: modIds ? modIds.size : 0,
      size: entry.size,
    };
  }
  const reportPath = path.resolve(
    outputSegmentDir,
    '..',
    `allocation-report-${runtimeTarget}.json`,
  );
  await fs.writeFile(reportPath, JSON.stringify(allocationReport, null, 2));
  console.log(`info Writing allocation report → ${reportPath}`);

  // Step 9c: Emit moduleId → relativePath map for crash post-mortem.
  // The runtime stack trace only carries numeric module IDs; this side-car
  // file lets a human resolve `Requiring unknown module "8192"` back to the
  // owning source file directly from APK / .app assets.
  const moduleIdMap = {
    runtimeTarget,
    eager: {},
    segments: {},
  };
  for (const moduleId of mainModuleIds) {
    const absPath = moduleIdToAbsPath.get(moduleId);
    if (!absPath) continue;
    moduleIdMap.eager[moduleId] = absPath
      .replace(monorepoRoot, '')
      .replace(/^\//, '');
  }
  for (const [segmentKey, modIds] of segmentModules) {
    const entry = manifest.segments[segmentKey];
    const segMods = {};
    for (const modId of modIds) {
      const absPath = moduleIdToAbsPath.get(modId);
      if (!absPath) continue;
      segMods[modId] = absPath.replace(monorepoRoot, '').replace(/^\//, '');
    }
    moduleIdMap.segments[segmentKey] = {
      id: entry ? entry.id : undefined,
      runtime: entry ? entry.runtime : undefined,
      modules: segMods,
    };
  }
  const moduleIdMapPath = getModuleIdMapPath(runtimeTarget);
  await fs.writeFile(moduleIdMapPath, JSON.stringify(moduleIdMap));
  console.log(`info Writing module-id map → ${moduleIdMapPath}`);

  // Step 11: Generate source map for main bundle (needed by Sentry / EAS)
  const mainGraphModules = [];
  // Include prepend modules (polyfills, require runtime, etc.)
  for (const preModule of prepend) {
    mainGraphModules.push(preModule);
  }
  // Include main (non-segment) modules
  for (const moduleId of mainModuleIds) {
    const absPath = moduleIdToAbsPath.get(moduleId);
    if (!absPath) continue;
    const modData = graph.dependencies.get(absPath);
    if (modData) {
      mainGraphModules.push(modData);
    }
  }
  const mainSourceMap = await sourceMapStringNonBlocking(mainGraphModules, {
    excludeSource: false,
    processModuleFilter: () => true,
    shouldAddToIgnoreList: () => false,
    getSourceUrl: (module) => module.path,
  });

  const bundleResult = bundleToString({
    pre: preWithManifest,
    post,
    modules: mainModules,
  });
  return {
    code: bundleResult.code,
    metadata: bundleResult.metadata,
    map: mainSourceMap,
  };
};
