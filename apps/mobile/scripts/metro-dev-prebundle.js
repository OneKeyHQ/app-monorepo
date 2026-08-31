#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words LOCALAPPDATA prebundle sigstore */

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { promisify } = require('util');
const zlib = require('zlib');

const devVendorConfig = require('../dev-vendor.config');
const {
  computeConfigInputsDigest,
  computeReleaseCompatibilityKey,
  getPlatformOutputDirectory,
  getReleaseTag,
  sha256,
  verifyManifest,
} = require('../plugins/devVendor');
const { REPO_ROOT, loadRegistry } = require('../plugins/moduleIdRegistry');

const MOBILE_DIR = path.resolve(__dirname, '..');
const execFileAsync = promisify(execFile);
const RELEASE_MANIFEST_NAME = 'metro-dev-prebundle-release.json';
const PACKAGE_INVENTORY_NAME = 'metro-dev-prebundle-packages.json';
const THIRD_PARTY_NOTICES_NAME = 'THIRD_PARTY_NOTICES.txt';
const TRUSTED_ROOT_REPO_PATH =
  'apps/mobile/bundle-registry/metro-dev-prebundle-trusted-root.jsonl';
const RELEASE_SIGNER_WORKFLOW =
  'OneKeyHQ/app-monorepo/.github/workflows/metro-dev-prebundle.yml';
const RELEASE_SOURCE_REF = 'refs/heads/x';
const ATTESTATION_PREDICATE_TYPE = 'https://slsa.dev/provenance/v1';
const SHARED_CACHE_SCHEMA_VERSION = 1;
const SHARED_CACHE_ENV = 'ONEKEY_METRO_PREBUNDLE_CACHE_DIR';
const MAX_CACHED_RELEASES = 5;
const SUPPORTED_PLATFORMS = ['ios', 'android'];
const MAX_RELEASE_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 512 * 1024 * 1024;
const MAX_ATTESTATION_BYTES = 8 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

async function pathExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readJsonFile(filePath, maxBytes = MAX_RELEASE_MANIFEST_BYTES) {
  const stat = await fs.promises.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    throw new Error(
      `[metroDevPrebundle] Invalid cached JSON file: ${filePath}.`,
    );
  }
  return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
}

function getSharedCacheRoot(
  env = process.env,
  platform = process.platform,
  homeDirectory = os.homedir(),
) {
  if (env[SHARED_CACHE_ENV]) {
    return path.resolve(env[SHARED_CACHE_ENV]);
  }
  if (platform === 'darwin') {
    return path.join(
      homeDirectory,
      'Library/Caches/OneKey/metro-dev-prebundle',
    );
  }
  if (platform === 'win32') {
    return path.join(
      env.LOCALAPPDATA || path.join(homeDirectory, 'AppData/Local'),
      'OneKey/metro-dev-prebundle',
    );
  }
  return path.join(
    env.XDG_CACHE_HOME || path.join(homeDirectory, '.cache'),
    'onekey/metro-dev-prebundle',
  );
}

function getCacheVersionRoot(cacheRoot) {
  return path.join(path.resolve(cacheRoot), `v${SHARED_CACHE_SCHEMA_VERSION}`);
}

function getPlatformCacheDirectory({ cacheRoot, platform, tagName }) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`[metroDevPrebundle] Unsupported platform: ${platform}`);
  }
  const expectedPrefix = `${devVendorConfig.releaseTagPrefix}-`;
  if (
    !tagName.startsWith(expectedPrefix) ||
    !/^[0-9a-f]{64}$/.test(tagName.slice(expectedPrefix.length))
  ) {
    throw new Error(`[metroDevPrebundle] Invalid release tag: ${tagName}.`);
  }
  return path.join(getCacheVersionRoot(cacheRoot), tagName, platform);
}

function getTrustedRootPath(repoRoot = REPO_ROOT) {
  return path.resolve(repoRoot, TRUSTED_ROOT_REPO_PATH);
}

function getAttestationBundleName(fileName) {
  return `${assertSafeFileName(fileName)}.attestation.jsonl`;
}

async function ensureCacheDirectory(directoryPath) {
  await fs.promises.mkdir(directoryPath, { mode: 0o700, recursive: true });
  const stat = await fs.promises.lstat(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      `[metroDevPrebundle] Shared cache path is not a directory: ${directoryPath}.`,
    );
  }
  if (
    typeof process.getuid === 'function' &&
    Number.isSafeInteger(stat.uid) &&
    stat.uid !== process.getuid()
  ) {
    throw new Error(
      `[metroDevPrebundle] Shared cache is owned by another user: ${directoryPath}.`,
    );
  }
  if (process.platform !== 'win32') {
    await fs.promises.chmod(directoryPath, 0o700);
  }
}

