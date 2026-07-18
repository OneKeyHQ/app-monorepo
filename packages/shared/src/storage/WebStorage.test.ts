import { OneKeyLocalError, SystemDiskFullError } from '../errors';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { IndexedDBPromised } from '../IndexedDBPromised';
import resetUtils from '../utils/resetUtils';

import WebStorage, {
  EWebStorageKeyPrefix,
  migrateFromLegacyStorage,
} from './WebStorage';

const mockLegacyGetAllKeys = jest.fn<Promise<readonly string[]>, unknown[]>();
const mockLegacyGetItem = jest.fn<Promise<string | null>, unknown[]>();

jest.mock('./WebStorageLegacy', () => ({
  __esModule: true,
  default: class MockWebStorageLegacy {
    getAllKeys(...args: unknown[]) {
      return mockLegacyGetAllKeys(...args);
    }

    getItem(...args: unknown[]) {
      return mockLegacyGetItem(...args);
    }
  },
}));

describe('WebStorage.checkDiskFull', () => {
  const callCheckDiskFull = (payload?: unknown) =>
    WebStorage.prototype.checkDiskFull.call({} as WebStorage, payload);

  beforeEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    resetUtils.endResetting();
  });

  afterEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    resetUtils.endResetting();
    jest.restoreAllMocks();
  });

  it('skips disk-full precheck while resetting', () => {
    resetUtils.startResetting();
    globalThis.$onekeySystemDiskIsFull = true;
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    expect(() =>
      callCheckDiskFull({
        method: 'setItem',
      }),
    ).not.toThrow();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('keeps original warning + throw behavior when not resetting', () => {
    globalThis.$onekeySystemDiskIsFull = true;
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    expect(() =>
      callCheckDiskFull({
        method: 'setItem',
      }),
    ).toThrow(SystemDiskFullError);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.ShowSystemDiskFullWarning,
      undefined,
    );
  });
});

describe('WebStorage initialization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects callers when IndexedDB cannot be opened', async () => {
    const openError = new Error('open failed');
    jest
      .spyOn(IndexedDBPromised.prototype, 'open')
      .mockRejectedValueOnce(openError);

    const storage = new WebStorage({
      bucketName: 'bucket',
      dbName: 'database',
      legacyKeyPrefix: EWebStorageKeyPrefix.AppStorage,
      tableName: 'storage',
    });

    await expect(storage.indexed).rejects.toBe(openError);
  });
});

describe('WebStorage reset write gate', () => {
  beforeEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
  });

  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
  });

  it('blocks a write that was waiting for IndexedDB when reset starts', async () => {
    let resolveIndexed: ((value: unknown) => void) | undefined;
    const indexedPending = new Promise((resolve) => {
      resolveIndexed = resolve;
    });
    const indexed = {
      put: jest.fn(),
      add: jest.fn(),
    };
    const storage = {
      checkDiskFull: jest.fn(),
      indexed: indexedPending,
      tableName: 'storage',
    };

    const writePending = WebStorage.prototype.setItem.call(
      storage as unknown as WebStorage,
      'key',
      'value',
      undefined,
    );
    resetUtils.startResetting();
    resolveIndexed?.(indexed);

    await expect(writePending).rejects.toThrow(
      'Cannot perform operation while resetting',
    );
    expect(indexed.put).not.toHaveBeenCalled();
    expect(indexed.add).not.toHaveBeenCalled();
  });

  it('does not run the add fallback if reset starts while put is pending', async () => {
    const indexed = {
      put: jest.fn(async () => {
        resetUtils.startResetting();
        throw new OneKeyLocalError('put failed');
      }),
      add: jest.fn(),
    };
    const storage = {
      checkDiskFull: jest.fn(),
      indexed: Promise.resolve(indexed),
      tableName: 'storage',
    };

    await expect(
      WebStorage.prototype.setItem.call(
        storage as unknown as WebStorage,
        'key',
        'value',
        undefined,
      ),
    ).rejects.toThrow('Cannot perform operation while resetting');
    expect(indexed.put).toHaveBeenCalledTimes(1);
    expect(indexed.add).not.toHaveBeenCalled();
  });
});

describe('WebStorage legacy migration reset fence', () => {
  const originalIndexedDBDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'indexedDB',
  );

  beforeEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    mockLegacyGetAllKeys.mockReset();
    mockLegacyGetAllKeys.mockResolvedValue([
      `${EWebStorageKeyPrefix.SimpleDB}legacy-key`,
    ]);
    mockLegacyGetItem.mockReset();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        databases: jest.fn().mockResolvedValue([{ name: 'OneKeyStorage' }]),
      },
      writable: true,
    });
  });

  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    if (originalIndexedDBDescriptor) {
      Object.defineProperty(
        globalThis,
        'indexedDB',
        originalIndexedDBDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });

  const buildIndexed = () => {
    const values = new Map<string, string>();
    const indexed = {
      name: 'migration-test',
      getAllKeys: jest.fn().mockResolvedValue([]),
      put: jest.fn(async (_tableName: string, value: string, key: string) => {
        values.set(key, value);
        return key;
      }),
      add: jest.fn(async (_tableName: string, value: string, key: string) => {
        values.set(key, value);
        return key;
      }),
      clear: jest.fn(async () => values.clear()),
    };
    return { indexed, values };
  };

  it('drains an in-flight migration and skips its stale-generation write before clear', async () => {
    let resolveLegacyValue: ((value: string | null) => void) | undefined;
    let notifyLegacyReadStarted: (() => void) | undefined;
    const legacyReadStarted = new Promise<void>((resolve) => {
      notifyLegacyReadStarted = resolve;
    });
    mockLegacyGetItem.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveLegacyValue = resolve;
          notifyLegacyReadStarted?.();
        }),
    );
    const { indexed, values } = buildIndexed();

    const migration = migrateFromLegacyStorage({
      indexed: indexed as unknown as IndexedDBPromised,
      legacyKeyPrefix: EWebStorageKeyPrefix.SimpleDB,
      tableName: 'storage',
    });
    await legacyReadStarted;

    resetUtils.startResetting();
    let drainSettled = false;
    const drain = resetUtils.waitForResetSensitiveTasksToSettle().then(() => {
      drainSettled = true;
    });
    await Promise.resolve();
    expect(drainSettled).toBe(false);

    resolveLegacyValue?.('legacy-value');
    await expect(migration).resolves.toBeUndefined();
    await drain;
    await indexed.clear();

    expect(indexed.put).not.toHaveBeenCalled();
    expect(indexed.add).not.toHaveBeenCalled();
    expect(values.size).toBe(0);
  });

  it('skips migration without rejecting initialization when reset is active', async () => {
    mockLegacyGetItem.mockResolvedValue('legacy-value');
    const { indexed } = buildIndexed();
    resetUtils.startResetting();

    await expect(
      migrateFromLegacyStorage({
        indexed: indexed as unknown as IndexedDBPromised,
        legacyKeyPrefix: EWebStorageKeyPrefix.SimpleDB,
        tableName: 'storage',
      }),
    ).resolves.toBeUndefined();

    expect(indexed.getAllKeys).not.toHaveBeenCalled();
    expect(mockLegacyGetAllKeys).not.toHaveBeenCalled();
  });
});
