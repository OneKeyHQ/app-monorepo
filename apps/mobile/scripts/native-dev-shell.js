#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words POSTBUILD SIMCTL */

const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const {
  getInputKey: getWebEmbedInputKey,
} = require('../../web-embed/scripts/web-embed-prebundle');
const devVendorConfig = require('../dev-vendor.config');
const {
  computeNativeContractKey,
  computeShellCompatibilityKey,
  computeShellInputKey,
  getPlatformOutputDirectory,
  getReleaseTag,
  verifyManifest,
} = require('../plugins/devVendor');

const {
  installMobileDevShell,
  resolveExactMobileDevShell,
  restoreMobileDevShell,
  runWithCacheLeaseCleanup,
} = require('./mobile-dev-shell-resource');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MOBILE_ROOT, '../..');
const DEV_SESSION_SCHEMA_VERSION = 2;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_RENEW_INTERVAL_MS = 3 * 60 * 60 * 1000;
const SESSION_RENEW_RETRY_INTERVAL_MS = 30_000;
const SESSION_RENEW_FATAL_WINDOW_MS = 5 * 60 * 1000;
const ANDROID_APP_STARTUP_TIMEOUT_MS = 10_000;
const ANDROID_APP_STARTUP_POLL_INTERVAL_MS = 500;
const NATIVE_APP_STARTUP_GRACE_MS = 1500;
const NATIVE_RUNTIME_PREWARM_TIMEOUT_MS = 10 * 60 * 1000;
const SHELL_MANIFEST_SCHEMA_VERSION = 3;
const SHELL_RELEASE_TAG_VERSION = 3;
const ANDROID_APPLICATION_ID = 'so.onekey.app.wallet';
const IOS_BUNDLE_ID = 'so.onekey.wallet';
const DEV_SESSION_ROOT_NAME = 'onekey-dev-sessions';
const LOCK_ROOT = path.join(os.tmpdir(), 'onekey-mobile-dev-locks-v1');
const LOCK_STALE_MS = 30_000;
const CURRENT_PROCESS_STARTED_AT_MS = Date.now() - process.uptime() * 1000;
const WORKTREE_ID = crypto
  .createHash('sha256')
  .update(fs.realpathSync(REPO_ROOT))
  .digest('hex')
  .slice(0, 12);

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

function getNativeRuntimeBundleUrl({
  fingerprint,
  metroPort,
  platform,
  runtimeTarget,
  sessionId,
}) {
  const targetPlatform = assertPlatform(platform);
  if (!['main', 'background'].includes(runtimeTarget)) {
    throw new Error('[nativeDevShell] Invalid runtime prewarm target.');
  }
  if (!/^[0-9a-f]{64}$/u.test(fingerprint || '')) {
    throw new Error('[nativeDevShell] Invalid dev-vendor fingerprint.');
  }
  const url = new URL(
    runtimeTarget === 'background'
      ? `http://127.0.0.1:${String(metroPort)}/background.bundle`
      : `http://127.0.0.1:${String(metroPort)}/.expo/.virtual-metro-entry.bundle`,
  );
  const values = {
    platform: targetPlatform,
    dev: 'true',
    lazy: 'false',
    minify: 'false',
    inlineSourceMap: 'false',
    modulesOnly: 'true',
    runModule: 'true',
    'resolver.devVendor': 'true',
    'resolver.devVendorNative': 'true',
    'resolver.devVendorFingerprint': fingerprint,
    'resolver.devSessionId': sessionId,
    'resolver.runtimeTarget': runtimeTarget,
    unstable_transformProfile: 'hermes-stable',
  };
  for (const [name, value] of Object.entries(values)) {
    url.searchParams.set(name, value);
  }
  return url;
}

async function prewarmNativeRuntimeBundles({
  fetchImpl = globalThis.fetch,
  fingerprint,
  metroPort,
  platform,
  sessionId,
  timeoutMs = NATIVE_RUNTIME_PREWARM_TIMEOUT_MS,
}) {
  for (const runtimeTarget of ['main', 'background']) {
    const url = getNativeRuntimeBundleUrl({
      fingerprint,
      metroPort,
      platform,
      runtimeTarget,
      sessionId,
    });
    let receivedBytes = 0;
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }
      if (response.body) {
        for await (const chunk of response.body) {
          receivedBytes += Buffer.byteLength(chunk);
        }
      }
    } catch (error) {
      throw new Error(
        `[nativeDevShell] Failed to prewarm the ${runtimeTarget} runtime bundle.`,
        { cause: error },
      );
    }
    console.log(
      `[nativeDevShell] prewarmed runtime=${runtimeTarget} bytes=${String(receivedBytes)}`,
    );
  }
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

function createRunReport({
  deviceId,
  metroPort,
  metroUrl,
  platform,
  sessionId,
  shell,
  vendor,
  worktreeId = WORKTREE_ID,
}) {
  return {
    contract: getContractManifest(platform),
    deviceId,
    finishedAt: undefined,
    metroPort,
    metroUrl,
    platform,
    runReportPath: getRunReportPath(sessionId),
    sessionId,
    shell: { requested: shell, status: 'pending' },
    startedAt: new Date().toISOString(),
    status: 'preparing',
    userNoticeRequired: false,
    userNotices: [],
    vendor: { requested: vendor, status: 'pending' },
    webEmbed: { status: 'not-required' },
    worktreeId,
  };
}

function addFallbackNotice(report, { reason, resource }) {
  const context = formatRunContext(report);
  const notice = `${context} resource=${resource} action=local-build reason=${JSON.stringify(reason)}`;
  report.userNoticeRequired = true;
  report.userNotices.push({ notice, reason, resource });
  console.error(
    `[ONEKEY_FALLBACK_START] ${context} resource=${resource} action=BUILD_LOCAL reason=${JSON.stringify(reason)}`,
  );
  console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
}

function addCompatibilityNotice(report, { reason, resource }) {
  const context = formatRunContext(report);
  const notice = `${context} resource=${resource} action=use-compatible-remote reason=${JSON.stringify(reason)}`;
  report.userNoticeRequired = true;
  report.userNotices.push({ notice, reason, resource });
  console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
}

function addFailureNotice(report, reason) {
  const context = formatRunContext(report);
  const notice = `${context} action=run-failed reason=${JSON.stringify(reason)}`;
  report.userNoticeRequired = true;
  report.userNotices.push({ notice, reason, resource: 'run' });
  console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
}

function addSessionRenewalNotice(
  report,
  {
    consecutiveFailures,
    error,
    expiresAtEpochMs,
    remainingMs,
    retryIntervalMs,
    shouldPrintNotice,
  },
) {
  const reason = getErrorMessage(error);
  const notice = `${formatRunContext(report)} resource=session-renewal action=retry consecutiveFailures=${String(consecutiveFailures)} expiresAt=${new Date(expiresAtEpochMs).toISOString()} remainingMs=${String(remainingMs)} retryInMs=${String(retryIntervalMs)} reason=${JSON.stringify(reason)}`;
  const entry = { notice, reason, resource: 'session-renewal' };
  const existingIndex = report.userNotices.findIndex(
    (item) => item.resource === 'session-renewal',
  );
  report.userNoticeRequired = true;
  if (existingIndex === -1) report.userNotices.push(entry);
  else report.userNotices[existingIndex] = entry;
  if (shouldPrintNotice) {
    console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
  }
}

function printFallbackDone(report, resource) {
  console.error(
    `[ONEKEY_FALLBACK_DONE] ${formatRunContext(report)} resource=${resource} source=local-build`,
  );
}

async function writeRunReport(report) {
  await writeJson(report.runReportPath, report);
}

function printRunSummary(report) {
  const summary = `${formatRunContext(report)} status=${report.status} shell.source=${report.shell.source || 'unresolved'} vendor.source=${report.vendor.source || 'unresolved'} webEmbed.source=${report.webEmbed.source || 'not-required'} metro.url=${report.metroUrl} metro.port=${String(report.metroPort)} userNoticeRequired=${String(report.userNoticeRequired)}`;
  console.error(`[ONEKEY_RUN_SUMMARY] ${summary}`);
  for (const { notice } of report.userNotices) {
    console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
  }
  console.error(`[ONEKEY_RUN_REPORT] ${report.runReportPath}`);
}

function formatRunContext(report) {
  return `worktree=${report.worktreeId} device=${report.deviceId} session=${report.sessionId}`;
}