async function assertRegularFile(filePath, maxBytes) {
  const stat = await fs.promises.lstat(filePath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size <= 0 ||
    stat.size > maxBytes
  ) {
    throw new Error(
      `[metroDevPrebundle] Invalid cached file: ${path.basename(filePath)}.`,
    );
  }
  return stat;
}

async function runGhCommand(args, { cwd } = {}) {
  try {
    return await execFileAsync('gh', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    throw new Error(
      `[metroDevPrebundle] GitHub CLI attestation command failed: gh ${args
        .slice(0, 2)
        .join(
          ' ',
        )}. Install or update GitHub CLI and authenticate if required.`,
      { cause: error },
    );
  }
}

function getReleaseOutputDirectory(projectRoot = MOBILE_DIR) {
  return path.join(projectRoot, 'out-dir-bundle/metro-dev-prebundle-release');
}

function getPlatformAssetNames(platform) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`[metroDevPrebundle] Unsupported platform: ${platform}`);
  }
  const prefix = `${devVendorConfig.RELEASE_ASSET_PREFIX}-${platform}`;
  return {
    bytecode: `${prefix}-common.hbc.gz`,
    manifest: `${prefix}-manifest.json`,
    source: `${prefix}-common.js.gz`,
  };
}

function assertSafeFileName(fileName) {
  if (
    typeof fileName !== 'string' ||
    fileName.length === 0 ||
    fileName === '.' ||
    fileName === '..' ||
    path.basename(fileName) !== fileName
  ) {
    throw new Error(
      `[metroDevPrebundle] Invalid release asset name: ${String(fileName)}`,
    );
  }
  return fileName;
}

function assertSafeOutputDirectory({ outputDirectory, projectRoot }) {
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  const allowedOutputRoot = path.resolve(projectRoot, 'out-dir-bundle');
  const relativePath = path.relative(
    allowedOutputRoot,
    resolvedOutputDirectory,
  );
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `[metroDevPrebundle] Release output must be inside ${allowedOutputRoot}.`,
    );
  }
  return resolvedOutputDirectory;
}

async function getAssetMetadata(filePath) {
  const content = await fs.promises.readFile(filePath);
  return {
    bytes: content.length,
    file: path.basename(filePath),
    sha256: sha256(content),
  };
}

async function gzipFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION, mtime: 0 }),
    fs.createWriteStream(outputPath),
  );
}

async function gunzipFile(inputPath, outputPath) {
  let outputBytes = 0;
  const output = fs.createWriteStream(outputPath);
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      outputBytes += chunk.length;
      if (outputBytes > MAX_UNCOMPRESSED_BYTES) {
        callback(
          new Error(
            `[metroDevPrebundle] Uncompressed artifact exceeds ${MAX_UNCOMPRESSED_BYTES} bytes.`,
          ),
        );
        return;
      }
      callback(null, chunk);
    },
  });
  await pipeline(
    fs.createReadStream(inputPath),
    zlib.createGunzip(),
    counter,
    output,
  );
}

function findPackageRoot(modulePath, repoRoot) {
  const segments = modulePath.split('/');
  const nodeModulesIndex = segments.lastIndexOf('node_modules');
  const packageNameIndex = nodeModulesIndex + 1;
  const packageName = segments[packageNameIndex];
  const packageSegmentCount = packageName?.startsWith('@') ? 2 : 1;
  const packageSegments = segments.slice(
    packageNameIndex,
    packageNameIndex + packageSegmentCount,
  );
  if (
    nodeModulesIndex < 0 ||
    packageSegments.length !== packageSegmentCount ||
    packageSegments.some((segment) => !segment)
  ) {
    throw new Error(
      `[metroDevPrebundle] Unable to identify package root for ${modulePath}.`,
    );
  }
  const packageRoot = path.resolve(
    repoRoot,
    ...segments.slice(0, packageNameIndex),
    ...packageSegments,
  );
  if (!fs.existsSync(path.join(packageRoot, 'package.json'))) {
    throw new Error(
      `[metroDevPrebundle] Unable to resolve package metadata for ${modulePath}.`,
    );
  }
  return packageRoot;
}

function getPackageLicense(packageJson) {
  if (typeof packageJson.license === 'string') return packageJson.license;
  if (
    packageJson.license &&
    typeof packageJson.license === 'object' &&
    typeof packageJson.license.type === 'string'
  ) {
    return packageJson.license.type;
  }
  return 'UNKNOWN';
}

function getPackageRepository(packageJson) {
  if (typeof packageJson.repository === 'string') {
    return packageJson.repository;
  }
  if (
    packageJson.repository &&
    typeof packageJson.repository === 'object' &&
    typeof packageJson.repository.url === 'string'
  ) {
    return packageJson.repository.url;
  }
  return null;
}

