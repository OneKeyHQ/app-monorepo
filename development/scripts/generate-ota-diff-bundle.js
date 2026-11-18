#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:ignore aapt xhdpi uncrunched udev onekeyd icns */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RESERVED_METADATA_KEYS = Object.freeze([
  'requiresBackgroundBundle',
  'backgroundProtocolVersion',
  'requiresCommonBundle',
  'bundleFormat',
  'storageSchemaVersion',
]);

const RESERVED_METADATA_KEY_SET = new Set(RESERVED_METADATA_KEYS);

const SUPPORTED_APP_TYPES = Object.freeze(['ios', 'android', 'electron']);

const HASH_ALGORITHMS = Object.freeze({
  electron: 'sha512',
  ios: 'sha256',
  android: 'sha256',
});

const HASH_HEX_LENGTHS = Object.freeze({
  sha256: 64,
  sha512: 128,
});

const FORBIDDEN_BUNDLE_FILE_NAMES = new Set([
  'metadata.json',
  'diff-manifest.json',
  'dist.zip',
  '.DS_Store',
]);

// Files present in Rspack/Metro bundle output (and hashed into metadata.json)
// that are excluded or byte-altered by the native app packager (electron-builder
// or Android aapt2) when building the built-in 6.8.0 app without modifying
// native packaging scripts. These files are always included in `changedFiles`
// so a fresh built-in install can reconstruct 100% of `metadata.json`.
const ELECTRON_ASAR_EXCLUDED_ICON_PATHS = new Set([
  'static/images/icons/512x512.icns',
  'static/images/icons/512x512@2x.png',
  'static/images/icons/background.tiff',
  'static/images/icons/dmg.icns',
  'static/images/icons/icon.icns',
  'static/images/icons/installerIcon.ico',
  'static/images/icons/installerSidebar.bmp',
]);

function isBuiltinNonPreservedFile(appType, relPath) {
  if (appType === 'electron') {
    if (ELECTRON_ASAR_EXCLUDED_ICON_PATHS.has(relPath)) {
      return true;
    }
    if (relPath.startsWith('static/bin/')) {
      return true;
    }
    return false;
  }
  if (appType === 'android') {
    if (relPath === 'assets/raw/keep.xml') {
      return true;
    }
    if (/^assets\/drawable[^/]*\/.+\.png$/i.test(relPath)) {
      return true;
    }
    return false;
  }
  return false;
}

function isHexOfLength(value, expectedLength) {
  if (typeof value !== 'string' || value.length !== expectedLength) {
    return false;
  }
  return /^[0-9a-fA-F]+$/.test(value);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashFileWithAlgorithm(filePath, algorithm) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or invalid required option: ${fieldName}`);
  }
  return value.trim();
}

function assertVersionValue(value, fieldName) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return assertNonEmptyString(value, fieldName);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}

function sortObjectKeys(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).toSorted()) {
    sorted[key] = obj[key];
  }
  return sorted;
}

function assertSafeRelativePath(relPath, label) {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw new Error(`${label} contains an empty file path key`);
  }
  if (
    relPath.includes('\0') ||
    relPath.includes('\\') ||
    path.isAbsolute(relPath)
  ) {
    throw new Error(`${label} contains an unsafe file path: ${relPath}`);
  }
  if (FORBIDDEN_BUNDLE_FILE_NAMES.has(relPath)) {
    throw new Error(`${label} contains a forbidden file path: ${relPath}`);
  }
  const segments = relPath.split('/');
  if (segments.some((seg) => seg.length === 0 || seg === '.' || seg === '..')) {
    throw new Error(`${label} contains a path traversal entry: ${relPath}`);
  }
  return relPath;
}

function validateFullMetadataSpec(metadata, appType, label = 'metadata.json') {
  assertPlainObject(metadata, label);
  if (!SUPPORTED_APP_TYPES.includes(appType)) {
    throw new Error(
      `Unsupported appType "${appType}". Expected one of: ${SUPPORTED_APP_TYPES.join(', ')}`,
    );
  }
  const hashAlgorithm = HASH_ALGORITHMS[appType];
  const expectedHexLen = HASH_HEX_LENGTHS[hashAlgorithm];
  const fileEntries = {};
  const reservedEntries = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (RESERVED_METADATA_KEY_SET.has(key)) {
      if (appType === 'electron') {
        throw new Error(
          `${label} for electron must not contain reserved mobile key "${key}"`,
        );
      }
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${label} has invalid reserved value for key "${key}"`);
      }
      reservedEntries[key] = value;
    } else {
      assertSafeRelativePath(key, label);
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(
          `${label} has non-string or empty hash for file key "${key}"`,
        );
      }
      if (!isHexOfLength(value, expectedHexLen)) {
        throw new Error(
          `${label} has invalid ${hashAlgorithm} hash for file key "${key}"`,
        );
      }
      fileEntries[key] = value.toLowerCase();
    }
  }

  return {
    hashAlgorithm,
    fileEntries,
    reservedEntries,
  };
}

