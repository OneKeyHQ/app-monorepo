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
const { getSegmentsDir, getManifestPath } = require('../plugins/segmentPaths');
const {
  deriveSegmentKey,
  allocateSegmentIds,
  monorepoRoot,
} = require('../plugins/segmentUtils');

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

  return {
    asyncRequireModulePath: resolvedAsyncRequireModulePath,
    processModuleFilter: config.serializer.processModuleFilter,
    createModuleId: metroServer.getCreateModuleId(),
    getRunModuleStatement: config.serializer.getRunModuleStatement,
    globalPrefix: config.transformer.globalPrefix,
    dev: false,
    includeAsyncPaths: false,
    projectRoot: config.projectRoot,
    modulesOnly: false,
    runBeforeMainModule: config.serializer.getModulesRunBeforeMainModule(
      path.relative(config.projectRoot, entryPoint),
    ),
    runModule: true,
    sourceMapUrl,
    sourceUrl: null,
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
        const rootId = asyncTypes.find((v) => asyncRoots.has(v));
        asyncDescendants.set(moduleId, rootId);
        step1Changed = true;
      } else if (hasUnresolved) {
        // Defer to next round.
      } else {
        eagerModuleIds.add(moduleId);
        step1Changed = true;
      }
    }
  }

  const segmentModules = new Map();
  const moduleToSegment = new Map();

  for (const [moduleId, absolutePath] of asyncRoots) {
    const segmentKey = deriveSegmentKey(absolutePath);
    if (!segmentModules.has(segmentKey)) {
      segmentModules.set(segmentKey, new Set());
    }
    segmentModules.get(segmentKey).add(moduleId);
    moduleToSegment.set(moduleId, segmentKey);
  }

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

  // Build a path-based set of segment modules for use in moduleFilter.
  // moduleToSegment uses fileToIdMap IDs which may differ from Metro server IDs,
  // so path-based lookup is the reliable way to check in writeBundle.
  const segmentAbsPaths = new Set();
  for (const [moduleId] of moduleToSegment) {
    // moduleId here is a fileToIdMap ID — find the matching absolutePath
    for (const [absPath] of graph.dependencies) {
      if (fileToIdMap.get(absPath) === moduleId) {
        segmentAbsPaths.add(absPath);
        break;
      }
    }
  }

  return {
    eagerModuleIds,
    segmentModules,
    moduleToSegment,
    segmentAbsPaths,
    segmentIdMap: allocateSegmentIds([...segmentModules.keys()]),
  };
}

function buildModuleIndexesForGraphs(graphs, createModuleId) {
  const moduleIdToAbsPath = new Map();
  const getModuleId = createModuleId || ((absPath) => fileToIdMap.get(absPath));
  for (const graph of graphs) {
    for (const [absolutePath] of graph.dependencies) {
      moduleIdToAbsPath.set(getModuleId(absolutePath), absolutePath);
    }
  }
  return { moduleIdToAbsPath };
}

function createResolverOptions(runtimeTarget) {
  const customResolverOptions = Object.create(null);
  customResolverOptions.runtimeTarget = runtimeTarget;
  return {
    customResolverOptions,
  };
}