function readPackageLicenseFiles(packageRoot) {
  const names = fs
    .readdirSync(packageRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .toSorted();
  return names.flatMap((name) => {
    const filePath = path.join(packageRoot, name);
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 1024) return [];
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content.includes('\0') ? [] : [{ content, name }];
  });
}

function collectPackageInventory(platformManifests, repoRoot = REPO_ROOT) {
  const packages = new Map();
  for (const [platform, manifest] of Object.entries(platformManifests)) {
    for (const moduleRecord of manifest.modules) {
      const packageRoot = findPackageRoot(moduleRecord.path, repoRoot);
      const relativeRoot = path
        .relative(repoRoot, packageRoot)
        .split(path.sep)
        .join('/');
      let record = packages.get(relativeRoot);
      if (!record) {
        const packageJson = JSON.parse(
          fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
        );
        record = {
          license: getPackageLicense(packageJson),
          licenseFiles: readPackageLicenseFiles(packageRoot),
          modulePaths: new Set(),
          name: packageJson.name || relativeRoot,
          packageRoot: relativeRoot,
          platforms: new Set(),
          repository: getPackageRepository(packageJson),
          version: packageJson.version || 'UNKNOWN',
        };
        packages.set(relativeRoot, record);
      }
      record.modulePaths.add(moduleRecord.path);
      record.platforms.add(platform);
    }
  }
  return [...packages.values()]
    .map((record) => ({
      license: record.license,
      licenseFiles: record.licenseFiles,
      moduleCount: record.modulePaths.size,
      name: record.name,
      packageRoot: record.packageRoot,
      platforms: [...record.platforms].toSorted(),
      repository: record.repository,
      version: record.version,
    }))
    .toSorted((first, second) => {
      const firstKey = `${first.name}@${first.version}:${first.packageRoot}`;
      const secondKey = `${second.name}@${second.version}:${second.packageRoot}`;
      if (firstKey < secondKey) return -1;
      if (firstKey > secondKey) return 1;
      return 0;
    });
}

function createThirdPartyNotices(packages) {
  const sections = [
    'Third-party notices for the OneKey Metro development prebundle.',
    'This file is generated from package metadata and bundled license files.',
  ];
  for (const packageRecord of packages) {
    const header = [
      `${packageRecord.name}@${packageRecord.version}`,
      `Path: ${packageRecord.packageRoot}`,
      `License: ${packageRecord.license}`,
      `Repository: ${packageRecord.repository || 'UNKNOWN'}`,
    ].join('\n');
    const licenseText =
      packageRecord.licenseFiles.length > 0
        ? packageRecord.licenseFiles
            .map(({ content, name }) => `--- ${name} ---\n${content}`)
            .join('\n\n')
        : 'No package license file was found in the installed package.';
    sections.push(`${'='.repeat(80)}\n${header}\n\n${licenseText}`);
  }
  return `${sections.join('\n\n')}\n`;
}

async function replaceDirectoryAtomically({
  outputDirectory,
  temporaryDirectory,
}) {
  const backupDirectory = `${outputDirectory}.previous-${process.pid}`;
  await fs.promises.rm(backupDirectory, { force: true, recursive: true });
  const hadPreviousOutput = await pathExists(outputDirectory);
  if (hadPreviousOutput) {
    await fs.promises.rename(outputDirectory, backupDirectory);
  }
  try {
    await fs.promises.rename(temporaryDirectory, outputDirectory);
  } catch (error) {
    if (hadPreviousOutput && (await pathExists(backupDirectory))) {
      await fs.promises.rename(backupDirectory, outputDirectory);
    }
    throw error;
  }
  if (hadPreviousOutput) {
    await fs.promises.rm(backupDirectory, { force: true, recursive: true });
  }
}

async function verifyAndReplaceDirectory({
  outputDirectory,
  temporaryDirectory,
  verifyTemporaryDirectory,
}) {
  try {
    await verifyTemporaryDirectory(temporaryDirectory);
  } catch (error) {
    await fs.promises.rm(temporaryDirectory, {
      force: true,
      recursive: true,
    });
    throw error;
  }
  await replaceDirectoryAtomically({ outputDirectory, temporaryDirectory });
}