function validateDiffManifestSpec(
  diffManifest,
  {
    appType,
    appVersion,
    bundleVersion,
    targetMetadata,
    targetMetadataSha256,
  } = {},
) {
  assertPlainObject(diffManifest, 'diff-manifest.json');
  if (diffManifest.schemaVersion !== 1) {
    throw new Error(
      `Unsupported diff-manifest schemaVersion: ${String(diffManifest.schemaVersion)}`,
    );
  }
  const manifestAppType = assertNonEmptyString(
    diffManifest.appType,
    'diffManifest.appType',
  );
  if (!SUPPORTED_APP_TYPES.includes(manifestAppType)) {
    throw new Error(`Unsupported diffManifest.appType: ${manifestAppType}`);
  }
  if (appType && manifestAppType !== appType) {
    throw new Error(
      `diffManifest.appType mismatch: expected "${appType}", got "${manifestAppType}"`,
    );
  }
  if (appVersion && String(diffManifest.appVersion) !== String(appVersion)) {
    throw new Error(
      `diffManifest.appVersion mismatch: expected "${appVersion}", got "${String(diffManifest.appVersion)}"`,
    );
  }
  if (
    bundleVersion &&
    String(diffManifest.targetBundleVersion) !== String(bundleVersion)
  ) {
    throw new Error(
      `diffManifest.targetBundleVersion mismatch: expected "${bundleVersion}", got "${String(diffManifest.targetBundleVersion)}"`,
    );
  }
  const expectedHashAlgorithm = HASH_ALGORITHMS[manifestAppType];
  if (diffManifest.hashAlgorithm !== expectedHashAlgorithm) {
    throw new Error(
      `diffManifest.hashAlgorithm mismatch: expected "${expectedHashAlgorithm}", got "${String(diffManifest.hashAlgorithm)}"`,
    );
  }
  if (!isHexOfLength(diffManifest.baseMetadataSha256, 64)) {
    throw new Error(
      'diffManifest.baseMetadataSha256 must be 64-char sha256 hex',
    );
  }
  if (!isHexOfLength(diffManifest.targetMetadataSha256, 64)) {
    throw new Error(
      'diffManifest.targetMetadataSha256 must be 64-char sha256 hex',
    );
  }
  if (
    targetMetadataSha256 &&
    diffManifest.targetMetadataSha256.toLowerCase() !==
      targetMetadataSha256.toLowerCase()
  ) {
    throw new Error(
      'diffManifest.targetMetadataSha256 does not match metadata.json',
    );
  }

  assertPlainObject(diffManifest.changedFiles, 'diffManifest.changedFiles');
  assertPlainObject(diffManifest.reusedFiles, 'diffManifest.reusedFiles');
  const expectedHexLen = HASH_HEX_LENGTHS[expectedHashAlgorithm];

  for (const [relPath, hash] of Object.entries(diffManifest.changedFiles)) {
    assertSafeRelativePath(relPath, 'diffManifest.changedFiles');
    if (!isHexOfLength(hash, expectedHexLen)) {
      throw new Error(
        `Invalid ${expectedHashAlgorithm} hash in changedFiles for "${relPath}"`,
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(diffManifest.reusedFiles, relPath)
    ) {
      throw new Error(
        `Overlapping file path in changedFiles and reusedFiles: "${relPath}"`,
      );
    }
  }

  for (const [relPath, hash] of Object.entries(diffManifest.reusedFiles)) {
    assertSafeRelativePath(relPath, 'diffManifest.reusedFiles');
    if (!isHexOfLength(hash, expectedHexLen)) {
      throw new Error(
        `Invalid ${expectedHashAlgorithm} hash in reusedFiles for "${relPath}"`,
      );
    }
  }

  if (diffManifest.deletedFiles !== undefined) {
    if (!Array.isArray(diffManifest.deletedFiles)) {
      throw new Error('diffManifest.deletedFiles must be an array');
    }
    for (const deletedPath of diffManifest.deletedFiles) {
      assertSafeRelativePath(deletedPath, 'diffManifest.deletedFiles');
      if (
        Object.prototype.hasOwnProperty.call(
          diffManifest.changedFiles,
          deletedPath,
        ) ||
        Object.prototype.hasOwnProperty.call(
          diffManifest.reusedFiles,
          deletedPath,
        )
      ) {
        throw new Error(
          `deletedFiles entry "${deletedPath}" overlaps changedFiles or reusedFiles`,
        );
      }
    }
  }

  if (targetMetadata) {
    const { fileEntries } = validateFullMetadataSpec(
      targetMetadata,
      manifestAppType,
      'targetMetadata',
    );
    const targetKeys = Object.keys(fileEntries);
    const changedKeys = Object.keys(diffManifest.changedFiles);
    const reusedKeys = Object.keys(diffManifest.reusedFiles);
    if (changedKeys.length + reusedKeys.length !== targetKeys.length) {
      throw new Error(
        `Partition count mismatch: changedFiles(${changedKeys.length}) + reusedFiles(${reusedKeys.length}) !== targetMetadata(${targetKeys.length})`,
      );
    }
    for (const [relPath, expectedHash] of Object.entries(fileEntries)) {
      const fromChanged = diffManifest.changedFiles[relPath];
      const fromReused = diffManifest.reusedFiles[relPath];
      const candidate = fromChanged ?? fromReused;
      if (
        typeof candidate !== 'string' ||
        candidate.toLowerCase() !== expectedHash.toLowerCase()
      ) {
        throw new Error(
          `Partition mismatch for "${relPath}": diffManifest does not match targetMetadata`,
        );
      }
    }
  }

  return true;
}

function extractFileHashes(metadata, label) {
  assertPlainObject(metadata, label);
  const files = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!RESERVED_METADATA_KEY_SET.has(key)) {
      assertSafeRelativePath(key, label);
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(
          `${label} has non-string or empty hash for file key "${key}"`,
        );
      }
      files[key] = value;
    }
  }
  return files;
}

