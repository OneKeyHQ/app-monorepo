/* eslint-disable onekey/no-raw-error, no-continue, no-plusplus */
/* cspell:words prebundle */
const { spawnSync } = require('child_process');
const path = require('path');

const fs = require('fs-extra');
const Metro = require('metro');
const { loadConfig } = require('metro-config');

const devVendorConfig = require('../dev-vendor.config');
const {
  computeConfigInputsDigest,
  computeFingerprint,
  computeModulesDigest,
  computeNativeContractKey,
  getManifestPath,
  getPlatformOutputDirectory,
  sha256,
  verifyManifest,
} = require('../plugins/devVendor');
const {
  compareModuleKeys,
  loadRegistry,
  REPO_ROOT,
  toModuleKey,
} = require('../plugins/moduleIdRegistry');

const {
  restorePlatformFromRelease,
  verifyAndReplaceDirectory,
} = require('./metro-dev-prebundle');
const {
  updateRegistryFromModulePaths,
  writeRegistry,
} = require('./module-id-registry');
const { buildModuleSignature } = require('./unionBuildHelpers');

const metroRoot = path.resolve(__dirname, '../../../node_modules/metro/src');
const baseJSBundle = require(
  path.join(metroRoot, 'DeltaBundler/Serializers/baseJSBundle'),
).default;
const bundleToString = require(
  path.join(metroRoot, 'lib/bundleToString'),
).default;
const getPrependedScripts = require(
  path.join(metroRoot, 'lib/getPrependedScripts'),
).default;

const mobileDirPath = path.resolve(__dirname, '..');
const mainEntry = path.resolve(mobileDirPath, 'index.ts');
const backgroundEntry = path.resolve(mobileDirPath, 'background.ts');
const HERMES_PLATFORM_DIR = {
  darwin: 'osx-bin',
  linux: 'linux64-bin',
  win32: 'win64-bin',
}[process.platform];
if (!HERMES_PLATFORM_DIR) {
  throw new Error(
    `[devVendor] Unsupported Hermes compiler platform: ${process.platform}`,
  );
}
const HERMES_COMMAND = path.join(
  path.dirname(require.resolve('hermes-compiler/package.json')),
  'hermesc',
  HERMES_PLATFORM_DIR,
  process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
);

function ensureBuildEnvironment() {
  devVendorConfig.applyTransformationEnvironment(process.env);
  process.env.ONEKEY_MODULE_ID_REGISTRY_STRICT = 'true';
  delete process.env.ONEKEY_DEV_VENDOR;
}

function parseArgs(argv = process.argv.slice(2)) {
  const readArg = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const platform = readArg('platform') || 'ios';
  if (!['android', 'ios', 'all'].includes(platform)) {
    throw new Error(
      `[devVendor] --platform must be android, ios, or all; received ${platform}`,
    );
  }
  const check = argv.includes('--check');
  const prepare = argv.includes('--prepare');
  const registryUpdate = argv.includes('--update-registry');
  if ([check, prepare, registryUpdate].filter(Boolean).length > 1) {
    throw new Error(
      '[devVendor] --check, --prepare, and --update-registry cannot be used together.',
    );
  }
  return {
    check,
    platforms: platform === 'all' ? ['ios', 'android'] : [platform],
    prepare,
    registryUpdate,
  };
}

function addObservedModulePaths(observedModulePaths, graph, prepend) {
  for (const absolutePath of graph.dependencies.keys()) {
    observedModulePaths.add(absolutePath);
  }
  for (const moduleData of prepend) {
    observedModulePaths.add(moduleData.path);
  }
}

function isJsModule(moduleData) {
  return Boolean(
    moduleData?.output?.some(({ type }) =>
      typeof type === 'string' ? type.startsWith('js/') : false,
    ),
  );
}

function hasAsyncDependency(moduleData) {
  return [...moduleData.dependencies.values()].some(
    (dependency) => dependency.data?.data?.asyncType === 'async',
  );
}

