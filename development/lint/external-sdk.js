#!/usr/bin/env node

// External SDK integrity lint.
//
// Third-party native SDKs that ship as binaries (the OnramperSDK framework binary is the
// first one) cannot be reviewed by reading source in this repo. This lint pins
// the configured files by SHA-256 in `external-sdk.config.json`. The manifest
// and checker are trusted review inputs. Run on a quiescent installation;
// this is a point-in-time check, not a sandbox for install scripts or builds.
//
// Usage:
//   yarn lint:external-sdk                 # verify pinned files
//   node development/lint/external-sdk.js --write   # re-pin (review the diff!)
//   node development/lint/external-sdk.js --json    # machine-readable result
//
// Exit codes: 0 = all pinned SDKs match, 1 = mismatch, 2 = config/usage error.
// Per-SDK audit conclusions live in external-sdk-audit-docs/<name>.md.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'external-sdk.config.json');
const CONFIG_VERSION = 1;

function usage() {
  return [
    'Usage: node development/lint/external-sdk.js [options]',
    '',
    'Options:',
    '  --config <path>  Config manifest (default: development/lint/external-sdk.config.json)',
    '  --base <dir>     Repo root the config roots are resolved against (default: cwd)',
    '  --write          Recompute and write SHA-256 pins (review the diff before committing)',
    '  --json           Print a JSON summary instead of human-readable text',
    '  --help           Show this help',
  ].join('\n');
}

function fail(message) {
  const error = new Error(message);
  error.isUsageError = true;
  throw error;
}

