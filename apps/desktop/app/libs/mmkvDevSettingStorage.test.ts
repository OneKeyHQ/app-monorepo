import fs from 'fs';
import os from 'os';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EDevSettingSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

type IMmkvSyncArgs = {
  method: string;
  id: string;
  key?: string;
  value?: unknown;
};

let mockProfileDir = '';
const mockRegisterIpc = jest.fn<
  void,
  [string, (event: { returnValue: unknown }, args: IMmkvSyncArgs) => void]
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
      const event: { returnValue: unknown } = { returnValue: undefined };
      handler(event, args);
      return event.returnValue;
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mainStore = require('./store') as typeof import('./store');
  expect(mainStore.instance.path).toBe(
    path.join(mockProfileDir, 'OneKey.json'),
  );
  return { rendererStorage: loadRendererStorage(), mainStore };
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