function getRunReportPath(sessionId) {
  if (!sessionId) return undefined;
  return path.join(
    REPO_ROOT,
    'node_modules/.cache/onekey-mobile-dev/sessions',
    sessionId,
    'run-result.json',
  );
}

async function writeContractManifest({ output, platform }) {
  if (!output) {
    throw new Error('[nativeDevShell] contract requires --output.');
  }
  const manifest = getContractManifest(platform);
  await writeJson(path.resolve(output), manifest);
  return manifest;
}

function getDevSessionDirectory(platform, sessionId) {
  return path.join(
    MOBILE_ROOT,
    'out-dir-bundle/dev-session',
    platform,
    sessionId,
  );
}

async function pruneSessionDirectories(
  rootDirectory,
  { maxSessions = 3, preserveSessionId } = {},
) {
  let entries;
  try {
    entries = await fs.promises.readdir(rootDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  const sessions = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          /^wk-[0-9a-f]{12}-dev-[0-9a-f]{12}-[0-9a-f]{16}$/u.test(entry.name),
      )
      .map(async (entry) => ({
        modifiedAt: (
          await fs.promises.stat(path.join(rootDirectory, entry.name))
        ).mtimeMs,
        name: entry.name,
      })),
  );
  sessions.sort((left, right) => right.modifiedAt - left.modifiedAt);
  const retained = new Set();
  if (preserveSessionId) retained.add(preserveSessionId);
  for (const session of sessions) {
    if (retained.size >= maxSessions) break;
    retained.add(session.name);
  }
  await Promise.all(
    sessions
      .filter((session) => !retained.has(session.name))
      .map((session) =>
        fs.promises.rm(path.join(rootDirectory, session.name), {
          force: true,
          recursive: true,
        }),
      ),
  );
}

function loadVendorManifest(platform) {
  const artifactDirectory = getPlatformOutputDirectory(MOBILE_ROOT, platform);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(artifactDirectory, 'manifest.json'), 'utf8'),
  );
  return verifyManifest({ artifactDirectory, manifest, platform });
}

function createSessionId({
  deviceId = 'unbound',
  randomBytes = crypto.randomBytes,
} = {}) {
  const deviceKey = crypto
    .createHash('sha256')
    .update(deviceId)
    .digest('hex')
    .slice(0, 12);
  return `wk-${WORKTREE_ID}-dev-${deviceKey}-${randomBytes(8).toString('hex')}`;
}

async function writeDevSession({
  deviceId,
  metroUrl,
  output,
  platform,
  sessionId = createSessionId({ deviceId }),
}) {
  const targetPlatform = assertPlatform(platform);
  const metroBaseUrl = parseMetroBaseUrl(metroUrl);
  const vendorManifest = loadVendorManifest(targetPlatform);
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
    deviceId,
    metro: { baseUrl: metroBaseUrl },
    nativeContractKey: contract.nativeContractKey,
    platform: targetPlatform,
    schemaVersion: DEV_SESSION_SCHEMA_VERSION,
    sessionId,
    vendor: {
      commonHbcSha256: commonBytecode.sha256,
      commonHbcFile: 'common.hbc',
      fingerprint: vendorManifest.fingerprint,
      manifestFile: 'vendor-manifest.json',
      nativeContractKey: vendorManifest.nativeContractKey,
      schemaVersion: vendorManifest.schemaVersion,
      strategyVersion: vendorManifest.strategyVersion,
    },
    worktreeId: WORKTREE_ID,
  };
  const outputPath = path.resolve(
    output ||
      path.join(
        getDevSessionDirectory(targetPlatform, sessionId),
        'session.json',
      ),
  );
  await writeJson(outputPath, session);
  if (!output) {
    await pruneSessionDirectories(path.dirname(outputPath), {
      preserveSessionId: sessionId,
    });
  }
  return { outputPath, session };
}

function createRenewedDevSession(
  session,
  { nowEpochMs = Date.now(), ttlMs = SESSION_TTL_MS } = {},
) {
  if (
    session?.schemaVersion !== DEV_SESSION_SCHEMA_VERSION ||
    !['android', 'ios'].includes(session.platform) ||
    typeof session.deviceId !== 'string' ||
    !/^wk-[0-9a-f]{12}-dev-[0-9a-f]{12}-[0-9a-f]{16}$/u.test(
      session.sessionId || '',
    ) ||
    typeof session.worktreeId !== 'string'
  ) {
    throw new Error('[nativeDevShell] Cannot renew an invalid dev session.');
  }
  const expiresAtEpochMs = nowEpochMs + ttlMs;
  if (
    !Number.isSafeInteger(nowEpochMs) ||
    !Number.isSafeInteger(ttlMs) ||
    ttlMs <= 0 ||
    !Number.isSafeInteger(expiresAtEpochMs)
  ) {
    throw new Error('[nativeDevShell] Invalid dev session renewal time.');
  }
  return {
    ...session,
    expiresAt: new Date(expiresAtEpochMs).toISOString(),
    expiresAtEpochMs,
  };
}

function parseCurrentDevSession(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      '[nativeDevShell] Current private dev session pointer is invalid.',
      { cause: error },
    );
  }
}

