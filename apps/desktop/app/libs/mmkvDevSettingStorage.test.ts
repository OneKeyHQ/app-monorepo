import fs from 'fs';
import os from 'os';
import path from 'path';

import type { IDesktopApi } from '@onekeyhq/kit-bg/src/desktopApis/instance/IDesktopApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EDevSettingSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

type IMmkvSyncArgs = {
  method: string;
  id: string;
  key?: string;
  value?: unknown;
};

type IMmkvSyncEvent = {
  returnValue: unknown;
  sender?: {
    id: number;
    mainFrame?: unknown;
    isDestroyed?: () => boolean;
  };
  senderFrame?: unknown;
};

let mockProfileDir = '';
const mockRegisterIpc = jest.fn<
  void,
  [string, (event: IMmkvSyncEvent, args: IMmkvSyncArgs) => void]
>();

jest.mock('electron', () => ({
  app: {
    getPath: () => mockProfileDir,
    getVersion: () => '6.7.0',
  },
  ipcMain: { on: mockRegisterIpc },
  safeStorage: { isEncryptionAvailable: () => false },
}));
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
const mockElectronStore =
  jest.requireActual<typeof import('electron-store')>('electron-store');
jest.mock('electron-store', () => mockElectronStore);

const originalBridgeDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  '$mmkvSync',
);
const originalMainAppFunctions = globalThis.$desktopMainAppFunctions;
const devModeKey = EDevSettingSyncStorageKeys.onekey_developer_mode_enabled;
const skipKey = EDevSettingSyncStorageKeys.onekey_bundle_skip_gpg_verification;

function loadRendererStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('../../../../packages/shared/src/storage/instance/mmkvDevSettingStorageInstance.desktop') as typeof import('../../../../packages/shared/src/storage/instance/mmkvDevSettingStorageInstance.desktop')
  ).default;
}

