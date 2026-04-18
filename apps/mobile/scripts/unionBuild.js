/* eslint-disable onekey/no-raw-error, no-continue, no-plusplus */
/* cspell:ignore rescan */
/**
 * Union Graph Build Script
 *
 * Builds separate Metro graphs for main/background entries, then emits:
 * - common eager bundle (polyfills + shared modules + segment manifest)
 * - main eager bundle (main-only modules + entry require)
 * - background eager bundle (bg-only modules + entry require)
 * - shared/main/background segments
 * - per-runtime manifests and allocation reports
 * - copied assets
 *
 * Usage:
 *   UNION_BUILD=true node --max-old-space-size=8192 scripts/unionBuild.js \
 *     --platform ios \
 *     --common-bundle-output out-dir-bundle/ios/common.jsbundle \
 *     --common-sourcemap-output out-dir-bundle/ios/common.jsbundle.map \
 *     --main-bundle-output out-dir-bundle/ios/main.jsbundle \
 *     --main-sourcemap-output out-dir-bundle/ios/main.jsbundle.map \
 *     --background-bundle-output out-dir-bundle/ios/background.bundle.js \
 *     --background-sourcemap-output out-dir-bundle/ios/background.bundle.packager.map \
 *     --assets-dest out-dir-bundle/ios/assets
 */

const crypto = require('crypto');
const path = require('path');

const fs = require('fs-extra');
const Metro = require('metro');
const { loadConfig } = require('metro-config');
const saveAssets = require(
  path.resolve(
    __dirname,
    '../../../node_modules/@react-native/community-cli-plugin/dist/commands/bundle/saveAssets.js',
  ),
).default;

const {
  forbiddenInStartup,
  promotedSegments,
} = require('../bundle-groups.config');
const { computeReachable } = require('../plugins/entryReachability');
const { fileToIdMap } = require('../plugins/map');
const {
  getSegmentsDir,
  getManifestPath,
  getMergedModuleIdMapPath,
} = require('../plugins/segmentPaths');
const {
  deriveSegmentKey,
  allocateSegmentIds,
  monorepoRoot,
} = require('../plugins/segmentUtils');
const {
  buildStartupProfilePrologue,
} = require('../plugins/startupProfilePrologue');

const {
  buildPostSection,
  buildSerializedModuleEntries,
  buildGraphModuleIndex,
  buildRuntimeOwnership,
  collectCommonReferencedSegmentKeys,
  createAbsolutePathToSegmentMap,
  createSerializedModuleToSegmentMap,
  expandSegmentsWithSyncDeps,
  expandSyncDependencyClosure,
  groupSerializedEntriesBySegment,
  rewriteAsyncRequirePaths,
  seedSegmentAssignments,
  setEquals,
} = require('./unionBuildHelpers');

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
const getAppendScripts = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/lib/getAppendScripts',
  ),
).default;
const getPrependedScripts = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/lib/getPrependedScripts',
  ),
).default;
const { sourceMapStringNonBlocking } = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/DeltaBundler/Serializers/sourceMapString',
  ),
);

const mobileDirPath = path.resolve(__dirname, '..');
const mainEntry = path.resolve(mobileDirPath, 'index.ts');
const bgEntry = path.resolve(mobileDirPath, 'background.ts');

function ensureProductionBuildEnv() {
  process.env.NODE_ENV = 'production';
  process.env.BABEL_ENV = 'production';
  process.env.ONEKEY_PLATFORM = process.env.ONEKEY_PLATFORM || 'app';
}

function parseArgs() {
  const readArg = (name) => {
    const idx = process.argv.indexOf(`--${name}`);
    return idx >= 0 ? process.argv[idx + 1] : undefined;
  };

  return {
    platform: readArg('platform') || 'ios',
    commonBundleOutput: readArg('common-bundle-output'),
    commonSourceMapOutput: readArg('common-sourcemap-output'),
    mainBundleOutput: readArg('main-bundle-output'),
    mainSourceMapOutput: readArg('main-sourcemap-output'),
    backgroundBundleOutput: readArg('background-bundle-output'),
    backgroundSourceMapOutput: readArg('background-sourcemap-output'),
    assetsDest: readArg('assets-dest'),
  };
}

