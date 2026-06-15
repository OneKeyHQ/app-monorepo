import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  EIndexedDBBucketNames,
  IDBDevice,
  IDBWallet,
  ILocalDBGetRecordsByIdsParams,
  ILocalDBGetRecordsByIdsResult,
  ILocalDBRecord,
  ILocalDBRecordUpdater,
  ILocalDBTransaction,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetRecordByIdParams,
  ILocalDBTxGetRecordByIdResult,
  ILocalDBTxGetRecordsByIdsParams,
  ILocalDBTxGetRecordsByIdsResult,
} from './types';

class IndexedAccountTestLocalDb extends LocalDbBase {
  override readyDb = Promise.resolve(this as any);

  wallet: IDBWallet = {
    id: 'hd-1',
    name: 'wallet 1',
    type: 'hd',
    backuped: true,
    nextIds: { accountHdIndex: 0 },
    accounts: [],
    walletNo: 1,
  };

  indexedAccountIds = new Set<string>();

  buildSyncItemsCalls: Array<{ tx: unknown; targetIds: string[] }> = [];

  buildDuringTransactionCount = 0;

  insideTransaction = false;

  beforeTransactionHook: (() => void) | undefined;

  txSyncFlowCalls: Array<{
    newSyncItemIds: string[];
    existingSyncItemIds: string[];
  }> = [];

  constructor() {
    super();

    this.setBackgroundApi({
      servicePrimeCloudSync: {
        syncManagers: {
          indexedAccount: {
            buildExistingSyncItemsInfo: jest.fn(
              async ({
                tx,
                targets,
              }: {
                tx: unknown;
                targets: Array<{ targetId: string }>;
              }) => {
                if (this.insideTransaction) {
                  this.buildDuringTransactionCount += 1;
                }
                this.buildSyncItemsCalls.push({
                  tx,
                  targetIds: targets.map((t) => t.targetId),
                });
                return {
                  existingSyncItemsInfo: {},
                  existingSyncItems: [],
                  // sync item id is the deterministic key for the target
                  newSyncItems: targets.map((t) => ({
                    id: `sync-key-${t.targetId}`,
                  })),
                };
              },
            ),
            buildSyncKeyInfo: jest.fn(
              async ({ target }: { target: { targetId: string } }) => ({
                key: `sync-key-${target.targetId}`,
              }),
            ),
            txWithSyncFlowOfDBRecordCreating: jest.fn(
              async ({
                runDbTxFn,
                newSyncItems,
                existingSyncItems,
              }: {
                runDbTxFn: () => Promise<void>;
                newSyncItems: Array<{ id: string }>;
                existingSyncItems: Array<{ id: string }>;
              }) => {
                this.txSyncFlowCalls.push({
                  newSyncItemIds: newSyncItems.map((i) => i.id),
                  existingSyncItemIds: existingSyncItems.map((i) => i.id),
                });
                return runDbTxFn();
              },
            ),
          },
        },
      },
    } as any);
  }

  override async reset(): Promise<void> {
    return undefined;
  }

  override async withTransaction<T>(
    _bucketName: EIndexedDBBucketNames,
    task: (tx: any) => Promise<T>,
  ): Promise<T> {
    this.beforeTransactionHook?.();
    this.insideTransaction = true;
    try {
      return await task({});
    } finally {
      this.insideTransaction = false;
    }
  }

  override async getWallet(): Promise<IDBWallet> {
    return { ...this.wallet };
  }

  override async txGetWallet(): Promise<[IDBWallet, null]> {
    return [{ ...this.wallet }, null];
  }

  override async getRecordsByIds<T extends ELocalDBStoreNames>({
    ids,
  }: ILocalDBGetRecordsByIdsParams<T>): Promise<
    ILocalDBGetRecordsByIdsResult<T>
  > {
    return {
      records: ids.map((id) =>
        this.indexedAccountIds.has(id)
          ? ({ id } as ILocalDBRecord<T>)
          : undefined,
      ),
    };
  }

  override async txGetRecordsByIds<T extends ELocalDBStoreNames>({
    ids,
  }: ILocalDBTxGetRecordsByIdsParams<T>): Promise<
    ILocalDBTxGetRecordsByIdsResult<T>
  > {
    const records = ids.map((id) =>
      this.indexedAccountIds.has(id)
        ? ({ id } as ILocalDBRecord<T>)
        : undefined,
    );
    return {
      records,
      recordPairs: records.map((record) =>
        record ? ([record, null] as const) : undefined,
      ),
    };
  }

  override async txGetRecordById<T extends ELocalDBStoreNames>({
    id,
  }: ILocalDBTxGetRecordByIdParams<T>): Promise<
    ILocalDBTxGetRecordByIdResult<T>
  > {
    if (this.indexedAccountIds.has(id)) {
      return [{ id } as ILocalDBRecord<T>, null];
    }
    throw new OneKeyLocalError(`record not found: ${id}`);
  }