function loadStorage() {
  jest.resetModules();
  mockRegisterIpc.mockClear();
  const trustedMainFrame = { url: 'file:///opt/onekey/index.html' };
  Object.assign(globalThis, {
    $desktopMainAppFunctions: {
      ...originalMainAppFunctions,
      isTrustedMainWindowSender: (
        senderId: number,
        senderFrame: unknown,
        mainFrame: unknown,
      ) =>
        senderId === 1 &&
        senderFrame === trustedMainFrame &&
        mainFrame === trustedMainFrame,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./react-native-mmkv-desktop-main');
  const handler = mockRegisterIpc.mock.calls.find(
    ([channel]) => channel === 'mmkv:sync',
  )?.[1];
  if (!handler) {
    throw new OneKeyLocalError('MMKV main-process handler was not registered');
  }
  Object.defineProperty(globalThis, '$mmkvSync', {
    configurable: true,
    writable: true,
    value: (args: IMmkvSyncArgs) => {
      const event: IMmkvSyncEvent = {
        returnValue: undefined,
        sender: {
          id: 1,
          mainFrame: trustedMainFrame,
          isDestroyed: () => false,
        },
        senderFrame: trustedMainFrame,
      };
      handler(event, args);
      return event.returnValue;
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mainStore = require('./store') as typeof import('./store');
  expect(mainStore.instance.path).toBe(
    path.join(mockProfileDir, 'OneKey.json'),
  );
  return {
    rendererStorage: loadRendererStorage(),
    mainStore,
    handler,
    trustedMainFrame,
  };
}

beforeEach(() => {
  mockProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-gpg-storage-'));
});

afterEach(() => {
  if (originalBridgeDescriptor) {
    Object.defineProperty(globalThis, '$mmkvSync', originalBridgeDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, '$mmkvSync');
  }
  Object.assign(globalThis, {
    $desktopMainAppFunctions: originalMainAppFunctions,
  });
  jest.resetModules();
  fs.rmSync(mockProfileDir, { recursive: true, force: true });
});

test('renderer writes are immediately visible to the main-process update settings readers', () => {
  const { rendererStorage, mainStore } = loadStorage();

  rendererStorage.set(devModeKey, true);
  rendererStorage.set(skipKey, true);

  expect(rendererStorage.getBoolean(skipKey)).toBe(true);
  expect(mainStore.getDevSettingsEnabled()).toBe(true);
  expect(mainStore.getSkipGPGVerification()).toBe(true);

  rendererStorage.set(skipKey, false);
  expect(rendererStorage.getBoolean(skipKey)).toBe(false);
  expect(mainStore.getSkipGPGVerification()).toBe(false);
});

test('settings survive reinitializing both the renderer and main-process stores', () => {
  const { rendererStorage } = loadStorage();
  rendererStorage.set(devModeKey, true);
  rendererStorage.set(skipKey, true);

  const reloaded = loadStorage();

  expect(reloaded.rendererStorage.getBoolean(skipKey)).toBe(true);
  expect(reloaded.mainStore.getDevSettingsEnabled()).toBe(true);
  expect(reloaded.mainStore.getSkipGPGVerification()).toBe(true);
  expect(
    JSON.parse(
      fs.readFileSync(
        path.join(mockProfileDir, 'mmkv-onekey-app-dev-setting.json'),
        'utf8',
      ),
    ),
  ).toEqual({ [devModeKey]: true, [skipKey]: true });
});

test('removing or clearing renderer settings also clears the main-process values', () => {
  const { rendererStorage, mainStore } = loadStorage();
  rendererStorage.set(devModeKey, true);
  rendererStorage.set(skipKey, true);

  expect(rendererStorage.remove(skipKey)).toBe(true);
  expect(mainStore.getSkipGPGVerification()).toBe(false);
  expect(rendererStorage.getBoolean(skipKey)).toBeUndefined();

  rendererStorage.clearAll();
  expect(mainStore.getDevSettingsEnabled()).toBe(false);
});

test('app reset clears skip GPG across restart and re-enabling developer mode', async () => {
  const { rendererStorage, mainStore } = loadStorage();
  rendererStorage.set(devModeKey, true);
  rendererStorage.set(skipKey, true);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: DesktopApiStorage } =
    require('@onekeyhq/kit-bg/src/desktopApis/DesktopApiStorage') as typeof import('@onekeyhq/kit-bg/src/desktopApis/DesktopApiStorage');
  const storageApi = new DesktopApiStorage({ desktopApi: {} as IDesktopApi });

  await storageApi.resetAppConfiguration();

  expect(mainStore.getDevSettingsEnabled()).toBe(false);
  expect(mainStore.getSkipGPGVerification()).toBe(false);
  expect(rendererStorage.getBoolean(skipKey)).toBeUndefined();

  const reloaded = loadStorage();
  expect(reloaded.mainStore.getSkipGPGVerification()).toBe(false);
  reloaded.rendererStorage.set(devModeKey, true);
  expect(reloaded.mainStore.getDevSettingsEnabled()).toBe(true);
  expect(reloaded.mainStore.getSkipGPGVerification()).toBe(false);
  expect(reloaded.rendererStorage.getBoolean(skipKey)).toBeUndefined();
});

test('the tray renderer without a bridge reads an empty store without throwing', () => {
  jest.resetModules();
  Reflect.deleteProperty(globalThis, '$mmkvSync');
  const rendererStorage = loadRendererStorage();

  expect(rendererStorage.getBoolean(skipKey)).toBeUndefined();
  expect(() => rendererStorage.set(skipKey, true)).not.toThrow();
  expect(rendererStorage.remove(skipKey)).toBe(false);
  expect(() => rendererStorage.clearAll()).not.toThrow();
  expect(fs.readdirSync(mockProfileDir)).toEqual([]);
});

test('mmkv:sync rejects untrusted senders and non-persistent store ids', () => {
  const { handler, mainStore, trustedMainFrame } = loadStorage();

  const untrustedEvent: IMmkvSyncEvent = {
    returnValue: undefined,
    sender: {
      id: 99,
      mainFrame: { url: 'https://evil.example/' },
      isDestroyed: () => false,
    },
    senderFrame: { url: 'https://evil.example/' },
  };
  handler(untrustedEvent, {
    method: 'set',
    id: 'onekey-app-dev-setting',
    key: devModeKey,
    value: true,
  });
  expect(untrustedEvent.returnValue).toBeUndefined();
  expect(mainStore.getDevSettingsEnabled()).toBe(false);

  const arbitraryIdEvent: IMmkvSyncEvent = {
    returnValue: undefined,
    sender: {
      id: 1,
      mainFrame: trustedMainFrame,
      isDestroyed: () => false,
    },
    senderFrame: trustedMainFrame,
  };
  handler(arbitraryIdEvent, {
    method: 'set',
    id: 'arbitrary-untrusted-store',
    key: 'foo',
    value: 'bar',
  });
  expect(arbitraryIdEvent.returnValue).toBeUndefined();
  expect(
    fs.existsSync(
      path.join(mockProfileDir, 'mmkv-arbitrary-untrusted-store.json'),
    ),
  ).toBe(false);
});

test('mmkv:sync completes the synchronous reply with an error when the underlying store throws on write', () => {
  const { handler, rendererStorage, trustedMainFrame } = loadStorage();
  const setSpy = jest
    .spyOn(mockElectronStore.prototype, 'set')
    .mockImplementation(() => {
      throw new OneKeyLocalError('ENOSPC: no space left on device');
    });

  const sentinel = Symbol('unassigned');
  const writeEvent: IMmkvSyncEvent = {
    returnValue: sentinel,
    sender: {
      id: 1,
      mainFrame: trustedMainFrame,
      isDestroyed: () => false,
    },
    senderFrame: trustedMainFrame,
  };
  try {
    expect(() =>
      handler(writeEvent, {
        method: 'set',
        id: 'onekey-app-dev-setting',
        key: devModeKey,
        value: true,
      }),
    ).not.toThrow();
    expect(writeEvent.returnValue).toEqual({
      __onekeyMmkvSyncError: true,
      message: 'ENOSPC: no space left on device',
    });
    expect(() => rendererStorage.set(devModeKey, true)).toThrow(
      'ENOSPC: no space left on device',
    );
  } finally {
    setSpy.mockRestore();
  }
});