function assertRequiredArgs(args) {
  const required = [
    'commonBundleOutput',
    'commonSourceMapOutput',
    'mainBundleOutput',
    'mainSourceMapOutput',
    'backgroundBundleOutput',
    'backgroundSourceMapOutput',
    'assetsDest',
  ];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(
        `[unionBuild] Missing required arg --${key.replace(/[A-Z]/g, (s) => `-${s.toLowerCase()}`)}`,
      );
    }
  }
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function relativePath(absPath) {
  return absPath.replace(monorepoRoot, '').replace(/^\//, '');
}

function estimateModuleSize(moduleData) {
  if (!moduleData || !moduleData.output || !moduleData.output.length) {
    return 0;
  }
  return moduleData.output.reduce((sum, output) => {
    if (output.data && output.data.code) {
      return sum + output.data.code.length;
    }
    return sum;
  }, 0);
}

async function generateSegmentSourceMap(segModules, graph, moduleIdToAbsPath) {
  const sorted = segModules.slice().toSorted((a, b) => a[0] - b[0]);
  const segmentGraphModules = [];

  for (const [moduleId] of sorted) {
    const absolutePath = moduleIdToAbsPath.get(moduleId);
    if (!absolutePath) {
      continue;
    }
    const moduleData = graph.dependencies.get(absolutePath);
    if (moduleData) {
      segmentGraphModules.push(moduleData);
    }
  }

  return sourceMapStringNonBlocking(segmentGraphModules, {
    excludeSource: false,
    processModuleFilter: () => true,
    shouldAddToIgnoreList: () => false,
    getSourceUrl: (module) => module.path,
  });
}

function createBundleOptions({
  metroServer,
  config,
  entryPoint,
  sourceMapUrl,
}) {
  const asyncRequireModulePath = config.transformer.asyncRequireModulePath;
  const resolvedAsyncRequireModulePath = path.isAbsolute(asyncRequireModulePath)
    ? asyncRequireModulePath
    : require.resolve(asyncRequireModulePath, {
        paths: [
          config.projectRoot,
          path.join(config.projectRoot, 'node_modules'),
        ],
      });

  const asyncPathsSourceUrl = `https://split-bundle.invalid/${path.basename(
    entryPoint,
  )}`;

  return {
    asyncRequireModulePath: resolvedAsyncRequireModulePath,
    processModuleFilter: config.serializer.processModuleFilter,
    createModuleId: metroServer.getCreateModuleId(),
    getRunModuleStatement: config.serializer.getRunModuleStatement,
    globalPrefix: config.transformer.globalPrefix,
    dev: false,
    includeAsyncPaths: true,
    projectRoot: config.projectRoot,
    modulesOnly: false,
    runBeforeMainModule: config.serializer.getModulesRunBeforeMainModule(
      path.relative(config.projectRoot, entryPoint),
    ),
    runModule: true,
    sourceMapUrl,
    sourceUrl: asyncPathsSourceUrl,
    inlineSourceMap: false,
    serverRoot: config.server.unstable_serverRoot || config.projectRoot,
    shouldAddToIgnoreList: (module) =>
      metroServer._shouldAddModuleToIgnoreList(module),
    getSourceUrl: (module) => module.path,
  };
}

function buildSegmentAllocation(graph) {
  const asyncFlag = 'async';
  const eagerModuleIds = new Set();
  const asyncRoots = new Map();
  const asyncDescendants = new Map(); // moduleId → rootModuleId
  const findAsyncParent = (fatherId) => {
    if (asyncRoots.has(fatherId)) return fatherId;
    if (asyncDescendants.has(fatherId)) return asyncDescendants.get(fatherId);
    return null;
  };

  let step1Changed = true;
  while (step1Changed) {
    step1Changed = false;
    for (const [absolutePath, moduleData] of graph.dependencies) {
      const moduleId = fileToIdMap.get(absolutePath);
      if (
        eagerModuleIds.has(moduleId) ||
        asyncRoots.has(moduleId) ||
        asyncDescendants.has(moduleId)
      ) {
        continue;
      }

      const asyncTypes = [...moduleData.inverseDependencies].map(
        (parentPath) => {
          const parentId = fileToIdMap.get(parentPath);
          const parentModule = graph.dependencies.get(parentPath);
          if (!parentModule) {
            return undefined;
          }
          for (const [, dep] of parentModule.dependencies) {
            if (dep.absolutePath === absolutePath) {
              const existingChunk = findAsyncParent(parentId);
              const asyncType =
                dep.data && dep.data.data ? dep.data.data.asyncType : undefined;
              if (existingChunk && asyncType === null) {
                return existingChunk;
              }
              return asyncType;
            }
          }
          return undefined;
        },
      );

      // Check if any parent that returned null is actually unclassified
      // (not yet in asyncRoots, asyncDescendants, or eagerModuleIds).
      // If so, the null might turn into a rootId in a later iteration — defer.
      let hasUnclassifiedParentReturningNull = false;
      const parentPaths = [...moduleData.inverseDependencies];
      for (let i = 0; i < parentPaths.length; i++) {
        const parentPath = parentPaths[i];
        const parentId = fileToIdMap.get(parentPath);
        if (
          asyncTypes[i] === null &&
          !asyncRoots.has(parentId) &&
          !asyncDescendants.has(parentId) &&
          !eagerModuleIds.has(parentId)
        ) {
          hasUnclassifiedParentReturningNull = true;
          break;
        }
      }

      const hasUnresolved =
        asyncTypes.some((v) => v === undefined) ||
        hasUnclassifiedParentReturningNull;

      if (asyncTypes.length === 0) {
        eagerModuleIds.add(moduleId);
        step1Changed = true;
      } else if (
        asyncTypes.some((value) => value === null) &&
        !hasUnclassifiedParentReturningNull
      ) {
        // At least one parent is genuinely eager (classified as eager) → eager.
        eagerModuleIds.add(moduleId);
        step1Changed = true;
      } else if (asyncTypes.every((value) => value === asyncFlag)) {
        asyncRoots.set(moduleId, absolutePath);
        step1Changed = true;
      } else if (
        !hasUnresolved &&
        asyncTypes.length >= 1 &&
        asyncTypes.every((v) => v === asyncFlag || asyncRoots.has(v))
      ) {
        // If ANY parent uses a direct async import (asyncType === 'async'),
        // promote this module to its own ASYNC_ROOT instead of attaching it
        // as a descendant of an existing root.  This prevents a module that
        // is dynamically imported from multiple call sites from being lumped
        // into an unrelated segment (e.g. qr-wallet-sdk ending up inside
        // the QRWalletGallery dev segment just because Gallery also sync-
        // imports it).
        if (asyncTypes.some((v) => v === asyncFlag)) {
          asyncRoots.set(moduleId, absolutePath);
        } else {
          const rootId = asyncTypes.find((v) => asyncRoots.has(v));
          asyncDescendants.set(moduleId, rootId);
        }
        step1Changed = true;
      } else if (hasUnresolved) {
        // Defer to next round.
      } else {
        eagerModuleIds.add(moduleId);
        step1Changed = true;
      }
    }
  }

  const { segmentModules, moduleToSegment } = seedSegmentAssignments({
    asyncRoots,
    asyncDescendants,
    deriveSegmentKey,
  });

  // Iterate until stable — barrel files (index.ts re-exports) create multi-level
  // indirection that a single pass cannot resolve.
  let rescanChanged = true;
  while (rescanChanged) {
    rescanChanged = false;
    for (const [absolutePath, moduleData] of graph.dependencies) {
      const moduleId = fileToIdMap.get(absolutePath);
      if (eagerModuleIds.has(moduleId) || moduleToSegment.has(moduleId)) {
        continue;
      }

      const parentSegments = new Set();
      let hasUnresolvedParent = false;
      for (const parentPath of moduleData.inverseDependencies) {
        const parentId = fileToIdMap.get(parentPath);
        const parentSeg = moduleToSegment.get(parentId);
        if (parentSeg) {
          parentSegments.add(parentSeg);
        } else if (eagerModuleIds.has(parentId)) {
          parentSegments.add('main');
        } else {
          hasUnresolvedParent = true;
        }
      }

      if (hasUnresolvedParent) continue;

      if (!parentSegments.has('main') && parentSegments.size >= 1) {
        const segmentKey = [...parentSegments][0];
        segmentModules.get(segmentKey).add(moduleId);
        moduleToSegment.set(moduleId, segmentKey);
        rescanChanged = true;
      } else {
        eagerModuleIds.add(moduleId);
      }
    }
  }

  // Step 3: Fallback pass — classify remaining unclassified modules.
  // After Step 2's conservative rescan, modules with at least one unresolved
  // parent stay unclassified even if all their resolved parents are eager.
  // This creates cascading dead-locks (e.g., @babel/runtime used by both eager
  // and segment code).  Resolve by treating unclassified modules that have ANY
  // eager parent as eager (safe default — they were reachable from eager code).
  let fallbackChanged = true;
  while (fallbackChanged) {
    fallbackChanged = false;
    for (const [absolutePath, moduleData] of graph.dependencies) {
      const moduleId = fileToIdMap.get(absolutePath);
      if (eagerModuleIds.has(moduleId) || moduleToSegment.has(moduleId)) {
        continue;
      }

      let hasEagerParent = false;
      let hasSegmentParent = false;
      for (const parentPath of moduleData.inverseDependencies) {
        const parentId = fileToIdMap.get(parentPath);
        if (eagerModuleIds.has(parentId)) {
          hasEagerParent = true;
        } else if (moduleToSegment.has(parentId)) {
          hasSegmentParent = true;
        }
      }

      if (hasEagerParent) {
        // Reachable from eager code → must be eager
        eagerModuleIds.add(moduleId);
        fallbackChanged = true;
      } else if (hasSegmentParent && moduleData.inverseDependencies.size > 0) {
        // All resolved parents are segments, no eager parent → assign to first
        // parent's segment.  Unresolved parents are likely also segments that
        // will resolve in subsequent iterations.
        for (const parentPath of moduleData.inverseDependencies) {
          const parentId = fileToIdMap.get(parentPath);
          const parentSeg = moduleToSegment.get(parentId);
          if (parentSeg) {
            if (!segmentModules.has(parentSeg)) {
              segmentModules.set(parentSeg, new Set());
            }
            segmentModules.get(parentSeg).add(moduleId);
            moduleToSegment.set(moduleId, parentSeg);
            fallbackChanged = true;
            break;
          }
        }
      }
    }
  }

  // Final sweep: any module still unclassified has no resolved parents at all
  // (orphan in the graph).  Force them to eager so they're not lost.
  for (const [absolutePath] of graph.dependencies) {
    const moduleId = fileToIdMap.get(absolutePath);
    if (!eagerModuleIds.has(moduleId) && !moduleToSegment.has(moduleId)) {
      eagerModuleIds.add(moduleId);
    }
  }

  // Build a path-based set of segment modules for use in moduleFilter.
  // moduleToSegment uses fileToIdMap IDs which may differ from Metro server IDs,
  // so path-based lookup is the reliable way to check in writeBundle.
  const segmentAbsPaths = new Set();
  const segmentAbsPathsByKey = new Map();
  for (const [absolutePath] of graph.dependencies) {
    const segmentKey = moduleToSegment.get(fileToIdMap.get(absolutePath));
    if (!segmentKey) {
      continue;
    }
    segmentAbsPaths.add(absolutePath);
    if (!segmentAbsPathsByKey.has(segmentKey)) {
      segmentAbsPathsByKey.set(segmentKey, new Set());
    }
    segmentAbsPathsByKey.get(segmentKey).add(absolutePath);
  }

  return {
    eagerModuleIds,
    segmentModules,
    moduleToSegment,
    segmentAbsPaths,
    segmentAbsPathsByKey,
    segmentIdMap: allocateSegmentIds([...segmentModules.keys()]),
  };
}

function collectStartupAbsPaths(graph, eagerModuleIds) {
  const startupAbsPaths = new Set();
  for (const [absolutePath] of graph.dependencies) {
    if (eagerModuleIds.has(fileToIdMap.get(absolutePath))) {
      startupAbsPaths.add(absolutePath);
    }
  }
  return startupAbsPaths;
}

function createResolverOptions(runtimeTarget) {
  const customResolverOptions = Object.create(null);
  customResolverOptions.runtimeTarget = runtimeTarget;
  return {
    customResolverOptions,
  };
}

function mergeDependencyMaps(...maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [absolutePath, moduleData] of map) {
      if (!merged.has(absolutePath)) {
        merged.set(absolutePath, moduleData);
      }
    }
  }
  return merged;
}