function assertCurrentDevSession(current, session) {
  if (
    current?.schemaVersion !== 1 ||
    current.deviceId !== session.deviceId ||
    current.sessionId !== session.sessionId ||
    current.worktreeId !== session.worktreeId
  ) {
    throw new Error(
      '[nativeDevShell] Refusing to renew a private dev session that is no longer current.',
    );
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (
    ![
      'artifact-manifest',
      'compatibility',
      'contract',
      'launch',
      'resolve',
      'session',
    ].includes(command)
  ) {
    throw new Error(
      'Usage: native-dev-shell.js <artifact-manifest|compatibility|contract|resolve|session|launch> --platform <android|ios> [--device <serial|UDID>] [--artifact <path>] [--metro-url <url>] [--metro-port <port>] [--shell <auto|local|remote>] [--vendor <auto|local|tag>] [--output <path>]',
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
        'device',
        'metro-port',
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
    device: values.device,
    metroPort: values['metro-port'],
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
  const keyInputs = {
    nativeContractKey: resolvedNativeContractKey,
    platform: targetPlatform,
    webEmbedInputKey,
  };
  const shellCompatibilityKey = computeShellCompatibilityKey(keyInputs);
  const shellInputKey = computeShellInputKey(keyInputs);
  return {
    ...platformArtifact,
    compatibilityTag: `mobile-dev-shell-contract-v${SHELL_RELEASE_TAG_VERSION}-${platformArtifact.resourcePlatform}-${platformArtifact.architecture}-${shellCompatibilityKey}`,
    exactTag: `mobile-dev-shell-input-v${SHELL_RELEASE_TAG_VERSION}-${platformArtifact.resourcePlatform}-${platformArtifact.architecture}-${shellInputKey}`,
    nativeContractKey: resolvedNativeContractKey,
    platform: targetPlatform,
    shellCompatibilityKey,
    shellInputKey,
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
  const isRemoteReceipt = /^sha256:[0-9a-f]{64}$/.test(receipt.ociDigest || '');
  const isLocalBuildReceipt =
    receipt.schemaVersion === 1 &&
    receipt.ociDigest === undefined &&
    receipt.reference === undefined;
  if (
    !/^[0-9a-f]{64}$/.test(receipt.inputKey || '') ||
    !/^[0-9a-f]{64}$/.test(receipt.outputTreeDigest || '') ||
    (!isRemoteReceipt && !isLocalBuildReceipt)
  ) {
    throw new Error('[nativeDevShell] Invalid web-embed preparation receipt.');
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
  const shellArtifactKey = hashValues('onekey-mobile-dev-shell-artifact-v3', [
    compatibility.shellInputKey,
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
    shellInputKey: compatibility.shellInputKey,
    webEmbed: isLocalBuildReceipt
      ? {
          inputKey: receipt.inputKey,
          outputTreeDigest: receipt.outputTreeDigest,
          source: 'local-build',
        }
      : {
          inputKey: receipt.inputKey,
          ociDigest: receipt.ociDigest,
          outputTreeDigest: receipt.outputTreeDigest,
          reference: receipt.reference,
        },
  };
  await writeJson(path.resolve(output), manifest);
  return manifest;
}

function getDefaultMetroUrl(platform, metroPort) {
  return platform === 'android'
    ? `http://10.0.2.2:${metroPort}`
    : `http://127.0.0.1:${metroPort}`;
}

function configureDeviceMetro({
  deviceId,
  metroPort,
  platform,
  requestedMetroUrl,
  runBestEffortCommand = runBestEffort,
  runCheckedCommand = runChecked,
  runForOutputCommand = runForOutput,
}) {
  if (requestedMetroUrl) {
    // Only override the device-facing route. Metro remains launcher-owned.
    return { metroUrl: requestedMetroUrl };
  }
  if (platform !== 'android') {
    return { metroUrl: getDefaultMetroUrl(platform, metroPort) };
  }
  const isEmulator =
    runForOutputCommand('adb', [
      '-s',
      deviceId,
      'shell',
      'getprop',
      'ro.kernel.qemu',
    ]).trim() === '1';
  if (isEmulator) {
    return { metroUrl: getDefaultMetroUrl(platform, metroPort) };
  }
  const route = `tcp:${String(metroPort)}`;
  const existingRemoteRoutes = runForOutputCommand('adb', [
    '-s',
    deviceId,
    'reverse',
    '--list',
  ])
    .split(/\r?\n/u)
    .map((line) => line.trim().split(/\s+/u))
    .filter((parts) => parts.length >= 2 && parts.at(-2) === route)
    .map((parts) => parts.at(-1));
  if (existingRemoteRoutes.length > 0) {
    if (existingRemoteRoutes.every((remoteRoute) => remoteRoute === route)) {
      return { metroUrl: `http://127.0.0.1:${String(metroPort)}` };
    }
    throw new Error(
      `[nativeDevShell] Android reverse route ${route} already targets ${existingRemoteRoutes.join(', ')} on device ${deviceId}.`,
    );
  }
  runCheckedCommand('adb', ['-s', deviceId, 'reverse', route, route]);
  return {
    metroUrl: `http://127.0.0.1:${String(metroPort)}`,
    release() {
      runBestEffortCommand('adb', [
        '-s',
        deviceId,
        'reverse',
        '--remove',
        route,
      ]);
    },
  };
}

async function waitForMetro(metroPort, child, getSpawnError) {
  const deadline = Date.now() + 90_000;
  const statusUrl = `http://127.0.0.1:${metroPort}/status`;
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) {
      throw new Error('[nativeDevShell] Unable to start Metro.', {
        cause: spawnError,
      });
    }
    if (child.exitCode !== null) {
      throw new Error(
        `[nativeDevShell] Metro exited before serving the session (code ${String(child.exitCode)}).`,
      );
    }
    try {
      const response = await fetch(statusUrl, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      // Metro may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('[nativeDevShell] Timed out waiting for Metro.');
}

async function waitForMetroCompletionWithSessionRenewal({
  clearTimeoutFn = clearTimeout,
  fatalExpiryWindowMs = SESSION_RENEW_FATAL_WINDOW_MS,
  initialExpiresAtEpochMs,
  intervalMs = SESSION_RENEW_INTERVAL_MS,
  metroCompletion,
  nowFn = Date.now,
  onRenewalFailure = () => {},
  retryIntervalMs = SESSION_RENEW_RETRY_INTERVAL_MS,
  renewSession,
  setTimeoutFn = setTimeout,
}) {
  if (
    !Number.isSafeInteger(initialExpiresAtEpochMs) ||
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < 0 ||
    !Number.isSafeInteger(retryIntervalMs) ||
    retryIntervalMs < 0 ||
    !Number.isSafeInteger(fatalExpiryWindowMs) ||
    fatalExpiryWindowMs < 0
  ) {
    throw new Error('[nativeDevShell] Invalid session renewal timing.');
  }
  const metroOutcome = metroCompletion.then((value) => ({
    type: 'metro-complete',
    value,
  }));
  let actualExpiresAtEpochMs = initialExpiresAtEpochMs;
  let consecutiveFailures = 0;
  let nextDelayMs = intervalMs;
  while (true) {
    let timer;
    const delayMs = nextDelayMs;
    const renewalDue = new Promise((resolve) => {
      timer = setTimeoutFn(() => resolve({ type: 'renewal-due' }), delayMs);
    });
    let outcome;
    try {
      outcome = await Promise.race([metroOutcome, renewalDue]);
    } finally {
      clearTimeoutFn(timer);
    }
    if (outcome.type === 'metro-complete') return outcome.value;
    try {
      const renewedSession = await renewSession();
      const renewedExpiresAtEpochMs = renewedSession?.expiresAtEpochMs;
      if (
        !Number.isSafeInteger(renewedExpiresAtEpochMs) ||
        renewedExpiresAtEpochMs <= nowFn()
      ) {
        throw new Error(
          '[nativeDevShell] Session renewal returned an invalid expiry.',
        );
      }
      actualExpiresAtEpochMs = renewedExpiresAtEpochMs;
      consecutiveFailures = 0;
      nextDelayMs = intervalMs;
    } catch (error) {
      consecutiveFailures += 1;
      const remainingMs = actualExpiresAtEpochMs - nowFn();
      await Promise.resolve(
        onRenewalFailure({
          consecutiveFailures,
          error,
          expiresAtEpochMs: actualExpiresAtEpochMs,
          remainingMs,
          retryIntervalMs,
          shouldPrintNotice: consecutiveFailures === 1,
        }),
      );
      if (consecutiveFailures >= 2 && remainingMs <= fatalExpiryWindowMs) {
        throw new Error(
          `[nativeDevShell] Private dev session renewal failed ${String(consecutiveFailures)} consecutive times and expires in ${String(remainingMs)}ms.`,
          { cause: error },
        );
      }
      nextDelayMs = retryIntervalMs;
    }
  }
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `[nativeDevShell] Command failed (${String(result.status)}): ${command}`,
      { cause: result.error },
    );
  }
}

function runBestEffort(command, args, options = {}) {
  try {
    runChecked(command, args, options);
  } catch (error) {
    console.error(
      `[nativeDevShell] Cleanup warning: ${getErrorMessage(error)}`,
    );
  }
}

function runForOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `[nativeDevShell] Command failed (${String(result.status)}): ${command} ${result.stderr?.trim() || ''}`,
      { cause: result.error },
    );
  }
  return result.stdout.trim();
}

function getJavaMajorVersion(result) {
  if (result.status !== 0 || result.error) return undefined;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = output.match(/\bversion\s+"(?:1\.)?(\d+)/u);
  return match ? Number(match[1]) : undefined;
}

function getAndroidSdkRoot({ env, hostPlatform, spawnCommand }) {
  const candidates = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter(Boolean);
  const findAdb = spawnCommand(
    hostPlatform === 'win32' ? 'where' : 'which',
    ['adb'],
    {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  if (findAdb.status === 0 && !findAdb.error) {
    for (const adbPath of findAdb.stdout.split(/\r?\n/u).filter(Boolean)) {
      const platformToolsDirectory = path.dirname(adbPath);
      if (path.basename(platformToolsDirectory) === 'platform-tools') {
        candidates.push(path.dirname(platformToolsDirectory));
      }
    }
  }
  candidates.push(
    hostPlatform === 'darwin'
      ? path.join(os.homedir(), 'Library/Android/sdk')
      : path.join(os.homedir(), 'Android/Sdk'),
  );
  for (const candidate of new Set(candidates)) {
    if (fs.existsSync(path.join(candidate, 'platform-tools'))) {
      return candidate;
    }
  }
  throw new Error(
    '[nativeDevShell] Android local shell builds require an Android SDK. Set ANDROID_HOME or make the SDK adb available on PATH.',
  );
}

function getAndroidLocalBuildEnvironment({
  env = process.env,
  hostPlatform = process.platform,
  spawnCommand = spawnSync,
} = {}) {
  const javaHomes = [env.JAVA_HOME, env.JAVA_HOME_17_X64].filter(Boolean);
  let buildEnv;
  if (hostPlatform === 'darwin') {
    const javaHome = spawnCommand('/usr/libexec/java_home', ['-v', '17'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (javaHome.status === 0 && !javaHome.error && javaHome.stdout.trim()) {
      javaHomes.push(javaHome.stdout.trim());
    }
  }
  for (const javaHome of new Set(javaHomes)) {
    const result = spawnCommand(path.join(javaHome, 'bin/java'), ['-version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (getJavaMajorVersion(result) === 17) {
      buildEnv = {
        ...env,
        JAVA_HOME: javaHome,
        PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`,
      };
      break;
    }
  }
  if (!buildEnv) {
    const pathJava = spawnCommand('java', ['-version'], {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (getJavaMajorVersion(pathJava) === 17) {
      buildEnv = { ...env };
      delete buildEnv.JAVA_HOME;
    }
  }
  if (!buildEnv) {
    throw new Error(
      '[nativeDevShell] Android local shell builds require Java 17. Install a Java 17 JDK or set JAVA_HOME_17_X64.',
    );
  }
  const androidSdkRoot = getAndroidSdkRoot({
    env: buildEnv,
    hostPlatform,
    spawnCommand,
  });
  return {
    ...buildEnv,
    ANDROID_HOME: androidSdkRoot,
    ANDROID_SDK_ROOT: androidSdkRoot,
  };
}

function parseAndroidDevices(output) {
  return output
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.trim().split(/\s+/u))
    .filter((parts) => parts.length >= 2 && parts[1] === 'device')
    .map(([id]) => ({ id, name: id }));
}

function parseIosSimulators(output) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw new Error('[nativeDevShell] Unable to parse simctl device list.', {
      cause: error,
    });
  }
  return Object.values(parsed.devices || {})
    .flat()
    .filter(
      (device) => device.isAvailable !== false && device.state === 'Booted',
    )
    .map((device) => ({ id: device.udid, name: device.name }));
}

function selectTargetDevice({ candidates, platform, requestedDevice }) {
  if (requestedDevice) {
    const selected = candidates.find(({ id }) => id === requestedDevice);
    if (!selected) {
      throw new Error(
        `[nativeDevShell] Device ${requestedDevice} is not available for ${platform}. Available devices:\n${formatDeviceList(candidates)}`,
      );
    }
    return selected;
  }
  if (candidates.length !== 1) {
    throw new Error(
      `[nativeDevShell] --device is required when ${candidates.length === 0 ? 'no' : 'multiple'} ${platform} devices are available. Available devices:\n${formatDeviceList(candidates)}`,
    );
  }
  return candidates[0];
}

function formatDeviceList(candidates) {
  return candidates.length
    ? candidates.map(({ id, name }) => `- ${id} (${name})`).join('\n')
    : '- none';
}

function resolveTargetDevice({ platform, requestedDevice }) {
  const candidates =
    platform === 'android'
      ? parseAndroidDevices(runForOutput('adb', ['devices', '-l']))
      : parseIosSimulators(
          runForOutput('xcrun', [
            'simctl',
            'list',
            'devices',
            'available',
            '--json',
          ]),
        );
  return selectTargetDevice({ candidates, platform, requestedDevice });
}

function assertTargetDeviceArchitecture({
  deviceId,
  platform,
  runForOutputCommand = runForOutput,
}) {
  const targetPlatform = assertPlatform(platform);
  const requiredArchitecture = getPlatformArtifact(targetPlatform).architecture;
  const reportedArchitectures =
    targetPlatform === 'android'
      ? runForOutputCommand('adb', [
          '-s',
          deviceId,
          'shell',
          'getprop',
          'ro.product.cpu.abilist',
        ])
          .split(',')
          .map((architecture) => architecture.trim())
          .filter(Boolean)
      : [
          runForOutputCommand('xcrun', [
            'simctl',
            'spawn',
            deviceId,
            'uname',
            '-m',
          ]).trim(),
        ].filter(Boolean);
  if (!reportedArchitectures.includes(requiredArchitecture)) {
    throw new Error(
      `[nativeDevShell] ${targetPlatform} target ${deviceId} cannot run the ${requiredArchitecture} development shell; reported architectures: ${reportedArchitectures.join(', ') || 'none'}.`,
    );
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function getProcessStartedAtMs(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
  if (pid === process.pid) return CURRENT_PROCESS_STARTED_AT_MS;
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' },
    timeout: 5000,
  });
  if (result.status !== 0 || result.error) return undefined;
  const startedAtMs = Date.parse(result.stdout.trim());
  return Number.isFinite(startedAtMs) ? startedAtMs : undefined;
}

function isLockOwnerAlive({
  getProcessStartedAt,
  owner,
  ownerMtimeMs,
  processIsAlive,
}) {
  if (!owner || !processIsAlive(owner.pid)) return false;
  const currentStartedAtMs = getProcessStartedAt(owner.pid);
  if (currentStartedAtMs === undefined) return true;
  if (Number.isFinite(owner.processStartedAtMs)) {
    return Math.abs(owner.processStartedAtMs - currentStartedAtMs) <= 1000;
  }
  return (
    !Number.isFinite(ownerMtimeMs) || currentStartedAtMs <= ownerMtimeMs + 1000
  );
}

function getLockSnapshot({ fileSystem, lockDirectory, ownerPath }) {
  const missingSnapshot = () => ({
    activeOwner: undefined,
    ageMs: undefined,
    identity: undefined,
    missing: true,
    ownerMtimeMs: undefined,
  });
  let before;
  try {
    before = fileSystem.statSync(lockDirectory);
  } catch (error) {
    if (error?.code === 'ENOENT') return missingSnapshot();
    throw error;
  }
  const readOwner = () => {
    try {
      return JSON.parse(fileSystem.readFileSync(ownerPath, 'utf8'));
    } catch {
      return undefined;
    }
  };
  const getOwnerGeneration = (owner) =>
    owner?.sessionId === undefined
      ? owner?.token
      : `session:${owner.sessionId}`;
  const firstOwner = readOwner();
  try {
    const middle = fileSystem.statSync(lockDirectory);
    const secondOwner = readOwner();
    let ownerMtimeMs;
    try {
      ownerMtimeMs = fileSystem.statSync(ownerPath).mtimeMs;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const after = fileSystem.statSync(lockDirectory);
    if (
      before.dev !== middle.dev ||
      before.ino !== middle.ino ||
      middle.dev !== after.dev ||
      middle.ino !== after.ino ||
      getOwnerGeneration(firstOwner) !== getOwnerGeneration(secondOwner)
    ) {
      return missingSnapshot();
    }
    return {
      activeOwner: secondOwner,
      ageMs: Date.now() - after.mtimeMs,
      identity: `${String(after.dev)}:${String(after.ino)}`,
      missing: false,
      ownerMtimeMs,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return missingSnapshot();
    throw error;
  }
}

function getLockOwnerToken(snapshot) {
  return snapshot.activeOwner?.sessionId;
}

function isSameLockGeneration(left, right) {
  return (
    !left.missing &&
    !right.missing &&
    left.identity === right.identity &&
    getLockOwnerToken(left) === getLockOwnerToken(right)
  );
}

function getReclaimMarkerSnapshot(fileSystem, reclaimMarker) {
  return getLockSnapshot({
    fileSystem,
    lockDirectory: reclaimMarker,
    ownerPath: path.join(reclaimMarker, 'owner.json'),
  });
}

function isSameMarkerGeneration(left, right) {
  return (
    !left.missing &&
    !right.missing &&
    left.identity === right.identity &&
    left.activeOwner?.token === right.activeOwner?.token
  );
}

function isMarkerBoundToRoot(marker, root) {
  return (
    !marker.activeOwner ||
    (marker.activeOwner.rootIdentity === root.identity &&
      marker.activeOwner.mainOwnerToken === getLockOwnerToken(root))
  );
}

function recoverAbandonedReclaimMarker({
  fileSystem,
  getProcessStartedAt,
  lockDirectory,
  ownerPath,
  processIsAlive,
  reclaimMarker,
  rootSnapshot,
}) {
  const marker = getReclaimMarkerSnapshot(fileSystem, reclaimMarker);
  if (marker.missing) return true;
  if (!isMarkerBoundToRoot(marker, rootSnapshot)) return false;
  if (
    isLockOwnerAlive({
      getProcessStartedAt,
      owner: marker.activeOwner,
      ownerMtimeMs: marker.ownerMtimeMs,
      processIsAlive,
    })
  ) {
    return false;
  }
  if (!marker.activeOwner && marker.ageMs < LOCK_STALE_MS) {
    return false;
  }
  const confirmedRoot = getLockSnapshot({
    fileSystem,
    lockDirectory,
    ownerPath,
  });
  const confirmedMarker = getReclaimMarkerSnapshot(fileSystem, reclaimMarker);
  if (
    !isSameLockGeneration(rootSnapshot, confirmedRoot) ||
    !isSameMarkerGeneration(marker, confirmedMarker) ||
    !isMarkerBoundToRoot(confirmedMarker, confirmedRoot) ||
    isLockOwnerAlive({
      getProcessStartedAt,
      owner: confirmedMarker.activeOwner,
      ownerMtimeMs: confirmedMarker.ownerMtimeMs,
      processIsAlive,
    })
  ) {
    return false;
  }
  const markerToken =
    confirmedMarker.activeOwner?.token || confirmedMarker.identity;
  const staleMarker = `${reclaimMarker}.stale-${crypto
    .createHash('sha256')
    .update(markerToken)
    .digest('hex')
    .slice(0, 16)}`;
  try {
    fileSystem.renameSync(reclaimMarker, staleMarker);
  } catch (error) {
    if (
      error?.code === 'ENOENT' ||
      error?.code === 'EEXIST' ||
      error?.code === 'ENOTEMPTY'
    ) {
      return false;
    }
    throw error;
  }
  const movedMarker = getReclaimMarkerSnapshot(fileSystem, staleMarker);
  const finalRoot = getLockSnapshot({
    fileSystem,
    lockDirectory,
    ownerPath,
  });
  if (
    !isSameMarkerGeneration(confirmedMarker, movedMarker) ||
    !isSameLockGeneration(confirmedRoot, finalRoot)
  ) {
    return false;
  }
  fileSystem.rmSync(staleMarker, { force: true, recursive: true });
  return true;
}

function acquireNamedLock({
  fileSystem = fs,
  getProcessStartedAt = getProcessStartedAtMs,
  key,
  kind,
  lockRoot = LOCK_ROOT,
  owner,
  processIsAlive = isProcessAlive,
  returnNullWhenBusy = false,
}) {
  const lockOwner = {
    ...owner,
    processStartedAtMs: Number.isFinite(owner.processStartedAtMs)
      ? owner.processStartedAtMs
      : getProcessStartedAt(owner.pid),
  };
  fileSystem.mkdirSync(lockRoot, { recursive: true });
  const lockKey = crypto
    .createHash('sha256')
    .update(`${kind}\0${key}`)
    .digest('hex');
  const lockDirectory = path.join(lockRoot, `${kind}-${lockKey}`);
  const ownerPath = path.join(lockDirectory, 'owner.json');
  let lastContentionError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fileSystem.mkdirSync(lockDirectory);
      fileSystem.writeFileSync(
        ownerPath,
        `${JSON.stringify(lockOwner, null, 2)}\n`,
        { flag: 'wx' },
      );
      return {
        release() {
          let activeOwner;
          try {
            activeOwner = JSON.parse(
              fileSystem.readFileSync(ownerPath, 'utf8'),
            );
          } catch {
            return;
          }
          if (activeOwner.sessionId === lockOwner.sessionId) {
            fileSystem.rmSync(lockDirectory, {
              force: true,
              recursive: true,
            });
          }
        },
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      lastContentionError = error;
      const snapshot = getLockSnapshot({
        fileSystem,
        lockDirectory,
        ownerPath,
      });
      if (!snapshot.missing) {
        if (!snapshot.activeOwner && snapshot.ageMs < LOCK_STALE_MS) {
          if (returnNullWhenBusy) return null;
          throw new Error(
            `[nativeDevShell] ${kind} lock is being acquired by another process.`,
            { cause: error },
          );
        }
        if (
          isLockOwnerAlive({
            getProcessStartedAt,
            owner: snapshot.activeOwner,
            ownerMtimeMs: snapshot.ownerMtimeMs,
            processIsAlive,
          })
        ) {
          if (returnNullWhenBusy) return null;
          throw new Error(
            `[nativeDevShell] ${kind} is already owned by worktree=${snapshot.activeOwner.worktreeId || 'unknown'} device=${snapshot.activeOwner.deviceId || 'unknown'} session=${snapshot.activeOwner.sessionId || 'unknown'} pid=${String(snapshot.activeOwner.pid)}.`,
            { cause: error },
          );
        }
        const reclaimMarker = path.join(lockDirectory, '.reclaim');
        let markerOwner;
        let markerAcquired = false;
        let lockRenamed = false;
        try {
          try {
            fileSystem.mkdirSync(reclaimMarker);
            markerOwner = {
              mainOwnerToken: getLockOwnerToken(snapshot),
              pid: process.pid,
              processStartedAtMs: getProcessStartedAt(process.pid),
              rootIdentity: snapshot.identity,
              token: crypto.randomBytes(16).toString('hex'),
            };
            fileSystem.writeFileSync(
              path.join(reclaimMarker, 'owner.json'),
              `${JSON.stringify(markerOwner, null, 2)}\n`,
              { flag: 'wx' },
            );
            markerAcquired = true;
          } catch (markerError) {
            if (markerError?.code === 'EEXIST') {
              const recovered = recoverAbandonedReclaimMarker({
                fileSystem,
                getProcessStartedAt,
                lockDirectory,
                ownerPath,
                processIsAlive,
                reclaimMarker,
                rootSnapshot: snapshot,
              });
              if (!recovered) {
                if (returnNullWhenBusy) return null;
                throw new Error(
                  `[nativeDevShell] ${kind} stale lock is already being reclaimed.`,
                  { cause: markerError },
                );
              }
            } else if (markerError?.code !== 'ENOENT') {
              throw markerError;
            }
            lastContentionError = markerError;
          }
          if (markerAcquired) {
            const confirmed = getLockSnapshot({
              fileSystem,
              lockDirectory,
              ownerPath,
            });
            const confirmedMarker = getReclaimMarkerSnapshot(
              fileSystem,
              reclaimMarker,
            );
            if (
              isSameLockGeneration(snapshot, confirmed) &&
              confirmedMarker.activeOwner?.token === markerOwner.token &&
              isMarkerBoundToRoot(confirmedMarker, confirmed)
            ) {
              if (
                isLockOwnerAlive({
                  getProcessStartedAt,
                  owner: confirmed.activeOwner,
                  ownerMtimeMs: confirmed.ownerMtimeMs,
                  processIsAlive,
                })
              ) {
                if (returnNullWhenBusy) return null;
                throw new Error(
                  `[nativeDevShell] ${kind} became active while reclaiming its stale owner.`,
                  { cause: error },
                );
              }
              const staleDirectory = `${lockDirectory}.stale-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
              try {
                fileSystem.renameSync(lockDirectory, staleDirectory);
                lockRenamed = true;
                fileSystem.rmSync(staleDirectory, {
                  force: true,
                  recursive: true,
                });
              } catch (renameError) {
                if (renameError?.code !== 'ENOENT') throw renameError;
                lastContentionError = renameError;
              }
            }
          }
        } finally {
          if (markerAcquired && !lockRenamed) {
            const currentMarker = getReclaimMarkerSnapshot(
              fileSystem,
              reclaimMarker,
            );
            if (currentMarker.activeOwner?.token === markerOwner.token) {
              fileSystem.rmSync(reclaimMarker, {
                force: true,
                recursive: true,
              });
            }
          }
        }
      }
    }
  }
  throw new Error(`[nativeDevShell] Unable to acquire ${kind} lock.`, {
    cause: lastContentionError,
  });
}

async function acquireWorktreePreparationLock({
  report,
  waitIntervalMs = 500,
}) {
  let waitNoticePrinted = false;
  while (true) {
    const lock = acquireNamedLock({
      key: fs.realpathSync(REPO_ROOT),
      kind: 'worktree-preparation',
      owner: {
        deviceId: report.deviceId,
        pid: process.pid,
        sessionId: report.sessionId,
        worktreeId: report.worktreeId,
      },
      returnNullWhenBusy: true,
    });
    if (lock) return lock;
    if (!waitNoticePrinted) {
      const reason = 'another device session is preparing shared outputs';
      const notice = `${formatRunContext(report)} action=wait-worktree-preparation reason=${JSON.stringify(reason)}`;
      report.userNoticeRequired = true;
      report.userNotices.push({
        notice,
        reason,
        resource: 'worktree-preparation',
      });
      console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
      waitNoticePrinted = true;
    }
    await new Promise((resolve) => setTimeout(resolve, waitIntervalMs));
  }
}

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ host: '0.0.0.0', port }, () => {
      server.close(() => resolve(true));
    });
  });
}

