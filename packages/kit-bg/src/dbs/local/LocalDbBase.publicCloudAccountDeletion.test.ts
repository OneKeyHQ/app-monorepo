import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerAccount } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';
import keylessCloudSyncUtils from '../../services/ServicePrimeCloudSync/keylessCloudSyncUtils';
import { PUBLIC_ACCOUNT_TEST_XFP } from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.test-utils';
import { hasPublicAccountSnapshotWriteGuard } from '../../services/ServicePrimeCloudSync/publicAccountSnapshotWriteGuard';

import { EDBAccountType } from './consts';
import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  EIndexedDBBucketNames,
  IDBAccount,
  IDBBaseObject,
  IDBCloudSyncItem,
  IDBIndexedAccount,
  IDBWallet,
  ILocalDBGetRecordsByIdsParams,
  ILocalDBGetRecordsByIdsResult,
  ILocalDBRecord,
  ILocalDBTransaction,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxGetRecordsByIdsParams,
  ILocalDBTxGetRecordsByIdsResult,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionOptions,
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function account(walletId = 'hd-1', index = 0): IDBAccount {
  return {
    id: `${walletId}--m/44'/60'/0'/0/${index}`,
    indexedAccountId: `${walletId}--${index}`,
    name: 'Public test account',
    type: EDBAccountType.SIMPLE,
    impl: 'evm',
    coinType: '60',
    path: `m/44'/60'/0'/0/${index}`,
    pathIndex: index,
    template: "m/44'/60'/0'/0/$$INDEX$$",
    address: '0x1111111111111111111111111111111111111111',
    pub: '',
  };
}

function wallet(id: string, extra: Partial<IDBWallet> = {}): IDBWallet {
  return {
    id,
    type: id.startsWith('hw-') ? 'hw' : 'hd',
    name: 'Public test wallet',
    walletNo: 1,
    backuped: true,
    accounts: [],
    nextIds: {},
    ...extra,
  };
}

function snapshotKey(record: IDBAccount): string {
  return `test-snapshot:${record.id}`;
}

class DeletionTestDb extends LocalDbBase {
  override readyDb = Promise.resolve(this);

  stores = new Map<ELocalDBStoreNames, Map<string, IDBBaseObject>>();

  failTombstoneWrite = false;

  beforeTransaction?: () => void;

  syncPoolWriteAttempts: string[] = [];

  buildTombstone = jest.fn(
    async ({ dbRecord }: { dbRecord: IDBAccount }) =>
      ({
        id: snapshotKey(dbRecord),
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey: '',
        rawData: 'public-snapshot',
        data: 'encrypted-public-snapshot',
        dataTime: 2,
        isDeleted: true,
        pwdHash: 'test-pwd-hash',
        localSceneUpdated: true,
        serverUploaded: false,
      }) as IDBCloudSyncItem | undefined,
  );

  syncFlow = jest.fn(async () => undefined);

  constructor() {
    super();
    const buildLegacyTarget = async ({
      dbRecord,
    }: {
      dbRecord: IDBBaseObject;
    }) => ({ dbRecord });
    const buildLegacyKey = async ({
      target,
    }: {
      target: { dbRecord: IDBBaseObject };
    }) => ({ key: `legacy:${target.dbRecord.id}` });
    this.setBackgroundApi({
      servicePrimeCloudSync: {
        getSyncCredentialSafe: async () => undefined,
        startServerSyncFlowSilently: this.syncFlow,
        syncManagers: {
          account: {
            buildSyncItemByDBQuery: this.buildTombstone,
            buildSyncTargetByDBQuery: buildLegacyTarget,
            buildSyncKeyAndPayload: buildLegacyKey,
          },
          wallet: {
            buildSyncTargetByDBQuery: buildLegacyTarget,
            buildSyncKeyAndPayload: buildLegacyKey,
          },
        },
      },
    } as unknown as IBackgroundApi);
  }