function buildSegmentDeps(graph, segmentAbsPathsByKey, absPathToSegment) {
  const segmentDeps = new Map();
  for (const [segmentKey, absolutePaths] of segmentAbsPathsByKey) {
    const deps = new Set();
    for (const absolutePath of absolutePaths) {
      const moduleData = graph.dependencies.get(absolutePath);
      if (!moduleData) {
        continue;
      }
      for (const [, dep] of moduleData.dependencies) {
        // Skip async imports — they are loaded on-demand at runtime,
        // not as pre-requisites of this segment.
        const asyncType = dep.data?.data?.asyncType;
        if (asyncType === 'async') {
          continue;
        }
        const depSegment = absPathToSegment.get(dep.absolutePath);
        if (depSegment && depSegment !== segmentKey) {
          deps.add(depSegment);
        }
      }
    }
    segmentDeps.set(segmentKey, deps);
  }

  // Remove circular dependencies: if A depends on B and B depends on A,
  // remove B→A to break the cycle.  The runtime segment loader has its own
  // cycle detection and throws SegmentLoadError when it hits one, causing
  // silent blank pages.  Breaking cycles here (at build time) is safe
  // because both segments will already be loaded by the time the cyclic
  // require() executes — segment files are self-contained with their sync
  // deps included via expandSegmentsWithSyncDeps.
  let cyclesRemoved = 0;
  for (const [segKey, deps] of segmentDeps) {
    for (const depKey of deps) {
      const reverseEdge = segmentDeps.get(depKey);
      if (reverseEdge && reverseEdge.has(segKey)) {
        // Break cycle by removing the reverse edge
        reverseEdge.delete(segKey);
        cyclesRemoved += 1;
      }
    }
  }
  if (cyclesRemoved > 0) {
    console.log(
      `[unionBuild] Removed ${cyclesRemoved} circular segment dependencies`,
    );
  }

  return segmentDeps;
}

function isManifestVariantRecord(record) {
  return typeof record === 'object' && record !== null && 'variants' in record;
}

function buildManifestEntrySignature(entry) {
  return JSON.stringify({
    id: entry.id,
    key: entry.key,
    runtime: entry.runtime,
    relativePath: entry.relativePath,
    sha256: entry.sha256,
    dependsOn: entry.dependsOn || [],
    critical: entry.critical || false,
    size: entry.size ?? null,
  });
}

function buildManifestRecordSignature(record) {
  if (!record) {
    return '';
  }
  if (!isManifestVariantRecord(record)) {
    return buildManifestEntrySignature(record);
  }
  return JSON.stringify({
    key: record.key,
    variants: Object.entries(record.variants)
      .filter(([, entry]) => Boolean(entry))
      .map(([runtime, entry]) => [runtime, buildManifestEntrySignature(entry)])
      .toSorted(([left], [right]) => left.localeCompare(right)),
  });
}

function toManifestVariantRecord(segmentKey, record) {
  if (isManifestVariantRecord(record)) {
    return {
      key: record.key || segmentKey,
      variants: { ...record.variants },
    };
  }
  return {
    key: segmentKey,
    variants: {
      [record.runtime]: record,
    },
  };
}

function mergeSegmentManifestRecord(segmentKey, existingRecord, nextRecord) {
  if (!existingRecord) {
    return nextRecord;
  }
  if (
    buildManifestRecordSignature(existingRecord) ===
    buildManifestRecordSignature(nextRecord)
  ) {
    return existingRecord;
  }

  const mergedRecord = toManifestVariantRecord(segmentKey, existingRecord);
  const nextVariantRecord = toManifestVariantRecord(segmentKey, nextRecord);

  for (const [runtime, entry] of Object.entries(nextVariantRecord.variants)) {
    if (!entry) {
      continue;
    }
    const existingEntry = mergedRecord.variants[runtime];
    if (existingEntry) {
      if (
        buildManifestEntrySignature(existingEntry) !==
        buildManifestEntrySignature(entry)
      ) {
        throw new Error(
          `[unionBuild] Conflicting manifest entry for ${segmentKey} (${runtime})`,
        );
      }
      continue;
    }
    mergedRecord.variants[runtime] = entry;
  }

  const runtimes = Object.keys(mergedRecord.variants);
  if (runtimes.length === 1) {
    return mergedRecord.variants[runtimes[0]];
  }

  return mergedRecord;
}

function mergeSegmentManifests(...manifests) {
  const mergedManifest = { segments: {} };
  for (const manifest of manifests) {
    for (const [segmentKey, record] of Object.entries(manifest.segments)) {
      mergedManifest.segments[segmentKey] = mergeSegmentManifestRecord(
        segmentKey,
        mergedManifest.segments[segmentKey],
        record,
      );
    }
  }
  return mergedManifest;
}

function getManifestRecordEntries(record) {
  if (!record) {
    return [];
  }
  if (!isManifestVariantRecord(record)) {
    return [record];
  }
  return Object.values(record.variants).filter(Boolean);
}

function getManifestRecordRuntimes(record) {
  return getManifestRecordEntries(record)
    .map((entry) => entry.runtime)
    .toSorted();
}

function resolveManifestRecordForRuntime(record, runtimeTarget) {
  if (!record) {
    return undefined;
  }
  if (!isManifestVariantRecord(record)) {
    return record;
  }
  return record.variants[runtimeTarget] || record.variants.shared;
}

function getManifestRecordSize(record, runtimeTarget) {
  if (runtimeTarget === 'main' || runtimeTarget === 'background') {
    return resolveManifestRecordForRuntime(record, runtimeTarget)?.size;
  }
  return getManifestRecordEntries(record).reduce(
    (sum, entry) => sum + (entry.size || 0),
    0,
  );
}

function getReportSegmentModuleIds(reportSegmentModules) {
  if (!reportSegmentModules) {
    return new Set();
  }
  if (reportSegmentModules instanceof Set) {
    return new Set(reportSegmentModules);
  }

  const moduleIds = new Set();
  for (const modules of Object.values(reportSegmentModules)) {
    if (!modules) {
      continue;
    }
    for (const moduleId of modules) {
      moduleIds.add(moduleId);
    }
  }
  return moduleIds;
}

function detectStartupViolations(moduleIds, moduleIdToAbsPath) {
  return [...moduleIds]
    .map((moduleId) => moduleIdToAbsPath.get(moduleId))
    .filter(Boolean)
    .map(relativePath)
    .filter((relPath) =>
      forbiddenInStartup.some((forbiddenPath) =>
        relPath.startsWith(forbiddenPath),
      ),
    )
    .toSorted();
}

function buildAllocationReport({
  runtimeTarget,
  startupModuleIds,
  manifest,
  graph,
  moduleIdToAbsPath,
  segmentModules,
  violations,
}) {
  const startupModules = [...startupModuleIds]
    .map((moduleId) => moduleIdToAbsPath.get(moduleId))
    .filter(Boolean)
    .map(relativePath)
    .toSorted();
  const estimatedSizeBytes = [...startupModuleIds].reduce((sum, moduleId) => {
    const absolutePath = moduleIdToAbsPath.get(moduleId);
    if (!absolutePath) {
      return sum;
    }
    return sum + estimateModuleSize(graph.dependencies.get(absolutePath));
  }, 0);

  const segments = {};
  for (const [segmentKey, record] of Object.entries(manifest.segments)) {
    const modIds = getReportSegmentModuleIds(segmentModules.get(segmentKey));
    const runtimes = getManifestRecordRuntimes(record);
    segments[segmentKey] = {
      runtime: runtimes.length === 1 ? runtimes[0] : 'variant',
      runtimes,
      moduleCount: modIds.size,
      size: getManifestRecordSize(record, runtimeTarget),
    };
  }

  return {
    runtimeTarget,
    startup: {
      moduleCount: startupModules.length,
      estimatedSizeBytes,
      modules: startupModules,
    },
    segments,
    violations,
  };
}