function resolveContainedPath(baseDir, relPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, relPath);
  if (
    resolvedTarget !== resolvedBase &&
    !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)
  ) {
    throw new Error(`Path escapes base directory ${resolvedBase}: ${relPath}`);
  }
  return resolvedTarget;
}

function resolveTargetFilePath(targetBundleDir, appType, relPath) {
  const contentRoot =
    appType === 'electron'
      ? path.join(targetBundleDir, 'build')
      : targetBundleDir;
  return resolveContainedPath(contentRoot, relPath);
}

function resolveStagingFilePath(stagingDir, appType, relPath) {
  const contentRoot =
    appType === 'electron' ? path.join(stagingDir, 'build') : stagingDir;
  return resolveContainedPath(contentRoot, relPath);
}

function buildFileInfo({
  fileName,
  buffer,
  appType,
  appVersion,
  buildNumber,
  bundleVersion,
  generatedAt,
}) {
  return {
    fileName,
    sha256: sha256Buffer(buffer),
    size: buffer.length,
    generatedAt: generatedAt || new Date().toISOString(),
    appType,
    appVersion,
    buildNumber,
    bundleVersion,
  };
}

function readJsonMetadata(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  const rawBuffer = fs.readFileSync(filePath);
  let parsed;
  try {
    parsed = JSON.parse(rawBuffer.toString('utf8'));
  } catch (error) {
    throw new Error(
      `Failed to parse ${label} at ${filePath}: ${error.message}`,
      { cause: error },
    );
  }
  assertPlainObject(parsed, label);
  return { rawBuffer, parsed };
}