  put<TRecord extends IDBBaseObject>(
    name: ELocalDBStoreNames,
    record: TRecord,
  ) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    this.stores.get(name)?.set(record.id, cloneDeep(record));
  }

  read<T extends IDBBaseObject>(
    name: ELocalDBStoreNames,
    id: string,
  ): T | undefined {
    return this.stores.get(name)?.get(id) as T | undefined;
  }

  override async reset() {}

  override async withTransaction<T>(
    _bucket: EIndexedDBBucketNames,
    fn: (tx: ILocalDBTransaction) => Promise<T>,
    _options?: ILocalDBWithTransactionOptions,
  ): Promise<T> {
    if (!_options?.readOnly) this.beforeTransaction?.();
    const original = cloneDeep(this.stores);
    try {
      return await fn({} as ILocalDBTransaction);
    } catch (error) {
      this.stores = original;
      throw error;
    }
  }

  override async getWallet({ walletId }: { walletId: string }) {
    const result = this.read<IDBWallet>(ELocalDBStoreNames.Wallet, walletId);
    if (!result) throw new OneKeyLocalError('Missing test wallet');
    return cloneDeep(result);
  }

  override async getAllWallets() {
    return {
      wallets: Array.from(
        this.stores.get(ELocalDBStoreNames.Wallet)?.values() ?? [],
      ) as IDBWallet[],
    };
  }

  override async getNormalHwQrWalletInSameDevice({
    associatedDevice,
  }: {
    associatedDevice: string | undefined;
  }) {
    return (await this.getAllWallets()).wallets.filter(
      (record) =>
        record.associatedDevice === associatedDevice &&
        !accountUtils.isHwHiddenWallet({ wallet: record }),
    );
  }

  override async getAccountSafe({ accountId }: { accountId: string }) {
    return cloneDeep(
      this.read<IDBAccount>(ELocalDBStoreNames.Account, accountId),
    );
  }

  override async getSyncItemSafe({ id }: { id: string }) {
    return cloneDeep(
      this.read<IDBCloudSyncItem>(ELocalDBStoreNames.CloudSyncItem, id),
    );
  }

  override async getIndexedAccountSafe({ id }: { id: string }) {
    return cloneDeep(
      this.read<IDBIndexedAccount>(ELocalDBStoreNames.IndexedAccount, id),
    );
  }

  override async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    return this.txGetRecordsByIds({ ...params, tx: {} as ILocalDBTransaction });
  }

  override async txGetRecordsByIds<T extends ELocalDBStoreNames>({
    name,
    ids,
  }: ILocalDBTxGetRecordsByIdsParams<T>): Promise<
    ILocalDBTxGetRecordsByIdsResult<T>
  > {
    const records = ids.map(
      (id) => this.read(name, id) as ILocalDBRecord<T> | undefined,
    );
    return {
      records,
      recordPairs: records.map((record) =>
        record ? [record, null] : undefined,
      ),
    };
  }

  override async txGetAllRecords<T extends ELocalDBStoreNames>({
    name,
  }: ILocalDBTxGetAllRecordsParams<T>): Promise<
    ILocalDBTxGetAllRecordsResult<T>
  > {
    const records = Array.from(
      this.stores.get(name)?.values() ?? [],
    ) as ILocalDBRecord<T>[];
    return { records, recordPairs: records.map((record) => [record, null]) };
  }

  override async txAddRecords<T extends ELocalDBStoreNames>({
    name,
    records,
  }: ILocalDBTxAddRecordsParams<T>): Promise<ILocalDBTxAddRecordsResult> {
    if (name === ELocalDBStoreNames.CloudSyncItem)
      this.syncPoolWriteAttempts.push(...records.map((record) => record.id));
    if (name === ELocalDBStoreNames.CloudSyncItem && this.failTombstoneWrite)
      throw new OneKeyLocalError('Test storage full');
    const addedIds: string[] = [];
    for (const record of records) {
      if (!this.read(name, record.id)) {
        this.put(name, record);
        addedIds.push(record.id);
      }
    }
    return {
      addedIds,
      added: addedIds.length,
      skipped: records.length - addedIds.length,
    };
  }

  override async txRemoveRecords<T extends ELocalDBStoreNames>({
    name,
    ids,
    recordPairs,
  }: ILocalDBTxRemoveRecordsParams<T>): Promise<void> {
    const recordIds =
      ids ??
      recordPairs?.flatMap(([record]) => (record ? [record.id] : [])) ??
      [];
    for (const id of recordIds) this.stores.get(name)?.delete(id);
  }

  override async txUpdateRecords<T extends ELocalDBStoreNames>({
    name,
    ids,
    updater,
  }: ILocalDBTxUpdateRecordsParams<T>): Promise<void> {
    for (const id of ids ?? []) {
      const record = this.read(name, id) as ILocalDBRecord<T> | undefined;
      if (record) this.put(name, await updater(record));
    }
  }

  addAccount(record: IDBAccount) {
    this.put(ELocalDBStoreNames.Account, record);
    this.put(ELocalDBStoreNames.IndexedAccount, {
      id: record.indexedAccountId ?? '',
      walletId: accountUtils.getWalletIdFromAccountId({ accountId: record.id }),
      index: record.pathIndex,
      name: record.name,
    });
  }
}