function parseMetroPort(value) {
  if (value === undefined) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`[nativeDevShell] Invalid --metro-port: ${String(value)}`);
  }
  return port;
}

async function acquireMetroPort({ deviceId, requestedPort, sessionId }) {
  const explicitPort = parseMetroPort(requestedPort);
  const candidates = explicitPort
    ? [explicitPort]
    : Array.from({ length: 200 }, (_value, index) => 8081 + index);
  for (const port of candidates) {
    const lock = acquireNamedLock({
      key: String(port),
      kind: 'metro-port',
      owner: { deviceId, pid: process.pid, sessionId, worktreeId: WORKTREE_ID },
      returnNullWhenBusy: true,
    });
    if (!lock) {
      if (explicitPort) {
        throw new Error(
          `[nativeDevShell] Metro port ${port} is already locked.`,
        );
      }
    } else {
      if (await canListenOnPort(port)) return { lock, port };
      lock.release();
      if (explicitPort) {
        throw new Error(
          `[nativeDevShell] Metro port ${port} is already in use.`,
        );
      }
    }
  }
  throw new Error('[nativeDevShell] No available Metro port in 8081-8280.');
}

function launchNativeApp(
  platform,
  deviceId,
  { runCheckedCommand = runChecked, runForOutputCommand = runForOutput } = {},
) {
  if (platform === 'android') {
    runCheckedCommand('adb', [
      '-s',
      deviceId,
      'shell',
      'am',
      'start',
      '-S',
      '-n',
      'so.onekey.app.wallet/.MainLauncherActivity',
    ]);
    return {};
  }
  const output = runForOutputCommand('xcrun', [
    'simctl',
    'launch',
    '--terminate-running-process',
    deviceId,
    IOS_BUNDLE_ID,
  ]);
  const prefix = `${IOS_BUNDLE_ID}: `;
  const processId = output.startsWith(prefix)
    ? Number(output.slice(prefix.length))
    : Number.NaN;
  if (!Number.isSafeInteger(processId) || processId <= 0) {
    throw new Error(
      '[nativeDevShell] iOS simulator launch returned no process ID.',
    );
  }
  return { processId };
}