function selectClosedVendorModules({
  backgroundSignatures,
  mainGraph,
  isVendorModule = devVendorConfig.isVendorModule,
  repoRoot = REPO_ROOT,
}) {
  const selected = new Set();
  for (const [absolutePath, moduleData] of mainGraph.dependencies) {
    let moduleKey;
    try {
      moduleKey = toModuleKey(absolutePath, repoRoot);
    } catch {
      continue;
    }
    if (
      isVendorModule(moduleKey) &&
      isJsModule(moduleData) &&
      !hasAsyncDependency(moduleData) &&
      backgroundSignatures.get(absolutePath) ===
        buildModuleSignature(moduleData)
    ) {
      selected.add(absolutePath);
    }
  }

  let removedInPass = true;
  while (removedInPass) {
    removedInPass = false;
    for (const absolutePath of selected) {
      const moduleData = mainGraph.dependencies.get(absolutePath);
      const hasExternalSyncDependency = [
        ...moduleData.dependencies.values(),
      ].some(
        (dependency) =>
          dependency.data?.data?.asyncType !== 'async' &&
          !selected.has(dependency.absolutePath),
      );
      if (hasExternalSyncDependency) {
        selected.delete(absolutePath);
        removedInPass = true;
      }
    }
  }
  return selected;
}

function createResolverOptions(runtimeTarget) {
  const customResolverOptions = Object.create(null);
  customResolverOptions.runtimeTarget = runtimeTarget;
  return { customResolverOptions };
}

function createTransformOptions(platform) {
  return {
    customTransformOptions: Object.create(null),
    dev: true,
    minify: false,
    platform,
    unstable_transformProfile: 'hermes-stable',
  };
}

async function getPrepend({ bundler, config, platform, resolverOptions }) {
  return getPrependedScripts(
    config,
    createTransformOptions(platform),
    resolverOptions,
    bundler.getBundler(),
    bundler.getDeltaBundler(),
  );
}

function getPrependSignature(prepend) {
  return prepend.map((moduleData) => ({
    path: moduleData.path,
    signature: buildModuleSignature(moduleData),
  }));
}

function assertEquivalentPrepends(mainPrepend, backgroundPrependSignature) {
  const mainSignature = getPrependSignature(mainPrepend);
  if (
    JSON.stringify(mainSignature) !== JSON.stringify(backgroundPrependSignature)
  ) {
    throw new Error(
      '[devVendor] Main/background Metro prepends differ. A single common runtime prelude is unsafe.',
    );
  }
}

function createCommonModuleFilter({ prepend, selectedModules }) {
  const prependPaths = new Set(prepend.map((moduleData) => moduleData.path));
  return (modulePath) =>
    selectedModules.has(modulePath) || prependPaths.has(modulePath);
}

function createBundleOptions({
  config,
  createModuleId,
  moduleFilter,
  runBeforeMainModule,
}) {
  const asyncRequireModulePath = path.isAbsolute(
    config.transformer.asyncRequireModulePath,
  )
    ? config.transformer.asyncRequireModulePath
    : require.resolve(config.transformer.asyncRequireModulePath, {
        paths: [
          config.projectRoot,
          path.join(config.projectRoot, 'node_modules'),
        ],
      });
  return {
    asyncRequireModulePath,
    createModuleId,
    dev: true,
    getRunModuleStatement: config.serializer.getRunModuleStatement,
    getSourceUrl: (moduleData) => moduleData.path,
    globalPrefix: config.transformer.globalPrefix,
    includeAsyncPaths: false,
    inlineSourceMap: false,
    modulesOnly: false,
    processModuleFilter: (moduleData) => moduleFilter(moduleData.path),
    projectRoot: config.projectRoot,
    runBeforeMainModule,
    runModule: false,
    serverRoot: config.server.unstable_serverRoot || config.projectRoot,
    shouldAddToIgnoreList: () => false,
    sourceMapUrl: null,
    sourceUrl: 'onekey-dev-vendor://common.bundle?dev=true',
  };
}