// Cache the modules array per runtime.
// baseJSBundle serializes module code via graph.dependencies[].output, which is
// stable across calls. But the `post` section (runBeforeMainModule + entry require)
// differs per entry point, so each call must produce its own `post`.
// We cache `modules` per runtime graph to guarantee consistent module code.
const bundleSerializationCache = new Map();

function getSerializedBundleParts({
  cacheKey,
  entryPoint,
  prepend,
  graph,
  bundleOptions,
  moduleIdToAbsPath,
}) {
  const result = baseJSBundle(entryPoint, prepend, graph, bundleOptions);
  const serializedEntries = buildSerializedModuleEntries({
    graph,
    moduleIdToAbsPath,
    serializedModules: result.modules,
  });

  if (!bundleSerializationCache.has(cacheKey)) {
    bundleSerializationCache.set(cacheKey, {
      pre: result.pre,
      serializedEntries,
    });
  }

  const cached = bundleSerializationCache.get(cacheKey);
  return {
    pre: cached.pre,
    post: result.post,
    serializedEntries: cached.serializedEntries,
  };
}

async function writeBundle({
  cacheKey,
  bundleOutput,
  sourceMapOutput,
  entryPoint,
  moduleFilter,
  manifest,
  includePre,
  includePost,
  includeManifest,
  graph,
  prepend,
  bundleOptions,
  moduleToSegment,
  moduleIdToAbsPath,
  externalModulePaths,
  runtimeVariants,
}) {
  const { serializedEntries, pre } = getSerializedBundleParts({
    cacheKey,
    entryPoint,
    prepend,
    graph,
    bundleOptions,
    moduleIdToAbsPath,
  });

  const initialIncludedAbsPaths = new Set();
  const includedModulePaths = new Set();

  if (includePre) {
    for (const prependModule of prepend) {
      if (prependModule?.path) {
        includedModulePaths.add(prependModule.path);
      }
    }
  }

  for (const serializedEntry of serializedEntries) {
    const { absolutePath, moduleId } = serializedEntry;
    if (!moduleFilter(absolutePath, moduleId)) {
      continue;
    }
    initialIncludedAbsPaths.add(absolutePath);
  }

  const selectedAbsPaths = expandSyncDependencyClosure({
    serializedEntries,
    initialIncludedAbsPaths,
    externalAbsPaths: externalModulePaths,
  });

  const selectedWrappedModules = [];
  const selectedGraphModules = [];
  const selectedStartupModuleIds = new Set();

  for (const serializedEntry of serializedEntries) {
    const { absolutePath, moduleCode, moduleData, moduleId } = serializedEntry;
    if (!selectedAbsPaths.has(absolutePath)) {
      continue;
    }
    selectedStartupModuleIds.add(moduleId);
    includedModulePaths.add(absolutePath);
    selectedWrappedModules.push([moduleId, moduleCode]);
    if (moduleData) {
      selectedGraphModules.push(moduleData);
    }
  }

  let preSection = includePre ? pre : '';
  // Inject the startup-profile prologue into the bundle that carries the
  // Metro prelude (the common bundle — the only one written with includePre).
  // Common is loaded first in both main and background runtimes, so placing
  // the `globalThis.__ONEKEY_STARTUP_PROFILE__` / `__ONEKEY_MODULE_ID_TO_PATH__`
  // assignments here guarantees they run before any `__d` call or the main
  // entry's `installStartupProfileJs()` hook. Without this, the JS-side
  // profile silently never activates in union builds (the customSerializer
  // injection in plugins/index.js is bypassed because unionBuild.js calls
  // Metro's `baseJSBundle()` directly).
  if (includePre) {
    const profilePrologue = buildStartupProfilePrologue({ fileToIdMap });
    if (profilePrologue) {
      preSection = preSection
        ? `${preSection}\n${profilePrologue}\n`
        : `${profilePrologue}\n`;
    }
  }
  if (includeManifest && manifest) {
    const manifestCode = `globalThis.__SEGMENT_MANIFEST__=${JSON.stringify(manifest)};`;
    preSection = preSection
      ? `${preSection}\n${manifestCode}\n`
      : `${manifestCode}\n`;
  }

  rewriteAsyncRequirePaths(selectedWrappedModules, {
    moduleToSegment,
    moduleIdToAbsPath,
    eagerAbsPaths: new Set([
      ...selectedAbsPaths,
      ...(externalModulePaths || new Set()),
    ]),
    runtimeVariants,
  });

  const postSection = includePost
    ? buildPostSection({
        bundleOptions,
        entryPoint,
        includePre,
        includedModulePaths,
      })
    : '';

  const bundle = bundleToString({
    pre: preSection,
    post: postSection,
    modules: selectedWrappedModules,
  });

  const prependForSourceMap = includePre ? prepend : [];
  const appendScripts = includePost
    ? getAppendScripts(
        entryPoint,
        [...prependForSourceMap, ...selectedGraphModules],
        bundleOptions,
      )
    : [];
  const map = await sourceMapStringNonBlocking(
    [...prependForSourceMap, ...selectedGraphModules, ...appendScripts],
    {
      excludeSource: false,
      processModuleFilter: bundleOptions.processModuleFilter,
      shouldAddToIgnoreList: bundleOptions.shouldAddToIgnoreList,
      getSourceUrl: bundleOptions.getSourceUrl,
    },
  );

  await fs.ensureDir(path.dirname(bundleOutput));
  await fs.writeFile(bundleOutput, bundle.code);
  await fs.writeFile(sourceMapOutput, map);

  return { startupModuleIds: selectedStartupModuleIds };
}

