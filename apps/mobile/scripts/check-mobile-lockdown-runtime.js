#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
// This diagnostic reads only security state and LogBox from an isolated profile.
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const { createRequire } = require('module');
const os = require('os');
const path = require('path');
const { parseArgs } = require('util');

const inspectorRequire = createRequire(
  require.resolve('@react-native/dev-middleware/package.json'),
);
const WebSocket = inspectorRequire('ws');

const REPO_ROOT = fs.realpathSync(path.resolve(__dirname, '../../..'));
const REQUEST_TIMEOUT_MS = 10_000;
const STARTUP_OBSERVATION_MS = 10_000;

function validateRunReport(
  report,
  { device, repoRoot = REPO_ROOT, now = Date.now() },
) {
  const worktreeId = crypto
    .createHash('sha256')
    .update(fs.realpathSync(repoRoot))
    .digest('hex')
    .slice(0, 12);
  assert.equal(
    report.worktreeId,
    worktreeId,
    'DevSession belongs to a different worktree',
  );
  assert.equal(
    report.deviceId,
    device,
    'DevSession belongs to a different device',
  );
  assert.equal(report.status, 'running', 'DevSession must still be running');
  assert.equal(
    report.metroBindHost,
    '127.0.0.1',
    'Isolated acceptance requires a loopback-only Metro listener',
  );
  assert.ok(
    ['ios', 'android'].includes(report.platform),
    'Unsupported native platform',
  );
  assert.ok(
    Number.isInteger(report.metroPort) &&
      report.metroPort > 0 &&
      report.metroPort <= 65_535,
    'Invalid Metro port',
  );
  assert.equal(
    report.session?.status,
    'injected',
    'Private DevSession must be injected',
  );
  assert.equal(
    report.session?.worktreeId,
    worktreeId,
    'Private session worktree does not match',
  );
  assert.ok(
    report.session?.expiresAtEpochMs > now,
    'Private DevSession expired',
  );
  assert.ok(
    report.sessionId.startsWith(`wk-${worktreeId}-dev-`),
    'Invalid DevSession identity',
  );
  assert.equal(report.shell?.status, 'ready', 'Native shell must be ready');
  assert.equal(report.vendor?.status, 'ready', 'Vendor must be ready');
  if (report.platform === 'ios')
    assert.equal(
      report.shell.signing,
      'verified-archive',
      'iOS shell signature was not verified',
    );
  // Use only the launcher's local listener, never a device-visible LAN URL or
  // the native inspector's default port, which may belong to another worktree.
  return `http://127.0.0.1:${report.metroPort}`;
}

function selectTargets(targets, { title, origin }) {
  const selected = targets.filter(
    (target) => target.reactNative && target.title === title,
  );
  assert.equal(
    selected.length,
    2,
    'Expected exactly two explicitly selected Hermes targets',
  );
  assert.equal(
    new Set(selected.map((target) => target.id)).size,
    2,
    'Inspector target IDs must be distinct',
  );
  const deviceIds = selected.map(
    (target) => target.reactNative.logicalDeviceId,
  );
  assert.ok(
    deviceIds.every((id) => typeof id === 'string' && id.length > 0),
    'Inspector logical device identity is missing',
  );
  assert.equal(
    new Set(deviceIds).size,
    1,
    'The two Hermes heaps must belong to the same native device',
  );
  for (const target of selected) {
    const url = new URL(target.webSocketDebuggerUrl);
    assert.equal(
      url.protocol,
      'ws:',
      'Only the local Metro WebSocket is supported',
    );
    assert.equal(
      url.host,
      new URL(origin).host,
      'Inspector target points outside this DevSession Metro',
    );
    assert.equal(
      url.pathname,
      '/inspector/debug',
      'Unexpected inspector endpoint',
    );
    assert.equal(url.username, '', 'Inspector URLs must not carry credentials');
    assert.equal(url.password, '', 'Inspector URLs must not carry credentials');
  }
  return selected;
}

