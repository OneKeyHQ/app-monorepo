/* eslint-disable onekey/no-raw-error */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const metroRoot = path.resolve(__dirname, '../../../node_modules/metro/src');
const baseJSBundle = require(
  path.join(metroRoot, 'DeltaBundler/Serializers/baseJSBundle'),
).default;
const bundleToString = require(
  path.join(metroRoot, 'lib/bundleToString'),
).default;

const devVendorConfig = require('../dev-vendor.config');

const {
  REPO_ROOT,
  compareModuleKeys,
  getModuleIdDomain,
  loadRegistry,
} = require('./moduleIdRegistry');

const MANIFEST_NAME = 'manifest.json';
const SUPPORTED_PLATFORMS = new Set(['android', 'ios']);
const SUPPORTED_RUNTIME_TARGETS = new Set(['main', 'background']);
const runtimeCache = new Map();

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isDevVendorEnabled(env = process.env) {
  return env.ONEKEY_DEV_VENDOR === 'true';
}

function listDirectoryFiles(repoRoot, relativeDirectory) {
  const absoluteDirectory = path.resolve(repoRoot, relativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) {
    return [];
  }
  const pending = [absoluteDirectory];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
      } else if (entry.isFile()) {
        files.push(
          path.relative(repoRoot, absolutePath).split(path.sep).join('/'),
        );
      }
    }
  }
  return files.toSorted();
}

function getFingerprintInputPaths(repoRoot = REPO_ROOT) {
  return [
    ...devVendorConfig.fingerprintFiles,
    ...devVendorConfig.fingerprintOptionalFiles.filter((relativePath) =>
      fs.existsSync(path.resolve(repoRoot, relativePath)),
    ),
    ...devVendorConfig.fingerprintDirectories.flatMap((relativeDirectory) =>
      listDirectoryFiles(repoRoot, relativeDirectory),
    ),
  ].toSorted();
}

