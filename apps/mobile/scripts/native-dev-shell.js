#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words POSTBUILD SIMCTL */

const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  getInputKey: getWebEmbedInputKey,
} = require('../../web-embed/scripts/web-embed-prebundle');
const devVendorConfig = require('../dev-vendor.config');
const {
  computeNativeContractKey,
  getPlatformOutputDirectory,
  getReleaseTag,
  verifyManifest,
} = require('../plugins/devVendor');

const { preparePlatform } = require('./build-dev-vendor');
const {
  installMobileDevShell,
  restoreMobileDevShell,
} = require('./mobile-dev-shell-resource');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MOBILE_ROOT, '../..');
const DEV_SESSION_SCHEMA_VERSION = 1;
const DEV_SESSION_ROUTE_PREFIX = '/onekey-dev';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SHELL_MANIFEST_SCHEMA_VERSION = 2;
const SHELL_RELEASE_TAG_VERSION = 2;
const RUN_REPORT_PATH = path.join(
  REPO_ROOT,
  'node_modules/.cache/onekey-mobile-dev/last-run.json',
);

function getPlatformArtifact(platform) {
  const targetPlatform = assertPlatform(platform);
  return targetPlatform === 'android'
    ? {
        architecture: 'arm64-v8a',
        artifactFile: 'OneKeyWallet-DevShell-android-arm64-v8a.apk',
        resourcePlatform: 'android',
      }
    : {
        architecture: 'arm64',
        artifactFile: 'OneKeyWallet-DevShell-ios-simulator-arm64.zip',
        resourcePlatform: 'ios-simulator',
      };
}

function assertPlatform(platform) {
  if (!['android', 'ios'].includes(platform)) {
    throw new Error(
      `[nativeDevShell] --platform must be android or ios; received ${String(platform)}`,
    );
  }
  return platform;
}

function parseMetroBaseUrl(value) {
  let metroUrl;
  try {
    metroUrl = new URL(value);
  } catch (error) {
    throw new Error(`[nativeDevShell] Invalid --metro-url: ${String(value)}`, {
      cause: error,
    });
  }
  if (
    !['http:', 'https:'].includes(metroUrl.protocol) ||
    metroUrl.username ||
    metroUrl.password ||
    !metroUrl.hostname ||
    (metroUrl.pathname !== '/' && metroUrl.pathname !== '') ||
    metroUrl.search ||
    metroUrl.hash
  ) {
    throw new Error(
      '[nativeDevShell] --metro-url must be an HTTP(S) origin without credentials, path, query, or fragment.',
    );
  }
  return metroUrl.toString().replace(/\/$/u, '');
}

function getContractManifest(platform) {
  const targetPlatform = assertPlatform(platform);
  return {
    nativeContractKey: computeNativeContractKey(targetPlatform),
    platform: targetPlatform,
    schemaVersion: 1,
    vendorSchemaVersion: devVendorConfig.SCHEMA_VERSION,
    vendorStrategyVersion: devVendorConfig.STRATEGY_VERSION,
  };
}

async function writeJson(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function createRunReport({ metroUrl, platform, shell, vendor }) {
  return {
    contract: getContractManifest(platform),
    finishedAt: undefined,
    metroUrl,
    platform,
    shell: { requested: shell, status: 'pending' },
    startedAt: new Date().toISOString(),
    status: 'preparing',
    userNoticeRequired: false,
    userNotices: [],
    vendor: { requested: vendor, status: 'pending' },
    webEmbed: { status: 'not-required' },
  };
}

function addFallbackNotice(report, { reason, resource }) {
  const notice = `${resource} remote resource failed; using a local build. Reason: ${reason}`;
  report.userNoticeRequired = true;
  report.userNotices.push({ notice, reason, resource });
  console.error(
    `[ONEKEY_FALLBACK_START] resource=${resource} action=BUILD_LOCAL reason=${reason}`,
  );
  console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
}

function printFallbackDone(resource) {
  console.error(
    `[ONEKEY_FALLBACK_DONE] resource=${resource} source=local-build`,
  );
}

async function writeRunReport(report) {
  await writeJson(RUN_REPORT_PATH, report);
}

function printRunSummary(report) {
  console.error(
    `[ONEKEY_RUN_SUMMARY] shell.source=${report.shell.source || 'unresolved'} vendor.source=${report.vendor.source || 'unresolved'} webEmbed.source=${report.webEmbed.source || 'not-required'} metro.url=${report.metroUrl} userNoticeRequired=${String(report.userNoticeRequired)}`,
  );
  for (const { notice } of report.userNotices) {
    console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
  }
  console.error(`[ONEKEY_RUN_REPORT] ${RUN_REPORT_PATH}`);
}

async function writeContractManifest({ output, platform }) {
  if (!output) {
    throw new Error('[nativeDevShell] contract requires --output.');
  }
  const manifest = getContractManifest(platform);
  await writeJson(path.resolve(output), manifest);
  return manifest;
}

function getDevSessionDirectory(platform) {
  return path.join(MOBILE_ROOT, 'out-dir-bundle/dev-session', platform);
}

function loadVendorManifest(platform) {
  const artifactDirectory = getPlatformOutputDirectory(MOBILE_ROOT, platform);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(artifactDirectory, 'manifest.json'), 'utf8'),
  );
  return verifyManifest({ artifactDirectory, manifest, platform });
}

