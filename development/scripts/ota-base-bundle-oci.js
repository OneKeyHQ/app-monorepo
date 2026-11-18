#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words opencontainers */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const semver = require('semver');

const OCI_REGISTRY = 'ghcr.io';
const OCI_REPOSITORY = 'onekeyhq/ota-base-bundle';
const OCI_ARTIFACT_TYPE = 'application/vnd.onekey.ota-base-bundle.v1';
const MIN_BASE_VERSION = '6.8.0';
const SUPPORTED_PLATFORMS = Object.freeze(['desktop', 'ios', 'android']);

function assertValidPlatform(platform) {
  if (typeof platform !== 'string' || !SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(
      `Unsupported platform "${String(platform)}". Expected one of: ${SUPPORTED_PLATFORMS.join(', ')}`,
    );
  }
  return platform;
}

function assertValidAppVersion(appVersion) {
  if (typeof appVersion !== 'string' || appVersion.trim().length === 0) {
    throw new Error('appVersion must be a non-empty string');
  }
  const trimmed = appVersion.trim();
  if (!semver.valid(trimmed)) {
    throw new Error(`Invalid semver appVersion: "${appVersion}"`);
  }
  return trimmed.replace(/^v/, '');
}

function isIncrementalSupported(appVersion) {
  if (typeof appVersion !== 'string') {
    return false;
  }
  const parsed = semver.valid(appVersion.trim());
  return Boolean(parsed && semver.gte(parsed, MIN_BASE_VERSION));
}

function getOciTag({ appVersion, platform }) {
  const validPlatform = assertValidPlatform(platform);
  const validVersion = assertValidAppVersion(appVersion);
  return `v${validVersion}-${validPlatform}`;
}

function getOciReference({
  appVersion,
  platform,
  registry = OCI_REGISTRY,
  repository = OCI_REPOSITORY,
}) {
  if (typeof registry !== 'string' || registry.trim().length === 0) {
    throw new Error('registry must be a non-empty string');
  }
  if (typeof repository !== 'string' || repository.trim().length === 0) {
    throw new Error('repository must be a non-empty string');
  }
  const tag = getOciTag({ appVersion, platform });
  return `${registry.trim()}/${repository.trim()}:${tag}`;
}

function formatExecError(error) {
  const parts = [];
  if (error?.stderr) {
    parts.push(String(error.stderr).trim());
  }
  if (error?.stdout) {
    parts.push(String(error.stdout).trim());
  }
  if (error?.message) {
    parts.push(String(error.message).trim());
  }
  return parts.filter(Boolean).join('\n');
}

function isManifestNotFoundError(error) {
  const combined = formatExecError(error);
  return /manifest unknown|not found|name unknown|404/i.test(combined);
}