// Public synthetic credentials, never used by a real wallet or backend.
const realManagerFixtureCredential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'public-deletion-test',
    signingPrivateKey: '11'.repeat(32),
    signingPublicKey: '02'.repeat(33),
    encryptionKey: '22'.repeat(32),
    pwdHash: 'keyless-public-deletion-test',
  },
};

function attachRealSnapshotManager(db: DeletionTestDb) {
  const prime = db.backgroundApi.servicePrimeCloudSync;
  prime.getSyncCredentialSafe = async () => realManagerFixtureCredential;
  prime.getCloudSyncDataTime = async () => 1_750_000_000_000;
  const backgroundApi = { ...db.backgroundApi, localDb: db };
  const manager = new CloudSyncFlowManagerAccount({
    backgroundApi: backgroundApi as IBackgroundApi,
  });
  backgroundApi.servicePrimeCloudSync.syncManagers = {
    ...backgroundApi.servicePrimeCloudSync.syncManagers,
    account: manager,
  };
  db.setBackgroundApi(backgroundApi as IBackgroundApi);
  return manager;
}

describe('public account deletion tombstones', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('single HD/HW deletion retains the tombstone and triggers sync after commit', async () => {
    const db = new DeletionTestDb();
    const record = account('hw-test');
    db.put(ELocalDBStoreNames.Wallet, wallet('hw-test'));
    db.addAccount(record);
    db.put(ELocalDBStoreNames.CloudSyncItem, {
      ...(await db.buildTombstone({ dbRecord: record })),
      id: snapshotKey(record),
      dataTime: 1,
      isDeleted: false,
    });
    db.buildTombstone.mockClear();
    await db.removeAccount({ accountId: record.id, walletId: 'hw-test' });
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();
    expect(
      db.read(ELocalDBStoreNames.CloudSyncItem, snapshotKey(record)),
    ).toMatchObject({ isDeleted: true, serverUploaded: false });
    expect(db.buildTombstone).toHaveBeenCalledWith({
      dbRecord: record,
      isDeleted: true,
      dataTime: undefined,
      syncCredential: undefined,
    });
    expect(db.syncFlow).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).toHaveBeenCalledTimes(1);
  });

  test('batch deletion writes every tombstone but makes one debounced sync request', async () => {
    const db = new DeletionTestDb();
    const records = [account('hd-1', 0), account('hd-1', 1)];
    db.put(ELocalDBStoreNames.Wallet, wallet('hd-1'));
    records.forEach((record) => db.addAccount(record));
    await db.removeAccountsByIds({ ids: records.map((record) => record.id) });
    expect(
      records.every(
        (record) =>
          db.read<IDBCloudSyncItem>(
            ELocalDBStoreNames.CloudSyncItem,
            snapshotKey(record),
          )?.isDeleted,
      ),
    ).toBe(true);
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).toHaveBeenCalledTimes(1);
  });

  test('tombstone failure rolls back both account deletion and wallet references', async () => {
    const db = new DeletionTestDb();
    const record = account();
    db.put(
      ELocalDBStoreNames.Wallet,
      wallet('hd-1', { accounts: [record.id] }),
    );
    db.addAccount(record);
    db.failTombstoneWrite = true;
    await expect(
      db.removeAccount({ accountId: record.id, walletId: 'hd-1' }),
    ).rejects.toThrow('Test storage full');
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toEqual(record);
    expect(
      db.read<IDBWallet>(ELocalDBStoreNames.Wallet, 'hd-1')?.accounts,
    ).toEqual([record.id]);
    expect(
      db.read(ELocalDBStoreNames.CloudSyncItem, snapshotKey(record)),
    ).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test.each([
    'single account',
    'bulk accounts',
    'single index',
    'bulk indexes',
  ] as const)(
    'a concurrent newer pool row rolls back %s deletion, including other tombstones in the batch',
    async (mode) => {
      const db = new DeletionTestDb();
      const records = mode.startsWith('bulk')
        ? [account('hd-1', 0), account('hd-1', 1)]
        : [account('hd-1', 0)];
      db.put(
        ELocalDBStoreNames.Wallet,
        wallet('hd-1', {
          xfp: PUBLIC_ACCOUNT_TEST_XFP,
          accounts: records.map((record) => record.id),
        }),
      );
      records.forEach((record) => db.addAccount(record));
      const manager = attachRealSnapshotManager(db);
      const originals: IDBCloudSyncItem[] = [];
      for (const record of records) {
        const original = await manager.buildSyncItemByDBQuery({
          dbRecord: record,
          isDeleted: false,
          dataTime: undefined,
          syncCredential: realManagerFixtureCredential,
        });
        if (!original)
          throw new OneKeyLocalError('Missing real manager fixture');
        expect(hasPublicAccountSnapshotWriteGuard(original)).toBe(true);
        originals.push(original);
        db.put(ELocalDBStoreNames.CloudSyncItem, original);
      }
      const last = originals[originals.length - 1];
      const newer = {
        ...last,
        dataTime: (last.dataTime ?? 0) + 1000,
        localSceneUpdated: false,
      };
      db.beforeTransaction = () => {
        db.beforeTransaction = undefined;
        db.put(ELocalDBStoreNames.CloudSyncItem, newer);
      };
      let remove: Promise<void>;
      if (mode === 'single account')
        remove = db.removeAccount({
          accountId: records[0].id,
          walletId: 'hd-1',
        });
      else if (mode === 'bulk accounts')
        remove = db.removeAccountsByIds({
          ids: records.map((record) => record.id),
        });
      else if (mode === 'single index')
        remove = db.removeIndexedAccount({
          indexedAccountId: records[0].indexedAccountId ?? '',
          walletId: 'hd-1',
        });
      else
        remove = db.removeIndexedAccounts({
          indexedAccounts: records.map((record) => {
            const indexed = db.read<IDBIndexedAccount>(
              ELocalDBStoreNames.IndexedAccount,
              record.indexedAccountId ?? '',
            );
            if (!indexed) throw new OneKeyLocalError('Missing test index');
            return indexed;
          }),
        });
      await expect(remove).rejects.toThrow('Synced account data changed');
      expect(
        db.read<IDBWallet>(ELocalDBStoreNames.Wallet, 'hd-1')?.accounts,
      ).toEqual(records.map((record) => record.id));
      for (const record of records) {
        expect(db.read(ELocalDBStoreNames.Account, record.id)).toEqual(record);
        expect(
          db.read(
            ELocalDBStoreNames.IndexedAccount,
            record.indexedAccountId ?? '',
          ),
        ).toBeDefined();
      }
      for (const original of originals)
        expect(db.read(ELocalDBStoreNames.CloudSyncItem, original.id)).toEqual(
          original.id === last.id ? newer : original,
        );
      if (mode.startsWith('bulk'))
        expect(db.syncPoolWriteAttempts).toContain(originals[0].id);
      await jest.advanceTimersByTimeAsync(1000);
      expect(db.syncFlow).not.toHaveBeenCalled();
    },
  );

  test('a tombstone declined by timestamp ordering rolls back a partially written deletion batch', async () => {
    const db = new DeletionTestDb();
    const records = [account('hd-1', 0), account('hd-1', 1)];
    db.put(
      ELocalDBStoreNames.Wallet,
      wallet('hd-1', {
        xfp: PUBLIC_ACCOUNT_TEST_XFP,
        accounts: records.map((record) => record.id),
      }),
    );
    records.forEach((record) => db.addAccount(record));
    const manager = attachRealSnapshotManager(db);
    const originals: IDBCloudSyncItem[] = [];
    for (const record of records) {
      const original = await manager.buildSyncItemByDBQuery({
        dbRecord: record,
        isDeleted: false,
        dataTime: undefined,
        syncCredential: realManagerFixtureCredential,
      });
      if (!original) throw new OneKeyLocalError('Missing real manager fixture');
      originals.push(original);
      db.put(ELocalDBStoreNames.CloudSyncItem, original);
    }
    const last = originals[1];
    const newer = { ...last, dataTime: (last.dataTime ?? 0) + 1000 };
    db.put(ELocalDBStoreNames.CloudSyncItem, newer);
    await expect(
      db.removeAccountsByIds({ ids: records.map((record) => record.id) }),
    ).rejects.toThrow('Synced account data changed');
    expect(db.syncPoolWriteAttempts).toEqual(
      originals.map((record) => record.id),
    );
    expect(db.read(ELocalDBStoreNames.CloudSyncItem, originals[0].id)).toEqual(
      originals[0],
    );
    expect(db.read(ELocalDBStoreNames.CloudSyncItem, last.id)).toEqual(newer);
    for (const record of records) {
      expect(db.read(ELocalDBStoreNames.Account, record.id)).toEqual(record);
      expect(
        db.read(
          ELocalDBStoreNames.IndexedAccount,
          record.indexedAccountId ?? '',
        ),
      ).toBeDefined();
    }
    expect(
      db.read<IDBWallet>(ELocalDBStoreNames.Wallet, 'hd-1')?.accounts,
    ).toEqual(records.map((record) => record.id));
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test('the real manager refuses an encrypted future-format tombstone target before deleting local data', async () => {
    const db = new DeletionTestDb();
    const record = account('hd-1', 0);
    db.put(
      ELocalDBStoreNames.Wallet,
      wallet('hd-1', { xfp: PUBLIC_ACCOUNT_TEST_XFP, accounts: [record.id] }),
    );
    db.addAccount(record);
    const manager = attachRealSnapshotManager(db);
    const original = await manager.buildSyncItemByDBQuery({
      dbRecord: record,
      isDeleted: false,
      dataTime: undefined,
      syncCredential: realManagerFixtureCredential,
    });
    if (!original) throw new OneKeyLocalError('Missing real manager fixture');
    const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
      item: { ...original },
      syncCredential: realManagerFixtureCredential,
    });
    if (
      rawDataJson?.dataType !== EPrimeCloudSyncDataType.Account ||
      !rawDataJson.payload.publicAccountSnapshot
    )
      throw new OneKeyLocalError('Missing public snapshot fixture');
    const encryptionKey =
      realManagerFixtureCredential.keylessCredential?.encryptionKey;
    if (!encryptionKey)
      throw new OneKeyLocalError('Missing fixture encryption key');
    const future: IDBCloudSyncItem = {
      ...original,
      data: await keylessCloudSyncUtils.encryptWithKeylessKey({
        rawData: stringUtils.stableStringify({
          ...rawDataJson,
          payload: {
            ...rawDataJson.payload,
            publicAccountSnapshot: {
              ...rawDataJson.payload.publicAccountSnapshot,
              version: 2,
            },
          },
        }),
        encryptionKey,
        itemId: original.id,
        dataType: original.dataType,
      }),
      dataTime: (original.dataTime ?? 0) + 1000,
      rawData: '',
    };
    db.put(ELocalDBStoreNames.CloudSyncItem, future);
    await expect(
      db.removeAccount({ accountId: record.id, walletId: 'hd-1' }),
    ).rejects.toThrow('compatible App version');
    expect(db.read(ELocalDBStoreNames.CloudSyncItem, future.id)).toEqual(
      future,
    );
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toEqual(record);
    expect(
      db.read(ELocalDBStoreNames.IndexedAccount, record.indexedAccountId ?? ''),
    ).toBeDefined();
    expect(db.syncPoolWriteAttempts).toEqual([]);
  });

  test.each([false, true])(
    'index deletion bulk=%s covers associated account snapshots',
    async (bulk) => {
      const db = new DeletionTestDb();
      const record = account();
      db.put(ELocalDBStoreNames.Wallet, wallet('hd-1'));
      db.addAccount(record);
      const indexed = db.read<IDBIndexedAccount>(
        ELocalDBStoreNames.IndexedAccount,
        record.indexedAccountId ?? '',
      );
      expect(indexed).toBeDefined();
      if (bulk && indexed)
        await db.removeIndexedAccounts({ indexedAccounts: [indexed] });
      else
        await db.removeIndexedAccount({
          indexedAccountId: record.indexedAccountId ?? '',
          walletId: 'hd-1',
        });
      expect(
        db.read(
          ELocalDBStoreNames.IndexedAccount,
          record.indexedAccountId ?? '',
        ),
      ).toBeUndefined();
      expect(
        db.read(ELocalDBStoreNames.CloudSyncItem, snapshotKey(record)),
      ).toMatchObject({ isDeleted: true });
      await jest.advanceTimersByTimeAsync(1000);
      expect(db.syncFlow).toHaveBeenCalledTimes(1);
    },
  );

  test('wallet unbinding and implicit hidden-wallet removal stay local', async () => {
    const db = new DeletionTestDb();
    db.put(
      ELocalDBStoreNames.Wallet,
      wallet('hw-test', { associatedDevice: 'device-test' }),
    );
    db.put(
      ELocalDBStoreNames.Wallet,
      wallet('hw-test-hidden', {
        associatedDevice: 'device-test',
        passphraseState: 'hidden-session',
      }),
    );
    const records = [account('hw-test'), account('hw-test-hidden')];
    records.forEach((record) => db.addAccount(record));
    await db.removeWallet({ walletId: 'hw-test' });
    expect(
      db.read(ELocalDBStoreNames.Wallet, 'hw-test-hidden'),
    ).toBeUndefined();
    expect(db.buildTombstone).not.toHaveBeenCalled();
    expect(db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.size ?? 0).toBe(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test('bulk wallet cleanup during automatic merging creates no global tombstones', async () => {
    const db = new DeletionTestDb();
    const records = [account('hd-1'), account('hd-2')];
    for (const record of records) {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: record.id,
      });
      db.put(ELocalDBStoreNames.Wallet, wallet(walletId));
      db.addAccount(record);
    }
    await db.removeWallets({ walletIds: ['hd-1', 'hd-2'] });
    expect(db.stores.get(ELocalDBStoreNames.Wallet)?.size).toBe(0);
    expect(db.buildTombstone).not.toHaveBeenCalled();
    expect(db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.size ?? 0).toBe(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test('unsupported future records keep their existing pool item on local deletion', async () => {
    const db = new DeletionTestDb();
    const record = account();
    db.put(ELocalDBStoreNames.Wallet, wallet('hd-1'));
    db.addAccount(record);
    const future: IDBCloudSyncItem = {
      id: snapshotKey(record),
      rawKey: '',
      rawData: '',
      dataType: EPrimeCloudSyncDataType.Account,
      data: 'future-version-ciphertext',
      dataTime: 5,
      isDeleted: false,
      pwdHash: 'test-pwd-hash',
      localSceneUpdated: false,
      serverUploaded: true,
    };
    db.put(ELocalDBStoreNames.CloudSyncItem, future);
    db.buildTombstone.mockResolvedValue(undefined);
    await db.removeAccount({ accountId: record.id, walletId: 'hd-1' });
    expect(db.read(ELocalDBStoreNames.CloudSyncItem, future.id)).toEqual(
      future,
    );
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test.each(['account', 'index'])(
    'missing wallet cleanup via %s never produces tombstones',
    async (mode) => {
      const db = new DeletionTestDb();
      const record = account();
      db.addAccount(record);
      if (mode === 'account') {
        await db.removeAccountsByIds({
          ids: [record.id, account('hd-missing').id],
        });
      } else {
        const indexed = db.read<IDBIndexedAccount>(
          ELocalDBStoreNames.IndexedAccount,
          record.indexedAccountId ?? '',
        );
        expect(indexed).toBeDefined();
        if (indexed)
          await db.removeIndexedAccounts({ indexedAccounts: [indexed] });
      }
      expect(db.buildTombstone).not.toHaveBeenCalled();
      expect(db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.size ?? 0).toBe(
        0,
      );
    },
  );

  test.each(['watching', 'imported'] as const)(
    'legacy %s removal keeps its existing pool cleanup',
    async (kind) => {
      const db = new DeletionTestDb();
      const record = {
        ...account(),
        id: `${kind}--evm--legacy`,
        indexedAccountId: undefined,
      };
      db.put(ELocalDBStoreNames.Wallet, wallet(kind, { type: kind }));
      db.addAccount(record);
      if (kind === 'imported') {
        db.put(ELocalDBStoreNames.Credential, {
          id: record.id,
          credential: 'encrypted-test-only',
        });
      }
      db.put(ELocalDBStoreNames.CloudSyncItem, { id: `legacy:${record.id}` });
      await db.removeAccount({ accountId: record.id, walletId: kind });
      expect(db.read(ELocalDBStoreNames.Credential, record.id)).toBeUndefined();
      expect(
        db.read(ELocalDBStoreNames.CloudSyncItem, `legacy:${record.id}`),
      ).toBeUndefined();
      expect(db.buildTombstone).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1000);
      expect(db.syncFlow).not.toHaveBeenCalled();
    },
  );
});
