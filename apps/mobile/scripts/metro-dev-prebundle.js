#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words LOCALAPPDATA prebundle sigstore */

const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
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
  computeNativeContractKey,
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
const SHARED_CACHE_SCHEMA_VERSION = 2;
const SHARED_CACHE_ENV = 'ONEKEY_METRO_PREBUNDLE_CACHE_DIR';
const MAX_CACHED_RELEASES = 5;
const CACHE_LOCK_OWNER_NAME = 'owner.json';
const CACHE_LOCK_RECLAIM_DIRECTORY_NAME = '.reclaim';
const CACHE_LOCK_STALE_MS = 10 * 60_000;
const CACHE_LOCK_WAIT_TIMEOUT_MS = 3 * 60_000;
const CACHE_LOCK_POLL_INTERVAL_MS = 250;
const CACHE_LOCK_HEARTBEAT_INTERVAL_MS = 30_000;
const GH_COMMAND_TIMEOUT_MS = 2 * 60_000;
const SUPPORTED_PLATFORMS = ['ios', 'android'];
const MAX_RELEASE_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_OCI_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_OCI_TOKEN_BYTES = 64 * 1024;
const MAX_ASSET_BYTES = 512 * 1024 * 1024;
const MAX_ATTESTATION_BYTES = 8 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const OCI_IMAGE_MANIFEST_MEDIA_TYPE =
  'application/vnd.oci.image.manifest.v1+json';
const OCI_LAYER_TITLE_ANNOTATION = 'org.opencontainers.image.title';
const OCI_SOURCE_ANNOTATION = 'org.opencontainers.image.source';
const OCI_REVISION_ANNOTATION = 'org.opencontainers.image.revision';
const PUBLIC_RELEASE_LICENSE_OVERRIDES = {
  '@aptos-labs/siwa@0.4.0': {
    license: 'Apache-2.0',
    licenseFile: 'LICENSE',
    sha256: '50ea466a9376fe67c72a1da4533eda4460a14cd59c2c1759e0af4d4cdb1d33b5',
  },
  'buffer-compare@1.1.1': {
    license: 'MIT',
    licenseFile: 'LICENSE',
    sha256: '7e13db436c0a802ef58d0096cc07323e53ad64ab9a5f3260c53e003e6dcd77d6',
  },
  'text-encoding-utf-8@1.0.2': {
    license: 'Unlicense',
    licenseFile: 'LICENSE.md',
    sha256: 'caecf721eb8d6c1d74e57a798ef53d9cbeb58fc637af1877741a5572455206ec',
  },
};

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

function assertReleaseTag(tagName) {
  const expectedPrefix = `${devVendorConfig.releaseTagPrefix}-`;
  if (
    !tagName.startsWith(expectedPrefix) ||
    !/^[0-9a-f]{64}$/.test(tagName.slice(expectedPrefix.length))
  ) {
    throw new Error(`[metroDevPrebundle] Invalid release tag: ${tagName}.`);
  }
  return tagName;
}

function getPlatformCacheDirectory({ cacheRoot, platform, tagName }) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`[metroDevPrebundle] Unsupported platform: ${platform}`);
  }
  return path.join(
    getCacheVersionRoot(cacheRoot),
    assertReleaseTag(tagName),
    platform,
  );
}

function getTagCacheLockDirectory(cacheRoot, tagName) {
  return path.join(
    getCacheVersionRoot(cacheRoot),
    '.locks',
    `${assertReleaseTag(tagName)}.lock`,
  );
}