function hashRepoFiles(relativePaths, repoRoot = REPO_ROOT) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `[devVendor] Fingerprint input is missing: ${relativePath}`,
      );
    }
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(absolutePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function computeRegistryInputsDigest(registry = loadRegistry()) {
  const selectRelevantEntries = (entries) =>
    Object.entries(entries)
      .filter(([moduleKey]) =>
        ['nodeModules', 'virtual'].includes(getModuleIdDomain(moduleKey)),
      )
      .toSorted(([first], [second]) => compareModuleKeys(first, second));

  return sha256(
    JSON.stringify({
      allocationVersion: registry.allocationVersion,
      modules: selectRelevantEntries(registry.modules),
      ranges: registry.ranges,
      registryEpoch: registry.registryEpoch,
      tombstones: selectRelevantEntries(registry.tombstones),
    }),
  );
}

function computeConfigInputsDigest(
  repoRoot = REPO_ROOT,
  env = process.env,
  registry = loadRegistry(),
) {
  return sha256(
    JSON.stringify({
      files: hashRepoFiles(getFingerprintInputPaths(repoRoot), repoRoot),
      registry: computeRegistryInputsDigest(registry),
      transformationEnvironment:
        devVendorConfig.getTransformationEnvironment(env),
    }),
  );
}

function computeReleaseCompatibilityKey(
  repoRoot = REPO_ROOT,
  env = process.env,
  registry = loadRegistry(),
) {
  return sha256(
    JSON.stringify({
      configInputsDigest: computeConfigInputsDigest(repoRoot, env, registry),
      registryEpoch: registry.registryEpoch,
      schemaVersion: devVendorConfig.SCHEMA_VERSION,
      strategyVersion: devVendorConfig.STRATEGY_VERSION,
    }),
  );
}

function getReleaseTag(repoRoot = REPO_ROOT, env = process.env) {
  return `${devVendorConfig.releaseTagPrefix}-${computeReleaseCompatibilityKey(
    repoRoot,
    env,
  )}`;
}

function computeModulesDigest(modules, repoRoot = REPO_ROOT) {
  const hash = crypto.createHash('sha256');
  for (const moduleRecord of modules) {
    const absolutePath = path.resolve(repoRoot, moduleRecord.path);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `[devVendor] Common module is missing: ${moduleRecord.path}`,
      );
    }
    const sourceSha256 = sha256(fs.readFileSync(absolutePath));
    hash.update(moduleRecord.path);
    hash.update('\0');
    hash.update(String(moduleRecord.id));
    hash.update('\0');
    hash.update(sourceSha256);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function computeFingerprint(manifestFields) {
  return sha256(
    JSON.stringify({
      schemaVersion: manifestFields.schemaVersion,
      strategyVersion: manifestFields.strategyVersion,
      platform: manifestFields.platform,
      registryEpoch: manifestFields.registryEpoch,
      configInputsDigest: manifestFields.configInputsDigest,
      modulesDigest: manifestFields.modulesDigest,
      modules: manifestFields.modules.map(({ id, path: modulePath }) => ({
        id,
        path: modulePath,
      })),
    }),
  );
}

function getPlatformOutputDirectory(projectRoot, platform) {
  return path.join(devVendorConfig.outputRoot(projectRoot), platform);
}

function getManifestPath(projectRoot, platform) {
  return path.join(
    getPlatformOutputDirectory(projectRoot, platform),
    MANIFEST_NAME,
  );
}

function getStubRoot(projectRoot, platform) {
  return path.join(getPlatformOutputDirectory(projectRoot, platform), 'stubs');
}

function getStubPath(projectRoot, platform, moduleId) {
  return path.join(getStubRoot(projectRoot, platform), `${moduleId}.js`);
}

function getRuntimeCacheKey(projectRoot, platform, repoRoot = REPO_ROOT) {
  return `${path.resolve(projectRoot)}:${platform}:${path.resolve(repoRoot)}`;
}

function getFileIdentity(filePath) {
  const stat = fs.statSync(filePath, { bigint: true });
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
}

function captureFileIdentities(filePaths) {
  return new Map(
    filePaths.map((filePath) => [filePath, getFileIdentity(filePath)]),
  );
}

function fileIdentitiesMatch(fileIdentities) {
  try {
    return [...fileIdentities].every(
      ([filePath, identity]) => getFileIdentity(filePath) === identity,
    );
  } catch {
    return false;
  }
}

function isPathInsideDirectory(filePath, directoryPath) {
  const relativePath = path.relative(directoryPath, filePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function getDevVendorStubInfo(filePath, projectRoot) {
  const outputRoot = path.resolve(devVendorConfig.outputRoot(projectRoot));
  const relativePath = path.relative(outputRoot, path.resolve(filePath));
  if (
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return undefined;
  }
  const match = relativePath.match(/^(android|ios)[\\/]stubs[\\/](\d+)\.js$/);
  if (!match) {
    return undefined;
  }
  const moduleId = Number(match[2]);
  return Number.isSafeInteger(moduleId) && moduleId > 0
    ? { moduleId, platform: match[1] }
    : undefined;
}

function getDevVendorStubModuleId(filePath, projectRoot) {
  return getDevVendorStubInfo(filePath, projectRoot)?.moduleId;
}

function assertSortedUniqueModules(modules) {
  const paths = modules.map((moduleRecord) => moduleRecord.path);
  const sortedPaths = paths.toSorted(compareModuleKeys);
  if (paths.some((modulePath, index) => modulePath !== sortedPaths[index])) {
    throw new Error('[devVendor] Manifest modules must be sorted by path.');
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error('[devVendor] Manifest contains duplicate module paths.');
  }
  const ids = modules.map((moduleRecord) => moduleRecord.id);
  if (
    ids.some((moduleId) => !Number.isSafeInteger(moduleId) || moduleId <= 0)
  ) {
    throw new Error('[devVendor] Manifest contains an invalid module ID.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('[devVendor] Manifest contains duplicate module IDs.');
  }
}

function verifyManifest({
  artifactDirectory,
  manifest,
  platform,
  projectRoot,
  repoRoot = REPO_ROOT,
}) {
  if (manifest.schemaVersion !== devVendorConfig.SCHEMA_VERSION) {
    throw new Error(
      `[devVendor] Unsupported manifest schema ${String(manifest.schemaVersion)}. Rebuild the dev vendor cache.`,
    );
  }
  if (manifest.strategyVersion !== devVendorConfig.STRATEGY_VERSION) {
    throw new Error(
      `[devVendor] Unsupported strategy ${String(manifest.strategyVersion)}. Rebuild the dev vendor cache.`,
    );
  }
  if (manifest.platform !== platform) {
    throw new Error(
      `[devVendor] Manifest platform ${String(manifest.platform)} does not match ${platform}.`,
    );
  }
  if (!Array.isArray(manifest.modules)) {
    throw new Error('[devVendor] Manifest modules must be an array.');
  }
  assertSortedUniqueModules(manifest.modules);

  const registry = loadRegistry();
  if (manifest.registryEpoch !== registry.registryEpoch) {
    throw new Error(
      `[devVendor] Registry epoch mismatch for ${platform}. Rebuild the dev vendor cache.`,
    );
  }
  for (const moduleRecord of manifest.modules) {
    if (registry.modules[moduleRecord.path] !== moduleRecord.id) {
      throw new Error(
        `[devVendor] Stable module ID mismatch for ${moduleRecord.path}. Rebuild the dev vendor cache.`,
      );
    }
  }

  const configInputsDigest = computeConfigInputsDigest(repoRoot);
  if (manifest.configInputsDigest !== configInputsDigest) {
    throw new Error(
      `[devVendor] Build configuration changed for ${platform}. Run the dev-vendor build again.`,
    );
  }
  const modulesDigest = computeModulesDigest(manifest.modules, repoRoot);
  if (manifest.modulesDigest !== modulesDigest) {
    throw new Error(
      `[devVendor] Common module sources changed for ${platform}. Run the dev-vendor build again.`,
    );
  }
  const fingerprint = computeFingerprint({
    ...manifest,
    configInputsDigest,
    modulesDigest,
  });
  if (manifest.fingerprint !== fingerprint) {
    throw new Error(
      `[devVendor] Fingerprint mismatch for ${platform}. Rebuild the dev vendor cache.`,
    );
  }

  const resolvedArtifactDirectory =
    artifactDirectory ?? getPlatformOutputDirectory(projectRoot, platform);
  for (const artifact of [manifest.common.source, manifest.common.bytecode]) {
    const artifactPath = path.join(resolvedArtifactDirectory, artifact.file);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(
        `[devVendor] Cached artifact is missing: ${artifactPath}`,
      );
    }
    const bytes = fs.readFileSync(artifactPath);
    if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
      throw new Error(
        `[devVendor] Cached artifact integrity mismatch: ${artifactPath}`,
      );
    }
  }
  for (const moduleRecord of manifest.modules) {
    const stubPath = path.join(
      resolvedArtifactDirectory,
      'stubs',
      `${moduleRecord.id}.js`,
    );
    if (!fs.existsSync(stubPath)) {
      throw new Error(
        `[devVendor] External stub is missing for module ${moduleRecord.id}. Rebuild the dev vendor cache.`,
      );
    }
  }

  return manifest;
}

function loadRuntime(
  projectRoot,
  platform,
  { repoRoot = REPO_ROOT, validateArtifacts = false } = {},
) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  const cacheKey = getRuntimeCacheKey(projectRoot, platform, repoRoot);
  const cachedRuntime = runtimeCache.get(cacheKey);
  if (
    cachedRuntime &&
    (!validateArtifacts ||
      fileIdentitiesMatch(cachedRuntime.artifactFileIdentities))
  ) {
    return cachedRuntime;
  }
  runtimeCache.delete(cacheKey);
  const manifestPath = getManifestPath(projectRoot, platform);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `[devVendor] Missing ${platform} cache. Run \`yarn workspace @onekeyhq/mobile dev-vendor:build --platform ${platform}\` first.`,
    );
  }
  const manifest = verifyManifest({
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
    platform,
    projectRoot,
    repoRoot,
  });
  const moduleByAbsolutePath = new Map(
    manifest.modules.map((moduleRecord) => [
      path.resolve(repoRoot, moduleRecord.path),
      moduleRecord,
    ]),
  );
  const sourcePath = path.join(
    getPlatformOutputDirectory(projectRoot, platform),
    manifest.common.source.file,
  );
  const bytecodePath = path.join(
    getPlatformOutputDirectory(projectRoot, platform),
    manifest.common.bytecode.file,
  );
  const artifactPaths = [manifestPath, sourcePath, bytecodePath].map(
    (filePath) => path.resolve(filePath),
  );
  const runtime = {
    artifactFileIdentities: captureFileIdentities(artifactPaths),
    artifactPaths: new Set(artifactPaths),
    fingerprintDirectories: devVendorConfig.fingerprintDirectories.map(
      (relativeDirectory) => path.resolve(repoRoot, relativeDirectory),
    ),
    fingerprintFiles: new Set(
      devVendorConfig.fingerprintFiles.map((relativePath) =>
        path.resolve(repoRoot, relativePath),
      ),
    ),
    manifest,
    moduleByAbsolutePath,
    sourceCode: fs.readFileSync(sourcePath, 'utf8'),
  };
  runtimeCache.set(cacheKey, runtime);
  console.log(
    `[devVendor] cache hit platform=${platform} fingerprint=${manifest.fingerprint} modules=${manifest.modules.length} commonBytes=${manifest.common.source.bytes}`,
  );
  return runtime;
}