async function packagePrebundleRelease({
  outputDirectory = getReleaseOutputDirectory(),
  projectRoot = MOBILE_DIR,
  repoRoot = REPO_ROOT,
  sourceCommit,
}) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit || '')) {
    throw new Error(
      '[metroDevPrebundle] package requires a 40-character source commit.',
    );
  }
  const releaseOutputDirectory = assertSafeOutputDirectory({
    outputDirectory,
    projectRoot,
  });
  const registry = loadRegistry();
  const compatibilityKey = computeReleaseCompatibilityKey(
    repoRoot,
    process.env,
    registry,
  );
  const tagName = `${devVendorConfig.releaseTagPrefix}-${compatibilityKey}`;
  const platformManifests = {};
  const platforms = {};
  await fs.promises.rm(releaseOutputDirectory, {
    force: true,
    recursive: true,
  });
  await fs.promises.mkdir(releaseOutputDirectory, { recursive: true });
  try {
    for (const platform of SUPPORTED_PLATFORMS) {
      const artifactDirectory = getPlatformOutputDirectory(
        projectRoot,
        platform,
      );
      const manifestPath = path.join(artifactDirectory, 'manifest.json');
      const manifest = verifyManifest({
        artifactDirectory,
        manifest: await readJsonFile(manifestPath),
        platform,
        projectRoot,
        repoRoot,
      });
      const names = getPlatformAssetNames(platform);
      const releaseManifestPath = path.join(
        releaseOutputDirectory,
        names.manifest,
      );
      const sourcePath = path.join(
        artifactDirectory,
        manifest.common.source.file,
      );
      const bytecodePath = path.join(
        artifactDirectory,
        manifest.common.bytecode.file,
      );
      const compressedSourcePath = path.join(
        releaseOutputDirectory,
        names.source,
      );
      const compressedBytecodePath = path.join(
        releaseOutputDirectory,
        names.bytecode,
      );
      await fs.promises.copyFile(manifestPath, releaseManifestPath);
      await gzipFile(sourcePath, compressedSourcePath);
      await gzipFile(bytecodePath, compressedBytecodePath);
      platformManifests[platform] = manifest;
      platforms[platform] = {
        bytecode: await getAssetMetadata(compressedBytecodePath),
        manifest: await getAssetMetadata(releaseManifestPath),
        source: await getAssetMetadata(compressedSourcePath),
      };
    }

    const packages = collectPackageInventory(platformManifests, repoRoot);
    const packageInventoryPath = path.join(
      releaseOutputDirectory,
      PACKAGE_INVENTORY_NAME,
    );
    const noticesPath = path.join(
      releaseOutputDirectory,
      THIRD_PARTY_NOTICES_NAME,
    );
    const inventoryPackages = packages.map((packageRecord) => ({
      ...packageRecord,
      licenseFiles: packageRecord.licenseFiles.map(({ name }) => name),
    }));
    await fs.promises.writeFile(
      packageInventoryPath,
      `${JSON.stringify(
        { packages: inventoryPackages, schemaVersion: 1, sourceCommit },
        null,
        2,
      )}\n`,
    );
    await fs.promises.writeFile(noticesPath, createThirdPartyNotices(packages));

    const releaseManifest = {
      assets: {
        packageInventory: await getAssetMetadata(packageInventoryPath),
        thirdPartyNotices: await getAssetMetadata(noticesPath),
      },
      compatibilityKey,
      devVendor: {
        configInputsDigest: computeConfigInputsDigest(
          repoRoot,
          process.env,
          registry,
        ),
        registryEpoch: registry.registryEpoch,
        schemaVersion: devVendorConfig.SCHEMA_VERSION,
        strategyVersion: devVendorConfig.STRATEGY_VERSION,
      },
      platforms,
      repository: devVendorConfig.RELEASE_REPOSITORY,
      schemaVersion: devVendorConfig.RELEASE_SCHEMA_VERSION,
      sourceCommit,
      tagName,
    };
    await fs.promises.writeFile(
      path.join(releaseOutputDirectory, RELEASE_MANIFEST_NAME),
      `${JSON.stringify(releaseManifest, null, 2)}\n`,
    );
    return releaseManifest;
  } catch (error) {
    await fs.promises.rm(releaseOutputDirectory, {
      force: true,
      recursive: true,
    });
    throw error;
  }
}

function assertAssetMetadata(metadata, expectedFile) {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    metadata.file !== expectedFile ||
    !Number.isSafeInteger(metadata.bytes) ||
    metadata.bytes <= 0 ||
    !/^[0-9a-f]{64}$/.test(metadata.sha256 || '')
  ) {
    throw new Error(
      `[metroDevPrebundle] Invalid release metadata for ${expectedFile}.`,
    );
  }
  return metadata;
}