function getTrustedRootPath(repoRoot = REPO_ROOT) {
  return path.resolve(repoRoot, TRUSTED_ROOT_REPO_PATH);
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

async function runGhCommand(args, { cwd, execFileImpl = execFileAsync } = {}) {
  try {
    return await execFileImpl('gh', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: GH_COMMAND_TIMEOUT_MS,
      windowsHide: true,
    });
  } catch (error) {
    throw new Error(
      `[metroDevPrebundle] GitHub CLI attestation command failed: gh ${args
        .slice(0, 2)
        .join(' ')}. Install or update GitHub CLI.`,
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

function getPackageLicense(packageJson, licenseFiles) {
  if (typeof packageJson.license === 'string') {
    return { license: packageJson.license, licenseSource: 'package.json' };
  }
  if (
    packageJson.license &&
    typeof packageJson.license === 'object' &&
    typeof packageJson.license.type === 'string'
  ) {
    return { license: packageJson.license.type, licenseSource: 'package.json' };
  }
  const packageKey = `${packageJson.name}@${packageJson.version}`;
  const override = PUBLIC_RELEASE_LICENSE_OVERRIDES[packageKey];
  if (!override) {
    return { license: 'UNKNOWN', licenseSource: 'missing' };
  }
  const reviewedFile = licenseFiles.find(
    (licenseFile) => licenseFile.name === override.licenseFile,
  );
  if (!reviewedFile || reviewedFile.sha256 !== override.sha256) {
    throw new Error(
      `[metroDevPrebundle] Reviewed license file changed for ${packageKey}.`,
    );
  }
  return { license: override.license, licenseSource: 'reviewed-override' };
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
    const bytes = fs.readFileSync(filePath);
    const content = bytes.toString('utf8').trim();
    return content.includes('\0')
      ? []
      : [{ content, name, sha256: sha256(bytes) }];
  });
}

function collectPackageInventory(platformManifests, repoRoot = REPO_ROOT) {
  const packages = new Map();
  for (const [platform, manifest] of Object.entries(platformManifests)) {
    const packageModules = [
      ...manifest.modules,
      ...(manifest.prependModules || []),
    ].filter((moduleRecord) =>
      moduleRecord.path.split('/').includes('node_modules'),
    );
    for (const moduleRecord of packageModules) {
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
        const licenseFiles = readPackageLicenseFiles(packageRoot);
        record = {
          ...getPackageLicense(packageJson, licenseFiles),
          licenseFiles,
          modulePaths: new Set(),
          name: packageJson.name || relativeRoot,
          packageRoot: relativeRoot,
          platforms: new Set(),
          private: packageJson.private === true,
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
      licenseSource: record.licenseSource,
      moduleCount: record.modulePaths.size,
      name: record.name,
      packageRoot: record.packageRoot,
      platforms: [...record.platforms].toSorted(),
      private: record.private,
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

function assertPublicRedistributionPolicy(packages) {
  const rejectedPackages = packages.filter((packageRecord) => {
    const license = packageRecord.license.trim().toUpperCase();
    return (
      packageRecord.private || license === 'UNKNOWN' || license === 'UNLICENSED'
    );
  });
  if (rejectedPackages.length > 0) {
    throw new Error(
      `[metroDevPrebundle] Public release contains packages without redistribution approval: ${rejectedPackages
        .map(
          (packageRecord) =>
            `${packageRecord.name}@${packageRecord.version} (${packageRecord.license})`,
        )
        .join(', ')}.`,
    );
  }
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
      `License source: ${packageRecord.licenseSource}`,
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
    assertPublicRedistributionPolicy(packages);
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
        nativeContractKeys: Object.fromEntries(
          SUPPORTED_PLATFORMS.map((platform) => [
            platform,
            computeNativeContractKey(platform, repoRoot),
          ]),
        ),
        registryEpoch: registry.registryEpoch,
        schemaVersion: devVendorConfig.SCHEMA_VERSION,
        strategyVersion: devVendorConfig.STRATEGY_VERSION,
      },
      platforms,
      artifactRepository: `${devVendorConfig.OCI_REGISTRY}/${devVendorConfig.OCI_REPOSITORY}`,
      repository: devVendorConfig.SOURCE_REPOSITORY,
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
    manifest.artifactRepository !==
      `${devVendorConfig.OCI_REGISTRY}/${devVendorConfig.OCI_REPOSITORY}` ||
    manifest.repository !== devVendorConfig.SOURCE_REPOSITORY ||
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
    manifest.devVendor?.nativeContractKeys?.[platform] !==
      computeNativeContractKey(platform, repoRoot) ||
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

async function readResponseBody({ response, fileName, maxBytes }) {
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

function parseBearerChallenge(challengeHeader) {
  const schemeMatch = challengeHeader?.match(/^Bearer\s+(.+)$/i);
  if (!schemeMatch) {
    throw new Error(
      '[metroDevPrebundle] OCI registry returned an unsupported authentication challenge.',
    );
  }
  const parameters = {};
  const parameterPattern = /(?:^|,)\s*([a-z][a-z0-9_-]*)="([^"]*)"/gi;
  for (const match of schemeMatch[1].matchAll(parameterPattern)) {
    parameters[match[1].toLowerCase()] = match[2];
  }
  if (!parameters.realm) {
    throw new Error(
      '[metroDevPrebundle] OCI registry authentication challenge has no realm.',
    );
  }
  return parameters;
}

function getOciRegistryBaseUrl(registryBaseUrl) {
  const url = new URL(
    registryBaseUrl || `https://${devVendorConfig.OCI_REGISTRY}`,
  );
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('[metroDevPrebundle] OCI registry URL must use HTTPS.');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function createOciClient({
  fetchImpl = globalThis.fetch,
  registryBaseUrl,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('[metroDevPrebundle] This Node.js runtime has no fetch.');
  }
  const baseUrl = getOciRegistryBaseUrl(registryBaseUrl);
  const repositoryScope = `repository:${devVendorConfig.OCI_REPOSITORY}:pull`;
  let authorization;

  async function fetchRegistry(url, { accept, timeoutMs }) {
    const request = () =>
      fetchImpl(url, {
        headers: {
          Accept: accept,
          ...(authorization ? { Authorization: authorization } : {}),
          'User-Agent': 'OneKey-Metro-Dev-Prebundle',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
    let response = await request();
    if (response.status !== 401) return response;

    const challenge = parseBearerChallenge(
      response.headers.get('www-authenticate'),
    );
    if (challenge.scope && challenge.scope !== repositoryScope) {
      throw new Error(
        '[metroDevPrebundle] OCI registry requested an unexpected authentication scope.',
      );
    }
    const tokenUrl = new URL(challenge.realm);
    if (
      tokenUrl.protocol !== 'https:' ||
      tokenUrl.username ||
      tokenUrl.password ||
      tokenUrl.origin !== new URL(baseUrl).origin
    ) {
      throw new Error(
        '[metroDevPrebundle] OCI registry returned an untrusted authentication realm.',
      );
    }
    if (challenge.service)
      tokenUrl.searchParams.set('service', challenge.service);
    tokenUrl.searchParams.set('scope', challenge.scope || repositoryScope);
    const tokenResponse = await fetchImpl(tokenUrl, {
      headers: { 'User-Agent': 'OneKey-Metro-Dev-Prebundle' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) {
      throw new Error(
        `[metroDevPrebundle] OCI registry token request failed: HTTP ${tokenResponse.status}.`,
      );
    }
    const tokenBytes = await readResponseBody({
      fileName: 'OCI registry token',
      maxBytes: MAX_OCI_TOKEN_BYTES,
      response: tokenResponse,
    });
    let tokenPayload;
    try {
      tokenPayload = JSON.parse(tokenBytes.toString('utf8'));
    } catch (error) {
      throw new Error(
        '[metroDevPrebundle] OCI registry token response is not valid JSON.',
        { cause: error },
      );
    }
    const token = tokenPayload.token || tokenPayload.access_token;
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > 16_384
    ) {
      throw new Error(
        '[metroDevPrebundle] OCI registry returned an invalid access token.',
      );
    }
    authorization = `Bearer ${token}`;
    response = await request();
    return response;
  }

  const repositoryUrl = `${baseUrl}/v2/${devVendorConfig.OCI_REPOSITORY}`;
  return {
    fetchBlob(digest, timeoutMs = 120_000) {
      if (!/^sha256:[0-9a-f]{64}$/.test(digest || '')) {
        throw new Error('[metroDevPrebundle] Invalid OCI blob digest.');
      }
      return fetchRegistry(`${repositoryUrl}/blobs/${digest}`, {
        accept: 'application/octet-stream',
        timeoutMs,
      });
    },
    fetchManifest(tagName) {
      return fetchRegistry(
        `${repositoryUrl}/manifests/${encodeURIComponent(
          assertReleaseTag(tagName),
        )}`,
        {
          accept: OCI_IMAGE_MANIFEST_MEDIA_TYPE,
          timeoutMs: 15_000,
        },
      );
    },
  };
}

function getExpectedOciAssetNames() {
  return [
    THIRD_PARTY_NOTICES_NAME,
    PACKAGE_INVENTORY_NAME,
    RELEASE_MANIFEST_NAME,
    devVendorConfig.RELEASE_ATTESTATION_BUNDLE_NAME,
    ...SUPPORTED_PLATFORMS.flatMap((platform) =>
      Object.values(getPlatformAssetNames(platform)),
    ),
  ];
}

function verifyOciManifest(manifest) {
  if (
    manifest?.schemaVersion !== 2 ||
    manifest.mediaType !== OCI_IMAGE_MANIFEST_MEDIA_TYPE ||
    manifest.artifactType !== devVendorConfig.OCI_ARTIFACT_TYPE ||
    !manifest.config ||
    !Array.isArray(manifest.layers) ||
    manifest.annotations?.[OCI_SOURCE_ANNOTATION] !==
      `https://github.com/${devVendorConfig.SOURCE_REPOSITORY}`
  ) {
    throw new Error('[metroDevPrebundle] Invalid OCI artifact manifest.');
  }
  for (const descriptor of [manifest.config, ...manifest.layers]) {
    if (
      typeof descriptor.mediaType !== 'string' ||
      descriptor.mediaType.length === 0 ||
      !Number.isSafeInteger(descriptor.size) ||
      descriptor.size <= 0 ||
      !/^sha256:[0-9a-f]{64}$/.test(descriptor.digest || '')
    ) {
      throw new Error('[metroDevPrebundle] Invalid OCI descriptor.');
    }
  }
  const expectedNames = getExpectedOciAssetNames();
  if (manifest.layers.length !== expectedNames.length) {
    throw new Error(
      '[metroDevPrebundle] OCI artifact layer set is incomplete.',
    );
  }
  const layersByFileName = new Map();
  for (const descriptor of manifest.layers) {
    const fileName = assertSafeFileName(
      descriptor.annotations?.[OCI_LAYER_TITLE_ANNOTATION],
    );
    if (!expectedNames.includes(fileName) || layersByFileName.has(fileName)) {
      throw new Error(
        `[metroDevPrebundle] Invalid OCI artifact layer: ${fileName}.`,
      );
    }
    layersByFileName.set(fileName, descriptor);
  }
  if (expectedNames.some((fileName) => !layersByFileName.has(fileName))) {
    throw new Error(
      '[metroDevPrebundle] OCI artifact layer set is incomplete.',
    );
  }
  return layersByFileName;
}

async function resolveOciArtifact({ fetchImpl, registryBaseUrl, tagName }) {
  const client = createOciClient({ fetchImpl, registryBaseUrl });
  const response = await client.fetchManifest(tagName);
  if (!response.ok) {
    throw new Error(
      `[metroDevPrebundle] OCI manifest download failed: HTTP ${response.status}.`,
    );
  }
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (contentType !== OCI_IMAGE_MANIFEST_MEDIA_TYPE) {
    throw new Error(
      `[metroDevPrebundle] OCI registry returned an unexpected manifest type: ${contentType || 'missing'}.`,
    );
  }
  const manifestBytes = await readResponseBody({
    fileName: 'OCI artifact manifest',
    maxBytes: MAX_OCI_MANIFEST_BYTES,
    response,
  });
  const manifestDigest = response.headers.get('docker-content-digest');
  if (
    !/^sha256:[0-9a-f]{64}$/.test(manifestDigest || '') ||
    manifestDigest !== `sha256:${sha256(manifestBytes)}`
  ) {
    throw new Error('[metroDevPrebundle] OCI manifest digest mismatch.');
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error(
      '[metroDevPrebundle] OCI artifact manifest is not valid JSON.',
      { cause: error },
    );
  }
  return {
    client,
    layersByFileName: verifyOciManifest(manifest),
    manifest,
    manifestDigest,
  };
}

async function downloadOciAsset({
  fileName,
  maxBytes = MAX_ASSET_BYTES,
  ociArtifact,
  timeoutMs = 120_000,
}) {
  const safeFileName = assertSafeFileName(fileName);
  const descriptor = ociArtifact.layersByFileName.get(safeFileName);
  if (!descriptor) {
    throw new Error(
      `[metroDevPrebundle] OCI artifact has no layer for ${safeFileName}.`,
    );
  }
  if (descriptor.size > maxBytes) {
    throw new Error(
      `[metroDevPrebundle] Downloaded asset is too large: ${safeFileName}.`,
    );
  }
  const response = await ociArtifact.client.fetchBlob(
    descriptor.digest,
    timeoutMs,
  );
  if (!response.ok) {
    throw new Error(
      `[metroDevPrebundle] OCI blob download failed for ${safeFileName}: HTTP ${response.status}.`,
    );
  }
  const content = await readResponseBody({
    fileName: safeFileName,
    maxBytes,
    response,
  });
  if (
    content.length !== descriptor.size ||
    `sha256:${sha256(content)}` !== descriptor.digest
  ) {
    throw new Error(
      `[metroDevPrebundle] OCI blob integrity mismatch: ${safeFileName}.`,
    );
  }
  return content;
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

function getAttestationBundlePath(cacheDirectory) {
  return path.join(
    cacheDirectory,
    devVendorConfig.RELEASE_ATTESTATION_BUNDLE_NAME,
  );
}

async function downloadReleaseAttestationBundle({ bundlePath, ociArtifact }) {
  const bundle = await downloadOciAsset({
    fileName: devVendorConfig.RELEASE_ATTESTATION_BUNDLE_NAME,
    maxBytes: MAX_ATTESTATION_BYTES,
    ociArtifact,
    timeoutMs: 15_000,
  });
  await fs.promises.writeFile(bundlePath, bundle, { mode: 0o600 });
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
    devVendorConfig.SOURCE_REPOSITORY,
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
    bundlePath: getAttestationBundlePath(cacheDirectory),
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
      bundlePath: getAttestationBundlePath(cacheDirectory),
      repoRoot,
      sourceCommit,
    });
    assetPaths[assetType] = artifactPath;
  }
  return { assetPaths, releaseManifest, tagName };
}

async function downloadReleaseIntoCache({
  attestationDownloader = downloadReleaseAttestationBundle,
  attestationVerifier = verifyArtifactAttestation,
  cacheDirectory,
  fetchImpl,
  platform,
  registryBaseUrl,
  repoRoot,
  tagName,
}) {
  const temporaryDirectory = `${cacheDirectory}.download-${process.pid}-${Date.now()}`;
  await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  await fs.promises.mkdir(temporaryDirectory, { mode: 0o700, recursive: true });
  try {
    const ociArtifact = await resolveOciArtifact({
      fetchImpl,
      registryBaseUrl,
      tagName,
    });
    const releaseManifestBytes = await downloadOciAsset({
      fileName: RELEASE_MANIFEST_NAME,
      maxBytes: MAX_RELEASE_MANIFEST_BYTES,
      ociArtifact,
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
    if (
      ociArtifact.manifest.annotations?.[OCI_REVISION_ANNOTATION] !==
      sourceCommit
    ) {
      throw new Error(
        '[metroDevPrebundle] OCI artifact revision does not match its release manifest.',
      );
    }
    const releaseManifestPath = path.join(
      temporaryDirectory,
      RELEASE_MANIFEST_NAME,
    );
    await fs.promises.writeFile(releaseManifestPath, releaseManifestBytes, {
      mode: 0o600,
    });
    const releaseManifestBundlePath =
      getAttestationBundlePath(temporaryDirectory);
    await attestationDownloader({
      bundlePath: releaseManifestBundlePath,
      ociArtifact,
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
      const content = await downloadOciAsset({
        fileName: metadata.file,
        ociArtifact,
      });
      assertDownloadedAsset(content, metadata);
      const artifactPath = path.join(temporaryDirectory, metadata.file);
      await fs.promises.writeFile(artifactPath, content, { mode: 0o600 });
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

class CacheLockTimeoutError extends Error {}

function isProcessRunning(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

async function readCacheLockOwner(lockDirectory, fileSystem = fs.promises) {
  const ownerPath = path.join(lockDirectory, CACHE_LOCK_OWNER_NAME);
  try {
    const stat = await fileSystem.lstat(ownerPath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size <= 0 ||
      stat.size > 4096
    ) {
      return undefined;
    }
    const owner = JSON.parse(await fileSystem.readFile(ownerPath, 'utf8'));
    if (
      !Number.isSafeInteger(owner.pid) ||
      owner.pid <= 0 ||
      typeof owner.token !== 'string' ||
      owner.token.length === 0
    ) {
      return undefined;
    }
    return owner;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
}

async function getCacheLockSnapshot(lockDirectory, fileSystem) {
  let lastStat;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const firstOwner = await readCacheLockOwner(lockDirectory, fileSystem);
    let firstStat;
    try {
      firstStat = await fileSystem.lstat(lockDirectory);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return {
          ageMs: undefined,
          identity: undefined,
          missing: true,
          owner: undefined,
          stable: true,
          stat: undefined,
        };
      }
      throw error;
    }
    const firstIdentity = `${String(firstStat.dev)}:${String(firstStat.ino)}`;
    const confirmedOwner = await readCacheLockOwner(lockDirectory, fileSystem);
    let confirmedStat;
    try {
      confirmedStat = await fileSystem.lstat(lockDirectory);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    lastStat = confirmedStat;
    if (confirmedStat) {
      const lastIdentity = `${String(confirmedStat.dev)}:${String(confirmedStat.ino)}`;
      if (
        firstIdentity === lastIdentity &&
        firstOwner?.token === confirmedOwner?.token
      ) {
        return {
          ageMs: Date.now() - confirmedStat.mtimeMs,
          identity: lastIdentity,
          missing: false,
          owner: confirmedOwner,
          stable: true,
          stat: confirmedStat,
        };
      }
    }
  }
  return {
    ageMs: lastStat ? Date.now() - lastStat.mtimeMs : undefined,
    identity: lastStat
      ? `${String(lastStat.dev)}:${String(lastStat.ino)}`
      : undefined,
    missing: !lastStat,
    owner: undefined,
    stable: false,
    stat: lastStat,
  };
}

function isSameCacheLockGeneration(first, second) {
  return (
    !first.missing &&
    !second.missing &&
    first.stable &&
    second.stable &&
    first.identity === second.identity &&
    first.owner?.token === second.owner?.token
  );
}

function isReclaimMarkerBoundToLock(marker, lock) {
  return (
    marker.stable &&
    lock.stable &&
    (!marker.owner ||
      (marker.owner.lockIdentity === lock.identity &&
        marker.owner.lockOwnerToken === (lock.owner?.token || null)))
  );
}

async function recoverAbandonedCacheReclaimMarker({
  fileSystem,
  lockDirectory,
  processIsRunning,
  reclaimDirectory,
  rootSnapshot,
  staleMs,
  token,
}) {
  const marker = await getCacheLockSnapshot(reclaimDirectory, fileSystem);
  if (marker.missing) return true;
  if (!isReclaimMarkerBoundToLock(marker, rootSnapshot)) return false;
  if (marker.owner && processIsRunning(marker.owner.pid)) return false;
  if (!marker.owner && marker.ageMs <= staleMs) return false;

  const confirmedRoot = await getCacheLockSnapshot(lockDirectory, fileSystem);
  const confirmedMarker = await getCacheLockSnapshot(
    reclaimDirectory,
    fileSystem,
  );
  if (
    !isSameCacheLockGeneration(rootSnapshot, confirmedRoot) ||
    !isSameCacheLockGeneration(marker, confirmedMarker) ||
    !isReclaimMarkerBoundToLock(confirmedMarker, confirmedRoot) ||
    (confirmedMarker.owner && processIsRunning(confirmedMarker.owner.pid))
  ) {
    return false;
  }

  const staleMarker = `${reclaimDirectory}.stale-${token}`;
  try {
    await fileSystem.rename(reclaimDirectory, staleMarker);
  } catch (error) {
    if (['EEXIST', 'ENOENT', 'ENOTEMPTY'].includes(error?.code)) return false;
    throw error;
  }
  const movedMarker = await getCacheLockSnapshot(staleMarker, fileSystem);
  const finalRoot = await getCacheLockSnapshot(lockDirectory, fileSystem);
  if (
    !isSameCacheLockGeneration(confirmedMarker, movedMarker) ||
    !isSameCacheLockGeneration(confirmedRoot, finalRoot)
  ) {
    return false;
  }
  await fileSystem.rm(staleMarker, { force: true, recursive: true });
  return true;
}

async function tryReclaimCacheLock({
  fileSystem,
  lockDirectory,
  processIsRunning,
  snapshot,
  staleMs,
  token,
}) {
  const reclaimDirectory = path.join(
    lockDirectory,
    CACHE_LOCK_RECLAIM_DIRECTORY_NAME,
  );
  const markerOwner = {
    lockIdentity: snapshot.identity,
    lockOwnerToken: snapshot.owner?.token || null,
    pid: process.pid,
    token,
  };
  let markerAcquired = false;
  let lockRenamed = false;
  try {
    try {
      await fileSystem.mkdir(reclaimDirectory, { mode: 0o700 });
      markerAcquired = true;
      try {
        await fileSystem.writeFile(
          path.join(reclaimDirectory, CACHE_LOCK_OWNER_NAME),
          `${JSON.stringify(markerOwner)}\n`,
          { flag: 'wx', mode: 0o600 },
        );
      } catch (error) {
        await fileSystem.rm(reclaimDirectory, {
          force: true,
          recursive: true,
        });
        markerAcquired = false;
        throw error;
      }
    } catch (error) {
      if (error?.code === 'ENOENT') return true;
      if (error?.code !== 'EEXIST') throw error;
      return recoverAbandonedCacheReclaimMarker({
        fileSystem,
        lockDirectory,
        processIsRunning,
        reclaimDirectory,
        rootSnapshot: snapshot,
        staleMs,
        token,
      });
    }

    const confirmedRoot = await getCacheLockSnapshot(lockDirectory, fileSystem);
    const confirmedMarker = await getCacheLockSnapshot(
      reclaimDirectory,
      fileSystem,
    );
    if (
      !isSameCacheLockGeneration(snapshot, confirmedRoot) ||
      confirmedMarker.owner?.token !== token ||
      !isReclaimMarkerBoundToLock(confirmedMarker, confirmedRoot) ||
      (confirmedRoot.owner && processIsRunning(confirmedRoot.owner.pid))
    ) {
      return false;
    }

    const staleDirectory = `${lockDirectory}.stale-${token}`;
    try {
      await fileSystem.rename(lockDirectory, staleDirectory);
      lockRenamed = true;
    } catch (error) {
      if (error?.code === 'ENOENT') return true;
      throw error;
    }
    const movedRoot = await getCacheLockSnapshot(staleDirectory, fileSystem);
    if (!isSameCacheLockGeneration(confirmedRoot, movedRoot)) {
      throw new Error(
        '[metroDevPrebundle] Shared cache lock generation changed while reclaiming.',
      );
    }
    await fileSystem.rm(staleDirectory, { force: true, recursive: true });
    return true;
  } finally {
    if (markerAcquired && !lockRenamed) {
      const currentMarker = await getCacheLockSnapshot(
        reclaimDirectory,
        fileSystem,
      );
      if (currentMarker.stable && currentMarker.owner?.token === token) {
        await fileSystem.rm(reclaimDirectory, {
          force: true,
          recursive: true,
        });
      }
    }
  }
}

async function withCacheLock(
  lockDirectory,
  callback,
  {
    fileSystem = fs.promises,
    heartbeatIntervalMs = CACHE_LOCK_HEARTBEAT_INTERVAL_MS,
    processIsRunning = isProcessRunning,
    staleMs = CACHE_LOCK_STALE_MS,
    waitPollIntervalMs = CACHE_LOCK_POLL_INTERVAL_MS,
    waitTimeoutMs = CACHE_LOCK_WAIT_TIMEOUT_MS,
  } = {},
) {
  const startedAt = Date.now();
  const token = randomUUID();
  await ensureCacheDirectory(path.dirname(lockDirectory));
  while (true) {
    try {
      await fileSystem.mkdir(lockDirectory, { mode: 0o700 });
      try {
        await fileSystem.writeFile(
          path.join(lockDirectory, CACHE_LOCK_OWNER_NAME),
          `${JSON.stringify({ pid: process.pid, token })}\n`,
          { flag: 'wx', mode: 0o600 },
        );
      } catch (error) {
        await fileSystem.rm(lockDirectory, { force: true, recursive: true });
        throw error;
      }
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const snapshot = await getCacheLockSnapshot(lockDirectory, fileSystem);
      if (
        !snapshot.missing &&
        (!snapshot.stat.isDirectory() || snapshot.stat.isSymbolicLink())
      ) {
        throw new Error(
          `[metroDevPrebundle] Invalid shared cache lock: ${lockDirectory}.`,
          { cause: error },
        );
      }
      let reclaimed = false;
      if (
        !snapshot.missing &&
        snapshot.stable &&
        snapshot.ageMs > staleMs &&
        (!snapshot.owner || !processIsRunning(snapshot.owner.pid))
      ) {
        reclaimed = await tryReclaimCacheLock({
          fileSystem,
          lockDirectory,
          processIsRunning,
          snapshot,
          staleMs,
          token,
        });
      }
      if (
        !reclaimed &&
        !snapshot.missing &&
        Date.now() - startedAt >= waitTimeoutMs
      ) {
        throw new CacheLockTimeoutError(
          `[metroDevPrebundle] Timed out waiting for shared cache lock: ${lockDirectory}.`,
          { cause: error },
        );
      }
      if (!reclaimed && !snapshot.missing) {
        await new Promise((resolve) => setTimeout(resolve, waitPollIntervalMs));
      }
    }
  }

  let heartbeat = Promise.resolve();
  const heartbeatTimer = setInterval(() => {
    heartbeat = heartbeat
      .then(async () => {
        const owner = await readCacheLockOwner(lockDirectory, fileSystem);
        if (owner?.token === token) {
          const now = new Date();
          await fileSystem.utimes(lockDirectory, now, now);
        }
      })
      .catch(() => undefined);
  }, heartbeatIntervalMs);
  heartbeatTimer.unref();
  try {
    return await callback();
  } finally {
    clearInterval(heartbeatTimer);
    await heartbeat;
    const owner = await readCacheLockOwner(lockDirectory, fileSystem);
    if (owner?.token === token) {
      await fileSystem.rm(lockDirectory, { force: true, recursive: true });
    }
  }
}

async function listCacheTagDirectories(cacheVersionRoot) {
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
        tagDirectories.push({
          directoryPath,
          mtimeMs: stat.mtimeMs,
          tagName: entry.name,
        });
      }
    }
  }
  return tagDirectories.toSorted(
    (first, second) => second.mtimeMs - first.mtimeMs,
  );
}

async function touchAndPruneSharedCache(cacheRoot, currentTag) {
  const cacheVersionRoot = getCacheVersionRoot(cacheRoot);
  const currentTagDirectory = path.join(cacheVersionRoot, currentTag);
  const now = new Date();
  await fs.promises.utimes(currentTagDirectory, now, now);
  const candidates = (await listCacheTagDirectories(cacheVersionRoot)).slice(
    MAX_CACHED_RELEASES,
  );
  for (const candidate of candidates) {
    try {
      await withCacheLock(
        getTagCacheLockDirectory(cacheRoot, candidate.tagName),
        async () => {
          const expiredTags = (await listCacheTagDirectories(cacheVersionRoot))
            .slice(MAX_CACHED_RELEASES)
            .map(({ tagName }) => tagName);
          if (expiredTags.includes(candidate.tagName)) {
            await fs.promises.rm(candidate.directoryPath, {
              force: true,
              recursive: true,
            });
          }
        },
        { waitTimeoutMs: 0 },
      );
    } catch (error) {
      if (!(error instanceof CacheLockTimeoutError)) throw error;
    }
  }
}

async function restorePlatformFromRelease({
  attestationDownloader = downloadReleaseAttestationBundle,
  attestationVerifier = verifyArtifactAttestation,
  cacheRoot = getSharedCacheRoot(),
  fetchImpl,
  platform,
  projectRoot = MOBILE_DIR,
  registryBaseUrl,
  repoRoot = REPO_ROOT,
}) {
  const tagName = getReleaseTag(repoRoot, process.env);
  await ensureCacheDirectory(cacheRoot);
  await ensureCacheDirectory(getCacheVersionRoot(cacheRoot));
  await ensureCacheDirectory(
    path.dirname(getTagCacheLockDirectory(cacheRoot, tagName)),
  );
  const cacheDirectory = getPlatformCacheDirectory({
    cacheRoot,
    platform,
    tagName,
  });
  return withCacheLock(
    getTagCacheLockDirectory(cacheRoot, tagName),
    async () => {
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
          await fs.promises.rm(cacheDirectory, {
            force: true,
            recursive: true,
          });
        }
      }

      await downloadReleaseIntoCache({
        attestationDownloader,
        attestationVerifier,
        cacheDirectory,
        fetchImpl,
        platform,
        registryBaseUrl,
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
    },
  );
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
  PUBLIC_RELEASE_LICENSE_OVERRIDES,
  RELEASE_MANIFEST_NAME,
  THIRD_PARTY_NOTICES_NAME,
  assertPublicRedistributionPolicy,
  assertSafeOutputDirectory,
  collectPackageInventory,
  createThirdPartyNotices,
  downloadOciAsset,
  downloadReleaseAttestationBundle,
  getPlatformCacheDirectory,
  getPlatformAssetNames,
  getReleaseOutputDirectory,
  getSharedCacheRoot,
  getTagCacheLockDirectory,
  packagePrebundleRelease,
  parseArgs,
  replaceDirectoryAtomically,
  resolveOciArtifact,
  restorePlatformFromRelease,
  runGhCommand,
  touchAndPruneSharedCache,
  verifyArtifactAttestation,
  verifyAndReplaceDirectory,
  verifyCachedReleaseAssets,
  verifyOciManifest,
  verifyReleaseManifest,
  withCacheLock,
};