function isRuntimeInputPath(runtime, filePath) {
  const absolutePath = path.resolve(filePath);
  return (
    runtime.artifactPaths.has(absolutePath) ||
    runtime.fingerprintFiles.has(absolutePath) ||
    runtime.moduleByAbsolutePath.has(absolutePath) ||
    runtime.fingerprintDirectories.some((directoryPath) =>
      isPathInsideDirectory(absolutePath, directoryPath),
    )
  );
}

function refreshRuntimeCacheForChanges({
  changedFiles,
  platform,
  projectRoot,
  repoRoot = REPO_ROOT,
}) {
  const cacheKey = getRuntimeCacheKey(projectRoot, platform, repoRoot);
  const runtime = runtimeCache.get(cacheKey);
  if (
    !runtime ||
    ![...changedFiles].some((filePath) => isRuntimeInputPath(runtime, filePath))
  ) {
    return runtime;
  }
  runtimeCache.delete(cacheKey);
  return loadRuntime(projectRoot, platform, { repoRoot });
}

function isDevVendorRequest(bundleOptions) {
  try {
    const sourceUrl = new URL(bundleOptions.sourceUrl);
    return sourceUrl.searchParams.get('resolver.devVendor') === 'true';
  } catch {
    return false;
  }
}

function assertNativeDevVendorResolverContract({
  customResolverOptions,
  manifest,
  platform,
}) {
  if (customResolverOptions?.devVendorNative !== 'true') {
    return;
  }
  const requestedFingerprint = customResolverOptions.devVendorFingerprint;
  if (
    typeof requestedFingerprint !== 'string' ||
    requestedFingerprint !== manifest.fingerprint
  ) {
    throw new Error(
      `[devVendor] Native ${platform} cache fingerprint mismatch. Rebuild the dev-vendor cache and native app.`,
    );
  }
  const runtimeTarget = customResolverOptions.runtimeTarget;
  if (!SUPPORTED_RUNTIME_TARGETS.has(runtimeTarget)) {
    throw new Error(
      `[devVendor] Native ${platform} request has an invalid runtime target: ${String(runtimeTarget)}.`,
    );
  }
}

