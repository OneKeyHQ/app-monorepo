import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerAccount } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';

import { EDBAccountType } from './consts';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBAccount } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

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

afterEach(() => jest.restoreAllMocks());

async function fixture(accountId: string, supported: boolean) {
  const db = new LocalDbIndexed();
  const keyLock = jest.fn((work: () => Promise<void>) =>
    supported ? work() : new Promise<void>(() => {}),
  );
  const getSyncCredential = jest.fn(async () => credential);
  const upload = jest.fn(async () => undefined);
  const hydrate = jest.fn(async () => undefined);
  const syncManagers = { account: {} };
  const api = {
    localDb: db,
    serviceKeylessCloudSync: {
      runWithCloudSyncKeyLock: keyLock,
      hydrateKeylessSyncCredentialFromStorageIfNeeded: hydrate,
    },
    servicePrimeCloudSync: {
      syncManagers,
      getSyncCredentialSafe: getSyncCredential,
      getCloudSyncDataTime: async () => 5000,
      apiUploadItems: upload,
    },
  } as unknown as IBackgroundApi;
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