function generateOtaDiffBundle(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('generateOtaDiffBundle requires an options object');
  }

  const appType = assertNonEmptyString(options.appType, 'appType');
  if (!SUPPORTED_APP_TYPES.includes(appType)) {
    throw new Error(
      `Unsupported appType "${appType}". Expected one of: ${SUPPORTED_APP_TYPES.join(', ')}`,
    );
  }

  const appVersion = assertVersionValue(options.appVersion, 'appVersion');
  const baseAppVersion = options.baseAppVersion
    ? assertVersionValue(options.baseAppVersion, 'baseAppVersion')
    : appVersion;
  const buildNumber = assertVersionValue(options.buildNumber, 'buildNumber');
  const bundleVersion = assertVersionValue(
    options.bundleVersion,
    'bundleVersion',
  );
  const baseMetadataPath = assertNonEmptyString(
    options.baseMetadataPath,
    'baseMetadataPath',
  );
  const targetBundleDir = assertNonEmptyString(
    options.targetBundleDir,
    'targetBundleDir',
  );
  const outputZipPath = assertNonEmptyString(
    options.outputZipPath,
    'outputZipPath',
  );
  const outputDiffZipInfoPath = assertNonEmptyString(
    options.outputDiffZipInfoPath,
    'outputDiffZipInfoPath',
  );
  const outputDiffManifestInfoPath = assertNonEmptyString(
    options.outputDiffManifestInfoPath,
    'outputDiffManifestInfoPath',
  );
  const outputDiffManifestPath = options.outputDiffManifestPath
    ? assertNonEmptyString(
        options.outputDiffManifestPath,
        'outputDiffManifestPath',
      )
    : undefined;
  const generatedAt = options.generatedAt;
  const execFileSyncImpl = options.execFileSyncImpl || execFileSync;

  if (
    !fs.existsSync(targetBundleDir) ||
    !fs.statSync(targetBundleDir).isDirectory()
  ) {
    throw new Error(`targetBundleDir is not a directory: ${targetBundleDir}`);
  }

  const targetMetadataPath = path.join(targetBundleDir, 'metadata.json');
  const { rawBuffer: baseRawBuffer, parsed: baseMetadata } = readJsonMetadata(
    baseMetadataPath,
    'baseMetadata',
  );
  const { rawBuffer: targetRawBuffer, parsed: targetMetadata } =
    readJsonMetadata(targetMetadataPath, 'targetMetadata');

  const baseMetadataSha256 = sha256Buffer(baseRawBuffer);
  const targetMetadataSha256 = sha256Buffer(targetRawBuffer);
  const hashAlgorithm = HASH_ALGORITHMS[appType];

  const baseFiles = extractFileHashes(baseMetadata, 'baseMetadata');
  const targetFiles = extractFileHashes(targetMetadata, 'targetMetadata');

  const changedFiles = {};
  const reusedFiles = {};
  const deletedFiles = [];

  for (const [relPath, targetHash] of Object.entries(targetFiles)) {
    const canReuseFromBuiltin =
      options.allowNonPreservedInReuse === true ||
      !isBuiltinNonPreservedFile(appType, relPath);
    if (
      canReuseFromBuiltin &&
      Object.prototype.hasOwnProperty.call(baseFiles, relPath) &&
      baseFiles[relPath] === targetHash
    ) {
      reusedFiles[relPath] = targetHash;
    } else {
      changedFiles[relPath] = targetHash;
    }
  }

  for (const relPath of Object.keys(baseFiles)) {
    if (!Object.prototype.hasOwnProperty.call(targetFiles, relPath)) {
      deletedFiles.push(relPath);
    }
  }

  const sortedChangedFiles = sortObjectKeys(changedFiles);
  const sortedReusedFiles = sortObjectKeys(reusedFiles);
  const sortedDeletedFiles = deletedFiles.toSorted();

  const diffManifest = {
    schemaVersion: 1,
    appType,
    appVersion,
    baseAppVersion,
    baseMetadataSha256,
    targetBundleVersion: bundleVersion,
    targetMetadataSha256,
    hashAlgorithm,
    changedFiles: sortedChangedFiles,
    reusedFiles: sortedReusedFiles,
    deletedFiles: sortedDeletedFiles,
  };

  const diffManifestBuffer = Buffer.from(
    JSON.stringify(diffManifest, null, 2),
    'utf8',
  );

  const resolvedOutputZipPath = path.resolve(outputZipPath);
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-diff-bundle-'));

  try {
    fs.writeFileSync(
      path.join(stagingDir, 'diff-manifest.json'),
      diffManifestBuffer,
    );
    fs.writeFileSync(path.join(stagingDir, 'metadata.json'), targetRawBuffer);

    for (const relPath of Object.keys(sortedChangedFiles)) {
      const srcPath = resolveTargetFilePath(targetBundleDir, appType, relPath);
      if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
        throw new Error(
          `Missing changed file for ${appType} diff bundle: ${srcPath}`,
        );
      }
      const destPath = resolveStagingFilePath(stagingDir, appType, relPath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }

    fs.mkdirSync(path.dirname(resolvedOutputZipPath), { recursive: true });
    fs.rmSync(resolvedOutputZipPath, { force: true });

    execFileSyncImpl('zip', ['-r', '-q', resolvedOutputZipPath, '.'], {
      cwd: stagingDir,
      stdio: 'inherit',
    });
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  const zipBuffer = fs.readFileSync(resolvedOutputZipPath);
  const diffZipInfo = buildFileInfo({
    fileName: path.basename(resolvedOutputZipPath),
    buffer: zipBuffer,
    appType,
    appVersion,
    buildNumber,
    bundleVersion,
    generatedAt,
  });

  const diffManifestInfo = buildFileInfo({
    fileName: 'diff-manifest.json',
    buffer: diffManifestBuffer,
    appType,
    appVersion,
    buildNumber,
    bundleVersion,
    generatedAt,
  });

  fs.mkdirSync(path.dirname(outputDiffZipInfoPath), { recursive: true });
  fs.writeFileSync(outputDiffZipInfoPath, JSON.stringify(diffZipInfo, null, 2));

  fs.mkdirSync(path.dirname(outputDiffManifestInfoPath), { recursive: true });
  fs.writeFileSync(
    outputDiffManifestInfoPath,
    JSON.stringify(diffManifestInfo, null, 2),
  );

  if (outputDiffManifestPath) {
    fs.mkdirSync(path.dirname(outputDiffManifestPath), { recursive: true });
    fs.writeFileSync(outputDiffManifestPath, diffManifestBuffer);
  }

  return {
    diffManifest,
    diffZipInfo,
    diffManifestInfo,
    outputZipPath: resolvedOutputZipPath,
    outputDiffZipInfoPath,
    outputDiffManifestInfoPath,
    outputDiffManifestPath,
  };
}