async function writeDevSession({ metroUrl, output, platform }) {
  const targetPlatform = assertPlatform(platform);
  const metroBaseUrl = parseMetroBaseUrl(metroUrl);
  const vendorManifest = loadVendorManifest(targetPlatform);
  const routeRoot = `${DEV_SESSION_ROUTE_PREFIX}/${targetPlatform}`;
  const contract = getContractManifest(targetPlatform);
  if (vendorManifest.nativeContractKey !== contract.nativeContractKey) {
    throw new Error(
      '[nativeDevShell] Vendor and native shell contract keys do not match.',
    );
  }
  const commonBytecode = vendorManifest.common.bytecode;
  const expiresAtEpochMs = Date.now() + SESSION_TTL_MS;
  const session = {
    expiresAt: new Date(expiresAtEpochMs).toISOString(),
    expiresAtEpochMs,
    metro: { baseUrl: metroBaseUrl },
    nativeContractKey: contract.nativeContractKey,
    platform: targetPlatform,
    schemaVersion: DEV_SESSION_SCHEMA_VERSION,
    vendor: {
      commonHbcSha256: commonBytecode.sha256,
      commonHbcUrl: `${metroBaseUrl}${routeRoot}/vendor/common.hbc`,
      fingerprint: vendorManifest.fingerprint,
      manifestUrl: `${metroBaseUrl}${routeRoot}/vendor/manifest.json`,
      nativeContractKey: vendorManifest.nativeContractKey,
      schemaVersion: vendorManifest.schemaVersion,
      strategyVersion: vendorManifest.strategyVersion,
    },
  };
  const outputPath = path.resolve(
    output || path.join(getDevSessionDirectory(targetPlatform), 'session.json'),
  );
  await writeJson(outputPath, session);
  return { outputPath, session };
}

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (
    ![
      'artifact-manifest',
      'compatibility',
      'contract',
      'launch',
      'session',
    ].includes(command)
  ) {
    throw new Error(
      'Usage: native-dev-shell.js <artifact-manifest|compatibility|contract|session|launch> --platform <android|ios> [--artifact <path>] [--metro-url <url>] [--shell <auto|local|remote>] [--vendor <auto|local|tag>] [--output <path>]',
    );
  }
  const values = {};
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      throw new Error(`[nativeDevShell] Unknown argument: ${argument}`);
    }
    const name = argument.slice(2);
    if (
      ![
        'artifact',
        'metro-url',
        'output',
        'platform',
        'shell',
        'vendor',
        'web-embed-receipt',
      ].includes(name)
    ) {
      throw new Error(`[nativeDevShell] Unknown option: ${argument}`);
    }
    values[name] = argv[index + 1];
    if (!values[name]) {
      throw new Error(`[nativeDevShell] ${argument} requires a value.`);
    }
    index += 1;
  }
  return {
    command,
    artifact: values.artifact,
    metroUrl: values['metro-url'],
    output: values.output,
    platform: assertPlatform(values.platform),
    shell: values.shell || 'auto',
    vendor: values.vendor || 'auto',
    webEmbedReceipt: values['web-embed-receipt'],
  };
}

