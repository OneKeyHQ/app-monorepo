/**
 * Unit tests for the desktop renderer syncStorage adapter.
 *
 * The tray window shares the desktop renderer bundle, but preload does not
 * expose `$mmkvSync` to it. Module-level readers such as dbPerfMonitor run
 * before React mounts, so the adapter must degrade to an empty store instead
 * of throwing when the bridge is absent (OK-65749).
 */

import { EAppSyncStorageKeys } from '../syncStorageKeys';

jest.mock('../../utils/resetUtils', () => ({
  __esModule: true,
  default: { checkNotInResetting: jest.fn() },
}));

type IMmkvSyncArgs = {
  method: string;
  id: string;
  key?: string;
  value?: unknown;
};

const SETTINGS_STORE_ID = 'onekey-app-setting';
const testKey = EAppSyncStorageKeys.onekey_developer_mode_enabled;

const originalBridgeDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  '$mmkvSync',
);

function setBridge(bridge: unknown) {
  Object.defineProperty(globalThis, '$mmkvSync', {
    configurable: true,
    writable: true,
    value: bridge,
  });
}

function removeBridge() {
  Reflect.deleteProperty(globalThis, '$mmkvSync');
}

function loadDesktopSyncStorage() {
  // Fresh module instance per test so module-level state does not leak.
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod =
    require('./syncStorageInstance.desktop') as typeof import('./syncStorageInstance.desktop');
  return mod.syncStorage;
}

afterEach(() => {
  if (originalBridgeDescriptor) {
    Object.defineProperty(globalThis, '$mmkvSync', originalBridgeDescriptor);
  } else {
    removeBridge();
  }
  jest.restoreAllMocks();
});

describe('desktop syncStorage without $mmkvSync bridge (tray renderer)', () => {
  beforeEach(() => {
    removeBridge();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('reads return undefined instead of throwing', () => {
    const syncStorage = loadDesktopSyncStorage();

    expect(() => syncStorage.getBoolean(testKey)).not.toThrow();
    expect(syncStorage.getBoolean(testKey)).toBeUndefined();
    expect(syncStorage.getString(testKey)).toBeUndefined();
    expect(syncStorage.getNumber(testKey)).toBeUndefined();
    expect(syncStorage.getObject(testKey)).toBeUndefined();
    expect(syncStorage.getAllKeys()).toEqual([]);
  });

  it('writes are dropped instead of throwing', () => {
    const syncStorage = loadDesktopSyncStorage();

    expect(() => {
      void syncStorage.set(testKey, true);
      void syncStorage.setObject(testKey, { a: 1 });
      void syncStorage.delete(testKey);
      void syncStorage.clearAll();
    }).not.toThrow();
  });

  it('warns about the missing bridge only once', () => {
    const syncStorage = loadDesktopSyncStorage();

    syncStorage.getBoolean(testKey);
    syncStorage.getString(testKey);
    void syncStorage.set(testKey, true);

    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe('desktop syncStorage with $mmkvSync bridge (main renderer)', () => {
  it('forwards reads to the bridge with the settings store id', () => {
    const bridge = jest.fn((args: IMmkvSyncArgs) =>
      args.method === 'getBoolean' ? true : undefined,
    );
    setBridge(bridge);
    const syncStorage = loadDesktopSyncStorage();

    expect(syncStorage.getBoolean(testKey)).toBe(true);
    expect(bridge).toHaveBeenCalledWith({
      method: 'getBoolean',
      id: SETTINGS_STORE_ID,
      key: testKey,
      value: undefined,
    });
  });

  it('forwards writes with the value to the bridge', () => {
    const bridge = jest.fn(() => undefined);
    setBridge(bridge);
    const syncStorage = loadDesktopSyncStorage();

    void syncStorage.set(testKey, 'v');
    void syncStorage.setObject(testKey, { a: 1 });

    expect(bridge).toHaveBeenCalledWith({
      method: 'set',
      id: SETTINGS_STORE_ID,
      key: testKey,
      value: 'v',
    });
    expect(bridge).toHaveBeenCalledWith({
      method: 'set',
      id: SETTINGS_STORE_ID,
      key: testKey,
      value: '{"a":1}',
    });
  });

  it('getObject parses the JSON string returned by the bridge', () => {
    setBridge(
      jest.fn((args: IMmkvSyncArgs) =>
        args.method === 'getString' ? '{"x":99}' : undefined,
      ),
    );
    const syncStorage = loadDesktopSyncStorage();

    expect(syncStorage.getObject(testKey)).toEqual({ x: 99 });
  });
});
