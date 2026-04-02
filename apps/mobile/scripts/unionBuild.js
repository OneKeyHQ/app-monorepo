/**
 * Union Graph Build Script
 *
 * Builds a single Metro graph for both main/background entries, then emits:
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

const { computeEntryReachability } = require('../plugins/entryReachability');
const { fileToIdMap } = require('../plugins/map');
const { getSegmentsDir, getManifestPath } = require('../plugins/segmentPaths');
const {
  deriveSegmentKey,
  allocateSegmentIds,
  monorepoRoot,
} = require('../plugins/segmentUtils');
const {
  forbiddenInStartup,
  promotedSegments,
} = require('../bundle-groups.config');

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
  const sorted = segModules.slice().sort((a, b) => a[0] - b[0]);
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
                dep.data && dep.data.data
                  ? dep.data.data.asyncType
                  : undefined;
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
        asyncTypes.every(
          (v) => v === asyncFlag || asyncRoots.has(v),
        )
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

function buildModuleIndexes(graph, createModuleId) {
  const moduleIdToAbsPath = new Map();
  // Use the same createModuleId function as baseJSBundle to ensure
  // moduleId → absolutePath mapping is consistent with the serialized output.
  const getModuleId = createModuleId || ((absPath) => fileToIdMap.get(absPath));
  for (const [absolutePath] of graph.dependencies) {
    moduleIdToAbsPath.set(getModuleId(absolutePath), absolutePath);
  }
  return { moduleIdToAbsPath };
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

function deriveSegmentRuntime(
  segmentKey,
  segmentModules,
  reachability,
  moduleIdToAbsPath,
) {
  const moduleIds = segmentModules.get(segmentKey);
  if (!moduleIds) {
    return 'shared';
  }

  let fromMain = false;
  let fromBg = false;
  for (const moduleId of moduleIds) {
    const absolutePath = moduleIdToAbsPath.get(moduleId);
    if (!absolutePath) {
      continue;
    }
    if (reachability.mainReachable.has(absolutePath)) {
      fromMain = true;
    }
    if (reachability.bgReachable.has(absolutePath)) {
      fromBg = true;
    }
  }

  if (fromMain && fromBg) {
    return 'shared';
  }
  if (fromMain) {
    return 'main';
  }
  if (fromBg) {
    return 'background';
  }
  return 'shared';
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
    .sort();
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
    .sort();
  const estimatedSizeBytes = [...startupModuleIds].reduce((sum, moduleId) => {
    const absolutePath = moduleIdToAbsPath.get(moduleId);
    if (!absolutePath) {
      return sum;
    }
    return sum + estimateModuleSize(graph.dependencies.get(absolutePath));
  }, 0);

  const segments = {};
  for (const [segmentKey, entry] of Object.entries(manifest.segments)) {
    const modIds = segmentModules.get(segmentKey);
    segments[segmentKey] = {
      runtime: entry.runtime,
      moduleCount: modIds ? modIds.size : 0,
      size: entry.size,
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

// Cache the modules array from the first baseJSBundle call.
// baseJSBundle serializes module code via graph.dependencies[].output, which is
// stable across calls. But the `post` section (runBeforeMainModule + entry require)
// differs per entry point, so each call must produce its own `post`.
// We cache `modules` from the first call to guarantee consistent module code.
let _cachedModules = null;
let _cachedPre = null;

async function writeBundle({
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
  const result = baseJSBundle(
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  );

  // Cache modules and pre from the first call (stable across entries).
  // Each entry's `post` is entry-specific — always use the fresh one.
  if (!_cachedModules) {
    _cachedModules = result.modules;
    _cachedPre = result.pre;
  }
  const modules = _cachedModules;
  const pre = _cachedPre;
  const post = result.post;

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

  // For entry-only bundles (includePre=false), the full `post` from baseJSBundle
  // contains polyfill startup __r() calls that already ran in common.bundle.
  // Extract only the LAST __r() call which is the actual entry point require.
  let postSection = '';
  if (includePost) {
    if (includePre) {
      // Common/full bundle: use Metro's original post
      postSection = post;
    } else {
      // Entry-only bundle: extract only the entry module's __r() from Metro's post.
      // Metro's post has: __r(polyfill1);\n__r(polyfill2);\n__r(entryId);\n
      // The last __r() is the actual entry point.
      const rCalls = post.match(/__r\(\d+\)/g);
      if (rCalls && rCalls.length > 0) {
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
  graph,
  modules,
  segmentModules,
  moduleToSegment,
  segmentIdMap,
  segmentDeps,
  reachability,
  moduleIdToAbsPath,
}) {
  const promotedSet = new Set(promotedSegments);

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

  await fs.remove(getSegmentsDir('main'));
  await fs.remove(getSegmentsDir('background'));
  await fs.ensureDir(getSegmentsDir('main'));
  await fs.ensureDir(getSegmentsDir('background'));

  const mainManifest = { segments: {} };
  const backgroundManifest = { segments: {} };

  for (const [segmentKey, segModules] of segmentOutputs) {
    const runtime = deriveSegmentRuntime(
      segmentKey,
      segmentModules,
      reachability,
      moduleIdToAbsPath,
    );
    const segmentId = segmentIdMap.get(segmentKey);
    const { code } = bundleToString({
      pre: '',
      post: '',
      modules: segModules,
    });

    const safeName = segmentKey
      .replace(/^seg:/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const outputDir =
      runtime === 'background'
        ? getSegmentsDir('background')
        : getSegmentsDir('main');
    const relativeDir =
      runtime === 'background' ? 'segments-background' : 'segments';
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
        ? [...segmentDeps.get(segmentKey)].sort()
        : [],
      size: Buffer.byteLength(code),
    };

    if (runtime !== 'background') {
      mainManifest.segments[segmentKey] = entry;
    }
    if (runtime !== 'main') {
      backgroundManifest.segments[segmentKey] = entry;
    }

    console.log(`Segment emitted: ${segmentKey} (${runtime}) -> ${outputPath}`);
  }

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
    promotedSet,
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
    const resolverOptions = {
      customResolverOptions: Object.create(null),
    };
    const transformOptions = {
      customTransformOptions: Object.create(null),
      dev: false,
      minify: false,
      platform: args.platform,
      unstable_transformProfile: 'default',
    };

    console.log('Building unified graph...');
    const startedAt = Date.now();
    const graph = await bundler.buildGraphForEntries(
      [mainEntry, bgEntry],
      transformOptions,
      resolverOptions,
      {
        onProgress: null,
        shallow: false,
        lazy: false,
      },
    );
    console.log(
      `Graph built in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    );
    console.log(`Total modules: ${graph.dependencies.size}`);

    const prepend = await getPrependedScripts(
      config,
      {
        dev: false,
        minify: false,
        platform: args.platform,
        unstable_transformProfile: 'default',
      },
      resolverOptions,
      bundler.getBundler(),
      bundler.getDeltaBundler(),
    );

    const reachability = computeEntryReachability(graph, mainEntry, bgEntry);
    console.log(`Main-only modules: ${reachability.mainOnly.size}`);
    console.log(`BG-only modules:   ${reachability.bgOnly.size}`);
    console.log(`Shared modules:    ${reachability.shared.size}`);

    const { segmentModules, moduleToSegment, segmentAbsPaths, segmentIdMap } =
      buildSegmentAllocation(graph);
    // Use metroServer's createModuleId so moduleIdToAbsPath matches baseJSBundle's IDs
    const createModuleId = metroServer.getCreateModuleId();
    const { moduleIdToAbsPath } = buildModuleIndexes(graph, createModuleId);
    const segmentDeps = buildSegmentDeps(
      graph,
      segmentModules,
      moduleToSegment,
      moduleIdToAbsPath,
    );

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

    const allWrappedModules = baseJSBundle(
      mainEntry,
      prepend,
      graph,
      commonBundleOptions,
    ).modules;

    const { mainManifest, backgroundManifest, promotedSet } =
      await writeSegments({
        graph,
        modules: allWrappedModules,
        segmentModules,
        moduleToSegment,
        segmentIdMap,
        segmentDeps,
        reachability,
        moduleIdToAbsPath,
      });

    // Merge both manifests for the common bundle
    const mergedManifest = {
      segments: {
        ...mainManifest.segments,
        ...backgroundManifest.segments,
      },
    };

    // Common bundle: shared eager modules + polyfills/runtime + manifest
    const commonBundleResult = await writeBundle({
      bundleOutput: args.commonBundleOutput,
      sourceMapOutput: args.commonSourceMapOutput,
      entryPoint: mainEntry,
      moduleFilter: (absolutePath, moduleId) =>
        reachability.shared.has(absolutePath) &&
        !segmentAbsPaths.has(absolutePath),
      manifest: mergedManifest,
      includePre: true,
      includePost: false,
      includeManifest: true,
      graph,
      prepend,
      bundleOptions: commonBundleOptions,
      moduleIdToAbsPath,
    });

    // Main bundle: main-only eager modules + entry require
    const mainBundleResult = await writeBundle({
      bundleOutput: args.mainBundleOutput,
      sourceMapOutput: args.mainSourceMapOutput,
      entryPoint: mainEntry,
      moduleFilter: (absolutePath, moduleId) =>
        reachability.mainOnly.has(absolutePath) &&
        !segmentAbsPaths.has(absolutePath),
      manifest: null,
      includePre: false,
      includePost: true,
      includeManifest: false,
      graph,
      prepend,
      bundleOptions: mainBundleOptions,
      moduleIdToAbsPath,
    });

    // Background bundle: bg-only eager modules + entry require
    const backgroundBundleResult = await writeBundle({
      bundleOutput: args.backgroundBundleOutput,
      sourceMapOutput: args.backgroundSourceMapOutput,
      entryPoint: bgEntry,
      moduleFilter: (absolutePath, moduleId) =>
        reachability.bgOnly.has(absolutePath) &&
        !segmentAbsPaths.has(absolutePath),
      manifest: null,
      includePre: false,
      includePost: true,
      includeManifest: false,
      graph,
      prepend,
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
          graph,
          moduleIdToAbsPath,
          segmentModules,
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
          graph,
          moduleIdToAbsPath,
          segmentModules,
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
          graph,
          moduleIdToAbsPath,
          segmentModules,
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
          totalModules: graph.dependencies.size,
          mainOnly: reachability.mainOnly.size,
          bgOnly: reachability.bgOnly.size,
          shared: reachability.shared.size,
          estimatedDuplicateModules: reachability.shared.size,
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
      graph.dependencies,
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
    await metroServer.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