function sha256File(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function hashValues(namespace, values) {
  const hash = crypto.createHash('sha256');
  hash.update(namespace);
  hash.update('\0');
  for (const value of values) {
    hash.update(String(value));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function getShellCompatibility({
  nativeContractKey,
  platform,
  webEmbedInputKey = getWebEmbedInputKey(),
}) {
  const targetPlatform = assertPlatform(platform);
  const resolvedNativeContractKey =
    nativeContractKey ?? computeNativeContractKey(targetPlatform);
  if (!/^[0-9a-f]{64}$/.test(resolvedNativeContractKey)) {
    throw new Error('[nativeDevShell] Invalid native contract key.');
  }
  if (!/^[0-9a-f]{64}$/.test(webEmbedInputKey)) {
    throw new Error('[nativeDevShell] Invalid web-embed input key.');
  }
  const platformArtifact = getPlatformArtifact(targetPlatform);
  const shellCompatibilityKey = hashValues(
    'onekey-mobile-dev-shell-compatibility-v2',
    [
      targetPlatform,
      platformArtifact.architecture,
      resolvedNativeContractKey,
      webEmbedInputKey,
    ],
  );
  return {
    ...platformArtifact,
    nativeContractKey: resolvedNativeContractKey,
    platform: targetPlatform,
    shellCompatibilityKey,
    tag: `mobile-dev-shell-compat-v${SHELL_RELEASE_TAG_VERSION}-${platformArtifact.resourcePlatform}-${platformArtifact.architecture}-${shellCompatibilityKey}`,
    webEmbedInputKey,
  };
}

function getShellArtifactTag({ platform, shellArtifactKey }) {
  if (!/^[0-9a-f]{64}$/.test(shellArtifactKey || '')) {
    throw new Error('[nativeDevShell] Invalid shell artifact key.');
  }
  const { architecture, resourcePlatform } = getPlatformArtifact(platform);
  return `mobile-dev-shell-artifact-v${SHELL_RELEASE_TAG_VERSION}-${resourcePlatform}-${architecture}-${shellArtifactKey}`;
}

async function writeArtifactManifest({
  artifact,
  expectedWebEmbedInputKey = getWebEmbedInputKey(),
  output,
  platform,
  webEmbedReceipt,
}) {
  if (!artifact || !output || !webEmbedReceipt) {
    throw new Error(
      '[nativeDevShell] artifact-manifest requires --artifact, --web-embed-receipt, and --output.',
    );
  }
  const targetPlatform = assertPlatform(platform);
  const artifactPath = path.resolve(artifact);
  const receipt = JSON.parse(
    fs.readFileSync(path.resolve(webEmbedReceipt), 'utf8'),
  );
  if (
    !/^[0-9a-f]{64}$/.test(receipt.inputKey || '') ||
    !/^[0-9a-f]{64}$/.test(receipt.outputTreeDigest || '') ||
    !/^sha256:[0-9a-f]{64}$/.test(receipt.ociDigest || '')
  ) {
    throw new Error('[nativeDevShell] Invalid web-embed restore receipt.');
  }
  if (receipt.inputKey !== expectedWebEmbedInputKey) {
    throw new Error(
      '[nativeDevShell] Web-embed receipt does not match this checkout.',
    );
  }
  const compatibility = getShellCompatibility({
    platform: targetPlatform,
    webEmbedInputKey: receipt.inputKey,
  });
  const stat = fs.statSync(artifactPath);
  if (!stat.isFile()) {
    throw new Error('[nativeDevShell] Artifact must be a regular file.');
  }
  const artifactSha256 = sha256File(artifactPath);
  const shellArtifactKey = hashValues('onekey-mobile-dev-shell-artifact-v2', [
    compatibility.shellCompatibilityKey,
    artifactSha256,
    stat.size,
  ]);
  const manifest = {
    architecture: compatibility.architecture,
    artifact: {
      bytes: stat.size,
      file: path.basename(artifactPath),
      sha256: artifactSha256,
    },
    nativeContractKey: compatibility.nativeContractKey,
    platform: targetPlatform,
    schemaVersion: SHELL_MANIFEST_SCHEMA_VERSION,
    shellArtifactKey,
    shellCompatibilityKey: compatibility.shellCompatibilityKey,
    webEmbed: {
      inputKey: receipt.inputKey,
      ociDigest: receipt.ociDigest,
      outputTreeDigest: receipt.outputTreeDigest,
      reference: receipt.reference,
    },
  };
  await writeJson(path.resolve(output), manifest);
  return manifest;
}

function getDefaultMetroUrl(platform) {
  return platform === 'android'
    ? 'http://10.0.2.2:8081'
    : 'http://127.0.0.1:8081';
}

async function waitForSession(sessionUrl, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `[nativeDevShell] Metro exited before serving the session (code ${String(child.exitCode)}).`,
      );
    }
    try {
      const response = await fetch(sessionUrl, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      // Metro may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('[nativeDevShell] Timed out waiting for Metro DevSession.');
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(
      `[nativeDevShell] Command failed (${String(result.status)}): ${command}`,
    );
  }
}

function launchNativeApp(platform, sessionUrl) {
  if (platform === 'android') {
    runChecked('adb', [
      'shell',
      'am',
      'start',
      '-S',
      '-n',
      'so.onekey.app.wallet/.MainActivity',
      '--es',
      'ONEKEY_DEV_SESSION_URL',
      sessionUrl,
    ]);
    return;
  }
  runChecked(
    'xcrun',
    [
      'simctl',
      'launch',
      '--terminate-running-process',
      'booted',
      'so.onekey.wallet',
    ],
    {
      env: {
        ...process.env,
        SIMCTL_CHILD_ONEKEY_DEV_SESSION_URL: sessionUrl,
      },
    },
  );
}

async function prepareWebEmbedForLocalShell(report) {
  report.webEmbed = { status: 'restoring' };
  await writeRunReport(report);
  try {
    runChecked(
      'yarn',
      ['workspace', '@onekeyhq/web-embed', 'prebundle:restore'],
      { cwd: REPO_ROOT },
    );
    report.webEmbed = { source: 'remote', status: 'ready' };
  } catch (error) {
    const reason = getErrorMessage(error);
    addFallbackNotice(report, { reason, resource: 'web-embed' });
    report.webEmbed = {
      fallbackReason: reason,
      source: 'local-build',
      status: 'building',
    };
    await writeRunReport(report);
    runChecked('yarn', ['app:web-embed:build'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        WEB_EMBED_SKIP_POSTBUILD: 'true',
      },
    });
    report.webEmbed.status = 'ready';
    printFallbackDone('web-embed');
  }
  await writeRunReport(report);
}

async function buildLocalShell({ platform, report }) {
  await prepareWebEmbedForLocalShell(report);
  const resultPath = path.join(
    REPO_ROOT,
    `node_modules/.cache/onekey-mobile-dev/build-shell-${platform}-${process.pid}.json`,
  );
  await fs.promises.mkdir(path.dirname(resultPath), { recursive: true });
  try {
    runChecked('node', [
      path.join(MOBILE_ROOT, 'scripts/build-mobile-dev-shell.js'),
      'build',
      '--platform',
      platform,
      '--result',
      resultPath,
    ]);
    const result = JSON.parse(await fs.promises.readFile(resultPath, 'utf8'));
    if (
      typeof result.artifactPath !== 'string' ||
      !path.isAbsolute(result.artifactPath)
    ) {
      throw new Error(
        '[nativeDevShell] Local shell build returned no artifact.',
      );
    }
    return result.artifactPath;
  } finally {
    await fs.promises.rm(resultPath, { force: true });
  }
}

async function resolveAndInstallShell({ platform, report, shell }) {
  if (!['auto', 'local', 'remote'].includes(shell)) {
    throw new Error(
      `[nativeDevShell] --shell must be auto, local, or remote; received ${shell}.`,
    );
  }
  const compatibility = getShellCompatibility({ platform });
  let artifactPath;
  let usedFallback = false;
  if (shell === 'local') {
    report.shell = {
      requested: shell,
      source: 'local-build',
      status: 'building',
      tag: compatibility.tag,
    };
    await writeRunReport(report);
    artifactPath = await buildLocalShell({ platform, report });
  } else {
    report.shell = {
      requested: shell,
      status: 'restoring',
      tag: compatibility.tag,
    };
    await writeRunReport(report);
    try {
      const restored = await restoreMobileDevShell({ compatibility });
      artifactPath = restored.artifactPath;
      report.shell.source = restored.source;
      report.shell.ociDigest = restored.ociDigest;
    } catch (error) {
      if (shell === 'remote') throw error;
      const reason = getErrorMessage(error);
      addFallbackNotice(report, { reason, resource: 'shell' });
      usedFallback = true;
      report.shell.fallbackReason = reason;
      report.shell.source = 'local-build';
      report.shell.status = 'building';
      await writeRunReport(report);
      artifactPath = await buildLocalShell({ platform, report });
    }
  }
  report.shell.status = 'installing';
  await writeRunReport(report);
  await installMobileDevShell({ artifactPath, platform });
  if (usedFallback) printFallbackDone('shell');
  report.shell.artifactPath = artifactPath;
  report.shell.status = 'ready';
  await writeRunReport(report);
}

async function prepareVendor({ platform, report, vendor }) {
  if (vendor !== 'auto' && vendor !== 'local') {
    const expectedTag = getReleaseTag();
    if (vendor !== expectedTag) {
      throw new Error(
        `[nativeDevShell] Vendor ${vendor} is not compatible with this checkout; expected ${expectedTag}.`,
      );
    }
  }
  let source = 'remote';
  if (vendor === 'local') source = 'local';
  else if (vendor === 'auto') source = 'auto';
  report.vendor = {
    requested: vendor,
    status: source === 'local' ? 'building' : 'resolving',
  };
  await writeRunReport(report);
  const result = await preparePlatform(platform, {
    onFallback: async ({ reason, resource }) => {
      addFallbackNotice(report, { reason, resource });
      report.vendor.fallbackReason = reason;
      report.vendor.source = 'local-build';
      report.vendor.status = 'building';
      await writeRunReport(report);
    },
    source,
  });
  if (result.fallback) printFallbackDone('vendor');
  report.vendor = {
    ...report.vendor,
    ...result,
    status: 'ready',
  };
  await writeRunReport(report);
}

async function launchDevShell({ metroUrl, platform, shell, vendor }) {
  devVendorConfig.applyTransformationEnvironment(process.env);
  const deviceMetroUrl = parseMetroBaseUrl(
    metroUrl || getDefaultMetroUrl(platform),
  );
  const report = createRunReport({
    metroUrl: deviceMetroUrl,
    platform,
    shell,
    vendor,
  });
  await writeRunReport(report);
  try {
    await resolveAndInstallShell({ platform, report, shell });
    await prepareVendor({ platform, report, vendor });
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.status = 'failed';
    report.failure = getErrorMessage(error);
    await writeRunReport(report);
    printRunSummary(report);
    throw error;
  }
  await writeDevSession({ metroUrl: deviceMetroUrl, platform });
  const deviceSessionUrl = `${deviceMetroUrl}${DEV_SESSION_ROUTE_PREFIX}/${platform}/session.json`;
  const metroPort =
    new URL(deviceMetroUrl).port ||
    (deviceMetroUrl.startsWith('https:') ? '443' : '80');
  const child = spawn(
    'yarn',
    [
      'workspace',
      '@onekeyhq/mobile',
      'native-bundle',
      '--port',
      metroPort,
      '--host',
      '0.0.0.0',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ONEKEY_DEV_SESSION_PLATFORM: platform,
        ONEKEY_DEV_VENDOR: 'true',
      },
      stdio: 'inherit',
    },
  );
  const localSessionUrl = `http://127.0.0.1:${metroPort}${DEV_SESSION_ROUTE_PREFIX}/${platform}/session.json`;
  try {
    await waitForSession(localSessionUrl, child);
    launchNativeApp(platform, deviceSessionUrl);
    report.launchedAt = new Date().toISOString();
    report.status = 'running';
    await writeRunReport(report);
    printRunSummary(report);
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM')
          resolve();
        else {
          reject(
            new Error(
              `[nativeDevShell] Metro exited with code ${String(code)} signal ${String(signal)}.`,
            ),
          );
        }
      });
    });
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.status = 'failed';
    report.failure = getErrorMessage(error);
    await writeRunReport(report);
    printRunSummary(report);
    child.kill('SIGTERM');
    throw error;
  }
}

async function main() {
  const args = parseArgs();
  if (args.command === 'artifact-manifest') {
    const manifest = await writeArtifactManifest(args);
    console.log(manifest.shellArtifactKey);
  } else if (args.command === 'compatibility') {
    console.log(getShellCompatibility(args).shellCompatibilityKey);
  } else if (args.command === 'contract') {
    const manifest = await writeContractManifest(args);
    console.log(manifest.nativeContractKey);
  } else if (args.command === 'session') {
    const result = await writeDevSession({
      ...args,
      metroUrl: args.metroUrl || getDefaultMetroUrl(args.platform),
    });
    console.log(result.outputPath);
  } else {
    await launchDevShell(args);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  DEV_SESSION_ROUTE_PREFIX,
  DEV_SESSION_SCHEMA_VERSION,
  SHELL_MANIFEST_SCHEMA_VERSION,
  addFallbackNotice,
  createRunReport,
  getContractManifest,
  getPlatformArtifact,
  getShellArtifactTag,
  getShellCompatibility,
  loadVendorManifest,
  parseArgs,
  parseMetroBaseUrl,
  writeContractManifest,
  writeArtifactManifest,
  writeDevSession,
};