function checkOrPullBaseManifest({
  appVersion,
  platform,
  outputDir,
  registry = OCI_REGISTRY,
  repository = OCI_REPOSITORY,
  execFileSyncImpl = execFileSync,
}) {
  if (typeof outputDir !== 'string' || outputDir.trim().length === 0) {
    throw new Error('outputDir must be a non-empty string');
  }
  const resolvedOutputDir = path.resolve(outputDir);
  const reference = getOciReference({
    appVersion,
    platform,
    registry,
    repository,
  });

  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  try {
    execFileSyncImpl(
      'oras',
      ['pull', '--output', resolvedOutputDir, reference],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (error) {
    if (isManifestNotFoundError(error)) {
      return { found: false, reference };
    }
    throw new Error(
      `Failed to pull OTA base manifest from ${reference}: ${formatExecError(error)}`,
      { cause: error },
    );
  }

  const metadataPath = path.join(resolvedOutputDir, 'base-metadata.json');
  if (
    fs.existsSync(metadataPath) &&
    fs.statSync(metadataPath).isFile() &&
    fs.statSync(metadataPath).size > 0
  ) {
    return {
      found: true,
      metadataPath,
      reference,
    };
  }

  return { found: false, reference };
}

function pushBaseManifest({
  appVersion,
  platform,
  metadataPath,
  sourceCommit = '',
  registry = OCI_REGISTRY,
  repository = OCI_REPOSITORY,
  createdAt,
  execFileSyncImpl = execFileSync,
}) {
  if (typeof metadataPath !== 'string' || metadataPath.trim().length === 0) {
    throw new Error('metadataPath must be a non-empty string');
  }
  if (!fs.existsSync(metadataPath) || !fs.statSync(metadataPath).isFile()) {
    throw new Error(`metadataPath file not found: ${metadataPath}`);
  }

  const metadataBytes = fs.readFileSync(metadataPath);
  if (metadataBytes.length === 0) {
    throw new Error(`metadataPath file is empty: ${metadataPath}`);
  }
  try {
    const parsed = JSON.parse(metadataBytes.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('metadata.json must contain a JSON object');
    }
  } catch (error) {
    throw new Error(
      `Invalid metadata JSON at ${metadataPath}: ${error.message}`,
      { cause: error },
    );
  }

  const validPlatform = assertValidPlatform(platform);
  const validVersion = assertValidAppVersion(appVersion);
  const tag = getOciTag({ appVersion: validVersion, platform: validPlatform });
  const reference = getOciReference({
    appVersion: validVersion,
    platform: validPlatform,
    registry,
    repository,
  });
  const metadataSha256 = crypto
    .createHash('sha256')
    .update(metadataBytes)
    .digest('hex');

  const baseRelease = {
    schemaVersion: 1,
    appVersion: validVersion,
    platform: validPlatform,
    sourceCommit: sourceCommit ? String(sourceCommit).trim() : '',
    metadataSha256,
    createdAt: createdAt || new Date().toISOString(),
  };

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-base-oci-'));
  try {
    fs.writeFileSync(
      path.join(stagingDir, 'base-metadata.json'),
      metadataBytes,
    );
    fs.writeFileSync(
      path.join(stagingDir, 'base-release.json'),
      JSON.stringify(baseRelease, null, 2),
    );

    const args = [
      'push',
      '--artifact-type',
      OCI_ARTIFACT_TYPE,
      '--annotation',
      `org.opencontainers.image.version=${tag}`,
      '--annotation',
      `org.opencontainers.image.description=OneKey OTA base bundle metadata for ${validPlatform} ${validVersion}`,
    ];
    if (baseRelease.sourceCommit) {
      args.push(
        '--annotation',
        `org.opencontainers.image.revision=${baseRelease.sourceCommit}`,
      );
    }
    args.push(
      reference,
      'base-metadata.json:application/vnd.onekey.ota-base-bundle.metadata.v1+json',
      'base-release.json:application/vnd.onekey.ota-base-bundle.release.v1+json',
    );

    try {
      execFileSyncImpl('oras', args, {
        cwd: stagingDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      throw new Error(
        `Failed to push OTA base manifest to ${reference}: ${formatExecError(error)}`,
        { cause: error },
      );
    }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  return {
    pushed: true,
    reference,
    metadataSha256,
    baseRelease,
  };
}

function parseCliArgs(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return { command: 'help', options: {} };
  }

  const command = argv[0];
  const flagMap = {
    '--app-version': 'appVersion',
    '--platform': 'platform',
    '--output-dir': 'outputDir',
    '--metadata-path': 'metadataPath',
    '--source-commit': 'sourceCommit',
    '--registry': 'registry',
    '--repository': 'repository',
  };

  const options = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { command: 'help', options: {} };
    }
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

  return { command, options };
}

function printUsage() {
  console.log(
    [
      'Usage: node development/scripts/ota-base-bundle-oci.js <command> [options]',
      '',
      'Commands:',
      '  is-supported --app-version <ver>',
      '  tag --app-version <ver> --platform <desktop|ios|android>',
      '  reference --app-version <ver> --platform <desktop|ios|android> [--registry <reg>] [--repository <repo>]',
      '  pull --app-version <ver> --platform <desktop|ios|android> --output-dir <dir>',
      '  push --app-version <ver> --platform <desktop|ios|android> --metadata-path <path> [--source-commit <sha>]',
    ].join('\n'),
  );
}

function runCli(argv = process.argv.slice(2)) {
  const { command, options } = parseCliArgs(argv);
  switch (command) {
    case 'help': {
      printUsage();
      return 0;
    }
    case 'is-supported': {
      console.log(String(isIncrementalSupported(options.appVersion)));
      return 0;
    }
    case 'tag': {
      console.log(getOciTag(options));
      return 0;
    }
    case 'reference': {
      console.log(getOciReference(options));
      return 0;
    }
    case 'pull': {
      if (!isIncrementalSupported(options.appVersion)) {
        console.log(
          JSON.stringify({
            found: false,
            skipped: true,
            reason: `Incremental OTA requires version >= ${MIN_BASE_VERSION}`,
          }),
        );
        return 0;
      }
      const result = checkOrPullBaseManifest(options);
      console.log(JSON.stringify(result));
      return 0;
    }
    case 'push': {
      if (!isIncrementalSupported(options.appVersion)) {
        throw new Error(
          `Cannot push OTA base manifest for ${options.appVersion}: requires version >= ${MIN_BASE_VERSION}`,
        );
      }
      const result = pushBaseManifest(options);
      console.log(JSON.stringify(result));
      return 0;
    }
    default: {
      throw new Error(`Unknown command: ${command}`);
    }
  }
}

if (require.main === module) {
  try {
    const code = runCli();
    process.exit(code);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  MIN_BASE_VERSION,
  OCI_ARTIFACT_TYPE,
  OCI_REGISTRY,
  OCI_REPOSITORY,
  SUPPORTED_PLATFORMS,
  checkOrPullBaseManifest,
  getOciReference,
  getOciTag,
  isIncrementalSupported,
  parseCliArgs,
  pushBaseManifest,
  runCli,
};
