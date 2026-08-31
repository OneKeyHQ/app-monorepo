#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words prebundle */

const path = require('path');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');

const fs = require('fs-extra');

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
const RELEASE_MANIFEST_NAME = 'metro-dev-prebundle-release.json';
const PACKAGE_INVENTORY_NAME = 'metro-dev-prebundle-packages.json';
const THIRD_PARTY_NOTICES_NAME = 'THIRD_PARTY_NOTICES.txt';
const SUPPORTED_PLATFORMS = ['ios', 'android'];
const MAX_RELEASE_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 512 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

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
  const content = await fs.readFile(filePath);
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
        const packageJson = fs.readJsonSync(
          path.join(packageRoot, 'package.json'),
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

async function verifyAndReplaceDirectory({
  outputDirectory,
  temporaryDirectory,
  verifyTemporaryDirectory,
}) {
  try {
    await verifyTemporaryDirectory(temporaryDirectory);
  } catch (error) {
    await fs.remove(temporaryDirectory);
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
  await fs.remove(releaseOutputDirectory);
  await fs.ensureDir(releaseOutputDirectory);
  try {
    for (const platform of SUPPORTED_PLATFORMS) {
      const artifactDirectory = getPlatformOutputDirectory(
        projectRoot,
        platform,
      );
      const manifestPath = path.join(artifactDirectory, 'manifest.json');
      const manifest = verifyManifest({
        artifactDirectory,
        manifest: await fs.readJson(manifestPath),
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
      await fs.copyFile(manifestPath, releaseManifestPath);
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
    await fs.writeFile(
      packageInventoryPath,
      `${JSON.stringify(
        { packages: inventoryPackages, schemaVersion: 1, sourceCommit },
        null,
        2,
      )}\n`,
    );
    await fs.writeFile(noticesPath, createThirdPartyNotices(packages));

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
    await fs.writeFile(
      path.join(releaseOutputDirectory, RELEASE_MANIFEST_NAME),
      `${JSON.stringify(releaseManifest, null, 2)}\n`,
    );
    return releaseManifest;
  } catch (error) {
    await fs.remove(releaseOutputDirectory);
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
    manifest.tagName !== tagName
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

async function restorePlatformFromRelease({
  fetchImpl,
  platform,
  projectRoot = MOBILE_DIR,
  releaseBaseUrl,
  repoRoot = REPO_ROOT,
}) {
  const tagName = getReleaseTag(repoRoot, process.env);
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
    throw new Error('[metroDevPrebundle] Release manifest is not valid JSON.', {
      cause: error,
    });
  }
  const { platformAssets } = verifyReleaseManifest({
    manifest: releaseManifest,
    platform,
    repoRoot,
  });
  const outputDirectory = getPlatformOutputDirectory(projectRoot, platform);
  const temporaryRoot = `${outputDirectory}.download-${process.pid}-${Date.now()}`;
  const artifactDirectory = path.join(temporaryRoot, 'artifact');
  const downloadDirectory = path.join(temporaryRoot, 'download');
  await fs.remove(temporaryRoot);
  await fs.ensureDir(path.join(artifactDirectory, 'stubs'));
  await fs.ensureDir(downloadDirectory);
  try {
    const downloadedAssets = {};
    for (const [assetType, metadata] of Object.entries(platformAssets)) {
      const content = await downloadReleaseAsset({
        fetchImpl,
        fileName: metadata.file,
        releaseBaseUrl,
        tagName,
      });
      assertDownloadedAsset(content, metadata);
      downloadedAssets[assetType] = path.join(downloadDirectory, metadata.file);
      await fs.writeFile(downloadedAssets[assetType], content);
    }

    const manifest = await fs.readJson(downloadedAssets.manifest);
    await fs.copyFile(
      downloadedAssets.manifest,
      path.join(artifactDirectory, 'manifest.json'),
    );
    await gunzipFile(
      downloadedAssets.source,
      path.join(
        artifactDirectory,
        assertSafeFileName(manifest.common?.source?.file),
      ),
    );
    await gunzipFile(
      downloadedAssets.bytecode,
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
      fs.writeFileSync(
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
    await fs.remove(temporaryRoot);
    return { fingerprint: manifest.fingerprint, tagName };
  } catch (error) {
    await fs.remove(temporaryRoot);
    throw error;
  }
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
  getPlatformAssetNames,
  getReleaseOutputDirectory,
  packagePrebundleRelease,
  parseArgs,
  replaceDirectoryAtomically,
  restorePlatformFromRelease,
  verifyAndReplaceDirectory,
  verifyReleaseManifest,
};
