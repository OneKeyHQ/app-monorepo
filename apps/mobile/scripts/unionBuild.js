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

const { spawn } = require('child_process');
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
  computeSharedPerRuntimeDeps,
  createAbsolutePathToSegmentMap,
  createSerializedModuleToSegmentMap,
  expandSegmentsWithCrossRuntimeDeps,
  expandSegmentsWithSyncDeps,
  expandSyncDependencyClosure,
  groupSerializedEntriesBySegment,
  mergeSharedSegmentOutputs,
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
const projectRootPath = path.resolve(mobileDirPath, '../..');

// Hermesc binary — same resolution as build-bundle.js keeps behavior
// identical across the two entry points. We need it here so segment sha256
// hashes can be computed from the actual .seg.hbc bytes before the manifest
// gets baked into common.bundle, instead of from the .seg.js text which no
// longer matches what the native split-bundle-loader verifies at load time
// (3.0.23+ enforces per-segment hash check; before then the mismatch was
// tolerated and went unnoticed).
const HERMES_PLATFORM_DIR =
  process.platform === 'linux' ? 'linux64-bin' : 'osx-bin';
const HERMES_COMMAND = path.join(
  projectRootPath,
  `node_modules/react-native/sdks/hermesc/${HERMES_PLATFORM_DIR}/hermesc`,
);

function runHermescAsync({ outPath, inputPath }) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      HERMES_COMMAND,
      [
        '-O',
        '-emit-binary',
        '-output-source-map',
        `-out=${outPath}`,
        inputPath,
      ],
      { stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `hermesc failed for ${inputPath} (code=${code}, signal=${signal})`,
          ),
        );
      }
    });
  });
}

async function runWithConcurrencyLocal(tasks, concurrency) {
  const results = [];
  let index = 0;
  const runOne = async () => {
    while (index < tasks.length) {
      const i = index;
      index += 1;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, runOne),
  );
  return results;
}

/**
 * Resolve a manifest entry's `relativePath` (e.g. `segments/foo.seg.hbc`)
 * to the absolute on-disk path of the matching `.seg.js` source file and
 * the target `.seg.hbc` output path — both live next to each other inside
 * apps/mobile/dist/.
 */
function resolveSegmentIoPaths(segRelativePath) {
  const baseName = path.basename(segRelativePath, '.seg.hbc');
  const segDir = path.join(
    mobileDirPath,
    'dist',
    path.dirname(segRelativePath),
  );
  return {
    jsPath: path.join(segDir, `${baseName}.seg.js`),
    hbcPath: path.join(segDir, `${baseName}.seg.hbc`),
  };
}

/**
 * Compile every emitted `.seg.js` to `.seg.hbc` via hermesc, then rewrite
 * each manifest entry's `sha256` and `size` to reflect the compiled bytes.
 * Shared entries (same object reference in both manifests, or in the
 * merged manifest's variant map) are updated in place so all three views
 * stay consistent.
 *
 * Concurrency mirrors build-bundle.js's buildSegments to avoid regressing
 * overall build time — buildSegments subsequently detects pre-compiled
 * .seg.hbc on disk and skips its own hermesc call.
 */
