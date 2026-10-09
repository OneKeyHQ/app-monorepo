/* eslint-disable import/first */
import fs from 'fs';
import os from 'os';
import path from 'path';

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