function verifyReleaseManifest({ manifest, platform, repoRoot = REPO_ROOT }) {
  const registry = loadRegistry();
  const compatibilityKey = computeReleaseCompatibilityKey(
    repoRoot,
    process.env,
    registry,
  );
  const tagName = `${devVendorConfig.releaseTagPrefix}-${compatibilityKey}`;
  if (
    manifest?.schemaVersion !== devVendorConfig.RELEASE_SCHEMA_VERSION ||
    manifest.repository !== devVendorConfig.RELEASE_REPOSITORY ||
    manifest.compatibilityKey !== compatibilityKey ||
    manifest.tagName !== tagName ||
    !/^[0-9a-f]{40}$/.test(manifest.sourceCommit || '')
  ) {
    throw new Error(
      '[metroDevPrebundle] Release manifest is incompatible with this checkout.',
    );
  }
  if (
    manifest.devVendor?.schemaVersion !== devVendorConfig.SCHEMA_VERSION ||
    manifest.devVendor?.strategyVersion !== devVendorConfig.STRATEGY_VERSION ||
    manifest.devVendor?.registryEpoch !== registry.registryEpoch ||
    manifest.devVendor?.configInputsDigest !==
      computeConfigInputsDigest(repoRoot, process.env, registry)
  ) {
    throw new Error(
      '[metroDevPrebundle] Release build inputs do not match this checkout.',
    );
  }
  const platformAssets = manifest.platforms?.[platform];
  const names = getPlatformAssetNames(platform);
  if (!platformAssets) {
    throw new Error(
      `[metroDevPrebundle] Release has no ${platform} artifacts.`,
    );
  }
  assertAssetMetadata(platformAssets.manifest, names.manifest);
  assertAssetMetadata(platformAssets.source, names.source);
  assertAssetMetadata(platformAssets.bytecode, names.bytecode);
  return { compatibilityKey, platformAssets, tagName };
}

