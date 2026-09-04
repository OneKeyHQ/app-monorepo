/* eslint-disable max-classes-per-file */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';

const mockIndexedDBConstructor = jest.fn(() => {
  throw new OneKeyLocalError('A physical IndexedDB backend was constructed');
});
const mockRealmOpen = jest.fn(() => {
  throw new OneKeyLocalError('A physical Realm backend was opened');
});
const mockRealmDelete = jest.fn();
const mockV4IndexedDBOpen = jest.fn(() => {
  throw new OneKeyLocalError('A physical V4 IndexedDB backend was opened');
});
const mockV4IndexedDBDelete = jest.fn();

const maskedEnvironment = RuntimeEnvironment.create(
  getTravelModeRuntimeProfile(true),
  {
    isBlockedSync: () => true,
    runProtectedOperation: async ({ onBlocked }) => onBlocked(),
  },
);

jest.mock('@onekeyhq/shared/src/travelMode', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/travelMode')
  >('@onekeyhq/shared/src/travelMode');
  return {
    ...actual,
    travelModeManager: {
      getRuntimeEnvironment: async () => maskedEnvironment,
      getRuntimeEnvironmentSync: () => maskedEnvironment,
    },
  };
});

jest.mock('@onekeyhq/shared/src/IndexedDBPromised', () => ({
  IndexedDBPromised: class PoisonIndexedDB {
    static deleteDatabase = jest.fn();

    constructor() {
      mockIndexedDBConstructor();
    }
  },
}));

jest.mock('realm', () => ({
  __esModule: true,
  default: {
    Object: class MockRealmObject {},
    deleteFile: mockRealmDelete,
    open: mockRealmOpen,
  },
}));

jest.mock('idb', () => ({
  deleteDB: mockV4IndexedDBDelete,
  openDB: mockV4IndexedDBOpen,
}));

describe('masked local database startup', () => {
  it('loads Realm and IndexedDB entry points without opening either backend', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocalDbRealm } =
      require('./realm/LocalDbRealm') as typeof import('./realm/LocalDbRealm');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocalDbIndexed } =
      require('./indexed/LocalDbIndexed') as typeof import('./indexed/LocalDbIndexed');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { maskedLocalDbAgent } =
      require('./MaskedLocalDbAgent') as typeof import('./MaskedLocalDbAgent');

    const realmDb = new LocalDbRealm();
    const indexedDb = new LocalDbIndexed();

    await expect(realmDb.readyDb).resolves.toBe(maskedLocalDbAgent);
    await expect(indexedDb.readyDb).resolves.toBe(maskedLocalDbAgent);
    expect(mockRealmOpen).not.toHaveBeenCalled();
    expect(mockIndexedDBConstructor).not.toHaveBeenCalled();
  });

  it('keeps V4 Realm and IndexedDB behind the same masked persistence boundary', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { V4LocalDbRealm } =
      require('../../migrations/v4ToV5Migration/v4local/v4realm/V4LocalDbRealm') as typeof import('../../migrations/v4ToV5Migration/v4local/v4realm/V4LocalDbRealm');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { V4LocalDbIndexed } =
      require('../../migrations/v4ToV5Migration/v4local/v4indexed/V4LocalDbIndexed') as typeof import('../../migrations/v4ToV5Migration/v4local/v4indexed/V4LocalDbIndexed');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EV4LocalDBStoreNames } =
      require('../../migrations/v4ToV5Migration/v4local/v4localDBStoreNames') as typeof import('../../migrations/v4ToV5Migration/v4local/v4localDBStoreNames');

    const realmDb = new V4LocalDbRealm();
    const indexedDb = new V4LocalDbIndexed();

    await expect(
      realmDb.getAllRecords({ name: EV4LocalDBStoreNames.Wallet }),
    ).resolves.toEqual({ records: [] });
    await expect(
      indexedDb.getRecordsCount({ name: EV4LocalDBStoreNames.Account }),
    ).resolves.toEqual({ count: 0 });

    const updater = jest.fn(() => {
      throw new OneKeyLocalError('A masked V4 updater was invoked');
    });
    await expect(
      realmDb.txUpdateRecords({
        ids: ['wallet-1'],
        name: EV4LocalDBStoreNames.Wallet,
        tx: {},
        updater,
      }),
    ).resolves.toBeUndefined();
    await expect(realmDb.reset()).resolves.toBeUndefined();
    await expect(indexedDb.reset()).resolves.toBeUndefined();

    expect(updater).not.toHaveBeenCalled();
    expect(mockRealmOpen).not.toHaveBeenCalled();
    expect(mockRealmDelete).not.toHaveBeenCalled();
    expect(mockV4IndexedDBOpen).not.toHaveBeenCalled();
    expect(mockV4IndexedDBDelete).not.toHaveBeenCalled();
  });
});
