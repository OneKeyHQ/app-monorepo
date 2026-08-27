/* eslint-disable onekey/no-raw-error, no-continue, no-plusplus */
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
  getManifestPath,
  getPlatformOutputDirectory,
  sha256,
  verifyManifest,
} = require('../plugins/devVendor');
const {
  loadRegistry,
  REPO_ROOT,
  toModuleKey,
} = require('../plugins/moduleIdRegistry');

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
const { sourceMapStringNonBlocking } = require(
  path.join(metroRoot, 'DeltaBundler/Serializers/sourceMapString'),
);

const mobileDirPath = path.resolve(__dirname, '..');
const mainEntry = path.resolve(mobileDirPath, 'index.ts');
const backgroundEntry = path.resolve(mobileDirPath, 'background.ts');
const HERMES_PLATFORM_DIR =
  process.platform === 'linux' ? 'linux64-bin' : 'osx-bin';
const HERMES_COMMAND = path.join(
  path.dirname(require.resolve('hermes-compiler/package.json')),
  'hermesc',
  HERMES_PLATFORM_DIR,
  'hermesc',
);

function ensureBuildEnvironment() {
  process.env.NODE_ENV = 'development';
  process.env.BABEL_ENV = 'development';
  process.env.ONEKEY_PLATFORM = process.env.ONEKEY_PLATFORM || 'app';
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
  return {
    check: argv.includes('--check'),
    platforms: platform === 'all' ? ['ios', 'android'] : [platform],
  };
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
    [
      '-O',
      '-emit-binary',
      '-output-source-map',
      `-out=${outputPath}`,
      inputPath,
    ],
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
          `[devVendor] Common module has no stable registry ID: ${moduleKey}`,
        );
      }
      return { id: moduleId, path: moduleKey };
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

async function replaceDirectoryAtomically({
  outputDirectory,
  temporaryDirectory,
}) {
  const backupDirectory = `${outputDirectory}.previous-${process.pid}`;
  await fs.remove(backupDirectory);
  const hadPreviousOutput = await fs.pathExists(outputDirectory);
  if (hadPreviousOutput) {
    await fs.rename(outputDirectory, backupDirectory);
  }
  try {
    await fs.rename(temporaryDirectory, outputDirectory);
  } catch (error) {
    if (hadPreviousOutput && (await fs.pathExists(backupDirectory))) {
      await fs.rename(backupDirectory, outputDirectory);
    }
    throw error;
  }
  if (hadPreviousOutput) {
    await fs.remove(backupDirectory);
  }
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
  const configInputsDigest = computeConfigInputsDigest();
  const modulesDigest = computeModulesDigest(moduleRecords);
  const fingerprintFields = {
    schemaVersion: devVendorConfig.SCHEMA_VERSION,
    strategyVersion: devVendorConfig.STRATEGY_VERSION,
    platform,
    registryEpoch: registry.registryEpoch,
    configInputsDigest,
    modulesDigest,
    modules: moduleRecords,
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
    moduleFilter: (absolutePath) => selectedModules.has(absolutePath),
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

  const selectedGraphModules = [...selectedModules]
    .map((absolutePath) => graph.dependencies.get(absolutePath))
    .filter(Boolean);
  const sourceMap = await sourceMapStringNonBlocking(
    [...prepend, ...selectedGraphModules],
    {
      excludeSource: false,
      getSourceUrl: (moduleData) => moduleData.path,
      processModuleFilter: () => true,
      shouldAddToIgnoreList: () => false,
    },
  );

  const commonSourcePath = path.join(
    temporaryDirectory,
    devVendorConfig.commonSourceName,
  );
  const commonSourceMapPath = path.join(
    temporaryDirectory,
    devVendorConfig.commonSourceMapName,
  );
  const commonBytecodePath = path.join(
    temporaryDirectory,
    devVendorConfig.commonBytecodeName,
  );
  await fs.writeFile(commonSourcePath, commonBundle);
  await fs.writeFile(commonSourceMapPath, sourceMap);
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
      prependModuleCount: prepend.length,
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
      sourceMap: {
        file: devVendorConfig.commonSourceMapName,
        bytes: Buffer.byteLength(sourceMap),
        sha256: sha256(sourceMap),
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

  await replaceDirectoryAtomically({ outputDirectory, temporaryDirectory });
  verifyManifest({ manifest, platform, projectRoot: mobileDirPath });
  console.log(
    `[devVendor] built platform=${platform} fingerprint=${fingerprint} commonModules=${moduleRecords.length} commonJsBytes=${sourceBytes.length} commonHbcBytes=${bytecodeBytes.length} mainGraph=${mainModuleCount} backgroundGraph=${backgroundModuleCount}`,
  );
}

async function buildPlatform(platform) {
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

async function main() {
  ensureBuildEnvironment();
  const args = parseArgs();
  for (const platform of args.platforms) {
    if (args.check) {
      checkPlatform(platform);
    } else {
      await buildPlatform(platform);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  hasAsyncDependency,
  isJsModule,
  parseArgs,
  selectClosedVendorModules,
};