function setEquals(left, right) {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function buildModuleSignature(moduleData) {
  if (!moduleData) {
    return '';
  }
  const outputs = (moduleData.output || []).map((output) => ({
    type: output.type,
    code: output.data?.code || '',
  }));
  const dependencies = [...moduleData.dependencies.entries()]
    .map(([key, dep]) => ({
      key,
      absolutePath: dep.absolutePath,
      asyncType:
        dep.data && dep.data.data ? (dep.data.data.asyncType ?? null) : null,
      isOptional:
        dep.data && 'isOptional' in dep.data ? dep.data.isOptional : false,
    }))
    .toSorted((left, right) =>
      `${left.key}:${left.absolutePath}`.localeCompare(
        `${right.key}:${right.absolutePath}`,
      ),
    );
  return sha256(JSON.stringify({ outputs, dependencies }));
}

function buildRuntimeOwnership({
  mainGraph,
  bgGraph,
  mainReachable,
  bgReachable,
}) {
  const mainSignatures = new Map();
  const bgSignatures = new Map();

  for (const [absolutePath, moduleData] of mainGraph.dependencies) {
    mainSignatures.set(absolutePath, buildModuleSignature(moduleData));
  }
  for (const [absolutePath, moduleData] of bgGraph.dependencies) {
    bgSignatures.set(absolutePath, buildModuleSignature(moduleData));
  }

  const allAbsPaths = new Set([
    ...mainGraph.dependencies.keys(),
    ...bgGraph.dependencies.keys(),
  ]);
  const sharedEquivalentAbsPaths = new Set();
  const mainOnlyAbsPaths = new Set();
  const bgOnlyAbsPaths = new Set();

  for (const absolutePath of allAbsPaths) {
    const inMain = mainSignatures.has(absolutePath);
    const inBg = bgSignatures.has(absolutePath);
    const isSharedEquivalent =
      inMain &&
      inBg &&
      mainSignatures.get(absolutePath) === bgSignatures.get(absolutePath);

    if (isSharedEquivalent) {
      sharedEquivalentAbsPaths.add(absolutePath);
      continue;
    }
    if (inMain) {
      mainOnlyAbsPaths.add(absolutePath);
    }
    if (inBg) {
      bgOnlyAbsPaths.add(absolutePath);
    }
  }

  const sharedStartupAbsPaths = new Set(
    [...sharedEquivalentAbsPaths].filter(
      (absolutePath) =>
        mainReachable.has(absolutePath) && bgReachable.has(absolutePath),
    ),
  );
  const mainStartupAbsPaths = new Set(
    [...mainReachable].filter(
      (absolutePath) => !sharedStartupAbsPaths.has(absolutePath),
    ),
  );
  const bgStartupAbsPaths = new Set(
    [...bgReachable].filter(
      (absolutePath) => !sharedStartupAbsPaths.has(absolutePath),
    ),
  );

  return {
    allAbsPaths,
    sharedEquivalentAbsPaths,
    sharedStartupAbsPaths,
    mainStartupAbsPaths,
    bgStartupAbsPaths,
    mainOnlyAbsPaths,
    bgOnlyAbsPaths,
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

function getSegmentModuleAbsPaths(moduleIds, moduleIdToAbsPath) {
  return new Set(
    [...moduleIds]
      .map((moduleId) => moduleIdToAbsPath.get(moduleId))
      .filter(Boolean),
  );
}

function buildSegmentDeps(
  graph,
  segmentModules,
  moduleToSegment,
  moduleIdToAbsPath,
) {
  const segmentDeps = new Map();
  for (const [segmentKey, moduleIds] of segmentModules) {
    const deps = new Set();
    for (const moduleId of moduleIds) {
      const absolutePath = moduleIdToAbsPath.get(moduleId);
      if (!absolutePath) {
        continue;
      }
      const moduleData = graph.dependencies.get(absolutePath);
      if (!moduleData) {
        continue;
      }
      for (const [, dep] of moduleData.dependencies) {
        const depSegment = moduleToSegment.get(
          fileToIdMap.get(dep.absolutePath),
        );
        if (depSegment && depSegment !== segmentKey) {
          deps.add(depSegment);
        }
      }
    }
    segmentDeps.set(segmentKey, deps);
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
}) {
  const result = baseJSBundle(entryPoint, prepend, graph, bundleOptions);

  if (!bundleSerializationCache.has(cacheKey)) {
    bundleSerializationCache.set(cacheKey, {
      modules: result.modules,
      pre: result.pre,
    });
  }

  const cached = bundleSerializationCache.get(cacheKey);
  return {
    modules: cached.modules,
    pre: cached.pre,
    post: result.post,
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
  moduleIdToAbsPath,
}) {
  const { modules, pre, post } = getSerializedBundleParts({
    cacheKey,
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  });

  const selectedWrappedModules = [];
  const selectedGraphModules = [];
  const selectedStartupModuleIds = new Set();

  for (const [moduleId, moduleCode] of modules) {
    const absolutePath = moduleIdToAbsPath.get(moduleId);
    if (!absolutePath || !moduleFilter(absolutePath, moduleId)) {
      continue;
    }
    selectedStartupModuleIds.add(moduleId);
    selectedWrappedModules.push([moduleId, moduleCode]);
    const moduleData = graph.dependencies.get(absolutePath);
    if (moduleData) {
      selectedGraphModules.push(moduleData);
    }
  }

  let preSection = includePre ? pre : '';
  if (includeManifest && manifest) {
    const manifestCode = `globalThis.__SEGMENT_MANIFEST__=${JSON.stringify(manifest)};`;
    preSection = preSection
      ? `${preSection}\n${manifestCode}\n`
      : `${manifestCode}\n`;
  }

  // Metro's post section has the form:
  //   __r(initializeCoreId);   ← from getModulesRunBeforeMainModule (e.g. InitializeCore)
  //   __r(entryId);            ← the actual entry point
  //
  // Split bundle strategy:
  //   common bundle  (includePre=true):  emit runBeforeMainModule __r() calls ONLY
  //                                      (all but the last), so InitializeCore runs in
  //                                      both main and background Hermes runtimes when
  //                                      common.jsbundle is loaded.
  //   entry bundles  (includePre=false): emit ONLY the entry __r() (last call),
  //                                      since runBeforeMainModule already ran via common.
  let postSection = '';
  if (includePost) {
    const rCalls = post.match(/__r\(\d+\)/g) || [];
    if (includePre) {
      // Common bundle: emit the runBeforeMainModule __r() calls (all except the entry).
      // These initialize React Native globals (fetch, timers, etc.) in every runtime
      // that loads common.jsbundle.
      if (rCalls.length > 1) {
        postSection = `${rCalls
          .slice(0, -1)
          .map((r) => `${r};`)
          .join('\n')}\n`;
      }
      // If there is only one __r() it IS the entry — nothing to emit here.
    } else {
      // Entry-only bundle: emit only the entry module's __r().
      if (rCalls.length > 0) {
        postSection = `${rCalls[rCalls.length - 1]};\n`;
      }
    }
  }

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
  moduleIdToAbsPath,
}) {
  const promotedSet = new Set(promotedSegments);

  const collectSegmentOutputs = ({ modules, moduleToSegment }) => {
    const segmentOutputs = new Map();
    for (const [moduleId, moduleCode] of modules) {
      const segmentKey = moduleToSegment.get(moduleId);
      if (!segmentKey || promotedSet.has(segmentKey)) {
        continue;
      }
      if (!segmentOutputs.has(segmentKey)) {
        segmentOutputs.set(segmentKey, []);
      }
      segmentOutputs.get(segmentKey).push([moduleId, moduleCode]);
    }
    return segmentOutputs;
  };

  const emitSegment = async ({
    segmentKey,
    runtime,
    segModules,
    graph,
    segmentDeps,
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

  const mainSegmentOutputs = collectSegmentOutputs(mainRuntime);
  const backgroundSegmentOutputs = collectSegmentOutputs(backgroundRuntime);

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

  for (const segmentKey of [...allSegmentKeys].toSorted()) {
    const inMain = mainSegmentOutputs.has(segmentKey);
    const inBackground = backgroundSegmentOutputs.has(segmentKey);

    if (inMain && inBackground) {
      const mainAbsPaths = getSegmentModuleAbsPaths(
        mainRuntime.segmentModules.get(segmentKey),
        moduleIdToAbsPath,
      );
      const backgroundAbsPaths = getSegmentModuleAbsPaths(
        backgroundRuntime.segmentModules.get(segmentKey),
        moduleIdToAbsPath,
      );
      const mainDeps = new Set(mainRuntime.segmentDeps.get(segmentKey) || []);
      const backgroundDeps = new Set(
        backgroundRuntime.segmentDeps.get(segmentKey) || [],
      );
      const canShare =
        setEquals(mainAbsPaths, backgroundAbsPaths) &&
        setEquals(mainDeps, backgroundDeps) &&
        [...mainAbsPaths].every((absolutePath) =>
          sharedEquivalentAbsPaths.has(absolutePath),
        );

      if (canShare) {
        const sharedEntry = await emitSegment({
          segmentKey,
          runtime: 'shared',
          segModules: mainSegmentOutputs.get(segmentKey),
          graph: mainRuntime.graph,
          segmentDeps: mainRuntime.segmentDeps,
          outputDir: getSegmentsDir('main'),
          relativeDir: 'segments',
        });
        mainManifest.segments[segmentKey] = sharedEntry;
        backgroundManifest.segments[segmentKey] = sharedEntry;
        mainReportSegments.set(
          segmentKey,
          mainRuntime.segmentModules.get(segmentKey),
        );
        backgroundReportSegments.set(
          segmentKey,
          backgroundRuntime.segmentModules.get(segmentKey),
        );
        setMergedReportSegmentModules(
          segmentKey,
          'shared',
          mainRuntime.segmentModules.get(segmentKey),
        );
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
        outputDir: getSegmentsDir('main'),
        relativeDir: 'segments',
      });
      const backgroundSegmentEntry = await emitSegment({
        segmentKey,
        runtime: 'background',
        segModules: backgroundSegmentOutputs.get(segmentKey),
        graph: backgroundRuntime.graph,
        segmentDeps: backgroundRuntime.segmentDeps,
        outputDir: getSegmentsDir('background'),
        relativeDir: 'segments-background',
      });
      mainManifest.segments[segmentKey] = mainSegmentEntry;
      backgroundManifest.segments[segmentKey] = backgroundSegmentEntry;
      mainReportSegments.set(
        segmentKey,
        mainRuntime.segmentModules.get(segmentKey),
      );
      backgroundReportSegments.set(
        segmentKey,
        backgroundRuntime.segmentModules.get(segmentKey),
      );
      setMergedReportSegmentModules(
        segmentKey,
        'main',
        mainRuntime.segmentModules.get(segmentKey),
      );
      setMergedReportSegmentModules(
        segmentKey,
        'background',
        backgroundRuntime.segmentModules.get(segmentKey),
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
        outputDir: getSegmentsDir('main'),
        relativeDir: 'segments',
      });
      mainManifest.segments[segmentKey] = mainSegmentEntry;
      mainReportSegments.set(
        segmentKey,
        mainRuntime.segmentModules.get(segmentKey),
      );
      setMergedReportSegmentModules(
        segmentKey,
        'main',
        mainRuntime.segmentModules.get(segmentKey),
      );
      continue;
    }

    const backgroundEntry = await emitSegment({
      segmentKey,
      runtime: 'background',
      segModules: backgroundSegmentOutputs.get(segmentKey),
      graph: backgroundRuntime.graph,
      segmentDeps: backgroundRuntime.segmentDeps,
      outputDir: getSegmentsDir('background'),
      relativeDir: 'segments-background',
    });
    backgroundManifest.segments[segmentKey] = backgroundEntry;
    backgroundReportSegments.set(
      segmentKey,
      backgroundRuntime.segmentModules.get(segmentKey),
    );
    setMergedReportSegmentModules(
      segmentKey,
      'background',
      backgroundRuntime.segmentModules.get(segmentKey),
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
  const args = parseArgs();
  assertRequiredArgs(args);

  console.log(`Union build: platform=${args.platform}`);

  const config = await loadConfig({ cwd: mobileDirPath });
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

    const mainReachable = computeReachable(mainGraph, mainEntry, {
      skipAsyncEdges: true,
    });
    const bgReachable = computeReachable(backgroundGraph, bgEntry);
    const runtimeOwnership = buildRuntimeOwnership({
      mainGraph,
      bgGraph: backgroundGraph,
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

    const mainAllocation = buildSegmentAllocation(mainGraph);
    const backgroundAllocation = buildSegmentAllocation(backgroundGraph);
    const segmentIdMap = allocateSegmentIds(
      [
        ...new Set([
          ...mainAllocation.segmentModules.keys(),
          ...backgroundAllocation.segmentModules.keys(),
        ]),
      ].toSorted(),
    );

    const createModuleId = metroServer.getCreateModuleId();
    const { moduleIdToAbsPath } = buildModuleIndexesForGraphs(
      [mainGraph, backgroundGraph],
      createModuleId,
    );
    const mainSegmentDeps = buildSegmentDeps(
      mainGraph,
      mainAllocation.segmentModules,
      mainAllocation.moduleToSegment,
      moduleIdToAbsPath,
    );
    const backgroundSegmentDeps = buildSegmentDeps(
      backgroundGraph,
      backgroundAllocation.segmentModules,
      backgroundAllocation.moduleToSegment,
      moduleIdToAbsPath,
    );
    const allSegmentAbsPaths = new Set([
      ...mainAllocation.segmentAbsPaths,
      ...backgroundAllocation.segmentAbsPaths,
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

    const mainSerializedModules = getSerializedBundleParts({
      cacheKey: 'main-segments',
      entryPoint: mainEntry,
      prepend: mainPrepend,
      graph: mainGraph,
      bundleOptions: commonBundleOptions,
    }).modules;
    const backgroundSerializedModules = getSerializedBundleParts({
      cacheKey: 'background-segments',
      entryPoint: bgEntry,
      prepend: backgroundPrepend,
      graph: backgroundGraph,
      bundleOptions: backgroundBundleOptions,
    }).modules;

    const {
      mainManifest,
      backgroundManifest,
      mergedManifest,
      reportSegmentModules,
    } = await writeSegments({
      mainRuntime: {
        graph: mainGraph,
        modules: mainSerializedModules,
        segmentModules: mainAllocation.segmentModules,
        moduleToSegment: mainAllocation.moduleToSegment,
        segmentDeps: mainSegmentDeps,
      },
      backgroundRuntime: {
        graph: backgroundGraph,
        modules: backgroundSerializedModules,
        segmentModules: backgroundAllocation.segmentModules,
        moduleToSegment: backgroundAllocation.moduleToSegment,
        segmentDeps: backgroundSegmentDeps,
      },
      segmentIdMap,
      sharedEquivalentAbsPaths: runtimeOwnership.sharedEquivalentAbsPaths,
      moduleIdToAbsPath,
    });

    // Common bundle: shared eager modules + polyfills/runtime + manifest
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
      moduleIdToAbsPath,
    });

    // Main bundle: main-only eager modules + entry require
    const mainBundleResult = await writeBundle({
      cacheKey: 'main',
      bundleOutput: args.mainBundleOutput,
      sourceMapOutput: args.mainSourceMapOutput,
      entryPoint: mainEntry,
      moduleFilter: (absolutePath) =>
        runtimeOwnership.mainStartupAbsPaths.has(absolutePath) &&
        !allSegmentAbsPaths.has(absolutePath),
      manifest: null,
      includePre: false,
      includePost: true,
      includeManifest: false,
      graph: mainGraph,
      prepend: mainPrepend,
      bundleOptions: mainBundleOptions,
      moduleIdToAbsPath,
    });

    // Background bundle: bg-only eager modules + entry require
    const backgroundBundleResult = await writeBundle({
      cacheKey: 'background',
      bundleOutput: args.backgroundBundleOutput,
      sourceMapOutput: args.backgroundSourceMapOutput,
      entryPoint: bgEntry,
      moduleFilter: (absolutePath) =>
        runtimeOwnership.bgStartupAbsPaths.has(absolutePath) &&
        !allSegmentAbsPaths.has(absolutePath),
      manifest: null,
      includePre: false,
      includePost: true,
      includeManifest: false,
      graph: backgroundGraph,
      prepend: backgroundPrepend,
      bundleOptions: backgroundBundleOptions,
      moduleIdToAbsPath,
    });

    const commonViolations = detectStartupViolations(
      commonBundleResult.startupModuleIds,
      moduleIdToAbsPath,
    );
    const mainViolations = detectStartupViolations(
      mainBundleResult.startupModuleIds,
      moduleIdToAbsPath,
    );
    const backgroundViolations = detectStartupViolations(
      backgroundBundleResult.startupModuleIds,
      moduleIdToAbsPath,
    );

    await fs.writeFile(
      path.resolve(mobileDirPath, 'dist/allocation-report-common.json'),
      JSON.stringify(
        buildAllocationReport({
          runtimeTarget: 'common',
          startupModuleIds: commonBundleResult.startupModuleIds,
          manifest: mergedManifest,
          graph: mainGraph,
          moduleIdToAbsPath,
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
          moduleIdToAbsPath,
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
          moduleIdToAbsPath,
          segmentModules: reportSegmentModules.background,
          violations: backgroundViolations,
        }),
        null,
        2,
      ),
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