  override async txAddRecords<T extends ELocalDBStoreNames>({
    name,
    records,
  }: ILocalDBTxAddRecordsParams<T>): Promise<ILocalDBTxAddRecordsResult> {
    if (!this.insideTransaction) {
      throw new OneKeyLocalError('txAddRecords called outside of transaction');
    }
    if (name === ELocalDBStoreNames.IndexedAccount) {
      records.forEach((record) => this.indexedAccountIds.add(record.id));
    }
    return {
      added: records.length,
      addedIds: records.map((record) => record.id),
      skipped: 0,
    };
  }

  override async txUpdateWallet({
    updater,
  }: {
    tx: ILocalDBTransaction;
    walletId: string;
    updater: ILocalDBRecordUpdater<ELocalDBStoreNames.Wallet>;
  }): Promise<void> {
    this.wallet = await updater(this.wallet);
  }

  override async getDeviceSafe(): Promise<IDBDevice | undefined> {
    return undefined;
  }
}

describe('LocalDbBase.addIndexedAccount', () => {
  it('builds cloud sync items before opening the transaction (OK-56267)', async () => {
    const db = new IndexedAccountTestLocalDb();

    await db.addIndexedAccount({
      walletId: 'hd-1',
      indexes: [0, 1],
      skipIfExists: true,
    });

    expect(db.buildSyncItemsCalls).toHaveLength(1);
    // sync items must be built with non-tx reads, outside of the transaction
    expect(db.buildSyncItemsCalls[0].tx).toBeUndefined();
    expect(db.buildDuringTransactionCount).toBe(0);
    expect(db.buildSyncItemsCalls[0].targetIds).toEqual(['hd-1--0', 'hd-1--1']);
    expect(db.indexedAccountIds.has('hd-1--0')).toBe(true);
    expect(db.indexedAccountIds.has('hd-1--1')).toBe(true);
  });

  it('skips existing indexed accounts when skipIfExists is set', async () => {
    const db = new IndexedAccountTestLocalDb();
    db.indexedAccountIds.add('hd-1--0');

    await db.addIndexedAccount({
      walletId: 'hd-1',
      indexes: [0, 1],
      skipIfExists: true,
    });

    expect(db.buildSyncItemsCalls).toHaveLength(1);
    expect(db.buildSyncItemsCalls[0].targetIds).toEqual(['hd-1--1']);
    expect(db.indexedAccountIds.has('hd-1--1')).toBe(true);
  });

  it('drops sync items for accounts removed by the in-tx recheck (OK-56267)', async () => {
    const db = new IndexedAccountTestLocalDb();
    // both indexes are free at prepare time; a concurrent flow creates index 0
    // between prepare and the in-tx recheck
    db.beforeTransactionHook = () => {
      db.indexedAccountIds.add('hd-1--0');
    };

    await db.addIndexedAccount({
      walletId: 'hd-1',
      indexes: [0, 1],
      skipIfExists: true,
    });

    // only index 1 is actually created by this transaction
    expect(db.indexedAccountIds.has('hd-1--1')).toBe(true);
    expect(db.txSyncFlowCalls).toHaveLength(1);
    // the pre-built sync item for the concurrently-created index 0 must not be
    // written/uploaded by this tx, only the surviving index 1 remains
    expect(db.txSyncFlowCalls[0].newSyncItemIds).toEqual(['sync-key-hd-1--1']);
  });
});

describe('LocalDbBase.addHDNextIndexedAccount', () => {
  it('creates the next free indexed account with pre-built sync items', async () => {
    const db = new IndexedAccountTestLocalDb();
    db.indexedAccountIds.add('hd-1--0');

    const { indexedAccountId } = await db.addHDNextIndexedAccount({
      walletId: 'hd-1',
    });

    expect(indexedAccountId).toBe('hd-1--1');
    expect(db.buildDuringTransactionCount).toBe(0);
    expect(db.wallet.nextIds.accountHdIndex).toBe(2);
  });

  it('re-prepares when a concurrent creation takes the index', async () => {
    const db = new IndexedAccountTestLocalDb();
    let isFirstTransaction = true;
    db.beforeTransactionHook = () => {
      if (isFirstTransaction) {
        isFirstTransaction = false;
        // simulate a concurrent flow creating the same index before the tx
        db.indexedAccountIds.add('hd-1--0');
      }
    };

    const { indexedAccountId } = await db.addHDNextIndexedAccount({
      walletId: 'hd-1',
    });

    expect(indexedAccountId).toBe('hd-1--1');
    // first prepare targeted index 0, the retry re-prepared for index 1
    expect(db.buildSyncItemsCalls.map((c) => c.targetIds)).toEqual([
      ['hd-1--0'],
      ['hd-1--1'],
    ]);
    expect(db.buildDuringTransactionCount).toBe(0);
    expect(db.wallet.nextIds.accountHdIndex).toBe(2);
  });
});