function buildRunBeforePost({
  config,
  createModuleId,
  runBeforeMainModule,
  selectedModules,
}) {
  const missing = runBeforeMainModule.filter(
    (modulePath) => !selectedModules.has(modulePath),
  );
  if (missing.length > 0) {
    throw new Error(
      `[devVendor] Metro startup module is not in the closed common set:\n${missing
        .map((modulePath) => `- ${modulePath}`)
        .join('\n')}`,
    );
  }
  return runBeforeMainModule
    .map((modulePath) =>
      config.serializer.getRunModuleStatement(
        createModuleId(modulePath),
        config.transformer.globalPrefix,
      ),
    )
    .join('\n');
}

function compileHermes({ inputPath, outputPath }) {
  const result = spawnSync(
    HERMES_COMMAND,
    ['-O', '-emit-binary', `-out=${outputPath}`, inputPath],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(
      `[devVendor] hermesc failed with exit code ${String(result.status)}.`,
    );
  }
}

function createModuleRecords(selectedModules, registry) {
  return [...selectedModules]
    .map((absolutePath) => {
      const moduleKey = toModuleKey(absolutePath);
      const moduleId = registry.modules[moduleKey];
      if (!Number.isSafeInteger(moduleId) || moduleId <= 0) {
        throw new Error(
          `[devVendor] Common module has no stable registry ID: ${moduleKey}. Run \`yarn workspace @onekeyhq/mobile dev-vendor:registry:update\`, review and commit the registry, then retry the build.`,
        );
      }
      return { id: moduleId, path: moduleKey };
    })
    .toSorted((left, right) => compareModuleKeys(left.path, right.path));
}