async function writeSegments({
  mainRuntime,
  backgroundRuntime,
  segmentIdMap,
  sharedEquivalentAbsPaths,
  mainEagerAbsPaths,
  bgEagerAbsPaths,
  runtimeOwnership,
}) {
  const promotedSet = new Set(promotedSegments);

  const emitSegment = async ({
    segmentKey,
    runtime,
    segModules,
    graph,
    segmentDeps,
    moduleIdToAbsPath,
    outputDir,
    relativeDir,
  }) => {
    const segmentId = segmentIdMap.get(segmentKey);
    const { code } = bundleToString({
      pre: '',
      post: '',
      modules: segModules,
    });

    const safeName = segmentKey
      .replace(/^seg:/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const outputPath = path.resolve(outputDir, `${safeName}.seg.js`);
    const packagerMapPath = path.resolve(
      outputDir,
      `${safeName}.seg.packager.map`,
    );
    const relativeOutputPath = `${relativeDir}/${safeName}.seg.hbc`;

    await fs.writeFile(outputPath, code);

    const sourceMap = await generateSegmentSourceMap(
      segModules,
      graph,
      moduleIdToAbsPath,
    );
    await fs.writeFile(packagerMapPath, sourceMap);

    const entry = {
      id: segmentId,
      key: segmentKey,
      runtime,
      relativePath: relativeOutputPath,
      sha256: sha256(Buffer.from(code)),
      dependsOn: segmentDeps.has(segmentKey)
        ? [...segmentDeps.get(segmentKey)].toSorted()
        : [],
      size: Buffer.byteLength(code),
    };

    console.log(`Segment emitted: ${segmentKey} (${runtime}) -> ${outputPath}`);

    return entry;
  };

  const mainSegmentOutputs = groupSerializedEntriesBySegment({
    serializedEntries: mainRuntime.serializedEntries,
    absPathToSegment: mainRuntime.absPathToSegment,
    promotedSegmentKeys: promotedSet,
  });
  const backgroundSegmentOutputs = groupSerializedEntriesBySegment({
    serializedEntries: backgroundRuntime.serializedEntries,
    absPathToSegment: backgroundRuntime.absPathToSegment,
    promotedSegmentKeys: promotedSet,
  });

  // Expand segments: add sync deps that are not in the eager bundle and
  // not in any other segment. Each missing dep is added to exactly ONE
  // segment (first-come), preventing cross-segment duplication.
  const mainSyncDepsAdded = expandSegmentsWithSyncDeps({
    segmentOutputs: mainSegmentOutputs,
    serializedEntries: mainRuntime.serializedEntries,
    eagerAbsPaths: mainEagerAbsPaths,
    moduleIdToAbsPath: mainRuntime.moduleIdToAbsPath,
  });
  const bgSyncDepsAdded = expandSegmentsWithSyncDeps({
    segmentOutputs: backgroundSegmentOutputs,
    serializedEntries: backgroundRuntime.serializedEntries,
    eagerAbsPaths: bgEagerAbsPaths,
    moduleIdToAbsPath: backgroundRuntime.moduleIdToAbsPath,
  });
  if (mainSyncDepsAdded > 0 || bgSyncDepsAdded > 0) {
    console.log(
      `[unionBuild] Expanded segments with sync deps: main +${mainSyncDepsAdded}, background +${bgSyncDepsAdded}`,
    );
  }

  await fs.remove(getSegmentsDir('main'));
  await fs.remove(getSegmentsDir('background'));
  await fs.ensureDir(getSegmentsDir('main'));
  await fs.ensureDir(getSegmentsDir('background'));

  const mainManifest = { segments: {} };
  const backgroundManifest = { segments: {} };
  const mergedReportSegments = new Map();
  const mainReportSegments = new Map();
  const backgroundReportSegments = new Map();

  const setMergedReportSegmentModules = (segmentKey, runtime, moduleIds) => {
    if (runtime === 'shared') {
      mergedReportSegments.set(segmentKey, moduleIds);
      return;
    }

    const existing = mergedReportSegments.get(segmentKey);
    if (!existing || existing instanceof Set) {
      mergedReportSegments.set(segmentKey, { [runtime]: moduleIds });
      return;
    }
    existing[runtime] = moduleIds;
  };

  const allSegmentKeys = new Set([
    ...mainSegmentOutputs.keys(),
    ...backgroundSegmentOutputs.keys(),
  ]);

  // Segments async-imported from common-bundle modules must be shared.
  const commonReferencedSegmentKeys = collectCommonReferencedSegmentKeys({
    mainGraph: mainRuntime.graph,
    backgroundGraph: backgroundRuntime.graph,
    sharedStartupAbsPaths: runtimeOwnership?.sharedStartupAbsPaths,
    mainSegmentAbsPathsByKey: mainRuntime.segmentAbsPathsByKey,
    backgroundSegmentAbsPathsByKey: backgroundRuntime.segmentAbsPathsByKey,
  });
  if (commonReferencedSegmentKeys.size > 0) {
    console.log(
      `[unionBuild] Common-referenced segment keys (forced shared): ${[...commonReferencedSegmentKeys].join(', ')}`,
    );
  }

  for (const segmentKey of [...allSegmentKeys].toSorted()) {
    const inMain = mainSegmentOutputs.has(segmentKey);
    const inBackground = backgroundSegmentOutputs.has(segmentKey);

    if (inMain && inBackground) {
      const mainAbsPaths =
        mainRuntime.segmentAbsPathsByKey.get(segmentKey) || new Set();
      const backgroundAbsPaths =
        backgroundRuntime.segmentAbsPathsByKey.get(segmentKey) || new Set();
      const mainDeps = new Set(mainRuntime.segmentDeps.get(segmentKey) || []);
      const backgroundDeps = new Set(
        backgroundRuntime.segmentDeps.get(segmentKey) || [],
      );
      // Force shared when a common-bundle module async-imports this segment.
      // Without this, the segment gets split into runtime-specific variants
      // that the common bundle code in the other runtime can't resolve.
      const forceShared = commonReferencedSegmentKeys.has(segmentKey);
      const canShare =
        forceShared ||
        (setEquals(mainAbsPaths, backgroundAbsPaths) &&
          setEquals(mainDeps, backgroundDeps) &&
          [...mainAbsPaths].every((absolutePath) =>
            sharedEquivalentAbsPaths.has(absolutePath),
          ));

      if (canShare) {
        const sharedEntry = await emitSegment({
          segmentKey,
          runtime: 'shared',
          segModules: mainSegmentOutputs.get(segmentKey),
          graph: mainRuntime.graph,
          segmentDeps: mainRuntime.segmentDeps,
          moduleIdToAbsPath: mainRuntime.moduleIdToAbsPath,
          outputDir: getSegmentsDir('main'),
          relativeDir: 'segments',
        });
        mainManifest.segments[segmentKey] = sharedEntry;
        backgroundManifest.segments[segmentKey] = sharedEntry;
        mainReportSegments.set(segmentKey, mainAbsPaths);
        backgroundReportSegments.set(segmentKey, backgroundAbsPaths);
        setMergedReportSegmentModules(segmentKey, 'shared', mainAbsPaths);
        continue;
      }

      console.log(
        `[unionBuild] Segment runtime variants: ${segmentKey}\n` +
          `  main modules: ${[...mainAbsPaths]
            .map(relativePath)
            .toSorted()
            .join(', ')}\n` +
          `  background modules: ${[...backgroundAbsPaths]
            .map(relativePath)
            .toSorted()
            .join(', ')}`,
      );

      const mainSegmentEntry = await emitSegment({
        segmentKey,
        runtime: 'main',
        segModules: mainSegmentOutputs.get(segmentKey),
        graph: mainRuntime.graph,
        segmentDeps: mainRuntime.segmentDeps,
        moduleIdToAbsPath: mainRuntime.moduleIdToAbsPath,
        outputDir: getSegmentsDir('main'),
        relativeDir: 'segments',
      });
      const backgroundSegmentEntry = await emitSegment({
        segmentKey,
        runtime: 'background',
        segModules: backgroundSegmentOutputs.get(segmentKey),
        graph: backgroundRuntime.graph,
        segmentDeps: backgroundRuntime.segmentDeps,
        moduleIdToAbsPath: backgroundRuntime.moduleIdToAbsPath,
        outputDir: getSegmentsDir('background'),
        relativeDir: 'segments-background',
      });
      mainManifest.segments[segmentKey] = mainSegmentEntry;
      backgroundManifest.segments[segmentKey] = backgroundSegmentEntry;
      mainReportSegments.set(segmentKey, mainAbsPaths);
      backgroundReportSegments.set(segmentKey, backgroundAbsPaths);
      setMergedReportSegmentModules(segmentKey, 'main', mainAbsPaths);
      setMergedReportSegmentModules(
        segmentKey,
        'background',
        backgroundAbsPaths,
      );
      continue;
    }

    if (inMain) {
      const mainSegmentEntry = await emitSegment({
        segmentKey,
        runtime: 'main',
        segModules: mainSegmentOutputs.get(segmentKey),
        graph: mainRuntime.graph,
        segmentDeps: mainRuntime.segmentDeps,
        moduleIdToAbsPath: mainRuntime.moduleIdToAbsPath,
        outputDir: getSegmentsDir('main'),
        relativeDir: 'segments',
      });
      mainManifest.segments[segmentKey] = mainSegmentEntry;
      mainReportSegments.set(
        segmentKey,
        mainRuntime.segmentAbsPathsByKey.get(segmentKey) || new Set(),
      );
      setMergedReportSegmentModules(
        segmentKey,
        'main',
        mainRuntime.segmentAbsPathsByKey.get(segmentKey) || new Set(),
      );
      continue;
    }

    const backgroundEntry = await emitSegment({
      segmentKey,
      runtime: 'background',
      segModules: backgroundSegmentOutputs.get(segmentKey),
      graph: backgroundRuntime.graph,
      segmentDeps: backgroundRuntime.segmentDeps,
      moduleIdToAbsPath: backgroundRuntime.moduleIdToAbsPath,
      outputDir: getSegmentsDir('background'),
      relativeDir: 'segments-background',
    });
    backgroundManifest.segments[segmentKey] = backgroundEntry;
    backgroundReportSegments.set(
      segmentKey,
      backgroundRuntime.segmentAbsPathsByKey.get(segmentKey) || new Set(),
    );
    setMergedReportSegmentModules(
      segmentKey,
      'background',
      backgroundRuntime.segmentAbsPathsByKey.get(segmentKey) || new Set(),
    );
  }

  const mergedManifest = mergeSegmentManifests(
    mainManifest,
    backgroundManifest,
  );

  await fs.ensureDir(path.dirname(getManifestPath('main')));
  await fs.writeFile(
    getManifestPath('main'),
    JSON.stringify(mainManifest, null, 2),
  );
  await fs.writeFile(
    getManifestPath('background'),
    JSON.stringify(backgroundManifest, null, 2),
  );

  return {
    mainManifest,
    backgroundManifest,
    mergedManifest,
    promotedSet,
    reportSegmentModules: {
      common: mergedReportSegments,
      main: mainReportSegments,
      background: backgroundReportSegments,
    },
  };
}

async function main() {
  ensureProductionBuildEnv();
  const args = parseArgs();
  assertRequiredArgs(args);

  console.log(`Union build: platform=${args.platform}`);

  const config = await loadConfig({ cwd: mobileDirPath });
  config.cacheVersion = `${config.cacheVersion || 'default'}:union-build-production-env-v2`;
  const metroServer = await Metro.runMetro(config, { watch: false });

  try {
    const bundler = metroServer.getBundler();
    const mainResolverOptions = createResolverOptions('main');
    const backgroundResolverOptions = createResolverOptions('background');
    const transformOptions = {
      customTransformOptions: Object.create(null),
      dev: false,
      minify: false,
      platform: args.platform,
      unstable_transformProfile: 'default',
    };

    console.log('Building main graph...');
    const mainGraphStartedAt = Date.now();
    const mainGraph = await bundler.buildGraphForEntries(
      [mainEntry],
      transformOptions,
      mainResolverOptions,
      {
        onProgress: null,
        shallow: false,
        lazy: false,
      },
    );
    console.log(
      `Main graph built in ${((Date.now() - mainGraphStartedAt) / 1000).toFixed(1)}s`,
    );
    console.log(`Main graph modules: ${mainGraph.dependencies.size}`);

    console.log('Building background graph...');
    const backgroundGraphStartedAt = Date.now();
    const backgroundGraph = await bundler.buildGraphForEntries(
      [bgEntry],
      transformOptions,
      backgroundResolverOptions,
      {
        onProgress: null,
        shallow: false,
        lazy: false,
      },
    );
    console.log(
      `Background graph built in ${((Date.now() - backgroundGraphStartedAt) / 1000).toFixed(1)}s`,
    );
    console.log(
      `Background graph modules: ${backgroundGraph.dependencies.size}`,
    );

    const mainPrepend = await getPrependedScripts(
      config,
      {
        dev: false,
        minify: false,
        platform: args.platform,
        unstable_transformProfile: 'default',
      },
      mainResolverOptions,
      bundler.getBundler(),
      bundler.getDeltaBundler(),
    );
    const backgroundPrepend = await getPrependedScripts(
      config,
      {
        dev: false,
        minify: false,
        platform: args.platform,
        unstable_transformProfile: 'default',
      },
      backgroundResolverOptions,
      bundler.getBundler(),
      bundler.getDeltaBundler(),
    );

    const mainAllocation = buildSegmentAllocation(mainGraph);
    const backgroundAllocation = buildSegmentAllocation(backgroundGraph);
    const mainReachable = computeReachable(mainGraph, mainEntry, {
      skipAsyncEdges: true,
    });
    const bgReachable = computeReachable(backgroundGraph, bgEntry);
    const runtimeOwnership = buildRuntimeOwnership({
      mainGraph,
      bgGraph: backgroundGraph,
      mainStartupAbsPaths: collectStartupAbsPaths(
        mainGraph,
        mainAllocation.eagerModuleIds,
      ),
      bgStartupAbsPaths: collectStartupAbsPaths(
        backgroundGraph,
        backgroundAllocation.eagerModuleIds,
      ),
      mainReachable,
      bgReachable,
    });

    console.log(
      `Shared equivalent modules: ${runtimeOwnership.sharedEquivalentAbsPaths.size}`,
    );
    console.log(
      `Shared startup modules:    ${runtimeOwnership.sharedStartupAbsPaths.size}`,
    );
    console.log(
      `Main startup-only modules: ${runtimeOwnership.mainStartupAbsPaths.size}`,
    );
    console.log(
      `BG startup-only modules:   ${runtimeOwnership.bgStartupAbsPaths.size}`,
    );

    const segmentIdMap = allocateSegmentIds(
      [
        ...new Set([
          ...mainAllocation.segmentModules.keys(),
          ...backgroundAllocation.segmentModules.keys(),
        ]),
      ].toSorted(),
    );

    const createModuleId = metroServer.getCreateModuleId();
    const getGraphModuleId = (absolutePath) => fileToIdMap.get(absolutePath);
    const mainModuleIndex = buildGraphModuleIndex(mainGraph, createModuleId);
    const backgroundModuleIndex = buildGraphModuleIndex(
      backgroundGraph,
      createModuleId,
    );
    const mainAbsPathToSegment = createAbsolutePathToSegmentMap({
      graph: mainGraph,
      moduleToSegment: mainAllocation.moduleToSegment,
      getGraphModuleId,
    });
    const backgroundAbsPathToSegment = createAbsolutePathToSegmentMap({
      graph: backgroundGraph,
      moduleToSegment: backgroundAllocation.moduleToSegment,
      getGraphModuleId,
    });
    const mainSerializedModuleToSegment = createSerializedModuleToSegmentMap({
      moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
      absPathToSegment: mainAbsPathToSegment,
    });
    const backgroundSerializedModuleToSegment =
      createSerializedModuleToSegmentMap({
        moduleIdToAbsPath: backgroundModuleIndex.moduleIdToAbsPath,
        absPathToSegment: backgroundAbsPathToSegment,
      });
    const _mainRuntimeAsyncPaths = {
      absPathToSegment: mainAbsPathToSegment,
      eagerAbsPaths: new Set([
        ...runtimeOwnership.sharedStartupAbsPaths,
        ...runtimeOwnership.mainStartupAbsPaths,
      ]),
    };
    const _backgroundRuntimeAsyncPaths = {
      absPathToSegment: backgroundAbsPathToSegment,
      eagerAbsPaths: new Set([
        ...runtimeOwnership.sharedStartupAbsPaths,
        ...runtimeOwnership.bgStartupAbsPaths,
      ]),
    };
    const mainSegmentDeps = buildSegmentDeps(
      mainGraph,
      mainAllocation.segmentAbsPathsByKey,
      mainAbsPathToSegment,
    );
    const backgroundSegmentDeps = buildSegmentDeps(
      backgroundGraph,
      backgroundAllocation.segmentAbsPathsByKey,
      backgroundAbsPathToSegment,
    );
    // Each runtime's moduleFilter must only exclude its OWN segment paths.
    // Using the union of both runtimes' segments causes a module that is
    // segmented in one runtime but eager in another to be incorrectly
    // excluded from the eager bundle → "Requiring unknown module" crash.
    const mainSegmentAbsPaths = mainAllocation.segmentAbsPaths;
    const bgSegmentAbsPaths = backgroundAllocation.segmentAbsPaths;
    // Keep the union for common bundle (shared modules should not be in
    // any runtime-specific segment).
    const allSegmentAbsPaths = new Set([
      ...mainSegmentAbsPaths,
      ...bgSegmentAbsPaths,
    ]);

    const commonBundleOptions = createBundleOptions({
      metroServer,
      config,
      entryPoint: mainEntry,
      sourceMapUrl: path.basename(args.commonSourceMapOutput),
    });
    const mainBundleOptions = createBundleOptions({
      metroServer,
      config,
      entryPoint: mainEntry,
      sourceMapUrl: path.basename(args.mainSourceMapOutput),
    });
    const backgroundBundleOptions = createBundleOptions({
      metroServer,
      config,
      entryPoint: bgEntry,
      sourceMapUrl: path.basename(args.backgroundSourceMapOutput),
    });

    const mainSerializedEntries = getSerializedBundleParts({
      cacheKey: 'main-segments',
      entryPoint: mainEntry,
      prepend: mainPrepend,
      graph: mainGraph,
      bundleOptions: commonBundleOptions,
      moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
    }).serializedEntries;
    const backgroundSerializedEntries = getSerializedBundleParts({
      cacheKey: 'background-segments',
      entryPoint: bgEntry,
      prepend: backgroundPrepend,
      graph: backgroundGraph,
      bundleOptions: backgroundBundleOptions,
      moduleIdToAbsPath: backgroundModuleIndex.moduleIdToAbsPath,
    }).serializedEntries;

    const {
      mainManifest,
      backgroundManifest,
      mergedManifest,
      reportSegmentModules,
    } = await writeSegments({
      mainRuntime: {
        graph: mainGraph,
        serializedEntries: mainSerializedEntries,
        absPathToSegment: mainAbsPathToSegment,
        segmentAbsPathsByKey: mainAllocation.segmentAbsPathsByKey,
        segmentDeps: mainSegmentDeps,
        moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
      },
      backgroundRuntime: {
        graph: backgroundGraph,
        serializedEntries: backgroundSerializedEntries,
        absPathToSegment: backgroundAbsPathToSegment,
        segmentAbsPathsByKey: backgroundAllocation.segmentAbsPathsByKey,
        segmentDeps: backgroundSegmentDeps,
        moduleIdToAbsPath: backgroundModuleIndex.moduleIdToAbsPath,
      },
      segmentIdMap,
      sharedEquivalentAbsPaths: runtimeOwnership.sharedEquivalentAbsPaths,
      mainEagerAbsPaths: new Set([
        ...runtimeOwnership.sharedStartupAbsPaths,
        ...runtimeOwnership.mainStartupAbsPaths,
      ]),
      bgEagerAbsPaths: new Set([
        ...runtimeOwnership.sharedStartupAbsPaths,
        ...runtimeOwnership.bgStartupAbsPaths,
      ]),
      runtimeOwnership,
    });

    // ── Common bundle ──────────────────────────────────────────────────
    // Contains shared eager modules + polyfills/runtime + merged manifest.
    // Loaded into BOTH main and background Hermes runtimes via sequential
    // loading (common.bundle first, then the runtime-specific bundle).
    //
    // Async require path strategy:
    //   Common code runs in both runtimes, so its import() paths must
    //   work everywhere. We use the MERGED segment map (main ∪ background)
    //   instead of per-runtime variants. Shared segments (like locale JSON)
    //   get a simple segment key — no {"main":…,"background":…} branching.
    //   Both runtimes resolve the same key via the merged manifest.
    //
    //   For modules that are eager in main/background (not in a segment),
    //   externalModulePaths covers both runtimes' eager sets so the
    //   rewriter marks them as null (already loaded).
    const commonModuleToSegment = new Map([
      ...mainSerializedModuleToSegment,
      ...backgroundSerializedModuleToSegment,
    ]);
    const commonBundleResult = await writeBundle({
      cacheKey: 'main',
      bundleOutput: args.commonBundleOutput,
      sourceMapOutput: args.commonSourceMapOutput,
      entryPoint: mainEntry,
      moduleFilter: (absolutePath) =>
        runtimeOwnership.sharedStartupAbsPaths.has(absolutePath) &&
        !allSegmentAbsPaths.has(absolutePath),
      manifest: mergedManifest,
      includePre: true,
      includePost: true,
      includeManifest: true,
      graph: mainGraph,
      prepend: mainPrepend,
      bundleOptions: commonBundleOptions,
      moduleToSegment: commonModuleToSegment,
      moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
      externalModulePaths: new Set([
        ...runtimeOwnership.mainStartupAbsPaths,
        ...runtimeOwnership.bgStartupAbsPaths,
      ]),
      // No runtimeVariants — common code uses the merged segment map
      // directly. Both runtimes share the same manifest and can load
      // any shared segment by key.
    });

    // Main bundle: main-only eager modules + entry require
    const mainBundleResult = await writeBundle({
      cacheKey: 'main',
      bundleOutput: args.mainBundleOutput,
      sourceMapOutput: args.mainSourceMapOutput,
      entryPoint: mainEntry,
      moduleFilter: (absolutePath) =>
        runtimeOwnership.mainStartupAbsPaths.has(absolutePath) &&
        !mainSegmentAbsPaths.has(absolutePath),
      manifest: null,
      includePre: false,
      includePost: true,
      includeManifest: false,
      graph: mainGraph,
      prepend: mainPrepend,
      bundleOptions: mainBundleOptions,
      moduleToSegment: mainSerializedModuleToSegment,
      moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
      externalModulePaths: runtimeOwnership.sharedStartupAbsPaths,
    });

    // Background bundle: bg-only eager modules + entry require
    const backgroundBundleResult = await writeBundle({
      cacheKey: 'background',
      bundleOutput: args.backgroundBundleOutput,
      sourceMapOutput: args.backgroundSourceMapOutput,
      entryPoint: bgEntry,
      moduleFilter: (absolutePath) =>
        runtimeOwnership.bgStartupAbsPaths.has(absolutePath) &&
        !bgSegmentAbsPaths.has(absolutePath),
      manifest: null,
      includePre: false,
      includePost: true,
      includeManifest: false,
      graph: backgroundGraph,
      prepend: backgroundPrepend,
      bundleOptions: backgroundBundleOptions,
      moduleToSegment: backgroundSerializedModuleToSegment,
      moduleIdToAbsPath: backgroundModuleIndex.moduleIdToAbsPath,
      externalModulePaths: runtimeOwnership.sharedStartupAbsPaths,
    });

    // --- Bundle completeness validation ---
    // Ensure every module in each runtime's graph is covered by
    // eager bundles (common + runtime-specific) or a segment.
    const {
      validateBundleCompleteness,
      assertBundleCompleteness,
    } = require('./unionBuildHelpers');

    const moduleIdsToAbsPaths = (moduleIds, moduleIdToAbsPath) => {
      const absPaths = new Set();
      for (const id of moduleIds) {
        const p = moduleIdToAbsPath.get(id);
        if (p) {
          absPaths.add(p);
        }
      }
      return absPaths;
    };

    const commonEagerAbsPaths = moduleIdsToAbsPaths(
      commonBundleResult.startupModuleIds,
      mainModuleIndex.moduleIdToAbsPath,
    );

    const completenessReports = [
      [
        'main',
        mainGraph,
        new Set([
          ...commonEagerAbsPaths,
          ...moduleIdsToAbsPaths(
            mainBundleResult.startupModuleIds,
            mainModuleIndex.moduleIdToAbsPath,
          ),
        ]),
        mainSegmentAbsPaths,
      ],
      [
        'background',
        backgroundGraph,
        new Set([
          ...commonEagerAbsPaths,
          ...moduleIdsToAbsPaths(
            backgroundBundleResult.startupModuleIds,
            backgroundModuleIndex.moduleIdToAbsPath,
          ),
        ]),
        bgSegmentAbsPaths,
      ],
    ].map(([runtimeLabel, runtimeGraph, eagerAbsPaths, segAbsPaths]) => ({
      runtimeLabel,
      result: validateBundleCompleteness({
        graph: runtimeGraph.dependencies,
        eagerAbsPaths,
        segmentAbsPaths: segAbsPaths,
      }),
    }));

    if (process.env.ONEKEY_ALLOW_INCOMPLETE_BUNDLE === '1') {
      // Local-only opt-out. CI and release builds must NOT set this.
      // Keep the error body intact (paths + remediation) so a developer who
      // flipped the flag still sees every path to fix next.
      try {
        assertBundleCompleteness(completenessReports);
      } catch (error) {
        console.error(
          `[unionBuild] WARNING (opt-out active via ONEKEY_ALLOW_INCOMPLETE_BUNDLE=1):\n${error.message}`,
        );
      }
    } else {
      assertBundleCompleteness(completenessReports);
    }

    const commonViolations = detectStartupViolations(
      commonBundleResult.startupModuleIds,
      mainModuleIndex.moduleIdToAbsPath,
    );
    const mainViolations = detectStartupViolations(
      mainBundleResult.startupModuleIds,
      mainModuleIndex.moduleIdToAbsPath,
    );
    const backgroundViolations = detectStartupViolations(
      backgroundBundleResult.startupModuleIds,
      backgroundModuleIndex.moduleIdToAbsPath,
    );

    await fs.writeFile(
      path.resolve(mobileDirPath, 'dist/allocation-report-common.json'),
      JSON.stringify(
        buildAllocationReport({
          runtimeTarget: 'common',
          startupModuleIds: commonBundleResult.startupModuleIds,
          manifest: mergedManifest,
          graph: mainGraph,
          moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
          segmentModules: reportSegmentModules.common,
          violations: commonViolations,
        }),
        null,
        2,
      ),
    );

    await fs.writeFile(
      path.resolve(mobileDirPath, 'dist/allocation-report-main.json'),
      JSON.stringify(
        buildAllocationReport({
          runtimeTarget: 'main',
          startupModuleIds: mainBundleResult.startupModuleIds,
          manifest: mainManifest,
          graph: mainGraph,
          moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
          segmentModules: reportSegmentModules.main,
          violations: mainViolations,
        }),
        null,
        2,
      ),
    );

    await fs.writeFile(
      path.resolve(mobileDirPath, 'dist/allocation-report-background.json'),
      JSON.stringify(
        buildAllocationReport({
          runtimeTarget: 'background',
          startupModuleIds: backgroundBundleResult.startupModuleIds,
          manifest: backgroundManifest,
          graph: backgroundGraph,
          moduleIdToAbsPath: backgroundModuleIndex.moduleIdToAbsPath,
          segmentModules: reportSegmentModules.background,
          violations: backgroundViolations,
        }),
        null,
        2,
      ),
    );

    // Emit merged moduleId → relativePath map. Shipped with the APK / .app
    // assets so a runtime crash like `Requiring unknown module "8192"` can be
    // resolved back to the owning source file directly from the installed
    // app, without needing to archive every JS bundle in CI.
    const toRelPath = (absPath) =>
      absPath ? absPath.replace(monorepoRoot, '').replace(/^\//, '') : '';
    const buildAbsToId = (moduleIdToAbsPath) => {
      const out = new Map();
      for (const [id, absPath] of moduleIdToAbsPath) {
        if (absPath) out.set(absPath, id);
      }
      return out;
    };
    const mainAbsToId = buildAbsToId(mainModuleIndex.moduleIdToAbsPath);
    const bgAbsToId = buildAbsToId(backgroundModuleIndex.moduleIdToAbsPath);
    const moduleIdsToObject = (moduleIds, moduleIdToAbsPath) => {
      const obj = {};
      for (const id of moduleIds) {
        const absPath = moduleIdToAbsPath.get(id);
        if (absPath) obj[id] = toRelPath(absPath);
      }
      return obj;
    };
    const moduleIdMap = {
      common: moduleIdsToObject(
        commonBundleResult.startupModuleIds,
        mainModuleIndex.moduleIdToAbsPath,
      ),
      main: moduleIdsToObject(
        mainBundleResult.startupModuleIds,
        mainModuleIndex.moduleIdToAbsPath,
      ),
      background: moduleIdsToObject(
        backgroundBundleResult.startupModuleIds,
        backgroundModuleIndex.moduleIdToAbsPath,
      ),
      segments: {},
    };
    const segmentEntries = new Map();
    for (const [segKey, entry] of Object.entries(mergedManifest.segments)) {
      segmentEntries.set(segKey, entry);
    }
    const segmentRuntimeOf = (entry) => {
      if (!entry) return undefined;
      if (entry.runtime) return entry.runtime;
      if (entry.variants) {
        const runtimes = Object.keys(entry.variants);
        if (runtimes.length === 1) return runtimes[0];
        return 'shared';
      }
      return undefined;
    };
    const segmentIdOf = (entry) => {
      if (!entry) return undefined;
      if (typeof entry.id === 'number') return entry.id;
      if (entry.variants) {
        const first = Object.values(entry.variants).find(
          (v) => v && typeof v.id === 'number',
        );
        return first ? first.id : undefined;
      }
      return undefined;
    };
    const collectSegmentModules = (segKey, entry) => {
      const runtime = segmentRuntimeOf(entry);
      const out = {};
      const addFrom = (absPaths, absToId, idToAbs) => {
        if (!absPaths) return;
        for (const absPath of absPaths) {
          const id = absToId.get(absPath);
          if (id !== undefined && idToAbs.get(id)) {
            out[id] = toRelPath(absPath);
          }
        }
      };
      // For shared segments take main's view as canonical (matches the IDs
      // baked into common.bundle); fall back to background where needed.
      if (runtime === 'background') {
        addFrom(
          reportSegmentModules.background.get(segKey),
          bgAbsToId,
          backgroundModuleIndex.moduleIdToAbsPath,
        );
      } else {
        addFrom(
          reportSegmentModules.main.get(segKey),
          mainAbsToId,
          mainModuleIndex.moduleIdToAbsPath,
        );
        if (Object.keys(out).length === 0) {
          addFrom(
            reportSegmentModules.background.get(segKey),
            bgAbsToId,
            backgroundModuleIndex.moduleIdToAbsPath,
          );
        }
      }
      return out;
    };
    for (const [segKey, entry] of segmentEntries) {
      moduleIdMap.segments[segKey] = {
        id: segmentIdOf(entry),
        runtime: segmentRuntimeOf(entry),
        modules: collectSegmentModules(segKey, entry),
      };
    }
    const mergedMapPath = getMergedModuleIdMapPath();
    await fs.ensureDir(path.dirname(mergedMapPath));
    await fs.writeFile(mergedMapPath, JSON.stringify(moduleIdMap));
    console.log(
      `[unionBuild] Wrote module-id map (${Object.keys(moduleIdMap.common).length} common / ${Object.keys(moduleIdMap.main).length} main / ${Object.keys(moduleIdMap.background).length} background / ${Object.keys(moduleIdMap.segments).length} segments) → ${mergedMapPath}`,
    );

    const reportDir = path.resolve(mobileDirPath, 'out-dir-analysis');
    fs.ensureDirSync(reportDir);
    fs.writeFileSync(
      path.join(reportDir, 'union-graph-report.json'),
      JSON.stringify(
        {
          totalModules: runtimeOwnership.allAbsPaths.size,
          mainOnly: runtimeOwnership.mainOnlyAbsPaths.size,
          bgOnly: runtimeOwnership.bgOnlyAbsPaths.size,
          shared: runtimeOwnership.sharedEquivalentAbsPaths.size,
          sharedStartup: runtimeOwnership.sharedStartupAbsPaths.size,
          estimatedDuplicateModules:
            runtimeOwnership.sharedEquivalentAbsPaths.size,
          eagerModules: {
            common: commonBundleResult.startupModuleIds.size,
            main: mainBundleResult.startupModuleIds.size,
            background: backgroundBundleResult.startupModuleIds.size,
          },
          segments: {
            main: Object.values(mainManifest.segments).filter(
              (segment) => segment.runtime === 'main',
            ).length,
            background: Object.values(backgroundManifest.segments).filter(
              (segment) => segment.runtime === 'background',
            ).length,
            shared: Object.values(mainManifest.segments).filter(
              (segment) => segment.runtime === 'shared',
            ).length,
          },
        },
        null,
        2,
      ),
    );

    const assets = await metroServer._getAssetsFromDependencies(
      mergeDependencyMaps(mainGraph.dependencies, backgroundGraph.dependencies),
      args.platform,
    );
    await saveAssets(assets, args.platform, args.assetsDest);

    if (commonViolations.length > 0) {
      console.warn(
        `[unionBuild] WARNING: forbidden modules in common startup graph:\n${commonViolations
          .map((item) => `  - ${item}`)
          .join('\n')}`,
      );
    }
    if (mainViolations.length > 0) {
      console.warn(
        `[unionBuild] WARNING: forbidden modules in main startup graph:\n${mainViolations
          .map((item) => `  - ${item}`)
          .join('\n')}`,
      );
    }
    if (backgroundViolations.length > 0) {
      console.warn(
        `[unionBuild] WARNING: forbidden modules in background startup graph:\n${backgroundViolations
          .map((item) => `  - ${item}`)
          .join('\n')}`,
      );
    }
  } finally {
    metroServer.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