function assertNativeDevVendorServerEnabled(customResolverOptions, enabled) {
  if (customResolverOptions?.devVendorNative === 'true' && !enabled) {
    throw new Error(
      '[devVendor] Native dev-vendor request reached a Metro server without ONEKEY_DEV_VENDOR=true.',
    );
  }
}

function getRuntimeTarget(entryPoint, projectRoot) {
  const resolvedEntryPoint = path.resolve(entryPoint);
  if (resolvedEntryPoint === path.resolve(projectRoot, 'index.ts')) {
    return 'main';
  }
  if (resolvedEntryPoint === path.resolve(projectRoot, 'background.ts')) {
    return 'background';
  }
  return undefined;
}

function inspectDevVendorGraph({ entryPoint, graph, projectRoot }) {
  const stubInfos = [...graph.dependencies.keys()]
    .map((modulePath) => getDevVendorStubInfo(modulePath, projectRoot))
    .filter(Boolean);
  if (stubInfos.length === 0) return undefined;

  const platform = graph.transformOptions?.platform;
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(
      `[devVendor] External stubs found for unsupported platform: ${String(platform)}.`,
    );
  }
  const mismatchedStub = stubInfos.find(
    (stubInfo) => stubInfo.platform !== platform,
  );
  if (mismatchedStub) {
    throw new Error(
      `[devVendor] ${mismatchedStub.platform} external stub found in ${platform} graph.`,
    );
  }
  const runtimeTarget = getRuntimeTarget(entryPoint, projectRoot);
  if (!runtimeTarget) {
    throw new Error(
      `[devVendor] External stubs found for unsupported runtime entry: ${entryPoint}.`,
    );
  }
  return { platform, runtimeTarget, stubCount: stubInfos.length };
}