function parseArgs(argv) {
  const args = {
    base: process.cwd(),
    configPath: DEFAULT_CONFIG_PATH,
    json: false,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--config':
        args.configPath = argv[(index += 1)];
        if (!args.configPath || args.configPath.startsWith('--'))
          fail('--config requires a path');
        break;
      case '--base':
        args.base = argv[(index += 1)];
        if (!args.base || args.base.startsWith('--'))
          fail('--base requires a directory');
        break;
      case '--write':
        args.write = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function sameFileState(a, b) {
  return ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].every(
    (key) => a[key] === b[key],
  );
}

function sha256File(root, relativePath) {
  const filePath = path.join(root, relativePath);
  assertPathComponents(root, relativePath);
  const before = fs.lstatSync(filePath, { bigint: true });
  const noFollow = fs.constants.O_NOFOLLOW;
  if (noFollow === undefined) fail('O_NOFOLLOW is required on this platform');
  let fd;
  try {
    fd = fs.openSync(
      filePath,
      fs.constants.O_RDONLY | noFollow | fs.constants.O_NONBLOCK,
    );
  } catch (error) {
    fail(`Cannot read ${filePath}: ${error.message}`);
  }
  try {
    const stat = fs.fstatSync(fd, { bigint: true });
    if (!stat.isFile()) fail(`Not a regular file: ${filePath}`);
    if (!sameFileState(before, stat))
      fail(`File changed before hashing: ${filePath}`);
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let totalBytes = 0;
    let bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
    while (bytesRead > 0) {
      hash.update(buffer.subarray(0, bytesRead));
      totalBytes += bytesRead;
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
    }
    assertPathComponents(root, relativePath);
    if (
      BigInt(totalBytes) !== stat.size ||
      !sameFileState(stat, fs.fstatSync(fd, { bigint: true })) ||
      !sameFileState(stat, fs.lstatSync(filePath, { bigint: true }))
    ) {
      fail(`File changed while hashing: ${filePath}`);
    }
    return { sha256: hash.digest('hex'), size: totalBytes };
  } finally {
    fs.closeSync(fd);
  }
}

function readJson(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    fail(`Cannot read JSON file: ${filePath}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function assertRelativePath(value, label, allowRoot = false) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  if (allowRoot && value === '.') return;
  if (
    /[\\:]/u.test(value) ||
    [...value].some((character) => character.charCodeAt(0) < 32) ||
    value !== value.normalize('NFC') ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    fail(`${label} must be a canonical relative POSIX path: ${value}`);
  }
}

function assertPathComponents(root, relativePath) {
  lstatOrFail(root, root);
  let current = root;
  for (const part of relativePath.split('/')) {
    current = path.join(current, part);
    lstatOrFail(current, current);
  }
}

function lstatOrFail(filePath, label) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (_error) {
    fail(`${label} is missing`);
  }
  if (stat.isSymbolicLink()) {
    fail(`Refusing to trust a symlink: ${label}`);
  }
  return stat;
}

function walkDirectory(root, relativeDirectory, collector) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  lstatOrFail(absoluteDirectory, relativeDirectory);
  let entries;
  try {
    entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    fail(`Cannot read directory ${relativeDirectory}: ${error.message}`);
  }

  for (const entry of entries.toSorted((a, b) =>
    a.name < b.name ? -1 : Number(a.name > b.name),
  )) {
    if (entry.name !== '.DS_Store' || !entry.isFile()) {
      const relativePath = toPosixPath(
        path.join(relativeDirectory, entry.name),
      );
      assertRelativePath(relativePath, 'SDK file');
      if (entry.isSymbolicLink()) {
        fail(`Refusing to pin a symlink (possible tampering): ${relativePath}`);
      } else if (entry.isDirectory()) {
        walkDirectory(root, relativePath, collector);
      } else if (entry.isFile()) {
        collector.add(relativePath);
      } else {
        fail(`Unsupported file type in external SDK: ${relativePath}`);
      }
    }
  }
}

function validateSdkConfig(sdk) {
  if (!sdk || typeof sdk !== 'object') fail('Each SDK entry must be an object');
  if (typeof sdk.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/u.test(sdk.id)) {
    fail(`Invalid SDK id: ${String(sdk.id)}`);
  }
  assertRelativePath(sdk.root, `${sdk.id}.root`);
  if (!Array.isArray(sdk.directories)) {
    fail(`${sdk.id}.directories must be an array`);
  }
  if (!Array.isArray(sdk.files)) fail(`${sdk.id}.files must be an array`);
  for (const directory of sdk.directories) {
    assertRelativePath(directory, `${sdk.id}.directories[]`, true);
  }
  for (const file of sdk.files) {
    assertRelativePath(file, `${sdk.id}.files[]`);
  }
  if (sdk.directories.length + sdk.files.length === 0) {
    fail(`${sdk.id}: select at least one file or directory`);
  }
  if (sdk.packageVersion !== undefined) {
    if (
      !sdk.packageVersion ||
      typeof sdk.packageVersion.file !== 'string' ||
      typeof sdk.packageVersion.expect !== 'string'
    ) {
      fail(`${sdk.id}.packageVersion must be { file, expect }`);
    }
    assertRelativePath(
      sdk.packageVersion.file,
      `${sdk.id}.packageVersion.file`,
    );
    if (!sdk.packageVersion.expect)
      fail(`${sdk.id}: expected version is empty`);
  }
  if (
    !sdk.hashes ||
    Array.isArray(sdk.hashes) ||
    typeof sdk.hashes !== 'object'
  ) {
    fail(`${sdk.id}.hashes must be an object`);
  }
  for (const [file, pin] of Object.entries(sdk.hashes)) {
    assertRelativePath(file, `${sdk.id}.hashes key`);
    if (
      !pin ||
      typeof pin !== 'object' ||
      !/^[a-f0-9]{64}$/u.test(pin.sha256) ||
      !Number.isSafeInteger(pin.size) ||
      pin.size < 0
    )
      fail(`${sdk.id}: invalid SHA-256/size pin for ${file}`);
  }
}

function loadConfig(configPath) {
  const config = readJson(configPath);
  if (!config || typeof config !== 'object') fail('Config must be an object');
  if (config.version !== CONFIG_VERSION) {
    fail(
      `Unsupported config version ${String(config.version)} (expected ${CONFIG_VERSION})`,
    );
  }
  if (!Array.isArray(config.sdks) || config.sdks.length === 0) {
    fail('Config must define at least one SDK');
  }
  const seen = new Set();
  for (const sdk of config.sdks) {
    validateSdkConfig(sdk);
    if (seen.has(sdk.id)) fail(`Duplicate SDK id: ${sdk.id}`);
    seen.add(sdk.id);
  }
  return config;
}

function resolveSdkRoot(base, sdk) {
  assertPathComponents(base, sdk.root);
  const root = path.resolve(base, sdk.root);
  const stat = lstatOrFail(root, `${sdk.id} root ${sdk.root}`);
  if (!stat.isDirectory()) fail(`${sdk.id} root is not a directory: ${root}`);
  return root;
}

function collectSdkFiles(root, sdk) {
  const collector = new Set();
  for (const directory of sdk.directories) {
    assertPathComponents(root, directory);
    const absoluteDirectory = path.join(root, directory);
    const stat = lstatOrFail(absoluteDirectory, `${sdk.id}: ${directory}`);
    if (!stat.isDirectory()) {
      fail(`${sdk.id}: ${directory} is not a directory`);
    }
    walkDirectory(root, directory, collector);
  }
  for (const file of sdk.files) {
    assertPathComponents(root, file);
    const absoluteFile = path.join(root, file);
    const stat = lstatOrFail(absoluteFile, `${sdk.id}: ${file}`);
    if (!stat.isFile()) fail(`${sdk.id}: ${file} is not a regular file`);
    collector.add(toPosixPath(file));
  }
  const files = [...collector].toSorted();
  if (files.length === 0) fail(`${sdk.id}: no files selected`);
  const portableNames = new Set();
  for (const file of files) {
    const key = file.toLowerCase();
    if (portableNames.has(key)) fail(`${sdk.id}: case-colliding path: ${file}`);
    portableNames.add(key);
  }
  if (sdk.packageVersion && !collector.has(sdk.packageVersion.file)) {
    fail(`${sdk.id}: packageVersion.file must be included in the pinned files`);
  }
  return files;
}

function buildHashes(root, relativeFiles) {
  const hashes = Object.create(null);
  let totalBytes = 0;
  for (const relativePath of relativeFiles) {
    const digest = sha256File(root, relativePath);
    hashes[relativePath] = digest;
    totalBytes += digest.size;
  }
  return { hashes, totalBytes };
}

function compareSdk(sdk, root) {
  const files = collectSdkFiles(root, sdk);
  const pins = sdk.hashes;
  if (!pins || typeof pins !== 'object' || Object.keys(pins).length === 0) {
    fail(
      `${sdk.id}: no SHA-256 pins in config; run with --write to initialize`,
    );
  }

  const missing = [];
  const modified = [];
  const unexpected = [];
  let totalBytes = 0;
  for (const relativePath of files) {
    const pin = Object.hasOwn(pins, relativePath)
      ? pins[relativePath]
      : undefined;
    if (!pin) {
      unexpected.push(relativePath);
    } else {
      const digest = sha256File(root, relativePath);
      totalBytes += digest.size;
      if (pin.sha256 !== digest.sha256 || pin.size !== digest.size) {
        modified.push({
          relativePath,
          expected: pin.sha256,
          actual: digest.sha256,
        });
      }
    }
  }
  const fileSet = new Set(files);
  for (const relativePath of Object.keys(pins).toSorted()) {
    if (!fileSet.has(relativePath)) missing.push(relativePath);
  }

  const versionError = checkPackageVersion(sdk, root);

  return {
    id: sdk.id,
    root: sdk.root,
    fileCount: files.length,
    totalBytes,
    missing,
    modified,
    unexpected,
    versionError,
    ok:
      missing.length === 0 &&
      modified.length === 0 &&
      unexpected.length === 0 &&
      !versionError,
  };
}

function checkPackageVersion(sdk, root) {
  if (sdk.packageVersion) {
    assertPathComponents(root, sdk.packageVersion.file);
    const packageJsonPath = path.join(root, sdk.packageVersion.file);
    const packageJson = readJson(packageJsonPath);
    if (packageJson.version !== sdk.packageVersion.expect) {
      return `${sdk.id}: expected package version ${sdk.packageVersion.expect}, found ${String(packageJson.version)}`;
    }
  }

  return undefined;
}

function writePins(config, configPath, base) {
  for (const sdk of config.sdks) {
    const root = resolveSdkRoot(base, sdk);
    const files = collectSdkFiles(root, sdk);
    const versionError = checkPackageVersion(sdk, root);
    if (versionError) fail(versionError);
    const { hashes } = buildHashes(root, files);
    sdk.hashes = hashes;
  }
  const temporaryPath = `${configPath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, configPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function printHumanResult(result, configPath) {
  const bytes = result.totalBytes;
  if (result.ok) {
    const megabytes = (bytes / (1024 * 1024)).toFixed(1);
    console.log(
      `external-sdk lint: OK — ${result.sdks.length} SDK(s), ${result.totalFiles} files, ${megabytes} MB pinned`,
    );
    for (const sdk of result.sdks) {
      console.log(`  PASS ${sdk.id} (${sdk.fileCount} files)`);
    }
    return;
  }

  console.error('external-sdk lint: FAILED');
  for (const sdk of result.sdks) {
    if (!sdk.ok) {
      console.error(`  FAIL ${sdk.id}`);
      if (sdk.versionError) console.error(`    ${sdk.versionError}`);
      for (const file of sdk.missing) {
        console.error(`    MISSING    ${file}`);
      }
      for (const item of sdk.modified) {
        console.error(`    MODIFIED   ${item.relativePath}`);
        console.error(`      expected ${item.expected}`);
        console.error(`      actual   ${item.actual}`);
      }
      for (const file of sdk.unexpected) {
        console.error(`    UNEXPECTED ${file}`);
      }
    }
  }
  console.error(
    `\nIf these changes are expected and reviewed, re-pin with:\n  node development/lint/external-sdk.js --write\nThen review the diff of ${path.basename(configPath)} before committing.`,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const base = fs.realpathSync(args.base);
  const configPath = path.resolve(args.configPath);
  const config = loadConfig(configPath);

  if (args.write) {
    writePins(config, configPath, base);
    console.log(
      `external-sdk lint: re-pinned ${config.sdks.length} SDK(s) in ${path.relative(base, configPath) || configPath}`,
    );
    console.log('Review the config diff and run the lint once more.');
    return 0;
  }

  const sdks = [];
  let totalFiles = 0;
  let totalBytes = 0;
  for (const sdk of config.sdks) {
    const root = resolveSdkRoot(base, sdk);
    const result = compareSdk(sdk, root);
    if (result.ok) {
      totalBytes += result.totalBytes;
      totalFiles += result.fileCount;
    }
    sdks.push(result);
  }

  const summary = {
    ok: sdks.every((sdk) => sdk.ok),
    sdks,
    totalFiles,
    totalBytes,
    configPath: path.relative(base, configPath) || configPath,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printHumanResult(summary, configPath);
  }
  return summary.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`external-sdk lint: ${error.message}`);
  if (error.isUsageError) {
    console.error(usage());
  }
  process.exitCode = 2;
}
