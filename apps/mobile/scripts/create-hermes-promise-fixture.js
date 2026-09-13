#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
const assert = require('assert/strict');
const fs = require('fs');
const { createRequire } = require('module');
const path = require('path');
const { parseArgs } = require('util');

const babel = require('@babel/core');

// This fixture executes in a fresh, standalone Hermes runtime, never an app
// inspector or wallet process. Timers are deterministic; the runner drains the
// engine's real microtask queue before checking the final fixed-field result.
function createHermesPromiseFixture({ preRegistered = false } = {}) {
  const adapter = createRequire(
    require.resolve('@lavamoat/react-native-lockdown/package.json'),
  );
  const trackerFile = path.resolve(
    __dirname,
    '../../../packages/shared/src/errors/nativePromiseRejectionTracker.native.ts',
  );
  const { code } = babel.transformFileSync(trackerFile, {
    babelrc: false,
    configFile: false,
    plugins: [
      '@babel/plugin-transform-typescript',
      '@babel/plugin-transform-modules-commonjs',
    ],
  });
  return `
    globalThis.console = { warn(){}, error(){}, log(){} };
    globalThis.tasks = new Map();
    globalThis.nextTimer = 1;
    globalThis.setTimeout = (callback) => { const id = nextTimer++; tasks.set(id, callback); return id; };
    globalThis.clearTimeout = (id) => tasks.delete(id);
    globalThis.global = globalThis;
    globalThis.__DEV__ = false;
    globalThis.process = { env: {} };
    globalThis.ErrorUtils = { handler(){}, getGlobalHandler(){ return this.handler; }, setGlobalHandler(handler){ this.handler = handler; } };
    globalThis.originalPromise = Promise;
    globalThis.originalEnable = HermesInternal.enablePromiseRejectionTracker;
    ${preRegistered ? 'HermesInternal.enablePromiseRejectionTracker({ allRejections: true, onUnhandled(){}, onHandled(){} });' : ''}
    ${fs.readFileSync(adapter.resolve('ses/hermes'), 'utf8')}
    ${fs.readFileSync(adapter.resolve('@lavamoat/react-native-lockdown/repair'), 'utf8')}
    const module = { exports: {} };
    (function(module, exports, require) { ${code} })(module, module.exports, () => { throw new Error('Unexpected fixture dependency'); });
    const tracker = module.exports;
    tracker.prepareNativePromiseRejectionTracker();
    tracker.prepareNativePromiseRejectionTracker();
    hardenIntrinsics();
    const events = [];
    let deliveredValue;
    tracker.default.setErrorTracker((error) => { events.push('app'); deliveredValue = error; });
    tracker.setNativePromiseRejectionTrackingOptions({
      allRejections: true,
      onUnhandled(){ events.push('old-sdk'); }
    });
    tracker.setNativePromiseRejectionTrackingOptions({
      allRejections: true,
      onUnhandled(){ events.push('sdk-unhandled'); },
      onHandled(){ events.push('sdk-handled'); }
    });
    function flushTimers() {
      while (tasks.size) {
        const [id, callback] = tasks.entries().next().value;
        tasks.delete(id);
        callback();
      }
    }
    const rejectionValue = { kind: 'non-error-fixture' };
    const rejection = Promise.reject(rejectionValue);
    flushTimers();
    rejection.catch(() => undefined);
    const result = {
      initialTracker: '${preRegistered ? 'present' : 'absent'}',
      promiseIdentity: Promise === originalPromise,
      promiseFrozen: Object.isFrozen(Promise.prototype),
      constructorFrozen: Object.isFrozen(Promise),
      nativeAPIUnchanged: HermesInternal.enablePromiseRejectionTracker === originalEnable,
      nonErrorIdentity: deliveredValue === rejectionValue,
      events,
      asyncDelivered: false
    };
    Promise.resolve().then(() => { result.asyncDelivered = true; });
    globalThis.finishHermesPromiseFixture = () => {
      if (Object.values(result).some((value) => value === false) ||
          JSON.stringify(events) !== JSON.stringify(['sdk-unhandled', 'app', 'sdk-handled'])) {
        throw new Error('Hermes Promise compatibility fixture failed');
      }
      return result;
    };
  `;
}

if (require.main === module) {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      'pre-registered': { type: 'boolean', default: false },
    },
  });
  assert.ok(
    values.output,
    'Usage: create-hermes-promise-fixture.js --output <fixture.js>',
  );
  fs.writeFileSync(
    values.output,
    createHermesPromiseFixture({ preRegistered: values['pre-registered'] }),
    {
      mode: 0o600,
    },
  );
  console.log('[mobile-lockdown] Standalone Hermes Promise fixture generated.');
}

module.exports = { createHermesPromiseFixture };