function parseCliArgs(argv) {
  const flagMap = {
    '--app-type': 'appType',
    '--app-version': 'appVersion',
    '--base-app-version': 'baseAppVersion',
    '--build-number': 'buildNumber',
    '--bundle-version': 'bundleVersion',
    '--base-metadata-path': 'baseMetadataPath',
    '--target-bundle-dir': 'targetBundleDir',
    '--output-zip-path': 'outputZipPath',
    '--output-diff-zip-info-path': 'outputDiffZipInfoPath',
    '--output-diff-manifest-info-path': 'outputDiffManifestInfoPath',
    '--output-diff-manifest-path': 'outputDiffManifestPath',
  };

  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      const eqIndex = arg.indexOf('=');
      let flag = arg;
      let value;
      if (eqIndex !== -1) {
        flag = arg.slice(0, eqIndex);
        value = arg.slice(eqIndex + 1);
      } else {
        if (i + 1 >= argv.length) {
          throw new Error(`Missing value for argument: ${flag}`);
        }
        i += 1;
        value = argv[i];
      }
      const optionKey = flagMap[flag];
      if (!optionKey) {
        throw new Error(`Unknown argument: ${flag}`);
      }
      options[optionKey] = value;
    }
  }
  return options;
}

function printUsage() {
  console.log(
    [
      'Usage: node development/scripts/generate-ota-diff-bundle.js [options]',
      '',
      'Required options:',
      '  --app-type <ios|android|electron>',
      '  --app-version <version>',
      '  --build-number <buildNumber>',
      '  --bundle-version <bundleVersion>',
      '  --base-metadata-path <path>',
      '  --target-bundle-dir <path>',
      '  --output-zip-path <path>',
      '  --output-diff-zip-info-path <path>',
      '  --output-diff-manifest-info-path <path>',
      '',
      'Optional:',
      '  --base-app-version <version> (defaults to --app-version)',
      '  --output-diff-manifest-path <path>',
    ].join('\n'),
  );
}

