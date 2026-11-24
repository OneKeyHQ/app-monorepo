import { EDeviceType } from '@onekeyfe/hd-shared';
import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import ServiceKeylessCloudSync from '../../services/ServiceKeylessCloudSync/ServiceKeylessCloudSync';
import { CloudSyncFlowManagerAccount } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';

import { EDBAccountType } from './consts';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBAccount } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const mockRecoverMigration = jest.fn();
const mockLoadMigrationChunk = jest.fn();
let mockMigrationChunkUnavailable = false;
jest.mock(
  '../../services/ServiceKeylessCloudSync/hardwareCloudSyncMigration',
  () => {
    mockLoadMigrationChunk();
    if (mockMigrationChunkUnavailable) {
      throw new OneKeyLocalError('Synthetic offline split chunk unavailable');
    }
    return { recoverHardwareCloudSyncMigration: mockRecoverMigration };
  },
);

const credential: ICloudSyncCredential = {
  masterPasswordUUID: '',
  primeAccountSalt: '',
  securityPasswordR1: '',
  keylessCredential: {
    keylessWalletId: 'test-scope',
    pwdHash: 'keyless-account-rename-scope',
    signingPrivateKey: '',
    signingPublicKey: 'test-public-key',
    encryptionKey: '12'.repeat(32),
  },
};

const backgroundBeforeTests = globalThis.$onekeyIsInBackground;
beforeEach(() => {
  globalThis.$onekeyIsInBackground = true;
});
afterEach(() => {
  globalThis.$onekeyIsInBackground = backgroundBeforeTests;
  jest.restoreAllMocks();
  mockMigrationChunkUnavailable = false;
  mockLoadMigrationChunk.mockClear();
  mockRecoverMigration.mockClear();
});

async function fixture(
  accountId: string,
  supported: boolean,
  { realKeyLock = false }: { realKeyLock?: boolean } = {},
) {
  const db = new LocalDbIndexed();
  const getSyncCredential = jest.fn<
    Promise<ICloudSyncCredential | undefined>,
    []
  >(async () => credential);
  const upload = jest.fn(async () => undefined);
  const hydrate = jest.fn(async () => undefined);
  const syncManagers = { account: {} };
  const api = {
    localDb: db,
    serviceKeylessCloudSync: {
      hydrateKeylessSyncCredentialFromStorageIfNeeded: hydrate,
    },
    servicePrimeCloudSync: {
      syncManagers,
      getSyncCredentialSafe: getSyncCredential,
      getCloudSyncDataTime: async () => 5000,
      apiUploadItems: upload,
    },
  } as unknown as IBackgroundApi;
  const service = new ServiceKeylessCloudSync({ backgroundApi: api });
  const keyLock = jest.fn();
  api.serviceKeylessCloudSync.runWithCloudSyncKeyLock = <T>(
    work: () => Promise<T>,
  ): Promise<T> => {
    keyLock();
    if (realKeyLock) return service.runWithCloudSyncKeyLock(work);
    return supported ? work() : new Promise<T>(() => {});
  };
  const manager = new CloudSyncFlowManagerAccount({ backgroundApi: api });
  syncManagers.account = manager;
  db.setBackgroundApi(api);
  jest.replaceProperty(
    appGlobals,
    '$backgroundApiProxy',
    api as unknown as typeof appGlobals.$backgroundApiProxy,
  );
  jest.spyOn(db, 'emitRenameDBAccountsEvent').mockResolvedValue(undefined);
  const account: IDBAccount = {
    id: accountId,
    name: 'Previous name',
    type: EDBAccountType.SIMPLE,
    path: '',
    coinType: '60',
    impl: 'evm',
    createAtNetwork: 'evm--1',
    pub: 'fixture-public-key',
    address: '0x0000000000000000000000000000000000000001',
  };
  await db.withTransaction(
    EIndexedDBBucketNames.account,
    (tx) =>
      db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        records: [account],
      }),
    { skipCloudCredentialWarmup: true },
  );
  const storedAccount = () =>
    db.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        const {
          records: [current],
        } = await db.txGetRecordsByIds({
          tx,
          name: ELocalDBStoreNames.Account,
          ids: [accountId],
        });
        return current;
      },
      { readOnly: true, skipCloudCredentialWarmup: true },
    );
  return {
    db,
    service,
    manager,
    account,
    keyLock,
    getSyncCredential,
    upload,
    hydrate,
    storedAccount,
  };
}

it.each(['external--60--test-rename', "qr-test-rename--m/44'/60'/0'/0/0"])(
  'renames unsupported Account %s without the Cloud key lock',
  async (id) => {
    const { db, keyLock, getSyncCredential, upload, hydrate, storedAccount } =
      await fixture(id, false);
    const { syncItems: before } = await db.getAllSyncItems();

    hydrate.mockClear();
    await db.setAccountName({ accountId: id, name: 'New local name' });
    expect(hydrate).not.toHaveBeenCalled();

    expect(await storedAccount()).toMatchObject({
      name: 'New local name',
    });
    expect(keyLock).not.toHaveBeenCalled();
    expect(getSyncCredential).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect((await db.getAllSyncItems()).syncItems).toEqual(before);
  },
);

