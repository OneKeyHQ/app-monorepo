#!/usr/bin/env node

// External SDK integrity lint.
//
// Third-party native SDKs that ship as binaries (the OnramperSDK framework binary is the
// first one) cannot be reviewed by reading source in this repo. This lint pins
// every vendored file by SHA-256 in `external-sdk.config.json` and fails when a
// file is modified, added or removed, so a supply-chain compromise or an
// npm publish that was not reviewed breaks CI instead of silently shipping.
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
        if (!args.configPath) fail('--config requires a path');
        break;
      case '--base':
        args.base = argv[(index += 1)];
        if (!args.base) fail('--base requires a directory');
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

function sha256File(filePath) {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  let fd;
  try {
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
  } catch (error) {
    fail(`Cannot read ${filePath}: ${error.message}`);
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) fail(`Not a regular file: ${filePath}`);
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
    while (bytesRead > 0) {
      hash.update(buffer.subarray(0, bytesRead));
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
    }
    return { sha256: hash.digest('hex'), size: stat.size };
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

function assertRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  if (path.isAbsolute(value)) {
    fail(`${label} must be relative, got absolute path: ${value}`);
  }
  const normalized = path.normalize(value);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    fail(`${label} must not escape its root: ${value}`);
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
    a.name.localeCompare(b.name),
  )) {
    if (entry.name !== '.DS_Store') {
      const relativePath = toPosixPath(
        path.join(relativeDirectory, entry.name),
      );
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
    assertRelativePath(directory, `${sdk.id}.directories[]`);
  }
  for (const file of sdk.files) {
    assertRelativePath(file, `${sdk.id}.files[]`);
  }
  if (sdk.packageVersion !== undefined) {
    if (
      !sdk.packageVersion ||
      typeof sdk.packageVersion.file !== 'string' ||
      typeof sdk.packageVersion.expect !== 'string'
    ) {
      fail(`${sdk.id}.packageVersion must be { file, expect }`);
    }
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
  const root = path.resolve(base, sdk.root);
  const stat = lstatOrFail(root, `${sdk.id} root ${sdk.root}`);
  if (!stat.isDirectory()) fail(`${sdk.id} root is not a directory: ${root}`);
  return root;
}

function collectSdkFiles(root, sdk) {
  const collector = new Set();
  for (const directory of sdk.directories) {
    const absoluteDirectory = path.join(root, directory);
    const stat = lstatOrFail(absoluteDirectory, `${sdk.id}: ${directory}`);
    if (!stat.isDirectory()) {
      fail(`${sdk.id}: ${directory} is not a directory`);
    }
    walkDirectory(root, directory, collector);
  }
  for (const file of sdk.files) {
    const absoluteFile = path.join(root, file);
    const stat = lstatOrFail(absoluteFile, `${sdk.id}: ${file}`);
    if (!stat.isFile()) fail(`${sdk.id}: ${file} is not a regular file`);
    collector.add(toPosixPath(file));
  }
  return [...collector].toSorted();
}

function buildHashes(root, relativeFiles) {
  const hashes = {};
  let totalBytes = 0;
  for (const relativePath of relativeFiles) {
    const absolutePath = path.join(root, relativePath);
    const digest = sha256File(absolutePath);
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
  for (const relativePath of files) {
    const pin = pins[relativePath];
    if (!pin) {
      unexpected.push(relativePath);
    } else {
      const absolutePath = path.join(root, relativePath);
      const digest = sha256File(absolutePath);
      if (
        pin.sha256 !== digest.sha256 ||
        (typeof pin.size === 'number' && pin.size !== digest.size)
      ) {
        modified.push({
          relativePath,
          expected: pin.sha256,
          actual: digest.sha256,
        });
      }
    }
  }
  for (const relativePath of Object.keys(pins)) {
    if (!files.includes(relativePath)) missing.push(relativePath);
  }

  let versionError;
  if (sdk.packageVersion) {
    const packageJsonPath = path.join(root, sdk.packageVersion.file);
    const packageJson = readJson(packageJsonPath);
    if (packageJson.version !== sdk.packageVersion.expect) {
      versionError = `${sdk.id}: expected package version ${sdk.packageVersion.expect}, found ${String(packageJson.version)}`;
    }
  }

  return {
    id: sdk.id,
    root: sdk.root,
    fileCount: files.length,
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

function writePins(config, configPath, base) {
  for (const sdk of config.sdks) {
    const root = resolveSdkRoot(base, sdk);
    const files = collectSdkFiles(root, sdk);
    const { hashes } = buildHashes(root, files);
    sdk.hashes = hashes;
  }
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
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

  const base = path.resolve(args.base);
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
      const files = collectSdkFiles(root, sdk);
      for (const relativePath of files) {
        totalBytes += sha256File(path.join(root, relativePath)).size;
        totalFiles += 1;
      }
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