async function waitForNativeAppStartup({
  androidPollIntervalMs = ANDROID_APP_STARTUP_POLL_INTERVAL_MS,
  androidStartupTimeoutMs = ANDROID_APP_STARTUP_TIMEOUT_MS,
  deviceId,
  launch,
  platform,
  runForOutputCommand = runForOutput,
  wait = (durationMs) =>
    new Promise((resolve) => setTimeout(resolve, durationMs)),
}) {
  try {
    if (platform === 'android') {
      const readProcessIds = () => {
        try {
          const output = runForOutputCommand('adb', [
            '-s',
            deviceId,
            'shell',
            'pidof',
            ANDROID_APPLICATION_ID,
          ]);
          return /^\d+(?:\s+\d+)*$/u.test(output) ? output.split(/\s+/u) : [];
        } catch {
          return [];
        }
      };
      const pollCount = Math.floor(
        androidStartupTimeoutMs / androidPollIntervalMs,
      );
      let launchedProcessIds = readProcessIds();
      for (
        let pollIndex = 0;
        launchedProcessIds.length === 0 && pollIndex < pollCount;
        pollIndex += 1
      ) {
        await wait(androidPollIntervalMs);
        launchedProcessIds = readProcessIds();
      }
      if (launchedProcessIds.length === 0) {
        throw new Error('[nativeDevShell] Android app process is missing.');
      }
      await wait(NATIVE_APP_STARTUP_GRACE_MS);
      const survivingProcessIds = new Set(readProcessIds());
      if (
        !launchedProcessIds.some((processId) =>
          survivingProcessIds.has(processId),
        )
      ) {
        throw new Error('[nativeDevShell] Android app process exited.');
      }
    } else {
      await wait(NATIVE_APP_STARTUP_GRACE_MS);
      if (!Number.isSafeInteger(launch.processId) || launch.processId <= 0) {
        throw new Error('[nativeDevShell] iOS app process ID is missing.');
      }
      runForOutputCommand('xcrun', [
        'simctl',
        'spawn',
        deviceId,
        '/bin/kill',
        '-0',
        String(launch.processId),
      ]);
    }
  } catch (error) {
    throw new Error(`[nativeDevShell] ${platform} app exited during startup.`, {
      cause: error,
    });
  }
}

