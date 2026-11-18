#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */

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

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
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
  if (relPath.includes('\0') || path.isAbsolute(relPath)) {
    throw new Error(`${label} contains an unsafe file path: ${relPath}`);
  }
  const normalized = path.posix.normalize(relPath.replaceAll('\\', '/'));
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`${label} contains a path traversal entry: ${relPath}`);
  }
  return relPath;
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
    if (
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

module.exports = {
  HASH_ALGORITHMS,
  RESERVED_METADATA_KEYS,
  SUPPORTED_APP_TYPES,
  buildFileInfo,
  extractFileHashes,
  generateOtaDiffBundle,
  parseCliArgs,
  sha256Buffer,
};