if (require.main === module) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.help) {
      printUsage();
      process.exit(0);
    }
    const result = generateOtaDiffBundle(options);
    console.log(
      `Generated OTA diff bundle (${result.diffManifest.appType}): ` +
        `changed=${Object.keys(result.diffManifest.changedFiles).length}, ` +
        `reused=${Object.keys(result.diffManifest.reusedFiles).length}, ` +
        `deleted=${result.diffManifest.deletedFiles.length}, ` +
        `zipSize=${result.diffZipInfo.size}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function resolveBuiltinCandidateRelPaths(appType, relPath) {
  assertSafeRelativePath(relPath, 'reusedFiles');
  if (appType === 'ios') {
    if (relPath === 'main.jsbundle.hbc') {
      return ['main.jsbundle.hbc', 'main.jsbundle'];
    }
    if (relPath.startsWith('assets/assets/')) {
      const strippedOne = relPath.slice('assets/'.length);
      const strippedTwo = relPath.slice('assets/assets/'.length);
      return [relPath, strippedOne, strippedTwo];
    }
    if (relPath.startsWith('assets/')) {
      const stripped = relPath.slice('assets/'.length);
      return [relPath, `assets/${relPath}`, stripped];
    }
    return [relPath];
  }
  if (appType === 'android') {
    if (relPath === 'main.jsbundle.hbc') {
      return ['main.jsbundle.hbc', 'index.android.bundle'];
    }
    if (relPath.startsWith('assets/')) {
      const stripped = relPath.slice('assets/'.length);
      const candidates = [relPath, stripped, `assets/${relPath}`];
      const parts = stripped.split('/');
      if (
        parts.length === 2 &&
        (parts[0].startsWith('drawable') || parts[0] === 'raw')
      ) {
        candidates.push(
          `res/${parts[0]}/${parts[1]}`,
          `res/${parts[0]}-v4/${parts[1]}`,
        );
      }
      return [...new Set(candidates)];
    }
    return [relPath];
  }
  if (appType === 'electron') {
    const bridgeMatch = relPath.match(/^static\/bin\/bridge\/[^/]+\/([^/]+)$/);
    if (bridgeMatch && bridgeMatch[1]) {
      return [relPath, `bin/bridge/${bridgeMatch[1]}`];
    }
  }
  return [relPath];
}

function reconstructFromDiffBundle({
  appType,
  appVersion,
  bundleVersion,
  diffExtractedDir,
  outputDir,
  candidateOtaDirs = [],
  builtinDir,
  extraBuiltinDirs = [],
}) {
  if (!SUPPORTED_APP_TYPES.includes(appType)) {
    throw new Error(`Unsupported appType "${appType}"`);
  }
  const diffManifestPath = path.join(diffExtractedDir, 'diff-manifest.json');
  const metadataPath = path.join(diffExtractedDir, 'metadata.json');
  const { parsed: diffManifest } = readJsonMetadata(
    diffManifestPath,
    'diff-manifest.json',
  );
  const { rawBuffer: metadataBuffer, parsed: targetMetadata } =
    readJsonMetadata(metadataPath, 'metadata.json');
  const actualMetadataSha256 = sha256Buffer(metadataBuffer);

  validateDiffManifestSpec(diffManifest, {
    appType,
    appVersion,
    bundleVersion,
    targetMetadata,
    targetMetadataSha256: actualMetadataSha256,
  });

  const { hashAlgorithm, fileEntries } = validateFullMetadataSpec(
    targetMetadata,
    appType,
    'metadata.json',
  );

  // 1. Verify every changedFile exists in diffExtractedDir and matches hash
  for (const [relPath, expectedHash] of Object.entries(
    diffManifest.changedFiles,
  )) {
    const stagedFilePath = resolveStagingFilePath(
      diffExtractedDir,
      appType,
      relPath,
    );
    if (
      !fs.existsSync(stagedFilePath) ||
      !fs.statSync(stagedFilePath).isFile()
    ) {
      throw new Error(`Missing changed file in diff archive: ${relPath}`);
    }
    const actualHash = hashFileWithAlgorithm(stagedFilePath, hashAlgorithm);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`Hash mismatch for changed file: ${relPath}`);
    }
  }

  // 2. Reconstruct every reusedFile from candidateOtaDirs -> builtinDir
  for (const [relPath, expectedHash] of Object.entries(
    diffManifest.reusedFiles,
  )) {
    const destPath = resolveStagingFilePath(diffExtractedDir, appType, relPath);
    let matchedSourcePath = null;

    // Priority 1: Local installed OTA directories
    for (const otaDir of candidateOtaDirs) {
      const candidatePath = resolveTargetFilePath(otaDir, appType, relPath);
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
        const candidateHash = hashFileWithAlgorithm(
          candidatePath,
          hashAlgorithm,
        );
        if (candidateHash.toLowerCase() === expectedHash.toLowerCase()) {
          matchedSourcePath = candidatePath;
          break;
        }
      }
    }

    // Priority 2: Built-in 6.8.0 app bundle directory (+ extraBuiltinDirs such as process.resourcesPath)
    if (!matchedSourcePath) {
      const builtinRoots = [];
      if (builtinDir) {
        builtinRoots.push(
          appType === 'electron' ? path.join(builtinDir, 'build') : builtinDir,
        );
      }
      for (const extraDir of extraBuiltinDirs) {
        if (extraDir) {
          builtinRoots.push(extraDir);
        }
      }
      const candidateRelPaths = resolveBuiltinCandidateRelPaths(
        appType,
        relPath,
      );
      for (const rootDir of builtinRoots) {
        for (const candidateRel of candidateRelPaths) {
          const candidatePath = resolveContainedPath(rootDir, candidateRel);
          if (
            fs.existsSync(candidatePath) &&
            fs.statSync(candidatePath).isFile()
          ) {
            const candidateHash = hashFileWithAlgorithm(
              candidatePath,
              hashAlgorithm,
            );
            if (candidateHash.toLowerCase() === expectedHash.toLowerCase()) {
              matchedSourcePath = candidatePath;
              break;
            }
          }
        }
        if (matchedSourcePath) {
          break;
        }
      }
    }

    if (!matchedSourcePath) {
      throw new Error(
        `Unable to reconstruct reused file from local sources: ${relPath}`,
      );
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(matchedSourcePath, destPath);
    const copiedHash = hashFileWithAlgorithm(destPath, hashAlgorithm);
    if (copiedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(
        `Copied reused file failed hash verification: ${relPath}`,
      );
    }
  }

  // 3. Remove diff-manifest.json and verify complete directory 1-to-1 against metadata.json
  fs.rmSync(diffManifestPath, { force: true });

  const contentRoot =
    appType === 'electron'
      ? path.join(diffExtractedDir, 'build')
      : diffExtractedDir;
  const discoveredRelPaths = new Set();

  const walkContent = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(
          `Symlink detected in reconstructed bundle: ${fullPath}`,
        );
      }
      if (entry.isDirectory()) {
        walkContent(fullPath);
      } else if (
        !(
          appType !== 'electron' &&
          currentDir === diffExtractedDir &&
          entry.name === 'metadata.json'
        ) &&
        entry.name !== '.DS_Store'
      ) {
        const relPath = path
          .relative(contentRoot, fullPath)
          .split(path.sep)
          .join('/');
        if (!Object.prototype.hasOwnProperty.call(fileEntries, relPath)) {
          throw new Error(
            `Unexpected file on disk not in metadata.json: ${relPath}`,
          );
        }
        const actualHash = hashFileWithAlgorithm(fullPath, hashAlgorithm);
        if (actualHash.toLowerCase() !== fileEntries[relPath].toLowerCase()) {
          throw new Error(`Final file hash mismatch for ${relPath}`);
        }
        discoveredRelPaths.add(relPath);
      }
    }
  };

  walkContent(contentRoot);
  for (const relPath of Object.keys(fileEntries)) {
    if (!discoveredRelPaths.has(relPath)) {
      throw new Error(
        `File listed in metadata.json missing after reconstruction: ${relPath}`,
      );
    }
  }

  if (outputDir && path.resolve(outputDir) !== path.resolve(diffExtractedDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(outputDir), { recursive: true });
    fs.renameSync(diffExtractedDir, outputDir);
  }

  return {
    reconstructedFilesCount: discoveredRelPaths.size,
    metadataSha256: actualMetadataSha256,
  };
}

module.exports = {
  ELECTRON_ASAR_EXCLUDED_ICON_PATHS,
  FORBIDDEN_BUNDLE_FILE_NAMES,
  HASH_ALGORITHMS,
  HASH_HEX_LENGTHS,
  RESERVED_METADATA_KEYS,
  SUPPORTED_APP_TYPES,
  buildFileInfo,
  extractFileHashes,
  generateOtaDiffBundle,
  isBuiltinNonPreservedFile,
  parseCliArgs,
  reconstructFromDiffBundle,
  resolveBuiltinCandidateRelPaths,
  sha256Buffer,
  validateDiffManifestSpec,
  validateFullMetadataSpec,
};
