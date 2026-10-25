import { createHash } from 'crypto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { withPublicAccountCreationContext } from '../../services/ServicePrimeCloudSync/publicAccountCreationContext';
import { rememberPublicAccountSnapshotWrite } from '../../services/ServicePrimeCloudSync/publicAccountSnapshotWriteGuard';

import { EDBAccountType } from './consts';
import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  EIndexedDBBucketNames,
  IDBAccount,
  IDBBaseObject,
  IDBCloudSyncItem,
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
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const XFP = `12345678--xpub${'A'.repeat(107)}`;
const WALLET: IDBWallet = {
  id: 'hd-1',
  type: 'hd',
  name: 'Local wallet',
  xfp: XFP,
  accounts: [],
  nextIds: {},
  walletNo: 1,
  backuped: true,
};

function account(index = 0): IDBAccount {
  return {
    id: `hd-1--m/44'/60'/0'/0/${index}`,
    indexedAccountId: `hd-1--${index}`,
    name: 'Cloud name',
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

class PublicAccountTestDb extends LocalDbBase {
  override readyDb = Promise.resolve(this);

  stores = new Map<ELocalDBStoreNames, Map<string, IDBBaseObject>>();

  writes: ELocalDBStoreNames[] = [];

  beforeTransaction?: () => void;

  afterWrite?: () => void;

  constructor() {
    super();
    this.put(ELocalDBStoreNames.Wallet, { ...WALLET });
    this.put(ELocalDBStoreNames.Credential, {
      id: WALLET.id,
      credential: 'encrypted-local-test-credential',
    });
  }

  put<T extends IDBBaseObject>(name: ELocalDBStoreNames, record: T) {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    store.set(record.id, record);
  }

  override async reset() {}

  override async getWallet({ walletId }: { walletId: string }) {
    const value = this.stores.get(ELocalDBStoreNames.Wallet)?.get(walletId) as
      | IDBWallet
      | undefined;
    if (!value) throw new OneKeyLocalError('Missing test wallet');
    return { ...value };
  }

  override async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    return this.txGetRecordsByIds({ ...params, tx: {} as ILocalDBTransaction });
  }

  override async withTransaction<T>(
    _bucket: EIndexedDBBucketNames,
    fn: (tx: ILocalDBTransaction) => Promise<T>,
  ): Promise<T> {
    this.beforeTransaction?.();
    const original = new Map(
      Array.from(this.stores, ([name, records]) => [name, new Map(records)]),
    );
    try {
      return await fn({} as ILocalDBTransaction);
    } catch (error) {
      this.stores = original;
      throw error;
    }
  }

  override async txGetRecordsByIds<T extends ELocalDBStoreNames>({
    name,
    ids,
  }: ILocalDBTxGetRecordsByIdsParams<T>): Promise<
    ILocalDBTxGetRecordsByIdsResult<T>
  > {
    const records = ids.map(
      (id) => this.stores.get(name)?.get(id) as ILocalDBRecord<T> | undefined,
    );
    return {
      records,
      recordPairs: records.map((record) =>
        record ? [record, null] : undefined,
      ),
    };
  }

  override async txAddRecords<T extends ELocalDBStoreNames>({
    name,
    records,
  }: ILocalDBTxAddRecordsParams<T>): Promise<ILocalDBTxAddRecordsResult> {
    this.writes.push(name);
    const addedIds: string[] = [];
    for (const record of records) {
      if (!this.stores.get(name)?.has(record.id)) {
        this.put(name, { ...record });
        addedIds.push(record.id);
      }
    }
    this.afterWrite?.();
    return {
      added: addedIds.length,
      addedIds,
      skipped: records.length - addedIds.length,
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

  override async txRemoveRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
  }: ILocalDBTxRemoveRecordsParams<T>) {
    this.writes.push(name);
    for (const id of ids) this.stores.get(name)?.delete(id);
    this.afterWrite?.();
  }

  override async txUpdateRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
    updater,
  }: ILocalDBTxUpdateRecordsParams<T>) {
    for (const id of ids) {
      const current = this.stores.get(name)?.get(id) as
        | ILocalDBRecord<T>
        | undefined;
      if (current) this.put(name, await updater({ ...current }));
    }
  }

  override async buildIndexedAccountIdHash() {
    return 'public-test-avatar-hash';
  }

  run(accounts: IDBAccount[], isCurrent = () => true) {
    return this.importPublicCloudAccounts({
      walletId: WALLET.id,
      expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
      expectedCredential: 'encrypted-local-test-credential',
      accounts,
      isCurrent,
    });
  }

  prepareSources(accounts: IDBAccount[], isDeleted = true, dataTime = 2) {
    const sources = new Map<string, IDBCloudSyncItem>();
    for (const value of accounts) {
      const source: IDBCloudSyncItem = {
        id: `source:${value.id}`,
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey: '',
        rawData: '',
        data: `public-test-source-${dataTime}`,
        dataTime,
        isDeleted,
        pwdHash: 'public-test-cloud',
        localSceneUpdated: false,
        serverUploaded: true,
      };
      sources.set(value.id, source);
      this.put(ELocalDBStoreNames.CloudSyncItem, { ...source });
    }
    return sources;
  }

  delete(
    accounts: IDBAccount[],
    sourceItemsByAccountId = this.prepareSources(accounts),
    isCurrent = () => true,
  ) {
    return this.deletePublicCloudAccounts({
      walletId: WALLET.id,
      expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
      expectedCredential: 'encrypted-local-test-credential',
      accounts,
      sourceItemsByAccountId,
      isCurrent,
    });
  }
}

