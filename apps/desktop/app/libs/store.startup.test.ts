/* eslint-disable import/first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';

import ts from 'typescript-classic';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchStreamRequest,
  IFetchStreamResult,
} from '@onekeyhq/shared/types/fetchStream';

import { isTrustedMainWindowUrl } from './desktopApiModuleAllowlist';
import { shouldReloadAppShellAfterFailedLoad } from './rendererLoadRecovery';

let mockProfileDir = '';
let mockAppVersion = '6.7.0';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => mockProfileDir),
    getVersion: jest.fn(() => mockAppVersion),
  },
  ipcMain: { on: jest.fn() },
  safeStorage: { isEncryptionAvailable: jest.fn(() => false) },
}));
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
const mockElectronStore =
  jest.requireActual<typeof import('electron-store')>('electron-store');
jest.mock('electron-store', () => mockElectronStore);
jest.mock('../i18n', () => ({ ElectronTranslations: {} }));

type IStoreModule = typeof import('./store');
type IBundleModule = typeof import('../bundle');

const activeBundle = {
  appVersion: '6.7.0',
  bundleVersion: '2',
  signature: 'fixture-signature',
};
const preferences = {
  theme: 'dark',
  encryptedData: { fixture: 'opaque-test-ciphertext' },
  appInstanceMetaBackup: { fixture: 'instance-metadata' },
};

function writeProfile(name: string, data: unknown) {
  fs.writeFileSync(
    path.join(mockProfileDir, `${name}.json`),
    JSON.stringify(data),
  );
}

function loadStartup() {
  const store = require('./store') as IStoreModule;
  // Fail before writes if a local dependency layout bypasses the Electron mock.
  expect(store.instance.path).toBe(path.join(mockProfileDir, 'OneKey.json'));
  const { getBundleIndexHtmlPath } = require('../bundle') as IBundleModule;
  return { store, getBundleIndexHtmlPath };
}

const appSource = ts.createSourceFile(
  'app.ts',
  fs.readFileSync(path.resolve(__dirname, '../app.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);

function getProductionBootHandlerSource(
  kind:
    | 'quit-reset'
    | 'render-gone'
    | 'load-failed'
    | 'ota-rollback'
    | 'recovery-window',
) {
  let selected: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (
      kind === 'quit-reset' &&
      ts.isIfStatement(node) &&
      node.expression.getText(appSource).includes('mainRendererBootFailed') &&
      node.expression.getText(appSource).includes('getConsecutiveBootFailCount')
    ) {
      selected = node;
    }
    if (
      ts.isIfStatement(node) &&
      ((kind === 'ota-rollback' &&
        node.expression.getText(appSource).includes('activeOtaBundleVersion') &&
        node.expression.getText(appSource).includes('bootFailCount')) ||
        (kind === 'recovery-window' &&
          node.expression.getText(appSource) === 'bootFailCount >= 3'))
    ) {
      selected = node;
    }
    if (
      (kind === 'render-gone' || kind === 'load-failed') &&
      ts.isCallExpression(node) &&
      node.expression.getText(appSource).includes('webContents.on') &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text ===
        (kind === 'render-gone' ? 'render-process-gone' : 'did-fail-load') &&
      node.arguments[1] &&
      ts.isArrowFunction(node.arguments[1])
    ) {
      selected = node.arguments[1];
    }
    ts.forEachChild(node, visit);
  };
  visit(appSource);
  expect(selected).toBeDefined();
  return ts
    .transpileModule(selected?.getText(appSource) ?? '', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    })
    .outputText.trim();
}

function getProductionFetchStreamSources() {
  let predicate: ts.ArrowFunction | undefined;
  let handler: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      node.left.getText(appSource) ===
        'globalThis.$desktopMainAppFunctions.isTrustedMainWindowSender' &&
      ts.isArrowFunction(node.right)
    ) {
      predicate = node.right;
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(appSource) === 'ipcMain.handle' &&
      node.arguments[0]?.getText(appSource) === 'ipcMessageKeys.FETCH_STREAM' &&
      node.arguments[1] &&
      ts.isArrowFunction(node.arguments[1])
    ) {
      handler = node.arguments[1];
    }
    ts.forEachChild(node, visit);
  };
  visit(appSource);
  expect(predicate).toBeDefined();
  expect(handler).toBeDefined();
  const transpile = (node: ts.ArrowFunction | undefined) =>
    ts.transpileModule(node?.getText(appSource) ?? '', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
  return { predicate: transpile(predicate), handler: transpile(handler) };
}

type IRelayFrame = { url: string };
type IRelayEvent = {
  sender: { id: number; isDestroyed: () => boolean; mainFrame: IRelayFrame };
  senderFrame: IRelayFrame | undefined;
};

function createProductionFetchStreamFixture() {
  const sources = getProductionFetchStreamSources();
  let currentMainId = 1;
  const frame = { url: 'file:///opt/onekey/index.html#/home' };
  const event: IRelayEvent = {
    sender: { id: 1, isDestroyed: () => false, mainFrame: frame },
    senderFrame: frame,
  };
  const mainAppFunctions: {
    isTrustedMainWindowSender?: (
      id: number,
      senderFrame: IRelayFrame | undefined,
      mainFrame: IRelayFrame,
    ) => boolean;
  } = {};
  const response: IFetchStreamResult = { ok: true, cancelled: true };
  const fetchStreamRequest = jest.fn(
    async (_request: IFetchStreamRequest): Promise<IFetchStreamResult> =>
      response,
  );
  const context = {
    globalThis: { $desktopMainAppFunctions: mainAppFunctions },
    getSafelyMainWindow: () => ({ webContents: { id: currentMainId } }),
    getSafelyBrowserWindow: () => undefined,
    selectedShellDocumentCommitted: true,
    trustedSameDocumentRouteUrl: undefined,
    src: 'file:///opt/onekey/index.html',
    isDevServer: false,
    isTrustedMainWindowUrl,
    fetchStreamRequest,
  };
  vm.runInNewContext(
    `globalThis.$desktopMainAppFunctions.isTrustedMainWindowSender = ${sources.predicate}`,
    context,
  );
  const handler = vm.runInNewContext(
    `const handler = ${sources.handler}\nhandler`,
    context,
  ) as (
    event: IRelayEvent,
    request: IFetchStreamRequest,
  ) => Promise<IFetchStreamResult>;
  return {
    context,
    event,
    frame,
    handler,
    mainAppFunctions,
    fetchStreamRequest,
    setMainId: (id: number) => {
      currentMainId = id;
    },
  };
}

function runProductionBootThresholds(store: IStoreModule) {
  const recoveryWindow = { on: jest.fn() };
  const context = {
    store,
    bootFailCount: store.incrementConsecutiveBootFailCount(),
    activeOtaBundleVersion: store.getUpdateBundleData()?.bundleVersion,
    currentAppVersion: mockAppVersion,
    logger: { warn: jest.fn(), error: jest.fn() },
    createRecoveryWindow: jest.fn(() => recoveryWindow),
  };
  const source = [
    getProductionBootHandlerSource('ota-rollback'),
    getProductionBootHandlerSource('recovery-window'),
  ].join('\n');
  const result = vm.runInNewContext(
    `(() => { ${source}\nreturn null; })()`,
    context,
  ) as typeof recoveryWindow | null;
  return { context, result, recoveryWindow };
}

function seedUpdateState(nativeVersion = '6.7.0', buildNumber = '100') {
  writeProfile('OneKey-update-state', {
    nativeVersion,
    nativeBuildNumber: buildNumber,
    updateBundleData: activeBundle,
  });
}

function seedPendingTask(appVersion = '6.7.0', bundleVersion = '2') {
  const task = {
    status: 'pending',
    action: 'switch-bundle',
    type: 'jsbundle-switch',
    scheduledEnvAppVersion: appVersion,
    scheduledEnvBuildNumber: '100',
    scheduledEnvBundleVersion: bundleVersion,
    expiresAt: Date.now() + 60_000,
    payload: { ...activeBundle, bundleVersion: '3' },
  };
  writeProfile('mmkv-onekey-app-setting', {
    onekey_pending_install_task: JSON.stringify(task),
  });
}

describe('desktop startup with persisted state', () => {
  const originalBuildNumber = process.env.BUILD_NUMBER;
  const originalBundleVersion = process.env.BUNDLE_VERSION;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-startup-'));
    mockAppVersion = '6.7.0';
    process.env.BUILD_NUMBER = '100';
    process.env.BUNDLE_VERSION = '1';
    writeProfile('OneKey', preferences);
    for (const version of ['2', '3']) {
      const dir = path.join(
        mockProfileDir,
        'onekey-bundle',
        `6.7.0-${version}`,
        'build',
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), '<html>fixture</html>');
    }
  });

  afterEach(() => {
    fs.rmSync(mockProfileDir, { recursive: true, force: true });
    if (originalBuildNumber === undefined) delete process.env.BUILD_NUMBER;
    else process.env.BUILD_NUMBER = originalBuildNumber;
    if (originalBundleVersion === undefined) delete process.env.BUNDLE_VERSION;
    else process.env.BUNDLE_VERSION = originalBundleVersion;
  });

  it('starts a native upgrade from legacy defaults without rewriting wallet preferences', () => {
    writeProfile('OneKey', {
      ...preferences,
      nativeVersion: '6.6.1',
      nativeBuildNumber: '99',
      updateBundleData: { ...activeBundle, appVersion: '6.6.1' },
      fallbackUpdateBundleData: [{ ...activeBundle, appVersion: '6.6.1' }],
      gpuCrashCount: 8,
      consecutiveBootFailCount: 4,
    });
    seedPendingTask('6.6.1');
    const before = fs.readFileSync(path.join(mockProfileDir, 'OneKey.json'));
    const { store, getBundleIndexHtmlPath } = loadStartup();
    expect(store.processPreLaunchPendingTask()).toBe(false);
    expect(store.getUpdateBundleData()).toEqual({});
    expect(getBundleIndexHtmlPath(store.getUpdateBundleData())).toBeUndefined();
    expect(store.getFallbackUpdateBundleData()).toEqual([]);
    expect(store.getConsecutiveBootFailCount()).toBe(0);
    expect(store.getGPUCrashStats().count).toBe(0);
    store.setBootFailAppVersion(mockAppVersion);
    expect(store.incrementConsecutiveBootFailCount()).toBe(1);
    expect(fs.readFileSync(path.join(mockProfileDir, 'OneKey.json'))).toEqual(
      before,
    );
  });

  it('keeps an installed bundle across same-native-version cold restarts', () => {
    seedUpdateState();
    const { store, getBundleIndexHtmlPath } = loadStartup();
    expect(getBundleIndexHtmlPath(store.getUpdateBundleData())).toBe(
      path.join(
        mockProfileDir,
        'onekey-bundle',
        '6.7.0-2',
        'build',
        'index.html',
      ),
    );
    expect(store.getUpdateBundleData()).toEqual(activeBundle);
  });

  it('resets a quick graceful quit before a healthy OTA reaches its five-second marker', () => {
    seedUpdateState();
    const { store } = loadStartup();
    store.setConsecutiveBootFailCount(1);

    vm.runInNewContext(getProductionBootHandlerSource('quit-reset'), {
      store,
      mainRendererBootFailed: false,
    });

    expect(store.getConsecutiveBootFailCount()).toBe(0);
    expect(store.incrementConsecutiveBootFailCount()).toBe(1);
    expect(store.getUpdateBundleData()).toEqual(activeBundle);
  });

  it('preserves real boot failures and an open recovery window on quit', () => {
    const { store } = loadStartup();
    const quitReset = getProductionBootHandlerSource('quit-reset');
    store.setConsecutiveBootFailCount(1);
    vm.runInNewContext(quitReset, {
      store,
      mainRendererBootFailed: true,
    });
    expect(store.incrementConsecutiveBootFailCount()).toBe(2);

    store.setConsecutiveBootFailCount(3);
    vm.runInNewContext(quitReset, {
      store,
      mainRendererBootFailed: false,
    });
    expect(store.getConsecutiveBootFailCount()).toBe(3);
  });

  it('keeps the active OTA after its second unsuccessful boot', () => {
    seedUpdateState();
    const { store } = loadStartup();
    store.setConsecutiveBootFailCount(1);

    const { context, result } = runProductionBootThresholds(store);

    expect(context.bootFailCount).toBe(2);
    expect(store.getConsecutiveBootFailCount()).toBe(2);
    expect(store.getUpdateBundleData()).toEqual(activeBundle);
    expect(result).toBeNull();
    expect(context.createRecoveryWindow).not.toHaveBeenCalled();
  });

  it('rolls back an OTA on its third unsuccessful boot and revokes only its pending switch', () => {
    seedUpdateState();
    seedPendingTask();
    const pendingPath = path.join(
      mockProfileDir,
      'mmkv-onekey-app-setting.json',
    );
    const profile = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as {
      onekey_pending_install_task: string;
    };
    const task = JSON.parse(profile.onekey_pending_install_task) as {
      targetAppVersion: string;
      targetBundleVersion: string;
      payload: { bundleVersion: string };
    };
    task.targetAppVersion = activeBundle.appVersion;
    task.targetBundleVersion = activeBundle.bundleVersion;
    task.payload.bundleVersion = activeBundle.bundleVersion;
    writeProfile('mmkv-onekey-app-setting', {
      onekey_pending_install_task: JSON.stringify(task),
    });
    const { store } = loadStartup();
    store.setConsecutiveBootFailCount(2);

    const { context, result } = runProductionBootThresholds(store);

    expect(context.bootFailCount).toBe(1);
    expect(store.getConsecutiveBootFailCount()).toBe(1);
    expect(store.getUpdateBundleData()).toEqual({});
    expect(result).toBeNull();
    expect(context.createRecoveryWindow).not.toHaveBeenCalled();
    const after = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(after.onekey_pending_install_task).toBeUndefined();
    expect(JSON.parse(after.onekey_failed_ota_bundle as string)).toEqual({
      appVersion: activeBundle.appVersion,
      bundleVersion: activeBundle.bundleVersion,
    });
    expect(store.processPreLaunchPendingTask()).toBe(false);
  });

  it('keeps a different pending target when the active OTA rolls back', () => {
    seedUpdateState();
    seedPendingTask();
    const pendingPath = path.join(
      mockProfileDir,
      'mmkv-onekey-app-setting.json',
    );
    const profile = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as {
      onekey_pending_install_task: string;
    };
    const task = JSON.parse(profile.onekey_pending_install_task) as {
      targetAppVersion: string;
      targetBundleVersion: string;
    };
    task.targetAppVersion = activeBundle.appVersion;
    task.targetBundleVersion = '3';
    writeProfile('mmkv-onekey-app-setting', {
      onekey_pending_install_task: JSON.stringify(task),
    });
    const before = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as Record<
      string,
      unknown
    >;
    const { store } = loadStartup();
    store.setConsecutiveBootFailCount(2);

    const { context, result } = runProductionBootThresholds(store);

    expect(context.bootFailCount).toBe(1);
    expect(store.getUpdateBundleData()).toEqual({});
    expect(result).toBeNull();
    const after = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(after.onekey_pending_install_task).toBe(
      before.onekey_pending_install_task,
    );
    expect(JSON.parse(after.onekey_failed_ota_bundle as string)).toEqual({
      appVersion: activeBundle.appVersion,
      bundleVersion: activeBundle.bundleVersion,
    });
  });

  it('opens recovery on the third failed boot without an active OTA', () => {
    const { store } = loadStartup();
    store.setConsecutiveBootFailCount(2);

    const { context, result, recoveryWindow } =
      runProductionBootThresholds(store);

    expect(context.bootFailCount).toBe(3);
    expect(store.getConsecutiveBootFailCount()).toBe(3);
    expect(result).toBe(recoveryWindow);
    expect(context.createRecoveryWindow).toHaveBeenCalledTimes(1);
  });

  it('counts a main renderer crash but ignores a clean exit and app shutdown', () => {
    const callbackSource = getProductionBootHandlerSource('render-gone');
    const run = (reason: string, appQuitStarted = false) => {
      const context = {
        appQuitStarted,
        bleQuitStarted: false,
        softRestarting: false,
        mainRendererBootFailed: false,
        mainRendererReloadTimestamps: [] as number[],
        MAIN_RENDERER_RELOAD_WINDOW_MS: 5 * 60_000,
        MAIN_RENDERER_MAX_RELOADS_IN_WINDOW: 3,
        logger: { warn: jest.fn(), error: jest.fn() },
        setImmediate: jest.fn(),
      };
      const callback = vm.runInNewContext(
        `const callback = ${callbackSource}\ncallback`,
        context,
      ) as (
        _event: unknown,
        details: { reason: string; exitCode: number },
      ) => void;
      callback(undefined, { reason, exitCode: 0 });
      return context.mainRendererBootFailed;
    };

    expect(run('crashed')).toBe(true);
    expect(run('clean-exit')).toBe(false);
    expect(run('crashed', true)).toBe(false);
  });

  it('counts a failed selected shell load but not a cancelled or routed reload', () => {
    const callbackSource = getProductionBootHandlerSource('load-failed');
    const shellUrl = 'file:///index.html';
    const run = (url: string, errorCode: number, isMainFrame = true) => {
      const context = {
        appQuitStarted: false,
        mainRendererBootFailed: false,
        src: shellUrl,
        isTrustedMainWindowUrl,
        shouldReloadAppShellAfterFailedLoad,
        logger: { info: jest.fn() },
        getSafelyBrowserWindow: () => ({ loadURL: jest.fn() }),
      };
      const callback = vm.runInNewContext(
        `const callback = ${callbackSource}\ncallback`,
        context,
      ) as (
        event: unknown,
        errorCode: number,
        description: string,
        validatedURL: string,
        isMainFrame: boolean,
      ) => void;
      callback(undefined, errorCode, '', url, isMainFrame);
      return context.mainRendererBootFailed;
    };

    expect(run(shellUrl, -6)).toBe(true);
    expect(run(shellUrl, -3)).toBe(false);
    expect(run('file:///market/stock/JNJ', -6)).toBe(false);
    expect(run(shellUrl, -6, false)).toBe(false);
  });

  it.each(['native-version', 'native-build'])(
    'invalidates active bundles after a %s change',
    (change) => {
      seedUpdateState();
      if (change === 'native-version') mockAppVersion = '6.8.0';
      else process.env.BUILD_NUMBER = '101';
      const { store, getBundleIndexHtmlPath } = loadStartup();
      expect(
        getBundleIndexHtmlPath(store.getUpdateBundleData()),
      ).toBeUndefined();
      expect(store.getUpdateBundleData()).toEqual({});
    },
  );

  it('applies pending switches before resolving the first renderer path', () => {
    seedUpdateState();
    seedPendingTask();
    const { store, getBundleIndexHtmlPath } = loadStartup();
    expect(store.processPreLaunchPendingTask()).toBe(true);
    expect(getBundleIndexHtmlPath(store.getUpdateBundleData())).toBe(
      path.join(
        mockProfileDir,
        'onekey-bundle',
        '6.7.0-3',
        'build',
        'index.html',
      ),
    );
    expect(store.getNativeVersion()).toBe('6.7.0');
    expect(store.getNativeBuildNumber()).toBe('100');
  });

  it('revokes a pending switch for the failed OTA before clearing its boot pointer', () => {
    seedUpdateState();
    seedPendingTask();
    const pendingPath = path.join(
      mockProfileDir,
      'mmkv-onekey-app-setting.json',
    );
    const profile = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as {
      onekey_pending_install_task: string;
    };
    const task = JSON.parse(profile.onekey_pending_install_task) as {
      targetAppVersion: string;
      targetBundleVersion: string;
      payload: { bundleVersion: string };
    };
    task.targetAppVersion = activeBundle.appVersion;
    task.targetBundleVersion = activeBundle.bundleVersion;
    task.payload.bundleVersion = activeBundle.bundleVersion;
    writeProfile('mmkv-onekey-app-setting', {
      onekey_pending_install_task: JSON.stringify(task),
    });

    const { store } = loadStartup();
    expect(
      store.revokePendingSwitchForFailedBundle(
        activeBundle.appVersion,
        activeBundle.bundleVersion,
      ),
    ).toBe(true);
    store.clearUpdateBundleData();
    expect(store.processPreLaunchPendingTask()).toBe(false);
    expect(store.getUpdateBundleData()).toEqual({});
    const after = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(after.onekey_pending_install_task).toBeUndefined();
  });

  it('leaves a different pending target untouched during failed-bundle rollback', () => {
    seedUpdateState();
    seedPendingTask();
    const { store } = loadStartup();
    expect(
      store.revokePendingSwitchForFailedBundle(
        activeBundle.appVersion,
        activeBundle.bundleVersion,
      ),
    ).toBe(false);
    expect(store.processPreLaunchPendingTask()).toBe(true);
  });

  it.each(['native-version', 'native-build'])(
    'rejects stale pending switches after a %s change',
    (change) => {
      seedUpdateState();
      seedPendingTask();
      if (change === 'native-version') mockAppVersion = '6.8.0';
      else process.env.BUILD_NUMBER = '101';
      const { store } = loadStartup();
      expect(store.processPreLaunchPendingTask()).toBe(false);
      expect(store.getUpdateBundleData()).toEqual(activeBundle);
    },
  );

  it('rejects and clears pending switch when payload.appVersion mismatches currentAppVersion', () => {
    seedUpdateState();
    const task = {
      status: 'pending',
      action: 'switch-bundle',
      type: 'jsbundle-switch',
      scheduledEnvAppVersion: '6.7.0',
      scheduledEnvBuildNumber: '100',
      scheduledEnvBundleVersion: '2',
      expiresAt: Date.now() + 60_000,
      payload: { ...activeBundle, appVersion: '6.6.0', bundleVersion: '3' },
    };
    writeProfile('mmkv-onekey-app-setting', {
      onekey_pending_install_task: JSON.stringify(task),
    });
    const { store } = loadStartup();
    expect(store.processPreLaunchPendingTask()).toBe(false);
    expect(store.getUpdateBundleData()).toEqual(activeBundle);
    const mmkvAfter = JSON.parse(
      fs.readFileSync(
        path.join(mockProfileDir, 'mmkv-onekey-app-setting.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(mmkvAfter.onekey_pending_install_task).toBeUndefined();
  });

  it('documents the unsupported same-native replacement with legacy-only bundle state', () => {
    writeProfile('OneKey', {
      ...preferences,
      nativeVersion: '6.7.0',
      nativeBuildNumber: '100',
      updateBundleData: activeBundle,
    });
    seedPendingTask();
    const { store, getBundleIndexHtmlPath } = loadStartup();
    expect(store.processPreLaunchPendingTask()).toBe(false);
    expect(getBundleIndexHtmlPath(store.getUpdateBundleData())).toBeUndefined();
  });

  it.each(['OneKey-update-state', 'OneKey-runtime-state'])(
    'recovers malformed %s JSON and persists fresh state across restart',
    (name) => {
      fs.writeFileSync(
        path.join(mockProfileDir, `${name}.json`),
        '{incomplete',
      );
      const before = fs.readFileSync(path.join(mockProfileDir, 'OneKey.json'));
      const { store } = loadStartup();
      expect(store.getUpdateBundleData()).toEqual({});
      expect(store.getConsecutiveBootFailCount()).toBe(0);
      store.setNativeVersion('6.7.0');
      store.setUpdateBundleData(activeBundle);
      expect(store.incrementConsecutiveBootFailCount()).toBe(1);
      expect(store.getGPUCrashStats().count).toBe(0);
      jest.resetModules();
      const restarted = require('./store') as IStoreModule;
      expect(restarted.getUpdateBundleData()).toEqual(activeBundle);
      expect(restarted.getConsecutiveBootFailCount()).toBe(1);
      expect(fs.readFileSync(path.join(mockProfileDir, 'OneKey.json'))).toEqual(
        before,
      );
    },
  );

  it('keeps invalid wallet preferences intact and surfaces their parsing error', () => {
    const file = path.join(mockProfileDir, 'OneKey.json');
    fs.writeFileSync(file, '{invalid-wallet-preferences');
    expect(() => {
      require('./store');
    }).toThrow(SyntaxError);
    expect(fs.readFileSync(file, 'utf8')).toBe('{invalid-wallet-preferences');
  });
});

describe('desktop FETCH_STREAM sender trust boundary', () => {
  it.each(['open', 'read', 'cancel'] as const)(
    'forwards a committed main-frame %s request and preserves its result',
    async (action) => {
      const fixture = createProductionFetchStreamFixture();
      if (action === 'read') {
        fixture.context.src = 'file:///opt/onekey/ota/index.html';
        fixture.frame.url = `${fixture.context.src}#/home`;
      }
      const request: IFetchStreamRequest =
        action === 'open'
          ? { action, url: 'https://fixture.example/stream', headers: [] }
          : { action, id: 'fixture-stream' };
      let response: IFetchStreamResult = { ok: true, cancelled: true };
      if (action === 'open') {
        response = {
          ok: true,
          response: {
            id: 'fixture-stream',
            status: 200,
            statusText: 'OK',
            headers: [],
          },
        };
      } else if (action === 'read') {
        response = { ok: true, chunk: { done: true, b64: '' } };
      }
      fixture.fetchStreamRequest.mockResolvedValue(response);

      await expect(fixture.handler(fixture.event, request)).resolves.toBe(
        response,
      );
      expect(fixture.fetchStreamRequest).toHaveBeenCalledTimes(1);
      expect(fixture.fetchStreamRequest).toHaveBeenCalledWith(request);
    },
  );

  it.each([
    'same-ID child frame',
    'guest or foreign sender',
    'wrong document URL',
    'uncommitted shell',
    'destroyed sender',
    'senderFrame getter throws',
    'mainFrame getter throws',
    'missing trust predicate',
  ])('rejects %s without forwarding a request', async (scenario) => {
    const fixture = createProductionFetchStreamFixture();
    switch (scenario) {
      case 'same-ID child frame':
        fixture.event.senderFrame = { url: fixture.frame.url };
        break;
      case 'guest or foreign sender':
        fixture.event.sender.id = 2;
        break;
      case 'wrong document URL':
        fixture.frame.url = 'file:///opt/other/index.html';
        break;
      case 'uncommitted shell':
        fixture.context.selectedShellDocumentCommitted = false;
        break;
      case 'destroyed sender':
        fixture.event.sender.isDestroyed = () => true;
        break;
      case 'senderFrame getter throws':
        Object.defineProperty(fixture.event, 'senderFrame', {
          get() {
            throw new OneKeyLocalError('frame destroyed');
          },
        });
        break;
      case 'mainFrame getter throws':
        Object.defineProperty(fixture.event.sender, 'mainFrame', {
          get() {
            throw new OneKeyLocalError('contents destroyed');
          },
        });
        break;
      case 'missing trust predicate':
        delete fixture.mainAppFunctions.isTrustedMainWindowSender;
        break;
      default:
        throw new OneKeyLocalError(`Unexpected scenario: ${scenario}`);
    }

    await expect(
      fixture.handler(fixture.event, {
        action: 'cancel',
        id: 'fixture-stream',
      }),
    ).resolves.toEqual({ ok: false, error: 'not allowed' });
    expect(fixture.fetchStreamRequest).not.toHaveBeenCalled();
  });

  it('uses the live main window after its ID changes', async () => {
    const fixture = createProductionFetchStreamFixture();
    const request: IFetchStreamRequest = {
      action: 'read',
      id: 'fixture-stream',
    };
    fixture.setMainId(2);
    await expect(fixture.handler(fixture.event, request)).resolves.toEqual({
      ok: false,
      error: 'not allowed',
    });
    expect(fixture.fetchStreamRequest).not.toHaveBeenCalled();

    const frame = { url: fixture.frame.url };
    const event: IRelayEvent = {
      sender: { id: 2, isDestroyed: () => false, mainFrame: frame },
      senderFrame: frame,
    };
    await expect(fixture.handler(event, request)).resolves.toEqual({
      ok: true,
      cancelled: true,
    });
    expect(fixture.fetchStreamRequest).toHaveBeenCalledTimes(1);
    expect(fixture.fetchStreamRequest).toHaveBeenCalledWith(request);
  });
});