async function connectInspector(
  target,
  { origin, timeoutMs = REQUEST_TIMEOUT_MS },
) {
  const socket = new WebSocket(target.webSocketDebuggerUrl, { origin });
  const pending = new Map();
  let nextId = 1;
  const failPending = (error) => {
    for (const fail of pending.values()) fail.reject(error);
    pending.clear();
  };
  socket.on('error', failPending);
  socket.on('close', () =>
    failPending(new Error('Inspector disconnected before responding')),
  );
  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      failPending(new Error('Malformed inspector response'));
      return;
    }
    pending.get(message.id)?.resolve(message);
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error('Inspector connection timed out'));
    }, timeoutMs);
    socket.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  return {
    async evaluate(expression) {
      const id = nextId;
      nextId += 1;
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Inspector evaluation timed out'));
        }, timeoutMs);
        const finish = (callback, value) => {
          clearTimeout(timeout);
          pending.delete(id);
          callback(value);
        };
        pending.set(id, {
          resolve: (value) => finish(resolve, value),
          reject: (error) => finish(reject, error),
        });
        socket.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true },
          }),
        );
      });
      assert.equal(
        response.error,
        undefined,
        'Inspector rejected the evaluation',
      );
      assert.equal(
        response.result?.exceptionDetails,
        undefined,
        'Runtime diagnostic threw',
      );
      assert.ok(
        response.result?.result &&
          Object.hasOwn(response.result.result, 'value'),
        'Inspector did not return diagnostic data',
      );
      return response.result.result.value;
    },
    close() {
      socket.close();
    },
  };
}

function runtimeIdentitySnapshot() {
  return {
    state: globalThis.__ONEKEY_MOBILE_LOCKDOWN_STATE__,
    vendorFingerprint: globalThis.__ONEKEY_DEV_VENDOR_FINGERPRINT__,
    fullBundleUrl: globalThis.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__,
  };
}

function runtimeSnapshot() {
  const state = globalThis.__ONEKEY_MOBILE_LOCKDOWN_STATE__;
  const binding = Object.getOwnPropertyDescriptor(
    globalThis,
    '__ONEKEY_MOBILE_LOCKDOWN_STATE__',
  );
  let tamperBlocked = false;
  try {
    (function attemptSameValueAssignment() {
      'use strict';
      const originalPush = Array.prototype.push;
      Array.prototype.push = originalPush;
    })();
  } catch {
    tamperBlocked = true;
  }
  return {
    state,
    stateFrozen: Object.isFrozen(state),
    binding: {
      writable: binding?.writable,
      configurable: binding?.configurable,
    },
    frozen: [
      Object.prototype,
      Array.prototype,
      Function.prototype,
      Promise.prototype,
    ].map(Object.isFrozen),
    hardenType: typeof globalThis.harden,
    tamperBlocked,
    vendorFingerprint: globalThis.__ONEKEY_DEV_VENDOR_FINGERPRINT__,
    fullBundleUrl: globalThis.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__,
  };
}

function validateRuntimeIdentity(snapshot, receipt, fingerprint) {
  const runtime = snapshot.state?.runtime;
  assert.ok(
    ['main', 'background'].includes(runtime),
    'Unknown runtime identity',
  );
  const bundleUrl = new URL(snapshot.fullBundleUrl);
  assert.equal(
    bundleUrl.origin,
    receipt.metroUrl,
    `${runtime}: wrong device-visible Metro origin`,
  );
  assert.equal(
    bundleUrl.searchParams.get('resolver.devSessionId'),
    receipt.sessionId,
    `${runtime}: stale or foreign DevSession`,
  );
  assert.equal(
    bundleUrl.searchParams.get('resolver.runtimeTarget'),
    runtime,
    `${runtime}: wrong entry runtime`,
  );
  assert.equal(
    bundleUrl.searchParams.get('platform'),
    receipt.platform,
    `${runtime}: wrong native platform`,
  );
  assert.equal(
    bundleUrl.searchParams.get('resolver.devVendorNative'),
    'true',
    `${runtime}: native vendor is missing`,
  );
  assert.equal(
    bundleUrl.searchParams.get('resolver.devVendorFingerprint'),
    fingerprint,
    `${runtime}: stale entry fingerprint`,
  );
  assert.equal(
    snapshot.vendorFingerprint,
    fingerprint,
    `${runtime}: stale vendor fingerprint`,
  );
}