async function compileEmittedSegmentsAndRewriteSha256({
  mainManifest,
  backgroundManifest,
}) {
  // relativePath -> array of manifest entries whose sha256 must be refreshed
  // after this path's .seg.hbc is written. Shared entries show up in both
  // manifests; collect without dedupe so every live reference gets the
  // update (mutating one may not reach the other in every case).
  const entriesByRelativePath = new Map();
  const collect = (manifest) => {
    for (const [, record] of Object.entries(manifest.segments)) {
      for (const entry of getManifestRecordEntries(record)) {
        const rel = entry.relativePath;
        if (!rel) continue;
        if (!entriesByRelativePath.has(rel)) {
          entriesByRelativePath.set(rel, []);
        }
        entriesByRelativePath.get(rel).push(entry);
      }
    }
  };
  collect(mainManifest);
  collect(backgroundManifest);

  const relativePaths = [...entriesByRelativePath.keys()];
  if (relativePaths.length === 0) return;

  const concurrency = parseInt(
    process.env.SEGMENT_BUILD_CONCURRENCY || '4',
    10,
  );
  const tasks = relativePaths.map((segRelativePath) => async () => {
    const { jsPath, hbcPath } = resolveSegmentIoPaths(segRelativePath);
    await runHermescAsync({ inputPath: jsPath, outPath: hbcPath });
    const hbcBytes = fs.readFileSync(hbcPath);
    const hbcSha = sha256(hbcBytes);
    const hbcSize = hbcBytes.length;
    for (const entry of entriesByRelativePath.get(segRelativePath)) {
      entry.sha256 = hbcSha;
      entry.size = hbcSize;
    }
  });

  console.log(
    `[unionBuild] Compiling ${relativePaths.length} segment(s) to .seg.hbc and rewriting manifest sha256 (concurrency=${concurrency})`,
  );
  const hermescStart = Date.now();
  await runWithConcurrencyLocal(tasks, concurrency);
  console.log(
    `[unionBuild] Segment hermesc done in ${((Date.now() - hermescStart) / 1000).toFixed(1)}s`,
  );
}

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
    mainDependsOn: entry.mainDependsOn || null,
    backgroundDependsOn: entry.backgroundDependsOn || null,
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

  // Per-runtime serialized moduleId→segmentKey maps. Used by emitSegment
  // to rewrite each segment's async-require dependencyMap "paths" block
  // so it points at sibling segment keys / null (already-eager) instead of
  // the raw Metro dev-server URLs that baseJSBundle emits by default.
  // Without this, segment .seg.js files ship URLs like
  // "/X/Y.bundle?modulesOnly=true&runModule=false" — at runtime the
  // installProdBundleLoader eager-fallback short-circuits and the
  // following require(<id>) FATALs because the actual segment is never
  // loaded. See REACT-NATIVE-4AX, iOS 6.3.0-10069276.
  const mainSerializedModuleToSegment = createSerializedModuleToSegmentMap({
    moduleIdToAbsPath: mainRuntime.moduleIdToAbsPath,
    absPathToSegment: mainRuntime.absPathToSegment,
  });
  const backgroundSerializedModuleToSegment =
    createSerializedModuleToSegmentMap({
      moduleIdToAbsPath: backgroundRuntime.moduleIdToAbsPath,
      absPathToSegment: backgroundRuntime.absPathToSegment,
    });
  // For shared segments — modules merged from BOTH runtimes — we must pass
  // runtimeVariants so the rewriter emits per-runtime dispatch literals
  // ({"main":"seg:X","background":null}) for modules whose ownership
  // differs between runtimes. Mirrors the eager-bundle call at line 1065.
  const segmentRuntimeVariants = {
    main: {
      absPathToSegment: mainRuntime.absPathToSegment,
      eagerAbsPaths: mainEagerAbsPaths,
    },
    background: {
      absPathToSegment: backgroundRuntime.absPathToSegment,
      eagerAbsPaths: bgEagerAbsPaths,
    },
  };

  const emitSegment = async ({
    segmentKey,
    runtime,
    segModules,
    graph,
    segmentDeps,
    moduleIdToAbsPath,
    outputDir,
    relativeDir,
    rewriteContext,
  }) => {
    const segmentId = segmentIdMap.get(segmentKey);
    // Mirror the eager-bundle rewrite at line 1065. See REACT-NATIVE-4AX.
    rewriteAsyncRequirePaths(segModules, {
      moduleToSegment: rewriteContext.moduleToSegment,
      moduleIdToAbsPath,
      eagerAbsPaths: rewriteContext.eagerAbsPaths,
      runtimeVariants: rewriteContext.runtimeVariants,
    });
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
    segmentAbsPathsByKey: mainRuntime.segmentAbsPathsByKey,
  });
  const bgSyncDepsAdded = expandSegmentsWithSyncDeps({
    segmentOutputs: backgroundSegmentOutputs,
    serializedEntries: backgroundRuntime.serializedEntries,
    eagerAbsPaths: bgEagerAbsPaths,
    moduleIdToAbsPath: backgroundRuntime.moduleIdToAbsPath,
    segmentAbsPathsByKey: backgroundRuntime.segmentAbsPathsByKey,
  });
  if (mainSyncDepsAdded > 0 || bgSyncDepsAdded > 0) {
    console.log(
      `[unionBuild] Expanded segments with sync deps: main +${mainSyncDepsAdded}, background +${bgSyncDepsAdded}`,
    );
  }

  // Cross-runtime sync-dep rescue. The per-runtime allocator has been
  // observed to miss modules that are sync-required from a segment but
  // whose definition only landed in the OTHER runtime's serialized
  // output (root cause: their absolute path is absent from this runtime's
  // graph.dependencies). Without this pass, those modules become orphan
  // __d-refs that crash as "Requiring unknown module <N>" on first use
  // (see the @ledgerhq bg-segment orphan incident). Because fileToIdMap is
  // a monorepo-wide singleton, it's safe to splice the remote runtime's
  // __d(fn, id, [deps]) code into a local segment without ID translation.
  const mainCrossRuntimeRescue = expandSegmentsWithCrossRuntimeDeps({
    segmentOutputs: mainSegmentOutputs,
    localSerializedEntries: mainRuntime.serializedEntries,
    remoteSerializedEntries: backgroundRuntime.serializedEntries,
    eagerAbsPaths: mainEagerAbsPaths,
    moduleIdToAbsPath: mainRuntime.moduleIdToAbsPath,
    segmentAbsPathsByKey: mainRuntime.segmentAbsPathsByKey,
  });
  const bgCrossRuntimeRescue = expandSegmentsWithCrossRuntimeDeps({
    segmentOutputs: backgroundSegmentOutputs,
    localSerializedEntries: backgroundRuntime.serializedEntries,
    remoteSerializedEntries: mainRuntime.serializedEntries,
    eagerAbsPaths: bgEagerAbsPaths,
    moduleIdToAbsPath: backgroundRuntime.moduleIdToAbsPath,
    segmentAbsPathsByKey: backgroundRuntime.segmentAbsPathsByKey,
  });
  if (
    mainCrossRuntimeRescue.pulledFromRemote > 0 ||
    bgCrossRuntimeRescue.pulledFromRemote > 0 ||
    mainCrossRuntimeRescue.pulledFromLocal > 0 ||
    bgCrossRuntimeRescue.pulledFromLocal > 0
  ) {
    console.log(
      `[unionBuild] Cross-runtime sync-dep rescue: main +${mainCrossRuntimeRescue.pulledFromLocal}(local)+${mainCrossRuntimeRescue.pulledFromRemote}(remote), background +${bgCrossRuntimeRescue.pulledFromLocal}(local)+${bgCrossRuntimeRescue.pulledFromRemote}(remote)`,
    );
  }
  const crossRuntimeMissing = [
    ...mainCrossRuntimeRescue.missingAbsPaths.map((p) => ({
      runtime: 'main',
      absolutePath: p,
    })),
    ...bgCrossRuntimeRescue.missingAbsPaths.map((p) => ({
      runtime: 'background',
      absolutePath: p,
    })),
  ];
  if (crossRuntimeMissing.length > 0) {
    const sample = crossRuntimeMissing
      .slice(0, 20)
      .map(({ runtime, absolutePath }) => `  [${runtime}] ${absolutePath}`)
      .join('\n');
    const extra =
      crossRuntimeMissing.length > 20
        ? `\n  ... and ${crossRuntimeMissing.length - 20} more`
        : '';
    throw new Error(
      [
        `[unionBuild] ${crossRuntimeMissing.length} sync-required module(s) are orphaned:`,
        'referenced by a segment but not serialized by either runtime.',
        'This would crash as "Requiring unknown module <N>" at runtime.',
        'Either add the module to apps/mobile/bundle-groups.config.js, promote',
        'the offending segment, or fix the upstream graph to include the dep.',
        '',
        sample + extra,
      ].join('\n'),
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
        const { mergedSegModules, mergedAbsPaths, mergedModuleIdToAbsPath } =
          mergeSharedSegmentOutputs({
            mainSegModules: mainSegmentOutputs.get(segmentKey),
            backgroundSegModules: backgroundSegmentOutputs.get(segmentKey),
            mainAbsPaths,
            backgroundAbsPaths,
            mainModuleIdToAbsPath: mainRuntime.moduleIdToAbsPath,
            backgroundModuleIdToAbsPath: backgroundRuntime.moduleIdToAbsPath,
          });
        // Union both runtimes' segmentDeps and graphs for this shared entry.
        // After mergeSharedSegmentOutputs pulls bg-only modules in, dependsOn
        // must reflect bg's cross-segment sync edges (otherwise the bg loader
        // won't preload the prerequisite segment and crashes with
        // "Requiring unknown module"); and generateSegmentSourceMap needs
        // graph.dependencies entries for bg-only absolute paths so their
        // source maps aren't silently dropped.
        const mergedSharedDeps = new Map([
          [segmentKey, new Set([...mainDeps, ...backgroundDeps])],
        ]);
        const mergedGraphDependencies = new Map(mainRuntime.graph.dependencies);
        for (const [absPath, moduleData] of backgroundRuntime.graph
          .dependencies) {
          if (!mergedGraphDependencies.has(absPath)) {
            mergedGraphDependencies.set(absPath, moduleData);
          }
        }
        const sharedEntry = await emitSegment({
          segmentKey,
          runtime: 'shared',
          segModules: mergedSegModules,
          graph: {
            ...mainRuntime.graph,
            dependencies: mergedGraphDependencies,
          },
          segmentDeps: mergedSharedDeps,
          moduleIdToAbsPath: mergedModuleIdToAbsPath,
          outputDir: getSegmentsDir('main'),
          relativeDir: 'segments',
          // Shared segment ships into both runtimes — use runtimeVariants
          // so async-require entries dispatch per-runtime where ownership
          // differs (mirrors the eager-bundle pattern at line 1065).
          rewriteContext: {
            runtimeVariants: segmentRuntimeVariants,
          },
        });
        // When the two runtimes' segment-level deps diverge (only possible
        // for forceShared segments — the canShare path above requires
        // setEquals), attach per-runtime override lists so each runtime's
        // loader only preloads deps that are reachable from its own
        // segment graph. Without this, the merged manifest's union
        // dependsOn would reference segments labelled `runtime: 'main'` or
        // `'background'`, and the loader's runtime access check
        // (installProdBundleLoader.ts:184) throws when consulted from the
        // other runtime.
        const perRuntimeDeps = computeSharedPerRuntimeDeps({
          mainDeps,
          backgroundDeps,
          forceShared,
        });
        if (perRuntimeDeps) {
          sharedEntry.mainDependsOn = perRuntimeDeps.mainDependsOn;
          sharedEntry.backgroundDependsOn = perRuntimeDeps.backgroundDependsOn;
        }
        mainManifest.segments[segmentKey] = sharedEntry;
        backgroundManifest.segments[segmentKey] = sharedEntry;
        // Keep the per-runtime report views honest: each reflects exactly
        // the modules that runtime's graph actually reaches. The idMap
        // builder in collectSegmentModules unions both when emitting a
        // shared segment, so readers get the full picture without this
        // bookkeeping having to double-count.
        mainReportSegments.set(segmentKey, mainAbsPaths);
        backgroundReportSegments.set(segmentKey, backgroundAbsPaths);
        setMergedReportSegmentModules(segmentKey, 'shared', mergedAbsPaths);
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
        rewriteContext: {
          moduleToSegment: mainSerializedModuleToSegment,
          eagerAbsPaths: mainEagerAbsPaths,
        },
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
        rewriteContext: {
          moduleToSegment: backgroundSerializedModuleToSegment,
          eagerAbsPaths: bgEagerAbsPaths,
        },
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
        rewriteContext: {
          moduleToSegment: mainSerializedModuleToSegment,
          eagerAbsPaths: mainEagerAbsPaths,
        },
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
      rewriteContext: {
        moduleToSegment: backgroundSerializedModuleToSegment,
        eagerAbsPaths: bgEagerAbsPaths,
      },
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

  // Compile each emitted .seg.js to .seg.hbc via hermesc NOW — before
  // the manifest is finalized / baked into common.bundle — so the sha256
  // field on every manifest entry can be the hash of the actual .seg.hbc
  // bytes that ship to the device. Without this step the sha256 would be
  // the hash of the .seg.js text (what `emitSegment` defaults to), which
  // the native split-bundle-loader (3.0.23+) rejects at load time with
  // "Segment SHA-256 mismatch" because it hashes .seg.hbc at runtime.
  //
  // Hermesc is deterministic given same input + same version, so running
  // it here and again later in build-bundle.js's buildSegments would
  // produce byte-identical .seg.hbc — but we make buildSegments detect
  // the already-compiled file and skip the redundant work to keep total
  // build time the same.
  await compileEmittedSegmentsAndRewriteSha256({
    mainManifest,
    backgroundManifest,
  });

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

  // On EAS Android workers the main + background graphs are held in memory at
  // the same time; with Metro's default worker count (6 on the 8-vCPU `large`
  // class) the peak RSS sits right at the 32 GB ceiling and the build daemon
  // gets OOM-killed intermittently ("Gradle build daemon disappeared"). Cap the
  // transform worker pool so the dual-graph peak has headroom. Android-only so
  // local/iOS bundling keeps full parallelism.
  //
  // EAS detection: PLATFORM is injected by eas.json (base.android.env) and only
  // set on EAS builds; it reaches here because runUnionBuild forwards
  // { ...process.env } to this script (same path that makes UNION_BUILD visible
  // to build.gradle). EAS_BUILD / EAS_BUILD_RUNNER are kept as fallbacks.
  const isEasAndroid =
    process.env.PLATFORM === 'android' ||
    Boolean(process.env.EAS_BUILD) ||
    process.env.EAS_BUILD_RUNNER === 'eas-build';
  if (args.platform === 'android' && isEasAndroid) {
    const cappedWorkers = Number(process.env.UNION_BUILD_MAX_WORKERS) || 2;
    config.maxWorkers = cappedWorkers;
    console.log(
      `Union build: capping Metro maxWorkers=${cappedWorkers} (EAS Android, reduce dual-graph peak memory)`,
    );
  }

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
      const mainOwned = {};
      const bgOwned = {};
      const addFrom = (absPaths, absToId, idToAbs, ownTarget) => {
        if (!absPaths) return;
        for (const absPath of absPaths) {
          const id = absToId.get(absPath);
          if (id !== undefined && idToAbs.get(id)) {
            out[id] = toRelPath(absPath);
            if (ownTarget) ownTarget[id] = toRelPath(absPath);
          }
        }
      };
      // For shared segments we need the UNION of both runtimes' module sets:
      // when a segment like `seg:nm.@onekeyfe` is forced shared but main only
      // reaches 23 of its modules while bg reaches 300+ (transitive deps of
      // @onekeyfe/hwk-ledger-adapter → @ledgerhq/* → inversify / xstate /
      // crypto-js / etc.), the emitted .seg.js carries all 300+ but only
      // main's 23 show up in idMap. That leaves 280+ module IDs referenced
      // by sibling segment __d(... id ...) calls with no idMap entry, which
      // the integrity check flags as orphan_dep. Walk both runtimes'
      // abs-to-id maps so idMap.segments[segKey].modules reflects every
      // module shipped inside the file.
      if (runtime === 'background') {
        addFrom(
          reportSegmentModules.background.get(segKey),
          bgAbsToId,
          backgroundModuleIndex.moduleIdToAbsPath,
          bgOwned,
        );
      } else {
        addFrom(
          reportSegmentModules.main.get(segKey),
          mainAbsToId,
          mainModuleIndex.moduleIdToAbsPath,
          mainOwned,
        );
        // Always also pull bg-only entries for shared segments. Their
        // __d(...) definitions must ship in the shared .seg.js so the bg
        // runtime can execute them, but main runtime will never actually
        // call into them — bg-owned bookkeeping is written alongside so the
        // integrity check can scope its scan to this-runtime-owned modules.
        addFrom(
          reportSegmentModules.background.get(segKey),
          bgAbsToId,
          backgroundModuleIndex.moduleIdToAbsPath,
          bgOwned,
        );
      }
      return { modules: out, mainOwned, bgOwned };
    };
    for (const [segKey, entry] of segmentEntries) {
      const runtime = segmentRuntimeOf(entry);
      const { modules, mainOwned, bgOwned } = collectSegmentModules(
        segKey,
        entry,
      );
      moduleIdMap.segments[segKey] = {
        id: segmentIdOf(entry),
        runtime,
        modules,
        // For shared segments the same .seg.js file carries __d(...) for
        // modules each runtime reaches, but only one side actually calls
        // into them at runtime. Record per-runtime ownership so the
        // integrity check can scope its sync-dep walk to this-runtime's
        // reachable modules — without this, main runtime's scan would
        // traverse bg-only __d(...) (e.g. @ledgerhq/device-management-kit's
        // RxJS requires) and report false orphan_dep for transitive deps
        // that exist only in bg's graph view.
        ...(runtime === 'shared'
          ? {
              mainOwned,
              bgOwned,
            }
          : {}),
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
