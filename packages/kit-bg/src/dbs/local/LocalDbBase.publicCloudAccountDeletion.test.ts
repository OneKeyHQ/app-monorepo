import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  IncorrectMasterPassword,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerAccount } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import { CloudSyncFlowManagerWallet } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';
import keylessCloudSyncUtils from '../../services/ServicePrimeCloudSync/keylessCloudSyncUtils';
import { withPublicAccountCreationContext } from '../../services/ServicePrimeCloudSync/publicAccountCreationContext';
import { PUBLIC_ACCOUNT_TEST_XFP } from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.test-utils';
import {
  hasPublicAccountSnapshotWriteGuard,
  rememberPublicAccountSnapshotWrite,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshotWriteGuard';

import { EDBAccountType, INDEXED_DB_VERSION, REALM_DB_VERSION } from './consts';
import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  EIndexedDBBucketNames,
  IDBAccount,
  IDBBaseObject,
  IDBCloudSyncItem,
  IDBDevice,
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
    }) => ({
      key: `legacy:${target.dbRecord.id}`,
      rawKey: 'Wallet >> wallet-fixture-key',
    });
    this.setBackgroundApi({
      serviceKeylessCloudSync: {
        getLocalMutationSyncCredential: async () => undefined,
        runWithCloudSyncKeyLock: async <T>(operation: () => Promise<T>) =>
          operation(),
      },
      servicePrimeCloudSync: {
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
            buildSyncKeyInfo: buildLegacyKey,
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

  override async getDeviceSafe(id: string) {
    return cloneDeep(this.read<IDBDevice>(ELocalDBStoreNames.Device, id));
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
  db.backgroundApi.serviceKeylessCloudSync.getLocalMutationSyncCredential =
    async () => realManagerFixtureCredential;
  prime.getCloudSyncDataTime = async (
    params: Parameters<
      IBackgroundApi['servicePrimeCloudSync']['getCloudSyncDataTime']
    >[0],
  ) =>
    params?.allowHistoricalTime && params.explicitHistoricalTime !== undefined
      ? params.explicitHistoricalTime
      : 1_750_000_000_000;
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

  test('requires the pending account deletion schema in both databases', () => {
    expect(REALM_DB_VERSION).toBeGreaterThanOrEqual(21);
    expect(INDEXED_DB_VERSION).toBe(REALM_DB_VERSION);
  });

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
    const requestedAt = Date.now();
    await db.removeAccount({ accountId: record.id, walletId: 'hw-test' });
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();
    expect(
      db.read(ELocalDBStoreNames.CloudSyncItem, snapshotKey(record)),
    ).toMatchObject({ isDeleted: true, serverUploaded: false });
    expect(db.buildTombstone).toHaveBeenCalledWith({
      dbRecord: record,
      isDeleted: true,
      dataTime: requestedAt,
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

  test('continuous deletion flushes within five seconds and flushes the trailing batch', async () => {
    const db = new DeletionTestDb();
    const records = Array.from({ length: 13 }, (_, index) =>
      account('hd-1', index),
    );
    db.put(ELocalDBStoreNames.Wallet, wallet('hd-1'));
    records.forEach((record) => db.addAccount(record));

    for (let index = 0; index < records.length; index += 1) {
      if (index > 0) await jest.advanceTimersByTimeAsync(500);
      await db.removeAccount({
        accountId: records[index].id,
        walletId: 'hd-1',
      });
      expect(db.syncFlow).toHaveBeenCalledTimes(index < 10 ? 0 : 1);
    }

    await jest.advanceTimersByTimeAsync(999);
    expect(db.syncFlow).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(db.syncFlow).toHaveBeenCalledTimes(2);
    expect(
      records.every(
        (record) =>
          db.read<IDBCloudSyncItem>(
            ELocalDBStoreNames.CloudSyncItem,
            snapshotKey(record),
          )?.isDeleted,
      ),
    ).toBe(true);
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

  test('a stalled Cloud preflight cannot delay or repeat local removal', async () => {
    const db = new DeletionTestDb();
    const record = account();
    db.put(
      ELocalDBStoreNames.Wallet,
      wallet('hd-1', { accounts: [record.id] }),
    );
    db.addAccount(record);
    const release = Promise.withResolvers<void>();
    const finished = Promise.withResolvers<void>();
    db.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock = async (
      operation,
    ) => {
      await release.promise;
      try {
        return await operation();
      } finally {
        finished.resolve();
      }
    };
    const transaction = jest.spyOn(db, 'txRemoveRecords');
    const removal = db.removeAccount({
      accountId: record.id,
      walletId: 'hd-1',
    });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(removal).resolves.toBeUndefined();
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();
    expect(transaction).toHaveBeenCalledTimes(1);
    release.resolve();
    await finished.promise;
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(db.buildTombstone).not.toHaveBeenCalled();
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test('local deletion without a verified credential leaves the old Cloud row intact', async () => {
    const db = new DeletionTestDb();
    const record = account();
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
    const old = { ...original, serverUploaded: true };
    db.put(ELocalDBStoreNames.CloudSyncItem, old);
    db.backgroundApi.serviceKeylessCloudSync.getLocalMutationSyncCredential =
      async () => undefined;
    await db.removeAccount({ accountId: record.id, walletId: 'hd-1' });
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();
    expect(db.read(ELocalDBStoreNames.CloudSyncItem, old.id)).toEqual(old);
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test('retired OneKey ID lookup cannot escape a local delete and cancel later hardware reconciliation', async () => {
    const db = new DeletionTestDb();
    const record = account();
    db.put(
      ELocalDBStoreNames.Wallet,
      wallet('hd-1', { accounts: [record.id] }),
    );
    db.addAccount(record);
    db.buildTombstone.mockResolvedValue(undefined);
    const reconciliation = new AbortController();
    const failedPrimeLookup = Promise.withResolvers<void>();
    const legacyLookup = jest.fn(async () => {
      // The legacy password getter clears all reconciliation on a failed
      // Prime lookup, even when the active key has since changed.
      await failedPrimeLookup.promise;
      reconciliation.abort();
      return undefined;
    });
    db.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe = legacyLookup;
    const readSelected = jest.spyOn(
      db.backgroundApi.serviceKeylessCloudSync,
      'getLocalMutationSyncCredential',
    );
    const removing = db.removeAccount({
      walletId: 'hd-1',
      accountId: record.id,
    });
    await jest.advanceTimersByTimeAsync(0);
    const removedBeforeDeadline = !db.read(
      ELocalDBStoreNames.Account,
      record.id,
    );
    failedPrimeLookup.resolve();
    await jest.advanceTimersByTimeAsync(1000);
    await removing;

    expect(removedBeforeDeadline).toBe(true);
    expect(readSelected).toHaveBeenCalledTimes(1);
    expect(legacyLookup).not.toHaveBeenCalled();
    expect(reconciliation.signal.aborted).toBe(false);
    expect(db.syncFlow).not.toHaveBeenCalled();
  });

  test.each(['single', 'batch'] as const)(
    '%s local removal completes after the already-admitted credential read stalls',
    async (kind) => {
      const db = new DeletionTestDb();
      const records =
        kind === 'single'
          ? [account('hd-1', 0)]
          : [account('hd-1', 0), account('hd-1', 1)];
      db.put(
        ELocalDBStoreNames.Wallet,
        wallet('hd-1', {
          accounts: records.map((record) => record.id),
        }),
      );
      records.forEach((record) => db.addAccount(record));
      const credential = Promise.withResolvers<ICloudSyncCredential>();
      const reading = Promise.withResolvers<void>();
      db.backgroundApi.serviceKeylessCloudSync.getLocalMutationSyncCredential =
        () => {
          reading.resolve();
          return credential.promise;
        };
      const txRemove = jest.spyOn(db, 'txRemoveRecords');
      try {
        const removing =
          kind === 'single'
            ? db.removeAccount({ walletId: 'hd-1', accountId: records[0].id })
            : db.removeAccountsByIds({
                ids: records.map((record) => record.id),
              });
        await reading.promise;
        await jest.advanceTimersByTimeAsync(1000);
        await expect(removing).resolves.toBeUndefined();
        expect(txRemove).toHaveBeenCalledTimes(1);
        for (const record of records) {
          expect(
            db.read(ELocalDBStoreNames.Account, record.id),
          ).toBeUndefined();
        }
        expect(
          db.read<IDBWallet>(ELocalDBStoreNames.Wallet, 'hd-1')?.accounts,
        ).toEqual([]);

        credential.resolve(realManagerFixtureCredential);
        await jest.advanceTimersByTimeAsync(1000);
        expect(txRemove).toHaveBeenCalledTimes(1);
        expect(db.buildTombstone).not.toHaveBeenCalled();
        expect(db.syncFlow).not.toHaveBeenCalled();
      } finally {
        credential.resolve(realManagerFixtureCredential);
        txRemove.mockRestore();
      }
    },
  );

  test.each([
    'single account',
    'bulk accounts',
    'single index',
    'bulk indexes',
  ] as const)(
    'a concurrent newer pool row rolls back Cloud writes but not %s deletion',
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
      await expect(remove).resolves.toBeUndefined();
      const removedAccount =
        mode.endsWith('account') || mode.endsWith('accounts');
      expect(
        db.read<IDBWallet>(ELocalDBStoreNames.Wallet, 'hd-1')?.accounts,
      ).toEqual(removedAccount ? [] : records.map((record) => record.id));
      for (const record of records) {
        const localAccount = db.read(ELocalDBStoreNames.Account, record.id);
        const localIndex = db.read(
          ELocalDBStoreNames.IndexedAccount,
          record.indexedAccountId ?? '',
        );
        expect(localAccount).toEqual(removedAccount ? undefined : record);
        expect(Boolean(localIndex)).toBe(removedAccount);
      }
      expect(db.read(ELocalDBStoreNames.CloudSyncItem, last.id)).toEqual(newer);
      if (mode.startsWith('bulk')) {
        const retained = db.read<IDBCloudSyncItem>(
          ELocalDBStoreNames.CloudSyncItem,
          originals[0].id,
        );
        expect(retained).toMatchObject({
          isDeleted: true,
          serverUploaded: false,
        });
      }
      await jest.advanceTimersByTimeAsync(1000);
      if (mode.startsWith('bulk')) {
        expect(db.syncFlow).toHaveBeenCalledTimes(1);
      } else {
        expect(db.syncFlow).not.toHaveBeenCalled();
      }
    },
  );

  test('a newer already-present Cloud version is not attempted while the local batch is deleted', async () => {
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
    const deletionTime = 1_750_000_000_123;
    jest.setSystemTime(deletionTime);
    const dataTime = jest.fn(async () => deletionTime);
    db.backgroundApi.servicePrimeCloudSync.getCloudSyncDataTime = dataTime;
    db.syncFlow.mockRejectedValueOnce(new OneKeyLocalError('Fixture offline'));
    await expect(
      db.removeAccountsByIds({ ids: records.map((record) => record.id) }),
    ).resolves.toBeUndefined();
    expect(db.syncPoolWriteAttempts).toEqual([originals[0].id]);
    expect(
      db.read(ELocalDBStoreNames.CloudSyncItem, originals[0].id),
    ).toMatchObject({
      dataTime: deletionTime,
      isDeleted: true,
      serverUploaded: false,
    });
    expect(dataTime).toHaveBeenCalledTimes(1);
    expect(db.read(ELocalDBStoreNames.CloudSyncItem, last.id)).toEqual(newer);
    for (const record of records) {
      expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();
      expect(
        db.read(
          ELocalDBStoreNames.IndexedAccount,
          record.indexedAccountId ?? '',
        ),
      ).toBeDefined();
    }
    expect(
      db.read<IDBWallet>(ELocalDBStoreNames.Wallet, 'hd-1')?.accounts,
    ).toEqual([]);
    await jest.advanceTimersByTimeAsync(1000);
    expect(db.syncFlow).toHaveBeenCalledTimes(1);
  });

  test.each(['account', 'index', 'batch'] as const)(
    'allows %s deletion and preserves an unreadable matching Cloud version and timestamp',
    async (mode) => {
      const db = new DeletionTestDb();
      const record = account();
      db.put(
        ELocalDBStoreNames.Wallet,
        wallet('hd-1', { xfp: PUBLIC_ACCOUNT_TEST_XFP, accounts: [record.id] }),
      );
      db.addAccount(record);
      const manager = attachRealSnapshotManager(db);
      const item = await manager.buildSyncItemByDBQuery({
        dbRecord: record,
        isDeleted: false,
        dataTime: undefined,
        syncCredential: realManagerFixtureCredential,
      });
      if (!item) throw new OneKeyLocalError('Missing real manager fixture');
      const original = { ...item, serverUploaded: true };
      db.put(ELocalDBStoreNames.CloudSyncItem, original);
      const prime = db.backgroundApi.servicePrimeCloudSync;
      const removalTime = 1_750_000_001_000;
      const decrypt = jest
        .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
        .mockRejectedValueOnce(new IncorrectMasterPassword());
      prime.getCloudSyncDataTime = async () => removalTime;
      if (mode === 'account')
        await db.removeAccount({ accountId: record.id, walletId: 'hd-1' });
      else if (mode === 'batch')
        await db.removeAccountsByIds({ ids: [record.id] });
      else
        await db.removeIndexedAccount({
          indexedAccountId: record.indexedAccountId ?? '',
          walletId: 'hd-1',
        });

      decrypt.mockRestore();
      const pending = {
        ...original,
        pendingPublicAccountDeletionAt: removalTime,
        pendingPublicAccountDeletionHash:
          expect.stringMatching(/^[\da-f]{64}$/),
      };
      expect(db.read(ELocalDBStoreNames.CloudSyncItem, original.id)).toEqual(
        pending,
      );
      if (mode === 'index')
        expect(
          db.read(
            ELocalDBStoreNames.IndexedAccount,
            record.indexedAccountId ?? '',
          ),
        ).toBeUndefined();
      else
        expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();

      await db.addAndUpdateSyncItems({
        items: [
          {
            ...original,
            dataTime: removalTime + 1000,
            pwdHash: 'different-cloud-space',
          },
        ],
        skipUploadToServer: true,
      });
      expect(db.read(ELocalDBStoreNames.CloudSyncItem, original.id)).toEqual(
        pending,
      );
    },
  );

  test.each(['remote', 'explicit'] as const)(
    'a newer %s re-add wins without the pending deletion being replayed',
    async (mode) => {
      const db = new DeletionTestDb();
      const record = account();
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
      db.put(ELocalDBStoreNames.CloudSyncItem, original);
      const prime = db.backgroundApi.servicePrimeCloudSync;
      const deletedAt = 1_750_000_001_000;
      prime.getCloudSyncDataTime = async () => deletedAt;
      const decrypt = jest
        .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
        .mockRejectedValueOnce(new IncorrectMasterPassword());
      await db.removeAccount({ accountId: record.id, walletId: 'hd-1' });
      decrypt.mockRestore();
      const pending = db.read<IDBCloudSyncItem>(
        ELocalDBStoreNames.CloudSyncItem,
        original.id,
      );
      if (!pending) throw new OneKeyLocalError('Missing queued deletion');
      expect(pending.pendingPublicAccountDeletionAt).toBe(deletedAt);
      const tombstone = rememberPublicAccountSnapshotWrite(
        {
          ...pending,
          dataTime: deletedAt,
          isDeleted: true,
          pendingPublicAccountDeletionAt: undefined,
          pendingPublicAccountDeletionHash: undefined,
        },
        pending,
      );

      if (mode === 'explicit') {
        prime.getCloudSyncDataTime = async () => deletedAt + 1000;
        const restored = await withPublicAccountCreationContext(
          (creationContext) =>
            manager.buildSyncItemForExplicitAccountCreation({
              target: {
                account: record,
                dataType: EPrimeCloudSyncDataType.Account,
                targetId: record.id,
              },
              syncCredential: realManagerFixtureCredential,
              creationContext,
            }),
        );
        if (!restored)
          throw new OneKeyLocalError('Missing explicit restore fixture');
        await db.addAndUpdateSyncItems({
          items: [restored.item],
          skipUploadToServer: true,
        });
        await db.addAndUpdateSyncItems({
          items: [tombstone],
          skipUploadToServer: true,
        });
      } else {
        await db.addAndUpdateSyncItems({
          items: [tombstone],
          skipUploadToServer: true,
        });
        await db.addAndUpdateSyncItems({
          items: [{ ...original, serverUploaded: true }],
          skipUploadToServer: true,
        });
        expect(
          db.read<IDBCloudSyncItem>(
            ELocalDBStoreNames.CloudSyncItem,
            original.id,
          )?.isDeleted,
        ).toBe(true);
        await db.addAndUpdateSyncItems({
          items: [
            { ...original, serverUploaded: true, dataTime: deletedAt + 1000 },
          ],
          skipUploadToServer: true,
        });
      }

      expect(
        db.read(ELocalDBStoreNames.CloudSyncItem, original.id),
      ).toMatchObject({
        dataTime: deletedAt + 1000,
        isDeleted: false,
        pendingPublicAccountDeletionAt: undefined,
      });
    },
  );

  test('cancels a queued local-only snapshot without creating a cross-space deletion', async () => {
    const db = new DeletionTestDb();
    const record = account();
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
      syncCredential: undefined,
    });
    if (!original) throw new OneKeyLocalError('Missing real manager fixture');
    db.put(ELocalDBStoreNames.CloudSyncItem, original);
    db.backgroundApi.serviceKeylessCloudSync.getLocalMutationSyncCredential =
      async () => undefined;
    await db.removeAccount({ accountId: record.id, walletId: 'hd-1' });
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();
    expect(
      db.read(ELocalDBStoreNames.CloudSyncItem, original.id),
    ).toBeUndefined();
  });

  test('local removal preserves the encrypted future-format Cloud row', async () => {
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
    ).resolves.toBeUndefined();
    expect(db.read(ELocalDBStoreNames.CloudSyncItem, future.id)).toEqual(
      future,
    );
    expect(db.read(ELocalDBStoreNames.Account, record.id)).toBeUndefined();
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

  test.each([
    'local live cache',
    'local tombstone',
    'desktop active settled',
    'desktop foreign settled',
    'web encrypted',
    'concurrently replaced',
    'empty raw key',
    'wrong raw key',
    'unsupported vendor',
    'another live HD identity',
  ] as const)(
    'keeps wallet cleanup separate and scope-safe: %s',
    async (mode) => {
      const db = new DeletionTestDb();
      const desktop = mode.startsWith('desktop');
      const encrypted = desktop || mode === 'web encrypted';
      const walletId = mode === 'unsupported vendor' ? 'hw-1' : 'hd-1';
      let id = `legacy:${walletId}`;
      const scope =
        mode === 'desktop foreign settled'
          ? 'foreign-scope'
          : (realManagerFixtureCredential.keylessCredential?.pwdHash ?? '');
      const candidate: IDBCloudSyncItem = {
        id,
        dataType: EPrimeCloudSyncDataType.Wallet,
        rawData: encrypted ? undefined : 'local display metadata',
        rawKey:
          mode === 'wrong raw key'
            ? 'Wallet >> other'
            : 'Wallet >> wallet-fixture-key',
        data: encrypted ? 'synthetic-encrypted-copy' : undefined,
        dataTime: 3,
        isDeleted: mode === 'local tombstone',
        pwdHash: encrypted ? scope : '',
        localSceneUpdated: true,
        serverUploaded: encrypted,
      };
      const updated = { ...candidate, dataTime: 4, rawData: 'newer' };
      if (mode === 'empty raw key') {
        candidate.rawKey = 'Wallet >> ';
        // An empty derived key can collide with unrelated unsupported wallets.
        const manager =
          db.backgroundApi.servicePrimeCloudSync.syncManagers.wallet;
        const original = manager.buildSyncKeyInfo.bind(manager);
        jest
          .spyOn(manager, 'buildSyncKeyInfo')
          .mockImplementation(async (params) => {
            const key = await original(params);
            return key && { ...key, rawKey: 'Wallet >> ' };
          });
      }
      if (mode === 'unsupported vendor') {
        const device = {
          id: 'fixture-device',
          vendor: EHardwareVendor.ledger,
        } as IDBDevice;
        db.put(ELocalDBStoreNames.Device, device);
        const manager = new CloudSyncFlowManagerWallet({
          backgroundApi: { ...db.backgroundApi, localDb: db } as IBackgroundApi,
        });
        db.backgroundApi.servicePrimeCloudSync.syncManagers.wallet = manager;
        id = manager.rawKeyToHashKey('Wallet >> ');
        candidate.id = id;
        candidate.rawKey = 'Wallet >> ';
        db.put(
          ELocalDBStoreNames.Wallet,
          wallet(walletId, { associatedDevice: device.id }),
        );
      } else {
        db.put(
          ELocalDBStoreNames.Wallet,
          wallet(walletId, {
            hash: 'shared-wallet-hash',
          }),
        );
        if (mode === 'another live HD identity') {
          db.put(
            ELocalDBStoreNames.Wallet,
            wallet('hd-peer', {
              hash: 'shared-wallet-hash',
            }),
          );
        }
      }
      db.put(ELocalDBStoreNames.CloudSyncItem, candidate);
      db.backgroundApi.serviceKeylessCloudSync.getLocalMutationSyncCredential =
        async () => realManagerFixtureCredential;
      const savedDesktop = platformEnv.isDesktop;
      const savedMas = platformEnv.isMas;
      const savedDev = platformEnv.isDev;
      platformEnv.isDesktop = desktop;
      platformEnv.isMas = false;
      platformEnv.isDev = false;
      let attempts = 0;
      db.beforeTransaction = () => {
        attempts += 1;
        if (attempts === 2 && mode === 'concurrently replaced') {
          db.put(ELocalDBStoreNames.CloudSyncItem, updated);
        }
      };
      try {
        await db.removeWallet({ walletId });
        expect(db.read(ELocalDBStoreNames.Wallet, walletId)).toBeUndefined();
        await jest.advanceTimersByTimeAsync(0);
        const fromPool = db.read(ELocalDBStoreNames.CloudSyncItem, id);
        if (mode === 'local live cache') {
          expect(fromPool).toBeUndefined();
        } else {
          expect(fromPool).toEqual(
            mode === 'concurrently replaced' ? updated : candidate,
          );
        }
      } finally {
        platformEnv.isDesktop = savedDesktop;
        platformEnv.isMas = savedMas;
        platformEnv.isDev = savedDev;
      }
    },
  );

  test.each(['hw', 'qr'] as const)(
    'preserves the cache for another live %s wallet using the real same key',
    async (type) => {
      const db = new DeletionTestDb();
      const manager = new CloudSyncFlowManagerWallet({
        backgroundApi: { ...db.backgroundApi, localDb: db } as IBackgroundApi,
      });
      db.backgroundApi.servicePrimeCloudSync.syncManagers.wallet = manager;
      const old = wallet(`${type}-1`, {
        type,
        associatedDevice: 'local-device-a',
      });
      const peer = wallet(`${type}-2`, {
        type,
        associatedDevice: 'local-device-b',
      });
      const device = {
        id: 'local-device-a',
        deviceId: 'same-physical-device-id',
        vendor: EHardwareVendor.onekey,
      } as IDBDevice;
      const peerDevice = { ...device, id: 'local-device-b' };
      db.put(ELocalDBStoreNames.Wallet, old);
      db.put(ELocalDBStoreNames.Wallet, peer);
      db.put(ELocalDBStoreNames.Device, device);
      db.put(ELocalDBStoreNames.Device, peerDevice);
      const target = await manager.buildSyncTargetByDBQuery({
        dbRecord: old,
        allDevices: [device],
      });
      const key = await manager.buildSyncKeyInfo({ target });
      if (!key)
        throw new OneKeyLocalError('Missing real hardware cleanup key fixture');
      const cached: IDBCloudSyncItem = {
        id: key.key,
        rawKey: key.rawKey,
        rawData: 'hardware-cache-fixture',
        dataType: EPrimeCloudSyncDataType.Wallet,
        pwdHash: '',
        data: undefined,
        dataTime: 1,
        isDeleted: false,
        localSceneUpdated: true,
        serverUploaded: false,
      };
      db.put(ELocalDBStoreNames.CloudSyncItem, cached);
      const actual = await manager.buildSyncKeyInfo({
        target: await manager.buildSyncTargetByDBQuery({
          dbRecord: peer,
          allDevices: [peerDevice],
        }),
      });
      expect(actual?.rawKey).toBe(key.rawKey);

      await db.removeWallet({ walletId: old.id });
      await jest.advanceTimersByTimeAsync(0);
      expect(db.read(ELocalDBStoreNames.Wallet, old.id)).toBeUndefined();
      expect(db.read(ELocalDBStoreNames.Wallet, peer.id)).toEqual(peer);
      expect(db.read(ELocalDBStoreNames.CloudSyncItem, key.key)).toEqual(
        cached,
      );
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
