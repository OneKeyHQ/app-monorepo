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

let mockProfileDir = '';
const mockMainFrame = {};
const mockRegisterIpc = jest.fn<
  void,
  [
    string,
    (
      event: {
        returnValue: unknown;
        sender?: { id: number; mainFrame?: unknown };
        senderFrame?: unknown;
      },
      args: IMmkvSyncArgs,
    ) => void,
  ]
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
const originalMainAppFunctionsDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  '$desktopMainAppFunctions',
);
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
  Object.defineProperty(globalThis, '$desktopMainAppFunctions', {
    configurable: true,
    writable: true,
    value: {
      isTrustedMainWindowSender: (
        senderId: number | undefined,
        senderFrame?: unknown,
        mainFrame?: unknown,
      ) => senderId === 1 && senderFrame === mainFrame,
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
      const event: {
        returnValue: unknown;
        sender: { id: number; mainFrame: unknown };
        senderFrame: unknown;
      } = {
        returnValue: undefined,
        sender: { id: 1, mainFrame: mockMainFrame },
        senderFrame: mockMainFrame,
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
  return { rendererStorage: loadRendererStorage(), mainStore, handler };
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
  if (originalMainAppFunctionsDescriptor) {
    Object.defineProperty(
      globalThis,
      '$desktopMainAppFunctions',
      originalMainAppFunctionsDescriptor,
    );
  } else {
    Reflect.deleteProperty(globalThis, '$desktopMainAppFunctions');
  }
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

test('rejects mmkv:sync IPC calls from untrusted webview or subframe senders', () => {
  const { rendererStorage, mainStore, handler } = loadStorage();
  rendererStorage.set(devModeKey, true);

  const untrustedEvent = {
    returnValue: 'initial' as unknown,
    sender: { id: 99, mainFrame: mockMainFrame },
    senderFrame: mockMainFrame,
  };
  handler(untrustedEvent, {
    method: 'set',
    id: 'onekey-app-dev-setting',
    key: skipKey,
    value: true,
  });
  expect(untrustedEvent.returnValue).toBeUndefined();
  expect(mainStore.getSkipGPGVerification()).toBe(false);
});
