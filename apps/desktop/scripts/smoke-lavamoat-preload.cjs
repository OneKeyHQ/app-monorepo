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

async function smokePreload({ outputPath, productionOutput = false } = {}) {
  const requestedDirectory = outputPath
    ? path.resolve(outputPath)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-preload-smoke-'));
  fs.mkdirSync(requestedDirectory, { recursive: true });
  const directory = fs.realpathSync(requestedDirectory);
  const profileDirectory = fs.mkdtempSync(path.join(directory, 'session-'));
  const preload = path.resolve(
    __dirname,
    productionOutput
      ? '../app/dist/preload.js'
      : '../app/dist-lavamoat/preload.js',
  );
  const source = fs.readFileSync(preload, 'utf8');
  const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
  const rawSes = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
  assert.equal(
    source.split(rawSes).length,
    2,
    'exact artifact must include one untouched SES prelude',
  );
  const report = {
    directory,
    preload,
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
  };
  const bootstrap = path.join(directory, 'bootstrap.cjs');
  fs.writeFileSync(
    bootstrap,
    `const { app, BrowserWindow, ipcMain } = require('electron');
    app.setPath('userData', ${JSON.stringify(path.join(profileDirectory, 'profile'))});
    app.setPath('sessionData', ${JSON.stringify(path.join(profileDirectory, 'session'))});
    globalThis.preloadReport = { errors: [], console: [], ready: false };
    ipcMain.on('GET_PLATFORM_INFO', event => { event.returnValue = {
      arch: process.arch, platform: process.platform, systemVersion: 'fixture',
      logicalProcessorCount: 1, totalMemoryBytes: 1024, isMas: false,
      deskChannel: 'fixture', processStartAt: Date.now(), supportsShareImageFile: false
    }; });
    ipcMain.on('IS_DEV', event => { event.returnValue = false; });
    ipcMain.on('LOG_DIRECTORY', event => { event.returnValue = ${JSON.stringify(path.join(directory, 'logs'))}; });
    ipcMain.on('app/ready', () => { globalThis.preloadReport.ready = true; });
    ipcMain.handle('DESKTOP_API_CALL', (_, value) => value);
    app.whenReady().then(() => {
      const window = new BrowserWindow({ show: false, webPreferences: {
        preload: ${JSON.stringify(preload)}, sandbox: true, contextIsolation: true,
        nodeIntegration: false, webSecurity: true
      } });
      window.webContents.on('preload-error', (_, file, error) => globalThis.preloadReport.errors.push({ file, message: error.message, stack: error.stack }));
      window.webContents.on('console-message', (_, level, message) => globalThis.preloadReport.console.push({ level, message }));
      window.loadURL('data:text/html,' + encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \\'none\\'"><title>Actual protected preload</title><div data-testid="ready">Ready</div>'));
    });`,
  );
  let application;
  let failure;
  try {
    application = await electron.launch({
      executablePath: require('electron'),
      args: [bootstrap],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    });
    const page = await application.firstWindow();
    await page.getByTestId('ready').waitFor();
    const cdp = await page.context().newCDPSession(page);
    const contexts = [];
    cdp.on('Runtime.executionContextCreated', ({ context }) =>
      contexts.push(context),
    );
    await cdp.send('Runtime.enable');
    const isolated = contexts.find(
      (context) => context.name === 'Electron Isolated Context',
    );
    assert.ok(isolated, 'inspect the actual preload world, not the page world');
    const security = await cdp.send('Runtime.evaluate', {
      contextId: isolated.id,
      expression:
        'JSON.stringify({ harden: typeof harden, object: Object.isFrozen(Object.prototype), array: Object.isFrozen(Array.prototype), fn: Object.isFrozen(Function.prototype), tamper: Reflect.set(Object.prototype, "__preloadSmokeMutation", true) })',
      returnByValue: true,
    });
    report.security = JSON.parse(security.result.value);
    assert.deepEqual(report.security, {
      harden: 'function',
      object: true,
      array: true,
      fn: true,
      tamper: false,
    });
    report.bridge = await page.evaluate(async () => {
      globalThis.desktopApi.ready();
      return {
        arch: globalThis.desktopApi.arch,
        bridge: await globalThis.desktopApiBridge.call(
          'fixture',
          'echo',
          'synthetic',
        ),
        mmkv: typeof globalThis.$mmkvSync,
      };
    });
    assert.equal(report.bridge.arch, process.arch);
    assert.equal(report.bridge.mmkv, 'function');
    assert.deepEqual(report.bridge.bridge, {
      module: 'fixture',
      method: 'echo',
      params: ['synthetic'],
    });
    report.hostFixture = await application.evaluate(
      () => globalThis.preloadReport,
    );
    report.preferences = await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
    );
    assert.equal(report.preferences.sandbox, true);
    assert.equal(report.preferences.contextIsolation, true);
    assert.equal(report.preferences.nodeIntegration, false);
    assert.equal(report.preferences.webSecurity, true);
    assert.deepEqual(report.hostFixture.errors, []);
    assert.deepEqual(
      report.hostFixture.console.filter((entry) => entry.level >= 3),
      [],
    );
    assert.equal(report.hostFixture.ready, true);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = { message: error.message, stack: error.stack };
    failure = error;
  } finally {
    try {
      await application?.close();
    } catch (error) {
      report.status = 'failed';
      report.cleanupError = { message: error.message, stack: error.stack };
      failure ||= error;
    }
    fs.writeFileSync(
      path.join(directory, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  if (failure)
    throw new LavaMoatError('Protected preload smoke failed', {
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
  smokePreload({
    outputPath: values.output,
    productionOutput: values['production-output'],
  }).catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
}

module.exports = { smokePreload };