async function preparePrivateSessionPayload({
  deviceId,
  metroUrl,
  platform,
  sessionId,
}) {
  const directory = getDevSessionDirectory(platform, sessionId);
  await fs.promises.rm(directory, { force: true, recursive: true });
  await fs.promises.mkdir(directory, { recursive: true });
  await pruneSessionDirectories(path.dirname(directory), {
    preserveSessionId: sessionId,
  });
  const { outputPath, session } = await writeDevSession({
    deviceId,
    metroUrl,
    output: path.join(directory, 'session.json'),
    platform,
    sessionId,
  });
  const artifactDirectory = getPlatformOutputDirectory(MOBILE_ROOT, platform);
  const manifestPath = path.join(artifactDirectory, 'manifest.json');
  const commonPath = path.join(artifactDirectory, 'common.hbc');
  await fs.promises.copyFile(
    manifestPath,
    path.join(directory, 'vendor-manifest.json'),
  );
  await fs.promises.copyFile(commonPath, path.join(directory, 'common.hbc'));
  const current = {
    deviceId,
    schemaVersion: 1,
    sessionId,
    worktreeId: WORKTREE_ID,
  };
  await writeJson(path.join(directory, 'current.json'), current);
  return { directory, outputPath, session };
}

function quoteAdbShellArgument(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function getAndroidPrivateSessionInstallArgs({ deviceId, sessionId }) {
  const remoteTemporaryDirectory = `/data/local/tmp/onekey-dev-session-${sessionId}`;
  const appRoot = `files/${DEV_SESSION_ROOT_NAME}`;
  const appTemporaryDirectory = `${appRoot}/.tmp-${sessionId}`;
  const appSessionDirectory = `${appRoot}/${sessionId}`;
  const installCommand = [
    'umask 077',
    `mkdir -p ${appRoot}`,
    `rm -rf ${appTemporaryDirectory}`,
    `mkdir ${appTemporaryDirectory}`,
    `cp ${remoteTemporaryDirectory}/session.json ${appTemporaryDirectory}/session.json`,
    `cp ${remoteTemporaryDirectory}/vendor-manifest.json ${appTemporaryDirectory}/vendor-manifest.json`,
    `cp ${remoteTemporaryDirectory}/common.hbc ${appTemporaryDirectory}/common.hbc`,
    `mv ${appTemporaryDirectory} ${appSessionDirectory}`,
    `cp ${remoteTemporaryDirectory}/current.json ${appRoot}/current.json.tmp-${sessionId}`,
    `mv ${appRoot}/current.json.tmp-${sessionId} ${appRoot}/current.json`,
    `for candidate in ${appRoot}/wk-*; do if [ -d "$candidate" ] && [ "$candidate" != ${appSessionDirectory} ]; then rm -rf "$candidate"; fi; done`,
  ].join(' && ');
  return [
    '-s',
    deviceId,
    'shell',
    'run-as',
    ANDROID_APPLICATION_ID,
    'sh',
    '-c',
    quoteAdbShellArgument(installCommand),
  ];
}

function stageAndroidPrivateSession({ deviceId, directory, sessionId }) {
  const remoteTemporaryDirectory = `/data/local/tmp/onekey-dev-session-${sessionId}`;
  runChecked('adb', [
    '-s',
    deviceId,
    'shell',
    'mkdir',
    '-p',
    remoteTemporaryDirectory,
  ]);
  try {
    for (const fileName of [
      'session.json',
      'vendor-manifest.json',
      'common.hbc',
      'current.json',
    ]) {
      runChecked('adb', [
        '-s',
        deviceId,
        'push',
        path.join(directory, fileName),
        `${remoteTemporaryDirectory}/${fileName}`,
      ]);
    }
    runChecked(
      'adb',
      getAndroidPrivateSessionInstallArgs({ deviceId, sessionId }),
    );
  } finally {
    runBestEffort('adb', [
      '-s',
      deviceId,
      'shell',
      'rm',
      '-rf',
      remoteTemporaryDirectory,
    ]);
  }
}

async function stageIosPrivateSession({ deviceId, directory, sessionId }) {
  const dataContainer = runForOutput('xcrun', [
    'simctl',
    'get_app_container',
    deviceId,
    IOS_BUNDLE_ID,
    'data',
  ]);
  const appRoot = path.join(
    dataContainer,
    'Library/Application Support',
    DEV_SESSION_ROOT_NAME,
  );
  const temporaryDirectory = path.join(appRoot, `.tmp-${sessionId}`);
  const sessionDirectory = path.join(appRoot, sessionId);
  await fs.promises.mkdir(appRoot, { recursive: true });
  await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  await fs.promises.mkdir(temporaryDirectory);
  for (const fileName of [
    'session.json',
    'vendor-manifest.json',
    'common.hbc',
  ]) {
    await fs.promises.copyFile(
      path.join(directory, fileName),
      path.join(temporaryDirectory, fileName),
    );
  }
  await fs.promises.rename(temporaryDirectory, sessionDirectory);
  const currentTemporaryPath = path.join(
    appRoot,
    `current.json.tmp-${sessionId}`,
  );
  await fs.promises.copyFile(
    path.join(directory, 'current.json'),
    currentTemporaryPath,
  );
  await fs.promises.rename(
    currentTemporaryPath,
    path.join(appRoot, 'current.json'),
  );
  const entries = await fs.promises.readdir(appRoot, { withFileTypes: true });
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith('wk-') &&
          entry.name !== sessionId,
      )
      .map((entry) =>
        fs.promises.rm(path.join(appRoot, entry.name), {
          force: true,
          recursive: true,
        }),
      ),
  );
}

