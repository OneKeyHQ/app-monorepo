/* eslint-disable import/first */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchStreamRequest,
  IFetchStreamResult,
} from '@onekeyhq/shared/types/fetchStream';

import {
  applyBootFailThresholds,
  resetBootFailCountOnGracefulQuit,
} from './bootFailRecovery';
import { createFetchStreamIpcHandler } from './fetchStreamRelay';
import { createMainWindowSenderTrustPredicate } from './mainWindowShellTrust';
import {
  createDidFailLoadHandler,
  createMainRendererRecoveryState,
  createRenderProcessGoneHandler,
} from './rendererRecoveryHandlers';

import type { BrowserWindow } from 'electron';

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

type IRelayFrame = { url: string };
type IRelayEvent = {
  sender: { id: number; isDestroyed: () => boolean; mainFrame: IRelayFrame };
  senderFrame: IRelayFrame | null;
};

function createProductionFetchStreamFixture() {
  let currentMainId = 1;
  const frame = { url: 'file:///opt/onekey/index.html#/home' };
  const event: IRelayEvent = {
    sender: { id: 1, isDestroyed: () => false, mainFrame: frame },
    senderFrame: frame,
  };
  const context = {
    selectedShellDocumentCommitted: true,
    trustedSameDocumentRouteUrl: undefined as string | undefined,
    src: 'file:///opt/onekey/index.html',
  };
  const mainAppFunctions: {
    isTrustedMainWindowSender?: ReturnType<
      typeof createMainWindowSenderTrustPredicate
    >;
  } = {};
  mainAppFunctions.isTrustedMainWindowSender =
    createMainWindowSenderTrustPredicate({
      state: context,
      getSafelyMainWindow: () =>
        ({ webContents: { id: currentMainId } }) as unknown as BrowserWindow,
      getSafelyBrowserWindow: () => undefined,
      getAppShellUrl: () => context.src,
      isDevServer: false,
    });
  const response: IFetchStreamResult = { ok: true, cancelled: true };
  const fetchStreamRequest = jest.fn(
    async (_request: IFetchStreamRequest): Promise<IFetchStreamResult> =>
      response,
  );
  const handler = createFetchStreamIpcHandler({
    fetchStreamRequest,
    getIsTrustedMainWindowSender: () =>
      mainAppFunctions.isTrustedMainWindowSender,
  });
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
  const recoveryWindowMock = { on: jest.fn() };
  const createRecoveryWindow = jest.fn(() => recoveryWindowMock);
  const result = applyBootFailThresholds({
    store,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    appVersion: mockAppVersion,
    bootFailCount: store.incrementConsecutiveBootFailCount(),
    createRecoveryWindow,
  });
  return {
    bootFailCount: result.bootFailCount,
    recoveryWindow: result.recoveryWindow,
    recoveryWindowMock,
    createRecoveryWindow,
  };
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

    resetBootFailCountOnGracefulQuit({
      store,
      mainRendererBootFailed: false,
    });

    expect(store.getConsecutiveBootFailCount()).toBe(0);
    expect(store.incrementConsecutiveBootFailCount()).toBe(1);
    expect(store.getUpdateBundleData()).toEqual(activeBundle);
  });

  it('preserves real boot failures and an open recovery window on quit', () => {
    const { store } = loadStartup();
    const quitReset = (mainRendererBootFailed: boolean) =>
      resetBootFailCountOnGracefulQuit({
        store,
        mainRendererBootFailed,
      });
    store.setConsecutiveBootFailCount(1);
    quitReset(true);
    expect(store.incrementConsecutiveBootFailCount()).toBe(2);

    store.setConsecutiveBootFailCount(3);
    quitReset(false);
    expect(store.getConsecutiveBootFailCount()).toBe(3);
  });

  it('keeps the active OTA after its second unsuccessful boot', () => {
    seedUpdateState();
    const { store } = loadStartup();
    store.setConsecutiveBootFailCount(1);

    const { bootFailCount, recoveryWindow, createRecoveryWindow } =
      runProductionBootThresholds(store);

    expect(bootFailCount).toBe(2);
    expect(store.getConsecutiveBootFailCount()).toBe(2);
    expect(store.getUpdateBundleData()).toEqual(activeBundle);
    expect(recoveryWindow).toBeUndefined();
    expect(createRecoveryWindow).not.toHaveBeenCalled();
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

    const { bootFailCount, recoveryWindow, createRecoveryWindow } =
      runProductionBootThresholds(store);

    expect(bootFailCount).toBe(1);
    expect(store.getConsecutiveBootFailCount()).toBe(1);
    expect(store.getUpdateBundleData()).toEqual({});
    expect(recoveryWindow).toBeUndefined();
    expect(createRecoveryWindow).not.toHaveBeenCalled();
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

    const { bootFailCount, recoveryWindow } =
      runProductionBootThresholds(store);

    expect(bootFailCount).toBe(1);
    expect(store.getUpdateBundleData()).toEqual({});
    expect(recoveryWindow).toBeUndefined();
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

    const {
      bootFailCount,
      recoveryWindow,
      recoveryWindowMock,
      createRecoveryWindow,
    } = runProductionBootThresholds(store);

    expect(bootFailCount).toBe(3);
    expect(store.getConsecutiveBootFailCount()).toBe(3);
    expect(recoveryWindow).toBe(recoveryWindowMock);
    expect(createRecoveryWindow).toHaveBeenCalledTimes(1);
  });

  it('counts a main renderer crash but ignores a clean exit and app shutdown', () => {
    const run = (reason: string, appQuitStarted = false) => {
      const state = createMainRendererRecoveryState();
      const callback = createRenderProcessGoneHandler({
        state,
        getSafelyBrowserWindow: () => undefined,
        getAppShellUrl: () => 'file:///index.html',
        isAppQuitStarted: () => appQuitStarted,
        isBleQuitStarted: () => false,
        isSoftRestarting: () => false,
        setAppReady: jest.fn(),
      });
      callback(undefined, { reason, exitCode: 0 });
      return state.bootFailed;
    };

    expect(run('crashed')).toBe(true);
    expect(run('clean-exit')).toBe(false);
    expect(run('crashed', true)).toBe(false);
  });

  it('counts a failed selected shell load but not a cancelled or routed reload', () => {
    const shellUrl = 'file:///index.html';
    const createLoadFailedCallback = () => {
      const state = createMainRendererRecoveryState();
      const callback = createDidFailLoadHandler({
        state,
        getSafelyBrowserWindow: () =>
          ({ loadURL: jest.fn() }) as unknown as BrowserWindow,
        getAppShellUrl: () => shellUrl,
        isAppQuitStarted: () => false,
      });
      return { callback, state };
    };
    const run = (url: string, errorCode: number, isMainFrame = true) => {
      const { callback, state } = createLoadFailedCallback();
      callback(undefined, errorCode, '', url, isMainFrame);
      return state.bootFailed;
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
