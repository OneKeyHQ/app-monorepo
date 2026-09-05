const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ts = require('typescript');

// Worker exit runs Node environment cleanup, unlike main-process process.exit().
// Keep the native binding real: this catches the macOS ThreadSafeFunction deadlock.
const describeMac = process.platform === 'darwin' ? describe : describe.skip;

describeMac('Noble SDK process cleanup', () => {
  test('bundle restart waits for BLE cleanup through Electron before-quit', () => {
    const parse = (relativePath) => {
      const file = path.resolve(__dirname, relativePath);
      return ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
    };
    const appSource = parse('../app/app.ts');
    const beforeQuit = appSource.statements.find(
      (node) =>
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        node.expression.expression.getText(appSource) === 'app.on' &&
        node.expression.arguments[0]?.text === 'before-quit',
    );
    const updateSource = parse(
      '../../../packages/kit-bg/src/desktopApis/DesktopApiBundleUpdate.ts',
    );
    const updateClass = updateSource.statements.find(
      (node) =>
        ts.isClassDeclaration(node) &&
        node.name?.text === 'DesktopApiAppBundleUpdate',
    );
    const restart = updateClass.members.find(
      (node) =>
        node.name?.getText(updateSource) === 'restartAppForBundleUpdate',
    );
    // Run the production restart method and quit handler in a real Electron process.
    // Stub relaunch to avoid spawning another app, and delay BLE disposal to test ordering.
    const production = ts.transpileModule(
      `${beforeQuit.getText(appSource)}\nclass BundleUpdate { ${restart.getText(updateSource)} }`,
      {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      },
    ).outputText;
    const source = `
      const { app } = require('electron');
      const events = [];
      const isMac = true, logger = { info() {}, warn() {}, error() {} };
      let bleQuitStarted = false, bleQuitReady = false;
      const nobleBleInitialization = Promise.resolve(), trezorBleSupports = new Set();
      const store = { getUpdateBundleData() {}, getConsecutiveBootFailCount: () => 0, resetConsecutiveBootFailCount() {} };
      const getSafelyMainWindow = () => null, destroyTrayManager = () => {};
      let systemIdleInterval, disposeContextMenu;
      const disposeNobleBleSupport = (release) => new Promise(resolve => {
        events.push('dispose-start');
        setTimeout(() => {
          release({ stop: () => events.push('native-stop') });
          events.push('dispose-done');
          resolve();
        }, 30);
      });
      app.relaunch = () => events.push('relaunch');
      app.on('before-quit', () => events.push('before-quit'));
      app.on('will-quit', () => console.log('QUIT-EVENTS:' + JSON.stringify([...events, 'will-quit'])));
      ${production}
      app.whenReady().then(async () => {
        app.dock?.hide();
        const update = new BundleUpdate();
        update.getMainWindow = () => ({ destroy: () => events.push('renderer-destroy') });
        await update.restartAppForBundleUpdate();
      }).catch(error => { console.error(error); app.exit(1); });
    `;
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-ble-restart-'),
    );
    try {
      const script = path.join(directory, 'restart.cjs');
      fs.writeFileSync(script, source);
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const result = spawnSync(require('electron'), [script], {
        encoding: 'utf8',
        env,
        timeout: 8000,
        killSignal: 'SIGKILL',
      });
      expect({
        error: result.error?.message,
        status: result.status,
        stderr: result.status === 0 ? '' : result.stderr,
      }).toEqual({ error: undefined, status: 0, stderr: '' });
      expect(result.stdout).toContain(
        `QUIT-EVENTS:${JSON.stringify([
          'renderer-destroy',
          'relaunch',
          'before-quit',
          'dispose-start',
          'dispose-done',
          'native-stop',
          'before-quit',
          'will-quit',
        ])}`,
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }, 10_000);

  test.each([
    'unused',
    'initialized',
    'scanning',
    'shared-instance',
    'multiple-instances',
    'soft-restart',
  ])(
    'releases native before Node teardown: %s',
    (scenario) => {
      const workerData = {
        scenario,
        noblePath: require.resolve('@stoprocent/noble'),
        oneKeyPath: require.resolve('@onekeyfe/hd-transport-electron'),
        trezorPath:
          require.resolve('@onekeyfe/hwk-trezor-connector-electron-ble/main'),
        sharedPath: require.resolve('@onekeyfe/hd-shared'),
      };
      const workerSource = `
        const { parentPort, workerData } = require('worker_threads');
        const { EventEmitter } = require('events');
        const Module = require('module');
        const handlers = new Map();
        const ipcMain = {
          handle: (channel, listener) => handlers.set(channel, listener),
          removeHandler: channel => handlers.delete(channel),
        };
        const originalLoad = Module._load;
        Module._load = function(id, ...args) {
          if (id === 'electron') return { ipcMain };
          if (id === 'electron-log') return { info() {}, debug() {}, warn() {}, error() {} };
          return originalLoad.call(this, id, ...args);
        };
        (async () => {
          const oneKey = require(workerData.oneKeyPath);
          const trezor = require(workerData.trezorPath);
          const { EOneKeyBleMessageKeys } = require(workerData.sharedPath);
          const window = new EventEmitter();
          window.send = () => {};
          await oneKey.initNobleBleSupport(window);
          const supports = [trezor.initTrezorBleSupport(window, { ipcMain })];
          const operations = [];
          if (workerData.scenario !== 'unused') {
            const channel = workerData.scenario === 'scanning'
              ? EOneKeyBleMessageKeys.NOBLE_BLE_ENUMERATE
              : EOneKeyBleMessageKeys.BLE_AVAILABILITY_CHECK;
            operations.push(handlers.get(channel)({}));
            await new Promise(resolve => setImmediate(resolve));
          }
          if (workerData.scenario === 'shared-instance') {
            await supports[0].handler.checkAvailability();
          }
          if (workerData.scenario === 'multiple-instances') {
            const second = require(workerData.noblePath).withBindings('mac');
            const handler = new trezor.NobleBleHandler({ nobleFactory: () => second });
            await handler.checkAvailability();
            supports.push(handler);
          }
          if (workerData.scenario === 'soft-restart') {
            await supports[0].handler.checkAvailability();
            window.emit('destroyed');
            await supports[0].dispose();
            await oneKey.initNobleBleSupport(window);
            supports.push(trezor.initTrezorBleSupport(window, { ipcMain }));
            await supports[1].handler.checkAvailability();
          }
          const instances = new Set();
          await Promise.all([
            oneKey.disposeNobleBleSupport(instance => instances.add(instance)),
            ...supports.map(support => support.disposeForAppQuit(instance => instances.add(instance))),
          ]);
          await Promise.allSettled(operations);
          const expected = workerData.scenario === 'unused' ? 0
            : workerData.scenario === 'multiple-instances' ? 2 : 1;
          if (instances.size !== expected) throw new Error('Native ownership mismatch: ' + instances.size);
          for (const instance of instances) instance.stop();
          parentPort.postMessage('native-stopped');
          process.exit(0);
        })().catch(error => { console.error(error); process.exit(1); });
      `;
      const parentSource = `
        const { Worker } = require('worker_threads');
        const worker = new Worker(${JSON.stringify(workerSource)}, {
          eval: true, workerData: ${JSON.stringify(workerData)},
        });
        let stopped = false;
        worker.on('message', () => { stopped = true; });
        worker.on('exit', code => {
          if (!stopped || code !== 0) process.exit(1);
          console.log('native-cleanup-complete');
        });
      `;
      const result = spawnSync(require('electron'), ['-e', parentSource], {
        encoding: 'utf8',
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        timeout: 8000,
        killSignal: 'SIGKILL',
      });
      expect({
        error: result.error?.message,
        signal: result.signal,
        status: result.status,
        stderr: result.status === 0 ? '' : result.stderr,
      }).toEqual({ error: undefined, signal: null, status: 0, stderr: '' });
      expect(result.stdout).toContain('native-cleanup-complete');
    },
    10_000,
  );
});