function getAndroidPrivateSessionRenewalArgs({ deviceId, sessionId }) {
  const appRoot = `files/${DEV_SESSION_ROOT_NAME}`;
  const sessionDirectory = `${appRoot}/${sessionId}`;
  const sessionPath = `${sessionDirectory}/session.json`;
  const temporaryPath = `${sessionPath}.tmp-${sessionId}`;
  const renewalCommand = [
    'umask 077',
    `test -d ${sessionDirectory}`,
    `rm -f ${temporaryPath}`,
    `cat > ${temporaryPath}`,
    `mv ${temporaryPath} ${sessionPath}`,
  ].join(' && ');
  return [
    '-s',
    deviceId,
    'shell',
    'run-as',
    ANDROID_APPLICATION_ID,
    'sh',
    '-c',
    quoteAdbShellArgument(renewalCommand),
  ];
}

function renewAndroidPrivateSession({
  deviceId,
  nowEpochMs,
  runCheckedCommand = runChecked,
  runForOutputCommand = runForOutput,
  session,
}) {
  const appRoot = `files/${DEV_SESSION_ROOT_NAME}`;
  const current = parseCurrentDevSession(
    runForOutputCommand('adb', [
      '-s',
      deviceId,
      'exec-out',
      'run-as',
      ANDROID_APPLICATION_ID,
      'cat',
      `${appRoot}/current.json`,
    ]),
  );
  assertCurrentDevSession(current, session);
  const renewedSession = createRenewedDevSession(session, { nowEpochMs });
  runCheckedCommand(
    'adb',
    getAndroidPrivateSessionRenewalArgs({
      deviceId,
      sessionId: session.sessionId,
    }),
    {
      input: `${JSON.stringify(renewedSession, null, 2)}\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
  return renewedSession;
}

async function renewIosPrivateSession({
  deviceId,
  fileSystem = fs,
  nowEpochMs,
  runForOutputCommand = runForOutput,
  session,
}) {
  const dataContainer = runForOutputCommand('xcrun', [
    'simctl',
    'get_app_container',
    deviceId,
    IOS_BUNDLE_ID,
    'data',
  ]);
  const appRoot = path.join(
    dataContainer,
    'Library/Application Support',
    DEV_SESSION_ROOT_NAME,
  );
  const current = parseCurrentDevSession(
    await fileSystem.promises.readFile(
      path.join(appRoot, 'current.json'),
      'utf8',
    ),
  );
  assertCurrentDevSession(current, session);
  const sessionDirectory = path.join(appRoot, session.sessionId);
  const sessionDirectoryStat =
    await fileSystem.promises.lstat(sessionDirectory);
  if (
    !sessionDirectoryStat.isDirectory() ||
    sessionDirectoryStat.isSymbolicLink()
  ) {
    throw new Error(
      '[nativeDevShell] iOS private dev session directory is invalid.',
    );
  }
  const renewedSession = createRenewedDevSession(session, { nowEpochMs });
  const sessionPath = path.join(sessionDirectory, 'session.json');
  const temporaryPath = path.join(
    sessionDirectory,
    `session.json.tmp-${session.sessionId}`,
  );
  await fileSystem.promises.rm(temporaryPath, { force: true });
  try {
    await fileSystem.promises.writeFile(
      temporaryPath,
      `${JSON.stringify(renewedSession, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    await fileSystem.promises.rename(temporaryPath, sessionPath);
  } finally {
    await fileSystem.promises.rm(temporaryPath, { force: true });
  }
  return renewedSession;
}

async function renewPrivateSession({
  deviceId,
  platform,
  session,
  ...options
}) {
  const targetPlatform = assertPlatform(platform);
  if (session.platform !== targetPlatform || session.deviceId !== deviceId) {
    throw new Error(
      '[nativeDevShell] Dev session renewal target does not match its host owner.',
    );
  }
  if (targetPlatform === 'android') {
    return renewAndroidPrivateSession({ deviceId, session, ...options });
  }
  return renewIosPrivateSession({ deviceId, session, ...options });
}

async function stagePrivateSession(options) {
  const payload = await preparePrivateSessionPayload(options);
  try {
    if (options.platform === 'android') {
      stageAndroidPrivateSession({ ...options, directory: payload.directory });
    } else {
      await stageIosPrivateSession({
        ...options,
        directory: payload.directory,
      });
    }
    return payload.session;
  } finally {
    await fs.promises.rm(payload.directory, { force: true, recursive: true });
  }
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
    runChecked(
      'yarn',
      ['workspace', '@onekeyhq/web-embed', 'prebundle:build'],
      { cwd: REPO_ROOT },
    );
    report.webEmbed.status = 'ready';
    printFallbackDone(report, 'web-embed');
  }
  await writeRunReport(report);
}

async function buildLocalShell({ platform, report }) {
  const buildEnv =
    platform === 'android' ? getAndroidLocalBuildEnvironment() : process.env;
  await prepareWebEmbedForLocalShell(report);
  const resultPath = path.join(
    REPO_ROOT,
    `node_modules/.cache/onekey-mobile-dev/build-shell-${platform}-${process.pid}.json`,
  );
  await fs.promises.mkdir(path.dirname(resultPath), { recursive: true });
  try {
    runChecked(
      'node',
      [
        path.join(MOBILE_ROOT, 'scripts/build-mobile-dev-shell.js'),
        'build',
        '--platform',
        platform,
        '--result',
        resultPath,
      ],
      { env: buildEnv },
    );
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

async function resolveAndInstallShell({ deviceId, platform, report, shell }) {
  if (!['auto', 'local', 'remote'].includes(shell)) {
    throw new Error(
      `[nativeDevShell] --shell must be auto, local, or remote; received ${shell}.`,
    );
  }
  const compatibility = getShellCompatibility({ platform });
  let artifactPath;
  let releaseCacheLease;
  let usedFallback = false;
  if (shell === 'local') {
    report.shell = {
      requested: shell,
      source: 'local-build',
      status: 'building',
      compatibilityTag: compatibility.compatibilityTag,
      exactTag: compatibility.exactTag,
    };
    await writeRunReport(report);
    artifactPath = await buildLocalShell({ platform, report });
  } else {
    report.shell = {
      requested: shell,
      status: 'restoring',
      compatibilityTag: compatibility.compatibilityTag,
      exactTag: compatibility.exactTag,
    };
    await writeRunReport(report);
    try {
      const restored = await restoreMobileDevShell({ compatibility });
      artifactPath = restored.artifactPath;
      releaseCacheLease = restored.releaseCacheLease;
      report.shell.source = restored.source;
      report.shell.ociDigest = restored.ociDigest;
      if (restored.compatibilityFallback) {
        const reason =
          restored.fallbackReason ||
          restored.userNotice ||
          'exact shell input was unavailable';
        report.shell.compatibilityFallback = true;
        report.shell.fallbackReason = reason;
        addCompatibilityNotice(report, { reason, resource: 'shell' });
      }
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
  await runWithCacheLeaseCleanup({
    operation: async () => {
      report.shell.status = 'installing';
      await writeRunReport(report);
      await installMobileDevShell({ artifactPath, deviceId, platform });
      if (usedFallback) printFallbackDone(report, 'shell');
      report.shell.artifactPath = artifactPath;
      report.shell.status = 'ready';
      await writeRunReport(report);
    },
    releaseCacheLease,
  });
}

async function prepareVendor({ platform, report, vendor }) {
  const { preparePlatform } = require('./build-dev-vendor');
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
  if (result.fallback) printFallbackDone(report, 'vendor');
  report.vendor = {
    ...report.vendor,
    ...result,
    status: 'ready',
  };
  await writeRunReport(report);
}

async function launchDevShell({
  device,
  metroPort: requestedMetroPort,
  metroUrl,
  platform,
  shell,
  vendor,
}) {
  devVendorConfig.applyTransformationEnvironment(process.env);
  const requestedDeviceMetroUrl = metroUrl
    ? parseMetroBaseUrl(metroUrl)
    : undefined;
  const selectedDevice = resolveTargetDevice({
    platform,
    requestedDevice: device,
  });
  assertTargetDeviceArchitecture({
    deviceId: selectedDevice.id,
    platform,
  });
  const sessionId = createSessionId({ deviceId: selectedDevice.id });
  const deviceLock = acquireNamedLock({
    key: `${platform}\0${selectedDevice.id}\0${platform === 'android' ? ANDROID_APPLICATION_ID : IOS_BUNDLE_ID}`,
    kind: 'device',
    owner: {
      deviceId: selectedDevice.id,
      pid: process.pid,
      sessionId,
      worktreeId: WORKTREE_ID,
    },
  });
  let metroLock;
  let child;
  let preparationLock;
  let releaseDeviceMetroRoute;
  let report;
  try {
    const metroAllocation = await acquireMetroPort({
      deviceId: selectedDevice.id,
      requestedPort: requestedMetroPort,
      sessionId,
    });
    metroLock = metroAllocation.lock;
    const metroPort = metroAllocation.port;
    const deviceMetro = configureDeviceMetro({
      deviceId: selectedDevice.id,
      metroPort,
      platform,
      requestedMetroUrl: requestedDeviceMetroUrl,
    });
    const deviceMetroUrl = deviceMetro.metroUrl;
    releaseDeviceMetroRoute = deviceMetro.release;
    report = createRunReport({
      deviceId: selectedDevice.id,
      metroPort,
      metroUrl: deviceMetroUrl,
      platform,
      sessionId,
      shell,
      vendor,
    });
    await writeRunReport(report);
    preparationLock = await acquireWorktreePreparationLock({ report });
    await resolveAndInstallShell({
      deviceId: selectedDevice.id,
      platform,
      report,
      shell,
    });
    await prepareVendor({ platform, report, vendor });
    const vendorManifest = loadVendorManifest(platform);
    let session = await stagePrivateSession({
      deviceId: selectedDevice.id,
      metroUrl: deviceMetroUrl,
      platform,
      sessionId,
    });
    report.session = {
      devicePath: `${DEV_SESSION_ROOT_NAME}/${sessionId}`,
      expiresAt: session.expiresAt,
      expiresAtEpochMs: session.expiresAtEpochMs,
      status: 'injected',
      worktreeId: session.worktreeId,
    };
    await writeRunReport(report);
    child = spawn(
      'yarn',
      [
        'workspace',
        '@onekeyhq/mobile',
        'native-bundle',
        '--port',
        String(metroPort),
        '--host',
        '0.0.0.0',
      ],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          ONEKEY_DEV_SESSION_ID: sessionId,
          ONEKEY_DEV_VENDOR: 'true',
        },
        stdio: 'inherit',
      },
    );
    let metroSpawnError;
    child.once('error', (error) => {
      metroSpawnError = error;
    });
    const metroCompletion = new Promise((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    await waitForMetro(metroPort, child, () => metroSpawnError);
    preparationLock.release();
    preparationLock = undefined;
    await prewarmNativeRuntimeBundles({
      fingerprint: vendorManifest.fingerprint,
      metroPort,
      platform,
      sessionId,
    });
    const nativeLaunch = launchNativeApp(platform, selectedDevice.id);
    report.launchedAt = new Date().toISOString();
    await waitForNativeAppStartup({
      deviceId: selectedDevice.id,
      launch: nativeLaunch,
      platform,
    });
    report.status = 'running';
    await writeRunReport(report);
    printRunSummary(report);
    if (metroSpawnError) {
      throw new Error('[nativeDevShell] Unable to start Metro.', {
        cause: metroSpawnError,
      });
    }
    const { code, signal } = await waitForMetroCompletionWithSessionRenewal({
      initialExpiresAtEpochMs: session.expiresAtEpochMs,
      metroCompletion,
      onRenewalFailure: async (details) => {
        addSessionRenewalNotice(report, details);
        try {
          await writeRunReport(report);
        } catch (error) {
          console.error(
            `[nativeDevShell] Session renewal report warning: ${getErrorMessage(error)}`,
          );
        }
      },
      renewSession: async () => {
        session = await renewPrivateSession({
          deviceId: selectedDevice.id,
          platform,
          session,
        });
        report.session.expiresAt = session.expiresAt;
        report.session.expiresAtEpochMs = session.expiresAtEpochMs;
        return session;
      },
    });
    if (code !== 0 && signal !== 'SIGINT' && signal !== 'SIGTERM') {
      throw new Error(
        `[nativeDevShell] Metro exited with code ${String(code)} signal ${String(signal)}.`,
      );
    }
    report.finishedAt = new Date().toISOString();
    report.status = 'finished';
    await writeRunReport(report);
    printRunSummary(report);
  } catch (error) {
    if (report) {
      report.finishedAt = new Date().toISOString();
      report.status = 'failed';
      report.failure = getErrorMessage(error);
      addFailureNotice(report, report.failure);
      await writeRunReport(report);
      printRunSummary(report);
    }
    throw error;
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
    preparationLock?.release();
    releaseDeviceMetroRoute?.();
    metroLock?.release();
    deviceLock.release();
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
  } else if (args.command === 'resolve') {
    const result = await resolveExactMobileDevShell({
      compatibility: getShellCompatibility(args),
    });
    if (args.output) await writeJson(path.resolve(args.output), result);
    console.log(String(result.exists));
  } else if (args.command === 'session') {
    const metroPort = parseMetroPort(args.metroPort) || 8081;
    const result = await writeDevSession({
      ...args,
      metroUrl: args.metroUrl || getDefaultMetroUrl(args.platform, metroPort),
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
  DEV_SESSION_SCHEMA_VERSION,
  SHELL_MANIFEST_SCHEMA_VERSION,
  addFallbackNotice,
  addFailureNotice,
  addSessionRenewalNotice,
  acquireNamedLock,
  acquireMetroPort,
  acquireWorktreePreparationLock,
  assertTargetDeviceArchitecture,
  configureDeviceMetro,
  createRenewedDevSession,
  createSessionId,
  createRunReport,
  getAndroidPrivateSessionInstallArgs,
  getAndroidPrivateSessionRenewalArgs,
  getAndroidLocalBuildEnvironment,
  getContractManifest,
  getNativeRuntimeBundleUrl,
  getPlatformArtifact,
  getShellArtifactTag,
  getShellCompatibility,
  launchNativeApp,
  loadVendorManifest,
  parseAndroidDevices,
  parseArgs,
  parseIosSimulators,
  parseMetroBaseUrl,
  parseMetroPort,
  prewarmNativeRuntimeBundles,
  printRunSummary,
  pruneSessionDirectories,
  quoteAdbShellArgument,
  renewPrivateSession,
  selectTargetDevice,
  waitForNativeAppStartup,
  waitForMetroCompletionWithSessionRenewal,
  writeContractManifest,
  writeArtifactManifest,
  writeDevSession,
};