function scheduleAsyncProbe(key) {
  if (Object.hasOwn(globalThis, key))
    throw new Error('Async probe already exists');
  const result = { promise: false, timer: false, nextTick: false };
  Object.defineProperty(globalThis, key, { value: result, configurable: true });
  Promise.resolve().then(() => {
    result.promise = true;
  });
  setTimeout(() => {
    result.timer = true;
  }, 10);
  process.nextTick(() => {
    result.nextTick = true;
  });
  return true;
}

function logBoxSnapshot(moduleId, tracingModuleId) {
  const metroRequire = globalThis.__r;
  if (
    ![moduleId, tracingModuleId].every(
      (id) => metroRequire?.getModules?.().get(id)?.isInitialized,
    )
  ) {
    throw new Error('LogBox must already be initialized by the application');
  }
  let snapshot;
  const subscription = metroRequire(moduleId).observe((state) => {
    snapshot = {
      disabled: state.isDisabled,
      tracing: metroRequire(tracingModuleId).default.isTracing(),
      logs: [...state.logs].map((log) => ({
        level: log.level,
        count: log.count,
        message: log.message.content,
        stack: log.stack,
      })),
    };
  });
  subscription.unsubscribe();
  return snapshot;
}

function validateRuntimeResults(results, fingerprint, receipt) {
  assert.equal(results.length, 2, 'Both native runtimes must be checked');
  assert.deepEqual(
    results.map((result) => result.snapshot?.state?.runtime).toSorted(),
    ['background', 'main'],
    'Both independent runtime identities are required',
  );
  for (const { snapshot, asyncDelivery, logBox } of results) {
    validateRuntimeIdentity(snapshot, receipt, fingerprint);
    const label = snapshot.state.runtime;
    assert.equal(
      snapshot.state.enabled,
      true,
      `${label}: lockdown is disabled`,
    );
    assert.equal(
      snapshot.state.lockdownApplied,
      true,
      `${label}: lockdown was not applied`,
    );
    assert.equal(
      snapshot.state.evalTaming,
      'unsafe-eval',
      `${label}: unexpected Hermes repair mode`,
    );
    assert.equal(
      snapshot.stateFrozen,
      true,
      `${label}: diagnostic state is mutable`,
    );
    assert.deepEqual(
      snapshot.binding,
      { configurable: false, writable: false },
      `${label}: diagnostic binding is mutable`,
    );
    assert.deepEqual(
      snapshot.frozen,
      [true, true, true, true],
      `${label}: intrinsics are mutable`,
    );
    assert.equal(
      snapshot.hardenType,
      'function',
      `${label}: harden is missing`,
    );
    assert.equal(
      snapshot.tamperBlocked,
      true,
      `${label}: prototype mutation was accepted`,
    );
    assert.deepEqual(
      asyncDelivery,
      { promise: true, timer: true, nextTick: true },
      `${label}: async delivery failed`,
    );
    assert.equal(
      logBox?.disabled,
      false,
      `${label}: LogBox observation is disabled`,
    );
    assert.ok(Array.isArray(logBox.logs), `${label}: LogBox data is missing`);
    assert.equal(
      logBox.tracing,
      false,
      `${label}: tracing suppresses LogBox errors`,
    );
    assert.deepEqual(
      logBox.logs.filter((log) =>
        ['error', 'fatal', 'syntax'].includes(log.level),
      ),
      [],
      `${label}: application LogBox errors remain`,
    );
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      report: { type: 'string' },
      device: { type: 'string' },
      'target-title': { type: 'string' },
      output: { type: 'string' },
      'isolated-profile': { type: 'boolean', default: false },
    },
  });
  assert.ok(
    values.report &&
      values.device &&
      values['target-title'] &&
      values['isolated-profile'],
    'Usage: check-mobile-lockdown-runtime.js --report <official-run-result.json> --device <device-id> --target-title <exact-inspector-title> --isolated-profile [--output <directory>]',
  );
  const reportPath = fs.realpathSync(values.report);
  const sessionRoot = fs.realpathSync(
    path.join(REPO_ROOT, 'node_modules/.cache/onekey-mobile-dev/sessions'),
  );
  assert.ok(
    reportPath.startsWith(`${sessionRoot}${path.sep}`),
    "Use this worktree's official DevSession receipt",
  );
  const receipt = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const origin = validateRunReport(receipt, { device: values.device });
  const output =
    values.output ||
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-mobile-lockdown-runtime-'));
  fs.mkdirSync(output, { recursive: true });
  const evidence = {
    status: 'running',
    sessionId: receipt.sessionId,
    platform: receipt.platform,
    device: receipt.deviceId,
    launchedAt: receipt.launchedAt,
    runtimes: [],
  };
  try {
    const config = require('../dev-vendor.config');
    config.applyTransformationEnvironment(process.env);
    const { getManifestPath, verifyManifest } = require('../plugins/devVendor');
    const mobileRoot = path.join(REPO_ROOT, 'apps/mobile');
    const manifest = JSON.parse(
      fs.readFileSync(getManifestPath(mobileRoot, receipt.platform), 'utf8'),
    );
    verifyManifest({
      manifest,
      platform: receipt.platform,
      projectRoot: mobileRoot,
    });
    evidence.vendorFingerprint = manifest.fingerprint;
    const registry = require('../bundle-registry/module-id-registry.json');
    const logBoxModuleId =
      registry.modules[
        'node_modules/react-native/Libraries/LogBox/Data/LogBoxData.js'
      ];
    const tracingModuleId =
      registry.modules[
        'node_modules/react-native/src/private/devsupport/rndevtools/TracingStateObserver.js'
      ];
    assert.ok(
      Number.isSafeInteger(logBoxModuleId) &&
        Number.isSafeInteger(tracingModuleId),
      'LogBox module is absent from the registry',
    );
    const response = await fetch(`${origin}/json/list`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(response.status, 200, 'Metro inspector discovery failed');
    const targets = selectTargets(await response.json(), {
      title: values['target-title'],
      origin,
    });
    // Allow deferred startup work to run before examining the application's
    // retained LogBox entries; an early empty snapshot is not startup acceptance.
    await new Promise((resolve) => setTimeout(resolve, STARTUP_OBSERVATION_MS));
    evidence.observedAt = new Date().toISOString();
    evidence.startupObservationMs = STARTUP_OBSERVATION_MS;
    for (const target of targets) {
      const connection = await connectInspector(target, { origin });
      const result = { targetId: target.id, title: target.title };
      evidence.runtimes.push(result);
      const probeKey = `__ONEKEY_LOCKDOWN_ASYNC_${crypto.randomBytes(8).toString('hex')}__`;
      let cleanupProbe = false;
      try {
        result.identity = await connection.evaluate(
          `(${runtimeIdentitySnapshot.toString()})()`,
        );
        // Check the live private session before tamper probes or application logs.
        validateRuntimeIdentity(result.identity, receipt, manifest.fingerprint);
        result.snapshot = await connection.evaluate(
          `(${runtimeSnapshot.toString()})()`,
        );
        validateRuntimeIdentity(result.snapshot, receipt, manifest.fingerprint);
        cleanupProbe = true;
        await connection.evaluate(
          `(${scheduleAsyncProbe.toString()})(${JSON.stringify(probeKey)})`,
        );
        const deadline = Date.now() + REQUEST_TIMEOUT_MS;
        do {
          await new Promise((resolve) => setTimeout(resolve, 100));
          result.asyncDelivery = await connection.evaluate(
            `globalThis[${JSON.stringify(probeKey)}]`,
          );
        } while (
          Date.now() < deadline &&
          !Object.values(result.asyncDelivery).every(Boolean)
        );
        result.logBox = await connection.evaluate(
          `(${logBoxSnapshot.toString()})(${logBoxModuleId}, ${tracingModuleId})`,
        );
      } finally {
        try {
          if (cleanupProbe)
            await connection.evaluate(
              `delete globalThis[${JSON.stringify(probeKey)}]`,
            );
        } finally {
          connection.close();
        }
      }
    }
    validateRuntimeResults(evidence.runtimes, manifest.fingerprint, receipt);
    evidence.status = 'passed';
    console.log(
      `[mobile-lockdown] Both Hermes runtimes passed. Evidence: ${output}`,
    );
  } catch (error) {
    evidence.status = 'failed';
    evidence.error = String(error);
    throw error;
  } finally {
    fs.writeFileSync(
      path.join(output, 'runtime-report.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  connectInspector,
  selectTargets,
  validateRunReport,
  validateRuntimeIdentity,
  validateRuntimeResults,
};