async function writePlatformOutput({
  backgroundModuleCount,
  config,
  graph,
  mainModuleCount,
  metroServer,
  platform,
  prepend,
  selectedModules,
}) {
  const registry = loadRegistry();
  const moduleRecords = createModuleRecords(selectedModules, registry);
  const prependModules = createModuleRecords(
    new Set(prepend.map((moduleData) => moduleData.path)),
    registry,
  );
  const configInputsDigest = computeConfigInputsDigest();
  const modulesDigest = computeModulesDigest(moduleRecords);
  const fingerprintFields = {
    schemaVersion: devVendorConfig.SCHEMA_VERSION,
    strategyVersion: devVendorConfig.STRATEGY_VERSION,
    platform,
    registryEpoch: registry.registryEpoch,
    configInputsDigest,
    nativeContractKey: computeNativeContractKey(platform),
    modulesDigest,
    modules: moduleRecords,
    prependModules,
  };
  const fingerprint = computeFingerprint(fingerprintFields);
  const outputDirectory = getPlatformOutputDirectory(mobileDirPath, platform);
  const temporaryDirectory = `${outputDirectory}.tmp-${process.pid}`;
  await fs.remove(temporaryDirectory);
  await fs.ensureDir(path.join(temporaryDirectory, 'stubs'));

  for (const moduleRecord of moduleRecords) {
    await fs.writeFile(
      path.join(temporaryDirectory, 'stubs', `${moduleRecord.id}.js`),
      '',
    );
  }

  const createModuleId = metroServer.getCreateModuleId();
  const runBeforeMainModule = config.serializer.getModulesRunBeforeMainModule(
    path.relative(config.projectRoot, mainEntry),
  );
  const bundleOptions = createBundleOptions({
    config,
    createModuleId,
    moduleFilter: createCommonModuleFilter({ prepend, selectedModules }),
    runBeforeMainModule,
  });
  const bundleParts = baseJSBundle(mainEntry, prepend, graph, bundleOptions);
  const runBeforePost = buildRunBeforePost({
    config,
    createModuleId,
    runBeforeMainModule,
    selectedModules,
  });
  const marker = `globalThis.__ONEKEY_DEV_VENDOR_FINGERPRINT__=${JSON.stringify(fingerprint)};`;
  const commonBundle = bundleToString({
    ...bundleParts,
    pre: `${bundleParts.pre}\n${marker}`,
    post: runBeforePost,
  }).code;

  const commonSourcePath = path.join(
    temporaryDirectory,
    devVendorConfig.commonSourceName,
  );
  const commonBytecodePath = path.join(
    temporaryDirectory,
    devVendorConfig.commonBytecodeName,
  );
  await fs.writeFile(commonSourcePath, commonBundle);
  compileHermes({
    inputPath: commonSourcePath,
    outputPath: commonBytecodePath,
  });

  const sourceBytes = await fs.readFile(commonSourcePath);
  const bytecodeBytes = await fs.readFile(commonBytecodePath);
  const manifest = {
    ...fingerprintFields,
    fingerprint,
    common: {
      moduleCount: moduleRecords.length,
      prependModuleCount: prependModules.length,
      source: {
        file: devVendorConfig.commonSourceName,
        bytes: sourceBytes.length,
        sha256: sha256(sourceBytes),
      },
      bytecode: {
        file: devVendorConfig.commonBytecodeName,
        bytes: bytecodeBytes.length,
        sha256: sha256(bytecodeBytes),
      },
    },
    baseline: {
      backgroundGraphModules: backgroundModuleCount,
      mainGraphModules: mainModuleCount,
    },
  };
  await fs.writeFile(
    path.join(temporaryDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  await verifyAndReplaceDirectory({
    outputDirectory,
    temporaryDirectory,
    verifyTemporaryDirectory: async (artifactDirectory) =>
      verifyManifest({
        artifactDirectory,
        manifest: await fs.readJson(
          path.join(artifactDirectory, 'manifest.json'),
        ),
        platform,
        projectRoot: mobileDirPath,
      }),
  });
  console.log(
    `[devVendor] built platform=${platform} fingerprint=${fingerprint} commonModules=${moduleRecords.length} commonJsBytes=${sourceBytes.length} commonHbcBytes=${bytecodeBytes.length} mainGraph=${mainModuleCount} backgroundGraph=${backgroundModuleCount}`,
  );
}

async function buildPlatform(platform, { writeOutput = true } = {}) {
  console.log(`[devVendor] building platform=${platform}`);
  const config = await loadConfig({ cwd: mobileDirPath });
  config.cacheVersion = `${config.cacheVersion || 'default'}:dev-vendor-build-v1`;
  const metroServer = await Metro.runMetro(config, { watch: false });
  try {
    const bundler = metroServer.getBundler();
    const transformOptions = createTransformOptions(platform);
    const backgroundResolverOptions = createResolverOptions('background');
    const mainResolverOptions = createResolverOptions('main');

    const backgroundStartedAt = Date.now();
    let backgroundGraph = await bundler.buildGraphForEntries(
      [backgroundEntry],
      transformOptions,
      backgroundResolverOptions,
      { lazy: false, onProgress: null, shallow: false },
    );
    const backgroundModuleCount = backgroundGraph.dependencies.size;
    const observedModulePaths = new Set();
    const backgroundSignatures = new Map(
      [...backgroundGraph.dependencies].map(([absolutePath, moduleData]) => [
        absolutePath,
        buildModuleSignature(moduleData),
      ]),
    );
    const backgroundPrepend = await getPrepend({
      bundler,
      config,
      platform,
      resolverOptions: backgroundResolverOptions,
    });
    const backgroundPrependSignature = getPrependSignature(backgroundPrepend);
    addObservedModulePaths(
      observedModulePaths,
      backgroundGraph,
      backgroundPrepend,
    );
    console.log(
      `[devVendor] background graph modules=${backgroundModuleCount} durationMs=${Date.now() - backgroundStartedAt}`,
    );
    backgroundGraph = null;
    if (globalThis.gc) globalThis.gc();

    const mainStartedAt = Date.now();
    const mainGraph = await bundler.buildGraphForEntries(
      [mainEntry],
      transformOptions,
      mainResolverOptions,
      { lazy: false, onProgress: null, shallow: false },
    );
    const mainModuleCount = mainGraph.dependencies.size;
    const mainPrepend = await getPrepend({
      bundler,
      config,
      platform,
      resolverOptions: mainResolverOptions,
    });
    assertEquivalentPrepends(mainPrepend, backgroundPrependSignature);
    addObservedModulePaths(observedModulePaths, mainGraph, mainPrepend);
    const selectedModules = selectClosedVendorModules({
      backgroundSignatures,
      mainGraph,
    });
    console.log(
      `[devVendor] main graph modules=${mainModuleCount} durationMs=${Date.now() - mainStartedAt} closedCommonModules=${selectedModules.size}`,
    );
    if (selectedModules.size === 0) {
      throw new Error('[devVendor] Closed common module set is empty.');
    }
    if (writeOutput) {
      await writePlatformOutput({
        backgroundModuleCount,
        config,
        graph: mainGraph,
        mainModuleCount,
        metroServer,
        platform,
        prepend: mainPrepend,
        selectedModules,
      });
    }
    return observedModulePaths;
  } finally {
    metroServer.end();
  }
}

function checkPlatform(platform) {
  const manifestPath = getManifestPath(mobileDirPath, platform);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[devVendor] Missing manifest: ${manifestPath}`);
  }
  const manifest = verifyManifest({
    manifest: fs.readJsonSync(manifestPath),
    platform,
    projectRoot: mobileDirPath,
  });
  console.log(
    `[devVendor] check passed platform=${platform} fingerprint=${manifest.fingerprint} modules=${manifest.modules.length} commonJsBytes=${manifest.common.source.bytes} commonHbcBytes=${manifest.common.bytecode.bytes}`,
  );
}

async function preparePlatform(
  platform,
  {
    build = (targetPlatform) =>
      buildPlatform(targetPlatform, { writeOutput: true }),
    check = checkPlatform,
    restore = (targetPlatform) =>
      restorePlatformFromRelease({
        platform: targetPlatform,
        projectRoot: mobileDirPath,
      }),
    onFallback,
    source = 'auto',
  } = {},
) {
  if (!['auto', 'local', 'remote'].includes(source)) {
    throw new Error(`[devVendor] Invalid prepare source: ${source}.`);
  }
  if (source === 'local') {
    await build(platform);
    check(platform);
    return { fallback: false, source: 'local-build' };
  }

  let localCacheReason;
  if (source === 'auto') {
    try {
      check(platform);
      return { fallback: false, source: 'local-cache' };
    } catch (error) {
      localCacheReason = error instanceof Error ? error.message : String(error);
      console.warn(
        `[devVendor] local cache unavailable platform=${platform} reason=${localCacheReason}`,
      );
    }
  }

  let remoteReason;
  try {
    const restored = await restore(platform);
    check(platform);
    console.log(
      `[devVendor] restored public prebundle platform=${platform} tag=${restored?.tagName || 'unknown'}`,
    );
    return { fallback: false, source: 'remote', tag: restored?.tagName };
  } catch (error) {
    remoteReason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[devVendor] public prebundle unavailable platform=${platform} reason=${remoteReason}`,
    );
    if (source === 'remote') throw error;
  }

  await onFallback?.({ reason: remoteReason, resource: 'vendor' });
  try {
    await build(platform);
    check(platform);
  } catch (error) {
    console.error(`[devVendor] Prepare failed for platform=${platform}.`);
    throw error;
  }
  return {
    fallback: true,
    fallbackReason: remoteReason,
    localCacheReason,
    source: 'local-build',
  };
}

async function main() {
  ensureBuildEnvironment();
  const args = parseArgs();
  const observedModulePaths = new Set();
  for (const platform of args.platforms) {
    if (args.check) {
      checkPlatform(platform);
    } else if (args.prepare) {
      await preparePlatform(platform);
    } else {
      const platformModulePaths = await buildPlatform(platform, {
        writeOutput: !args.registryUpdate,
      });
      for (const modulePath of platformModulePaths) {
        observedModulePaths.add(modulePath);
      }
      if (globalThis.gc) globalThis.gc();
    }
  }
  if (args.registryUpdate) {
    const result = updateRegistryFromModulePaths(
      loadRegistry(),
      observedModulePaths,
    );
    writeRegistry(result.registry);
    console.log(
      `[devVendor] registry updated observedModules=${observedModulePaths.size} activeModules=${Object.keys(result.registry.modules).length} added=${result.added}. Review and commit apps/mobile/bundle-registry/module-id-registry.json, then run the strict dev-vendor build.`,
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  addObservedModulePaths,
  createCommonModuleFilter,
  hasAsyncDependency,
  isJsModule,
  parseArgs,
  preparePlatform,
  createModuleRecords,
  selectClosedVendorModules,
  verifyAndReplaceDirectory,
};