it('keeps the normal encrypted sync path for a supported watching Account', async () => {
  const id = 'watching--60--test-rename';
  const { db, manager, account, keyLock, getSyncCredential, storedAccount } =
    await fixture(id, true);
  const target = await manager.buildSyncTargetByDBQuery({ dbRecord: account });
  const key = await manager.buildSyncKeyInfo({ target });
  if (!key) throw new OneKeyLocalError('Expected a supported watching Account');

  await db.setAccountName({ accountId: id, name: 'New synced name' });

  expect(await storedAccount()).toMatchObject({
    name: 'New synced name',
  });
  expect(keyLock).toHaveBeenCalledTimes(1);
  expect(getSyncCredential).toHaveBeenCalledTimes(1);
  const stored = await db.getSyncItem({ id: key.key });
  expect(stored).toMatchObject({
    pwdHash: credential.keylessCredential?.pwdHash,
    dataTime: 5000,
    serverUploaded: false,
  });
  const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
    item: { ...stored, rawData: '' },
    syncCredential: credential,
  });
  expect(rawDataJson).toMatchObject({ payload: { name: 'New synced name' } });
});

it.each([false, true])(
  'renames a supported watching Account without a migration download when software sync is %s',
  async (softwareSyncEnabled) => {
    mockMigrationChunkUnavailable = true;
    jest.spyOn(primeCloudSyncPersistAtom, 'get').mockResolvedValue({
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: softwareSyncEnabled,
      currentCloudSyncKeylessWalletId: softwareSyncEnabled
        ? credential.keylessCredential?.keylessWalletId
        : undefined,
    });
    const id = `watching--60--test-offline-migration-${softwareSyncEnabled}`;
    const { db, manager, account, getSyncCredential, storedAccount, keyLock } =
      await fixture(id, true, { realKeyLock: true });
    if (!softwareSyncEnabled) getSyncCredential.mockResolvedValue(undefined);
    const key = await manager.buildSyncKeyInfo({
      target: await manager.buildSyncTargetByDBQuery({ dbRecord: account }),
    });
    if (!key)
      throw new OneKeyLocalError('Expected a supported watching Account');

    await db.setAccountName({ accountId: id, name: 'Renamed without a chunk' });

    expect(await storedAccount()).toMatchObject({
      name: 'Renamed without a chunk',
    });
    expect(keyLock).toHaveBeenCalledTimes(1);
    expect(mockLoadMigrationChunk).not.toHaveBeenCalled();
    expect(mockRecoverMigration).not.toHaveBeenCalled();
    const stored = await db.getSyncItem({ id: key.key });
    expect(stored).toMatchObject({
      pwdHash: softwareSyncEnabled ? credential.keylessCredential?.pwdHash : '',
      serverUploaded: false,
    });
    expect(Boolean(stored.data)).toBe(softwareSyncEnabled);
    if (!softwareSyncEnabled)
      expect(stored.rawData).toContain('Renamed without a chunk');
  },
);

it('fails closed on an unreadable selection and requires migration before selected Hardware writes', async () => {
  const { service } = await fixture(
    'watching--60--test-hardware-recovery-chunk',
    true,
  );
  const read = jest.spyOn(primeCloudSyncPersistAtom, 'get');
  const operation = jest.fn(async () => 'written');
  const readError = new OneKeyLocalError('Synthetic selection read failed');
  read.mockRejectedValueOnce(readError);
  await expect(service.runWithCloudSyncKeyLock(operation)).rejects.toBe(
    readError,
  );
  expect(mockLoadMigrationChunk).not.toHaveBeenCalled();
  expect(operation).not.toHaveBeenCalled();

  read.mockResolvedValue({
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless: true,
    currentCloudSyncKeylessWalletId: 'hardware-test-key',
    hardwareCloudSyncKeySource: {
      type: 'hardware',
      credentialId: 'hardware-test-key',
      derivationVersion: 1,
      deviceName: 'Synthetic device',
      deviceType: EDeviceType.Pro,
    },
  });
  mockMigrationChunkUnavailable = true;
  await expect(service.runWithCloudSyncKeyLock(operation)).rejects.toThrow(
    'Synthetic offline split chunk unavailable',
  );
  expect(operation).not.toHaveBeenCalled();

  mockMigrationChunkUnavailable = false;
  mockRecoverMigration.mockRejectedValueOnce(readError);
  await expect(service.runWithCloudSyncKeyLock(operation)).rejects.toBe(
    readError,
  );
  expect(operation).not.toHaveBeenCalled();
  await expect(service.runWithCloudSyncKeyLock(operation)).resolves.toBe(
    'written',
  );
  expect(mockRecoverMigration).toHaveBeenCalledTimes(2);
  expect(operation).toHaveBeenCalledTimes(1);
  await expect(service.runWithCloudSyncKeyLock(operation)).resolves.toBe(
    'written',
  );
  expect(mockRecoverMigration).toHaveBeenCalledTimes(2);
});
