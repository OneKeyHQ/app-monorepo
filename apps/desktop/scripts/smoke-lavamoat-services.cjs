// cspell:ignore LavaMoat lavamoat

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');

const { _electron: electron } = require('playwright-core');

const { LavaMoatError } = require('../../../development/lavamoat/error.cjs');

async function withTimeout(operation, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new LavaMoatError(`Timed out: ${label}`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function evaluateService(application, expression, argument) {
  return withTimeout(
    application.evaluate(expression, argument),
    5000,
    'Electron main evaluation',
  );
}

async function waitForService(application, kind, deadline, entry) {
  let state;
  do {
    state = await evaluateService(application, () => globalThis.serviceSmoke);
    assert.deepEqual(state.errors, [], JSON.stringify(state));
    assert.ok(
      !state.messages.some((message) => message.kind === 'smoke-error'),
      JSON.stringify(state),
    );
    assert.ok(
      Date.now() < deadline,
      `${entry}: missing ${kind}: ${JSON.stringify(state)}`,
    );
    if (!state.messages.some((message) => message.kind === kind))
      await new Promise((resolve) => setTimeout(resolve, 50));
  } while (!state.messages.some((message) => message.kind === kind));
  return state;
}

async function smokeServices({ outputPath, productionOutput = false } = {}) {
  const directory = outputPath
    ? path.resolve(outputPath)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-service-smoke-'));
  fs.mkdirSync(directory, { recursive: true });
  const artifactDirectory = path.resolve(
    __dirname,
    productionOutput ? '../app/dist/service' : '../app/dist-lavamoat/service',
  );
  const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
  const rawSes = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
  const report = {
    directory,
    cases: [],
    nativeBoundary:
      'Explicit synthetic native capability fixture; no biometric or authentication request reaches the OS.',
  };
  let application;
  let failure;
  const overallDeadline = Date.now() + 60_000;
  const watchdog = setTimeout(() => {
    failure ||= new LavaMoatError(
      'Service smoke exceeded its overall deadline',
    );
    application?.process().kill('SIGKILL');
  }, 60_000);
  try {
    for (const entry of [
      'enum',
      'index',
      'windowsHello',
      'checkBiometricAuthChanged',
    ]) {
      const artifact = path.join(artifactDirectory, `${entry}.js`);
      const source = fs.readFileSync(artifact, 'utf8');
      assert.equal(
        source.split(rawSes).length,
        2,
        `${entry}: one untouched SES runtime`,
      );
      const result = {
        entry,
        artifact,
        sha256: crypto.createHash('sha256').update(source).digest('hex'),
      };
      report.cases.push(result);
      const caseDirectory = fs.mkdtempSync(path.join(directory, `${entry}-`));
      const childBootstrap = path.join(caseDirectory, 'child.cjs');
      const isUtility = ['windowsHello', 'checkBiometricAuthChanged'].includes(
        entry,
      );
      fs.writeFileSync(
        childBootstrap,
        `
        const Module = require('node:module');
        const originalLoad = Module._load;
        const nativeCalls = [];
        Module._load = function(request, ...rest) {
          if (request === 'passport-desktop/native') return {
            Passport: { available() { nativeCalls.push('availability'); return false; },
              requestVerification() { throw new Error('Authentication is forbidden in this smoke'); } },
            VerificationResult: { Verified: 0, Canceled: 1 }, KeyCreationOption: {}, PublicKeyEncoding: {}
          };
          if (request === 'electron-check-biometric-auth-changed/auth-arm64.node' || request === 'electron-check-biometric-auth-changed/auth-x64.node') return {
            checkBiometricAuthChanged() { nativeCalls.push('biometric-fixture'); return false; }
          };
          return Reflect.apply(originalLoad, this, [request, ...rest]);
        };
        process.on('uncaughtExceptionMonitor', error => process.parentPort.postMessage({ kind: 'smoke-error', message: error.message, stack: error.stack }));
        process.on('unhandledRejection', error => process.parentPort.postMessage({ kind: 'smoke-error', message: String(error), stack: error?.stack }));
        require(${JSON.stringify(artifact)});
        process.parentPort.on('message', event => {
          if (event.data.type === 'smoke-observe') process.parentPort.postMessage({ kind: 'smoke-native', nativeCalls });
        });
        process.parentPort.postMessage({ kind: 'smoke-ready', security: {
          harden: typeof harden, object: Object.isFrozen(Object.prototype), array: Object.isFrozen(Array.prototype),
          fn: Object.isFrozen(Function.prototype), tamper: Reflect.set(Object.prototype, '__serviceSmokeMutation', true)
        }});
      `,
      );
      const bootstrap = path.join(caseDirectory, 'bootstrap.cjs');
      fs.writeFileSync(
        bootstrap,
        `
        const { app, utilityProcess } = require('electron');
        app.setPath('userData', ${JSON.stringify(path.join(caseDirectory, 'profile'))});
        app.setPath('sessionData', ${JSON.stringify(path.join(caseDirectory, 'session'))});
        globalThis.serviceSmoke = { messages: [], errors: [], stdout: '', stderr: '' };
        process.on('uncaughtExceptionMonitor', error => globalThis.serviceSmoke.errors.push({ message: error.message, stack: error.stack }));
        process.on('unhandledRejection', error => globalThis.serviceSmoke.errors.push({ kind: 'unhandled-rejection', message: String(error), stack: error?.stack }));
        app.whenReady().then(async () => {
          if (${isUtility}) {
            const child = utilityProcess.fork(${JSON.stringify(childBootstrap)}, [], { stdio: 'pipe' });
            globalThis.serviceSmokeChild = child;
            child.on('message', message => globalThis.serviceSmoke.messages.push(message));
            child.on('exit', code => { if (!globalThis.serviceSmoke.stopping) globalThis.serviceSmoke.errors.push({ exit: code }); });
            child.stdout.on('data', data => { globalThis.serviceSmoke.stdout += data; });
            child.stderr.on('data', data => { globalThis.serviceSmoke.stderr += data; });
          } else {
            const exports = require(${JSON.stringify(artifact)});
            globalThis.serviceSmoke.exports = ${JSON.stringify(entry)} === 'enum'
              ? exports.EWindowHelloEventType.CheckAvailabilityAsync
              : await exports.checkAvailabilityAsync();
            globalThis.serviceSmoke.messages.push({ kind: 'smoke-ready', security: {
              harden: typeof harden, object: Object.isFrozen(Object.prototype), array: Object.isFrozen(Array.prototype),
              fn: Object.isFrozen(Function.prototype), tamper: Reflect.set(Object.prototype, '__serviceSmokeMutation', true)
            }});
          }
        });
      `,
      );
      application = await electron.launch({
        executablePath: require('electron'),
        args: [bootstrap],
        timeout: 15_000,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: undefined,
          ELECTRON_IS_DEV: '0',
        },
      });
      const deadline = Math.min(overallDeadline, Date.now() + 15_000);
      let state = await waitForService(
        application,
        'smoke-ready',
        deadline,
        entry,
      );
      assert.deepEqual(
        state.messages.find((message) => message.kind === 'smoke-ready')
          .security,
        {
          harden: 'function',
          object: true,
          array: true,
          fn: true,
          tamper: false,
        },
      );
      if (isUtility) {
        const type =
          entry === 'windowsHello'
            ? 'checkAvailabilityAsync'
            : 'checkBiometricAuthChanged';
        await evaluateService(
          application,
          (_, requestType) =>
            globalThis.serviceSmokeChild.postMessage({ type: requestType }),
          type,
        );
        // The original service handles the message and emits its real response.
        while (!state.messages.some((message) => message.type === type)) {
          assert.ok(Date.now() < deadline, `${entry}: no service response`);
          await new Promise((resolve) => setTimeout(resolve, 50));
          state = await evaluateService(
            application,
            () => globalThis.serviceSmoke,
          );
          assert.deepEqual(state.errors, []);
        }
        assert.equal(
          state.messages.find((message) => message.type === type).result,
          false,
        );
        await evaluateService(application, () =>
          globalThis.serviceSmokeChild.postMessage({ type: 'smoke-observe' }),
        );
        state = await waitForService(
          application,
          'smoke-native',
          deadline,
          entry,
        );
        let expectedCalls = [];
        if (entry === 'windowsHello') expectedCalls = ['availability'];
        else if (process.platform === 'darwin')
          expectedCalls = ['biometric-fixture'];
        assert.deepEqual(
          state.messages.find((message) => message.kind === 'smoke-native')
            .nativeCalls,
          expectedCalls,
        );
      } else {
        assert.equal(
          state.exports,
          entry === 'enum' ? 'checkAvailabilityAsync' : false,
        );
      }
      result.hostFixture = state;
      assert.ok(
        !state.messages.some((message) => message.kind === 'smoke-error'),
        JSON.stringify(state),
      );
      await evaluateService(application, () => {
        globalThis.serviceSmoke.stopping = true;
        globalThis.serviceSmokeChild?.kill();
      });
      await withTimeout(application.close(), 10_000, 'Electron cleanup');
      application = undefined;
    }
    if (failure)
      throw new LavaMoatError('Service smoke deadline expired', {
        cause: failure,
      });
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = { message: error.message, stack: error.stack };
    failure = error;
  } finally {
    try {
      if (application)
        await withTimeout(application.close(), 10_000, 'Electron cleanup');
    } catch (error) {
      failure ||= error;
      report.status = 'failed';
      report.cleanupError = { message: error.message, stack: error.stack };
      application?.process().kill('SIGKILL');
    }
    clearTimeout(watchdog);
    fs.writeFileSync(
      path.join(directory, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  if (failure)
    throw new LavaMoatError('Protected service smoke failed', {
      cause: failure,
    });
}

if (require.main === module) {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      'production-output': { type: 'boolean' },
    },
    strict: true,
  });
  smokeServices({
    outputPath: values.output,
    productionOutput: values['production-output'],
  }).catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}

module.exports = { smokeServices, withTimeout };