function shouldPrependCommon(bundleOptions, devVendorGraph) {
  return (
    bundleOptions.dev &&
    !bundleOptions.modulesOnly &&
    devVendorGraph !== undefined
  );
}

function composeDevVendorBundle({
  bundleOptions,
  commonSourceCode,
  devVendorGraph,
  serializedDelta,
}) {
  if (!shouldPrependCommon(bundleOptions, devVendorGraph)) {
    return serializedDelta;
  }
  const deltaCode =
    typeof serializedDelta === 'string'
      ? serializedDelta
      : serializedDelta.code;
  return `${commonSourceCode}\n${deltaCode}`;
}

function serializeDefault(entryPoint, prepend, graph, bundleOptions) {
  return bundleToString(baseJSBundle(entryPoint, prepend, graph, bundleOptions))
    .code;
}

function applyDevVendorConfig(config, projectRoot) {
  const enabled = isDevVendorEnabled();
  if (!enabled) {
    const previousResolveRequest = config.resolver.resolveRequest;
    config.resolver.resolveRequest = (context, moduleName, platform) => {
      assertNativeDevVendorServerEnabled(
        context.customResolverOptions,
        enabled,
      );
      return previousResolveRequest(context, moduleName, platform);
    };
    return config;
  }

  const previousResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolution = previousResolveRequest(context, moduleName, platform);
    if (
      context.customResolverOptions?.devVendor !== 'true' ||
      !SUPPORTED_PLATFORMS.has(platform) ||
      resolution.type !== 'sourceFile'
    ) {
      return resolution;
    }
    let runtime = loadRuntime(projectRoot, platform);
    if (
      context.customResolverOptions?.devVendorNative === 'true' &&
      context.customResolverOptions.devVendorFingerprint !==
        runtime.manifest.fingerprint
    ) {
      runtimeCache.delete(getRuntimeCacheKey(projectRoot, platform));
      runtime = loadRuntime(projectRoot, platform);
    }
    assertNativeDevVendorResolverContract({
      customResolverOptions: context.customResolverOptions,
      manifest: runtime.manifest,
      platform,
    });
    const moduleRecord = runtime.moduleByAbsolutePath.get(
      path.resolve(resolution.filePath),
    );
    if (!moduleRecord) {
      return resolution;
    }
    return {
      type: 'sourceFile',
      filePath: getStubPath(projectRoot, platform, moduleRecord.id),
    };
  };

  const previousProcessModuleFilter =
    config.serializer.processModuleFilter || (() => true);
  config.serializer.processModuleFilter = (moduleData) =>
    getDevVendorStubModuleId(moduleData.path, projectRoot) === undefined &&
    previousProcessModuleFilter(moduleData);

  const previousExperimentalSerializerHook =
    config.serializer.experimentalSerializerHook || (() => {});
  config.serializer.experimentalSerializerHook = (graph, delta) => {
    previousExperimentalSerializerHook(graph, delta);
    const platform = graph.transformOptions?.platform;
    const changedFiles = delta?.unstable_changedFiles;
    if (
      SUPPORTED_PLATFORMS.has(platform) &&
      changedFiles instanceof Set &&
      changedFiles.size > 0
    ) {
      refreshRuntimeCacheForChanges({
        changedFiles,
        platform,
        projectRoot,
      });
    }
  };

  const previousCustomSerializer = config.serializer.customSerializer;
  config.serializer.customSerializer = async (
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  ) => {
    const devVendorGraph = bundleOptions.dev
      ? inspectDevVendorGraph({ entryPoint, graph, projectRoot })
      : undefined;
    if (!devVendorGraph) {
      return previousCustomSerializer
        ? previousCustomSerializer(entryPoint, prepend, graph, bundleOptions)
        : serializeDefault(entryPoint, prepend, graph, bundleOptions);
    }
    const runtime = loadRuntime(projectRoot, devVendorGraph.platform, {
      validateArtifacts: true,
    });
    const deltaBundleOptions = {
      ...bundleOptions,
      modulesOnly: true,
    };
    const serializedDelta = previousCustomSerializer
      ? await previousCustomSerializer(
          entryPoint,
          prepend,
          graph,
          deltaBundleOptions,
        )
      : serializeDefault(entryPoint, prepend, graph, deltaBundleOptions);
    const deltaCode =
      typeof serializedDelta === 'string'
        ? serializedDelta
        : serializedDelta.code;
    const deltaModuleCount = graph.dependencies.size - devVendorGraph.stubCount;
    console.log(
      `[devVendor] serialize platform=${devVendorGraph.platform} runtime=${devVendorGraph.runtimeTarget} graph=${graph.dependencies.size} externalStubs=${devVendorGraph.stubCount} deltaModules=${deltaModuleCount} deltaBytes=${Buffer.byteLength(deltaCode)}`,
    );
    return composeDevVendorBundle({
      bundleOptions,
      commonSourceCode: runtime.sourceCode,
      devVendorGraph,
      serializedDelta,
    });
  };

  return config;
}

function resetRuntimeCacheForTests() {
  runtimeCache.clear();
}

module.exports = {
  MANIFEST_NAME,
  SUPPORTED_PLATFORMS,
  SUPPORTED_RUNTIME_TARGETS,
  applyDevVendorConfig,
  assertNativeDevVendorServerEnabled,
  assertNativeDevVendorResolverContract,
  assertSortedUniqueModules,
  computeConfigInputsDigest,
  computeFingerprint,
  computeModulesDigest,
  computeRegistryInputsDigest,
  computeReleaseCompatibilityKey,
  composeDevVendorBundle,
  getDevVendorStubModuleId,
  getFingerprintInputPaths,
  getManifestPath,
  getPlatformOutputDirectory,
  getReleaseTag,
  getStubPath,
  hashRepoFiles,
  isDevVendorEnabled,
  isDevVendorRequest,
  inspectDevVendorGraph,
  loadRuntime,
  refreshRuntimeCacheForChanges,
  resetRuntimeCacheForTests,
  sha256,
  shouldPrependCommon,
  verifyManifest,
};