function getReleaseAssetUrl(tagName, fileName, releaseBaseUrl) {
  const baseUrl =
    releaseBaseUrl ||
    `https://github.com/${devVendorConfig.RELEASE_REPOSITORY}/releases/download/${encodeURIComponent(
      tagName,
    )}`;
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(
    assertSafeFileName(fileName),
  )}`;
}

async function downloadReleaseAsset({
  fetchImpl = globalThis.fetch,
  fileName,
  maxBytes = MAX_ASSET_BYTES,
  releaseBaseUrl,
  tagName,
  timeoutMs = 120_000,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('[metroDevPrebundle] This Node.js runtime has no fetch.');
  }
  const response = await fetchImpl(
    getReleaseAssetUrl(tagName, fileName, releaseBaseUrl),
    {
      headers: { 'User-Agent': 'OneKey-Metro-Dev-Prebundle' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) {
    throw new Error(
      `[metroDevPrebundle] Download failed for ${fileName}: HTTP ${response.status}.`,
    );
  }
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new Error(
      `[metroDevPrebundle] Downloaded asset is too large: ${fileName}.`,
    );
  }
  if (!response.body) {
    throw new Error(
      `[metroDevPrebundle] Downloaded asset has no response body: ${fileName}.`,
    );
  }
  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    receivedBytes += bytes.length;
    if (receivedBytes > maxBytes) {
      throw new Error(
        `[metroDevPrebundle] Downloaded asset is too large: ${fileName}.`,
      );
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, receivedBytes);
}

function assertDownloadedAsset(content, metadata) {
  if (
    content.length !== metadata.bytes ||
    sha256(content) !== metadata.sha256
  ) {
    throw new Error(
      `[metroDevPrebundle] Downloaded asset integrity mismatch: ${metadata.file}.`,
    );
  }
}

function assertSourceCommit(sourceCommit) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit || '')) {
    throw new Error(
      '[metroDevPrebundle] Release manifest has an invalid source commit.',
    );
  }
  return sourceCommit;
}

function getAttestationBundlePath(cacheDirectory, fileName) {
  return path.join(cacheDirectory, getAttestationBundleName(fileName));
}

async function downloadArtifactAttestation({
  artifactPath,
  bundlePath,
  runGh = runGhCommand,
}) {
  const temporaryDirectory = `${bundlePath}.download-${process.pid}-${Date.now()}`;
  await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  await fs.promises.mkdir(temporaryDirectory, { mode: 0o700, recursive: true });
  try {
    await runGh(
      [
        'attestation',
        'download',
        artifactPath,
        '--repo',
        devVendorConfig.RELEASE_REPOSITORY,
        '--predicate-type',
        ATTESTATION_PREDICATE_TYPE,
      ],
      { cwd: temporaryDirectory },
    );
    const digest = sha256(await fs.promises.readFile(artifactPath));
    const candidateNames = [`sha256:${digest}.jsonl`, `sha256-${digest}.jsonl`];
    const candidatePath = (
      await Promise.all(
        candidateNames.map(async (fileName) => {
          const filePath = path.join(temporaryDirectory, fileName);
          return (await pathExists(filePath)) ? filePath : undefined;
        }),
      )
    ).find(Boolean);
    if (!candidatePath) {
      throw new Error(
        `[metroDevPrebundle] GitHub did not return an attestation for ${path.basename(artifactPath)}.`,
      );
    }
    await assertRegularFile(candidatePath, MAX_ATTESTATION_BYTES);
    await fs.promises.copyFile(candidatePath, bundlePath);
  } finally {
    await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  }
}

async function verifyArtifactAttestation({
  artifactPath,
  bundlePath,
  repoRoot = REPO_ROOT,
  runGh = runGhCommand,
  sourceCommit,
}) {
  const trustedRootPath = getTrustedRootPath(repoRoot);
  await assertRegularFile(trustedRootPath, MAX_ATTESTATION_BYTES);
  await assertRegularFile(bundlePath, MAX_ATTESTATION_BYTES);
  await runGh([
    'attestation',
    'verify',
    artifactPath,
    '--repo',
    devVendorConfig.RELEASE_REPOSITORY,
    '--bundle',
    bundlePath,
    '--custom-trusted-root',
    trustedRootPath,
    '--signer-workflow',
    RELEASE_SIGNER_WORKFLOW,
    '--source-ref',
    RELEASE_SOURCE_REF,
    '--source-digest',
    assertSourceCommit(sourceCommit),
    '--deny-self-hosted-runners',
  ]);
}

async function verifyCachedReleaseAssets({
  attestationVerifier = verifyArtifactAttestation,
  cacheDirectory,
  platform,
  repoRoot = REPO_ROOT,
}) {
  const releaseManifestPath = path.join(cacheDirectory, RELEASE_MANIFEST_NAME);
  const releaseManifest = await readJsonFile(releaseManifestPath);
  const sourceCommit = assertSourceCommit(releaseManifest.sourceCommit);
  await attestationVerifier({
    artifactPath: releaseManifestPath,
    bundlePath: getAttestationBundlePath(cacheDirectory, RELEASE_MANIFEST_NAME),
    repoRoot,
    sourceCommit,
  });
  const { platformAssets, tagName } = verifyReleaseManifest({
    manifest: releaseManifest,
    platform,
    repoRoot,
  });
  const assetPaths = {};
  for (const [assetType, metadata] of Object.entries(platformAssets)) {
    const artifactPath = path.join(
      cacheDirectory,
      assertSafeFileName(metadata.file),
    );
    await assertRegularFile(artifactPath, MAX_ASSET_BYTES);
    assertDownloadedAsset(await fs.promises.readFile(artifactPath), metadata);
    await attestationVerifier({
      artifactPath,
      bundlePath: getAttestationBundlePath(cacheDirectory, metadata.file),
      repoRoot,
      sourceCommit,
    });
    assetPaths[assetType] = artifactPath;
  }
  return { assetPaths, releaseManifest, tagName };
}

async function downloadReleaseIntoCache({
  attestationDownloader = downloadArtifactAttestation,
  attestationVerifier = verifyArtifactAttestation,
  cacheDirectory,
  fetchImpl,
  platform,
  releaseBaseUrl,
  repoRoot,
  tagName,
}) {
  const temporaryDirectory = `${cacheDirectory}.download-${process.pid}-${Date.now()}`;
  await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  await fs.promises.mkdir(temporaryDirectory, { mode: 0o700, recursive: true });
  try {
    const releaseManifestBytes = await downloadReleaseAsset({
      fetchImpl,
      fileName: RELEASE_MANIFEST_NAME,
      maxBytes: MAX_RELEASE_MANIFEST_BYTES,
      releaseBaseUrl,
      tagName,
      timeoutMs: 15_000,
    });
    let releaseManifest;
    try {
      releaseManifest = JSON.parse(releaseManifestBytes.toString('utf8'));
    } catch (error) {
      throw new Error(
        '[metroDevPrebundle] Release manifest is not valid JSON.',
        { cause: error },
      );
    }
    const sourceCommit = assertSourceCommit(releaseManifest.sourceCommit);
    const releaseManifestPath = path.join(
      temporaryDirectory,
      RELEASE_MANIFEST_NAME,
    );
    await fs.promises.writeFile(releaseManifestPath, releaseManifestBytes, {
      mode: 0o600,
    });
    const releaseManifestBundlePath = getAttestationBundlePath(
      temporaryDirectory,
      RELEASE_MANIFEST_NAME,
    );
    await attestationDownloader({
      artifactPath: releaseManifestPath,
      bundlePath: releaseManifestBundlePath,
    });
    await attestationVerifier({
      artifactPath: releaseManifestPath,
      bundlePath: releaseManifestBundlePath,
      repoRoot,
      sourceCommit,
    });
    const { platformAssets } = verifyReleaseManifest({
      manifest: releaseManifest,
      platform,
      repoRoot,
    });

    for (const metadata of Object.values(platformAssets)) {
      const content = await downloadReleaseAsset({
        fetchImpl,
        fileName: metadata.file,
        releaseBaseUrl,
        tagName,
      });
      assertDownloadedAsset(content, metadata);
      const artifactPath = path.join(temporaryDirectory, metadata.file);
      await fs.promises.writeFile(artifactPath, content, { mode: 0o600 });
      await attestationDownloader({
        artifactPath,
        bundlePath: getAttestationBundlePath(temporaryDirectory, metadata.file),
      });
    }
    await verifyCachedReleaseAssets({
      attestationVerifier,
      cacheDirectory: temporaryDirectory,
      platform,
      repoRoot,
    });
    await replaceDirectoryAtomically({
      outputDirectory: cacheDirectory,
      temporaryDirectory,
    });
  } catch (error) {
    await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
    throw error;
  }
}

async function materializePlatformFromCache({
  attestationVerifier,
  cacheDirectory,
  platform,
  projectRoot,
  repoRoot,
}) {
  const { assetPaths, tagName } = await verifyCachedReleaseAssets({
    attestationVerifier,
    cacheDirectory,
    platform,
    repoRoot,
  });
  const manifest = await readJsonFile(assetPaths.manifest);
  const outputDirectory = getPlatformOutputDirectory(projectRoot, platform);
  const temporaryRoot = `${outputDirectory}.restore-${process.pid}-${Date.now()}`;
  const artifactDirectory = path.join(temporaryRoot, 'artifact');
  await fs.promises.rm(temporaryRoot, { force: true, recursive: true });
  await fs.promises.mkdir(path.join(artifactDirectory, 'stubs'), {
    recursive: true,
  });
  try {
    await fs.promises.copyFile(
      assetPaths.manifest,
      path.join(artifactDirectory, 'manifest.json'),
    );
    await gunzipFile(
      assetPaths.source,
      path.join(
        artifactDirectory,
        assertSafeFileName(manifest.common?.source?.file),
      ),
    );
    await gunzipFile(
      assetPaths.bytecode,
      path.join(
        artifactDirectory,
        assertSafeFileName(manifest.common?.bytecode?.file),
      ),
    );
    for (const moduleRecord of manifest.modules || []) {
      if (!Number.isSafeInteger(moduleRecord.id) || moduleRecord.id <= 0) {
        throw new Error(
          '[metroDevPrebundle] Release manifest contains an invalid module ID.',
        );
      }
      await fs.promises.writeFile(
        path.join(artifactDirectory, 'stubs', `${moduleRecord.id}.js`),
        '',
      );
    }
    await verifyAndReplaceDirectory({
      outputDirectory,
      temporaryDirectory: artifactDirectory,
      verifyTemporaryDirectory: (candidateDirectory) =>
        verifyManifest({
          artifactDirectory: candidateDirectory,
          manifest,
          platform,
          projectRoot,
          repoRoot,
        }),
    });
    await fs.promises.rm(temporaryRoot, { force: true, recursive: true });
    return { fingerprint: manifest.fingerprint, tagName };
  } catch (error) {
    await fs.promises.rm(temporaryRoot, { force: true, recursive: true });
    throw error;
  }
}

async function withCacheLock(cacheDirectory, callback) {
  const lockDirectory = `${cacheDirectory}.lock`;
  const startedAt = Date.now();
  let lockAcquired = false;
  await ensureCacheDirectory(path.dirname(cacheDirectory));
  while (!lockAcquired) {
    try {
      await fs.promises.mkdir(lockDirectory, { mode: 0o700 });
      lockAcquired = true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      let stat;
      try {
        stat = await fs.promises.lstat(lockDirectory);
      } catch (statError) {
        if (statError?.code !== 'ENOENT') throw statError;
      }
      if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
        throw new Error(
          `[metroDevPrebundle] Invalid shared cache lock: ${lockDirectory}.`,
          { cause: error },
        );
      }
      if (stat && Date.now() - stat.mtimeMs > 10 * 60_000) {
        await fs.promises.rm(lockDirectory, { force: true, recursive: true });
      } else if (stat) {
        if (Date.now() - startedAt > 3 * 60_000) {
          throw new Error(
            `[metroDevPrebundle] Timed out waiting for shared cache lock: ${lockDirectory}.`,
            { cause: error },
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
  try {
    return await callback();
  } finally {
    await fs.promises.rm(lockDirectory, { force: true, recursive: true });
  }
}

async function touchAndPruneSharedCache(cacheRoot, currentTag) {
  const cacheVersionRoot = getCacheVersionRoot(cacheRoot);
  const currentTagDirectory = path.join(cacheVersionRoot, currentTag);
  const now = new Date();
  await fs.promises.utimes(currentTagDirectory, now, now);
  const entries = await fs.promises.readdir(cacheVersionRoot, {
    withFileTypes: true,
  });
  const tagDirectories = [];
  const expectedTagPrefix = `${devVendorConfig.releaseTagPrefix}-`;
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      entry.name.startsWith(expectedTagPrefix) &&
      /^[0-9a-f]{64}$/.test(entry.name.slice(expectedTagPrefix.length))
    ) {
      const directoryPath = path.join(cacheVersionRoot, entry.name);
      const stat = await fs.promises.lstat(directoryPath);
      if (!stat.isSymbolicLink()) {
        const children = await fs.promises.readdir(directoryPath, {
          withFileTypes: true,
        });
        tagDirectories.push({
          directoryPath,
          locked: children.some(
            (child) => child.isDirectory() && child.name.endsWith('.lock'),
          ),
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  }
  tagDirectories.sort((first, second) => second.mtimeMs - first.mtimeMs);
  for (const { directoryPath, locked } of tagDirectories.slice(
    MAX_CACHED_RELEASES,
  )) {
    if (!locked) {
      await fs.promises.rm(directoryPath, { force: true, recursive: true });
    }
  }
}

async function restorePlatformFromRelease({
  attestationDownloader = downloadArtifactAttestation,
  attestationVerifier = verifyArtifactAttestation,
  cacheRoot = getSharedCacheRoot(),
  fetchImpl,
  platform,
  projectRoot = MOBILE_DIR,
  releaseBaseUrl,
  repoRoot = REPO_ROOT,
}) {
  const tagName = getReleaseTag(repoRoot, process.env);
  await ensureCacheDirectory(cacheRoot);
  await ensureCacheDirectory(getCacheVersionRoot(cacheRoot));
  const cacheDirectory = getPlatformCacheDirectory({
    cacheRoot,
    platform,
    tagName,
  });
  return withCacheLock(cacheDirectory, async () => {
    if (await pathExists(cacheDirectory)) {
      try {
        const restored = await materializePlatformFromCache({
          attestationVerifier,
          cacheDirectory,
          platform,
          projectRoot,
          repoRoot,
        });
        await touchAndPruneSharedCache(cacheRoot, tagName);
        console.log(
          `[metroDevPrebundle] shared cache hit platform=${platform} tag=${tagName}`,
        );
        return { ...restored, sharedCacheHit: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
          `[metroDevPrebundle] rejected shared cache platform=${platform} reason=${reason}`,
        );
        await fs.promises.rm(cacheDirectory, { force: true, recursive: true });
      }
    }

    await downloadReleaseIntoCache({
      attestationDownloader,
      attestationVerifier,
      cacheDirectory,
      fetchImpl,
      platform,
      releaseBaseUrl,
      repoRoot,
      tagName,
    });
    const restored = await materializePlatformFromCache({
      attestationVerifier,
      cacheDirectory,
      platform,
      projectRoot,
      repoRoot,
    });
    await touchAndPruneSharedCache(cacheRoot, tagName);
    return { ...restored, sharedCacheHit: false };
  });
}

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!['package', 'tag'].includes(command)) {
    throw new Error(
      'Usage: metro-dev-prebundle.js <tag|package> [--output <path>] [--source-commit <sha>]',
    );
  }
  let outputDirectory;
  let sourceCommit;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output') {
      outputDirectory = argv[index + 1];
      if (!outputDirectory) throw new Error('--output requires a path.');
      index += 1;
    } else if (argument === '--source-commit') {
      sourceCommit = argv[index + 1];
      if (!sourceCommit) throw new Error('--source-commit requires a SHA.');
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}.`);
    }
  }
  if (command === 'tag' && (outputDirectory || sourceCommit)) {
    throw new Error('tag does not accept package options.');
  }
  return {
    command,
    outputDirectory: outputDirectory
      ? path.resolve(outputDirectory)
      : getReleaseOutputDirectory(),
    sourceCommit: sourceCommit || process.env.GITHUB_SHA,
  };
}

async function main() {
  devVendorConfig.applyTransformationEnvironment(process.env);
  const args = parseArgs();
  if (args.command === 'tag') {
    process.stdout.write(`${getReleaseTag()}\n`);
    return;
  }
  const manifest = await packagePrebundleRelease(args);
  console.log(
    `[metroDevPrebundle] packaged tag=${manifest.tagName} output=${args.outputDirectory}`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  PACKAGE_INVENTORY_NAME,
  RELEASE_MANIFEST_NAME,
  THIRD_PARTY_NOTICES_NAME,
  assertSafeOutputDirectory,
  collectPackageInventory,
  createThirdPartyNotices,
  downloadReleaseAsset,
  getPlatformCacheDirectory,
  getPlatformAssetNames,
  getReleaseOutputDirectory,
  getSharedCacheRoot,
  packagePrebundleRelease,
  parseArgs,
  replaceDirectoryAtomically,
  restorePlatformFromRelease,
  verifyArtifactAttestation,
  verifyAndReplaceDirectory,
  verifyCachedReleaseAssets,
  verifyReleaseManifest,
};