describe('LocalDbBase.importPublicCloudAccounts', () => {
  it.each([
    { firstEvmAddress: '0x111', index: 3, expected: '0x111--3' },
    { firstEvmAddress: undefined, index: 3, expected: 'hd-1--3' },
  ])(
    'keeps the existing index hash while using a transaction-safe backend %j',
    async ({ firstEvmAddress, index, expected }) => {
      const db = new PublicAccountTestDb();
      const params = { firstEvmAddress, index, indexedAccountId: 'hd-1--3' };
      const legacy = await LocalDbBase.prototype.buildIndexedAccountIdHash.call(
        db,
        params,
      );
      const synchronous =
        await LocalDbBase.prototype.buildIndexedAccountIdHash.call(db, {
          ...params,
          useSynchronousHash: true,
        });
      expect(synchronous).toBe(legacy);
      expect(synchronous).toBe(
        createHash('sha256').update(expected).digest('hex').slice(-42),
      );
    },
  );
  it('inserts missing account and index together without Cloud hooks or events', async () => {
    const db = new PublicAccountTestDb();
    expect(await db.run([account()])).toMatchObject({
      added: 1,
      conflicts: 0,
      pending: 0,
    });
    expect(db.writes).toEqual([
      ELocalDBStoreNames.IndexedAccount,
      ELocalDBStoreNames.Account,
    ]);
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
    ).toMatchObject({ walletId: 'hd-1', index: 0 });
  });

  it('is idempotent and keeps the local name', async () => {
    const db = new PublicAccountTestDb();
    db.put(ELocalDBStoreNames.Account, {
      ...account(),
      name: 'Keep local name',
    });
    expect(await db.run([account()])).toMatchObject({ added: 0, unchanged: 1 });
    expect(db.writes).toEqual([]);
    expect(
      db.stores.get(ELocalDBStoreNames.Account)?.get(account().id),
    ).toMatchObject({ name: 'Keep local name' });
  });

  it('does not overwrite same-path address conflicts', async () => {
    const db = new PublicAccountTestDb();
    const existing = {
      ...account(),
      address: '0x2222222222222222222222222222222222222222',
    };
    db.put(ELocalDBStoreNames.Account, existing);
    expect(await db.run([account()])).toMatchObject({ added: 0, conflicts: 1 });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.get(existing.id)).toEqual(
      existing,
    );
    expect(db.writes).toEqual([]);
  });

  it.each(['wallet', 'credential', 'hidden'])(
    'rechecks %s inside the transaction',
    async (change) => {
      const db = new PublicAccountTestDb();
      db.beforeTransaction = () => {
        if (change === 'wallet')
          db.stores.get(ELocalDBStoreNames.Wallet)?.delete(WALLET.id);
        if (change === 'credential')
          db.put(ELocalDBStoreNames.Credential, {
            id: WALLET.id,
            credential: 'changed-test-credential',
          });
        if (change === 'hidden')
          db.put(ELocalDBStoreNames.Wallet, {
            ...WALLET,
            passphraseState: 'hidden-session',
          });
      };
      expect(await db.run([account()])).toMatchObject({ added: 0, pending: 1 });
      expect(db.writes).toEqual([]);
    },
  );

  it('rolls back both record types if the source changes during the transaction', async () => {
    const db = new PublicAccountTestDb();
    let current = true;
    db.afterWrite = () => {
      current = false;
    };
    expect(await db.run([account()], () => current)).toMatchObject({
      added: 0,
      cancelled: true,
    });
    expect(db.stores.get(ELocalDBStoreNames.IndexedAccount)?.size || 0).toBe(0);
    expect(db.stores.get(ELocalDBStoreNames.Account)?.size || 0).toBe(0);
  });

  it('rejects foreign account IDs without creating indexes', async () => {
    const db = new PublicAccountTestDb();
    expect(
      await db.run([{ ...account(), id: "hw-foreign--m/44'/60'/0'/0/0" }]),
    ).toMatchObject({ conflicts: 1, added: 0 });
    expect(db.writes).toEqual([]);
  });

  it('rejects all conflicting candidates for the same missing ID', async () => {
    const db = new PublicAccountTestDb();
    const different = {
      ...account(),
      address: '0x2222222222222222222222222222222222222222',
    };
    expect(await db.run([account(), different])).toMatchObject({
      added: 0,
      conflicts: 2,
      appliedAccountIds: [],
    });
    expect(db.writes).toEqual([]);
  });

  it('does not report rolled-back IDs after an earlier unchanged record', async () => {
    const db = new PublicAccountTestDb();
    db.put(ELocalDBStoreNames.Account, account());
    let current = true;
    db.afterWrite = () => {
      current = false;
    };
    expect(await db.run([account(), account(1)], () => current)).toMatchObject({
      cancelled: true,
      appliedAccountIds: [],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.size).toBe(1);
  });

  it('caps each transaction at 50 records', async () => {
    const db = new PublicAccountTestDb();
    await expect(
      db.run(Array.from({ length: 51 }, (_, index) => account(index))),
    ).rejects.toThrow(OneKeyLocalError);
    expect(db.writes).toEqual([]);
  });

  it('deletes the winning remote account and its unused index while preserving wallet and seed credential', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const beforeWallet = db.stores
      .get(ELocalDBStoreNames.Wallet)
      ?.get(WALLET.id);
    const beforeCredential = db.stores
      .get(ELocalDBStoreNames.Credential)
      ?.get(WALLET.id);
    expect(await db.delete([account()])).toMatchObject({
      deleted: 1,
      added: 0,
      appliedAccountIds: [account().id],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      false,
    );
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.has('hd-1--0'),
    ).toBe(false);
    expect(db.stores.get(ELocalDBStoreNames.Wallet)?.get(WALLET.id)).toBe(
      beforeWallet,
    );
    expect(db.stores.get(ELocalDBStoreNames.Credential)?.get(WALLET.id)).toBe(
      beforeCredential,
    );
  });

  it('retains a shared index and its name while another chain references it', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const sol = {
      ...account(),
      id: "hd-1--m/44'/501'/0'/0'",
      impl: 'sol',
      coinType: '501',
      path: "m/44'/501'/0'/0'",
      template: "m/44'/501'/$$INDEX$$'/0'",
      address: '11111111111111111111111111111111',
    };
    db.put(ELocalDBStoreNames.Account, sol);
    db.put(ELocalDBStoreNames.IndexedAccount, {
      id: 'hd-1--0',
      walletId: 'hd-1',
      index: 0,
      name: 'Keep shared name',
    });
    expect((await db.delete([account()])).deleted).toBe(1);
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
    ).toMatchObject({ name: 'Keep shared name' });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(sol.id)).toBe(true);
    expect((await db.delete([sol])).deleted).toBe(1);
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.has('hd-1--0'),
    ).toBe(false);
  });

  it('makes remote deletion idempotent and rejects same-path different-address data', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const changed = {
      ...account(),
      address: '0x2222222222222222222222222222222222222222',
    };
    expect(await db.delete([changed])).toMatchObject({
      conflicts: 1,
      deleted: 0,
    });
    expect(
      db.stores.get(ELocalDBStoreNames.Account)?.get(account().id),
    ).toEqual(account());
    const sources = db.prepareSources([account()]);
    expect((await db.delete([account()], sources)).deleted).toBe(1);
    expect(await db.delete([account()], sources)).toMatchObject({
      deleted: 0,
      unchanged: 1,
    });
  });

  it('rejects t1 copy or delete after the opposite t2 source has won the local pool', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const deletedAtT1 = db.prepareSources([account()], true, 1);
    db.prepareSources([account()], false, 2);
    expect(await db.delete([account()], deletedAtT1)).toMatchObject({
      pending: 1,
      deleted: 0,
      appliedAccountIds: [],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      true,
    );
    db.stores.get(ELocalDBStoreNames.Account)?.delete(account().id);
    const copyAtT1 = db.prepareSources([account()], false, 1);
    db.prepareSources([account()], true, 2);
    expect(
      await db.importPublicCloudAccounts({
        walletId: WALLET.id,
        expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
        expectedCredential: 'encrypted-local-test-credential',
        accounts: [account()],
        sourceItemsByAccountId: copyAtT1,
        isCurrent: () => true,
      }),
    ).toMatchObject({ added: 0, pending: 1 });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      false,
    );
  });

  it('rolls back account and index deletion when the source is cancelled', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const sources = db.prepareSources([account()]);
    let current = true;
    db.afterWrite = () => {
      current = false;
    };
    expect(await db.delete([account()], sources, () => current)).toMatchObject({
      cancelled: true,
      deleted: 0,
      appliedAccountIds: [],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      true,
    );
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.has('hd-1--0'),
    ).toBe(true);
  });

  it('restores historical names and indexes atomically through the trusted user creation write path', async () => {
    const db = new PublicAccountTestDb();
    const value = account(1);
    const source = db.prepareSources([value]).get(value.id);
    if (!source) throw new OneKeyLocalError('Missing test source');
    const restored = rememberPublicAccountSnapshotWrite(
      {
        ...source,
        isDeleted: false,
        dataTime: 3,
        data: 'fresh-public-test-ciphertext',
        serverUploaded: false,
      },
      source,
    );
    const buildExplicit = jest.fn(async () => ({
      item: restored,
      name: 'Historical custom name',
    }));
    db.setBackgroundApi({
      servicePrimeCloudSync: {
        syncManagers: {
          account: {
            getSyncCredential: async () => undefined,
            buildExistingSyncItemsInfo: async () => ({
              existingSyncItems: [source],
              newSyncItems: [],
              existingSyncItemsInfo: {},
            }),
            buildSyncItemForExplicitAccountCreation: buildExplicit,
            txWithSyncFlowOfDBRecordCreating: async ({
              tx,
              newSyncItems,
              runDbTxFn,
            }: {
              tx: ILocalDBTransaction;
              newSyncItems: IDBCloudSyncItem[];
              runDbTxFn: () => ReturnType<LocalDbBase['addAccountsToWallet']>;
            }) => {
              await db.txAddAndUpdateSyncItems({
                tx,
                items: newSyncItems,
                skipUploadToServer: true,
              });
              return runDbTxFn();
            },
          },
        },
      },
    } as unknown as IBackgroundApi);
    await withPublicAccountCreationContext(
      async (publicAccountCreationContext) => {
        await db.addAccountsToWallet({
          walletId: WALLET.id,
          accounts: [value],
          publicAccountCreationContext,
          skipEventEmit: true,
        });
      },
    );
    expect(
      db.stores.get(ELocalDBStoreNames.Account)?.get(value.id),
    ).toMatchObject({ name: 'Historical custom name' });
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--1'),
    ).toMatchObject({ name: 'Historical custom name' });
    expect(
      db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.get(source.id),
    ).toMatchObject({ isDeleted: false, dataTime: 3 });
    expect(buildExplicit).toHaveBeenCalledTimes(1);
  });
});
