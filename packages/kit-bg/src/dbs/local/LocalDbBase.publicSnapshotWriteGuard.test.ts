import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  isRejectedPublicAccountSnapshotWrite,
  rememberPublicAccountSnapshotWrite,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshotWriteGuard';

import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  IDBCloudSyncItem,
  ILocalDBRecord,
  ILocalDBTransaction,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetRecordsByIdsParams,
  ILocalDBTxGetRecordsByIdsResult,
  ILocalDBTxUpdateRecordsParams,
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function item(id = 'synthetic-public-account-hash'): IDBCloudSyncItem {
  return {
    id,
    dataType: EPrimeCloudSyncDataType.Account,
    rawKey: 'account >> cloud-public-account:v1:synthetic',
    rawData: undefined,
    data: 'test-ciphertext-v1',
    dataTime: 1,
    pwdHash: 'test-pwd-hash',
    isDeleted: false,
    localSceneUpdated: false,
    serverUploaded: false,
  };
}

class SnapshotWriteTestDb extends LocalDbBase {
  override readyDb = Promise.resolve(this);

  records = new Map<string, IDBCloudSyncItem>();

  writes = 0;

  reads = 0;

  apiUploadItems = jest.fn(
    async (_params: { localItems: IDBCloudSyncItem[] }) => undefined,
  );

  constructor() {
    super();
    this.setBackgroundApi({
      servicePrimeCloudSync: { apiUploadItems: this.apiUploadItems },
    } as unknown as IBackgroundApi);
  }

  override async reset() {}

  override async txGetRecordsByIds<T extends ELocalDBStoreNames>({
    name,
    ids,
  }: ILocalDBTxGetRecordsByIdsParams<T>): Promise<
    ILocalDBTxGetRecordsByIdsResult<T>
  > {
    if (name !== ELocalDBStoreNames.CloudSyncItem)
      throw new OneKeyLocalError('Unexpected test store');
    this.reads += 1;
    const records = ids.map(
      (id) => this.records.get(id) as ILocalDBRecord<T> | undefined,
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
    if (name !== ELocalDBStoreNames.CloudSyncItem)
      throw new OneKeyLocalError('Unexpected test store');
    this.writes += 1;
    const addedIds: string[] = [];
    for (const record of records) {
      if (!this.records.has(record.id)) {
        this.records.set(record.id, { ...record } as IDBCloudSyncItem);
        addedIds.push(record.id);
      }
    }
    return {
      added: addedIds.length,
      addedIds,
      skipped: records.length - addedIds.length,
    };
  }

  override async txUpdateRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
    updater,
  }: ILocalDBTxUpdateRecordsParams<T>): Promise<void> {
    if (name !== ELocalDBStoreNames.CloudSyncItem)
      throw new OneKeyLocalError('Unexpected test store');
    this.writes += 1;
    for (const id of ids) {
      const record = this.records.get(id);
      if (record) {
        const updated = await updater({ ...record } as ILocalDBRecord<T>);
        this.records.set(id, updated as IDBCloudSyncItem);
      }
    }
  }

  async run(items: IDBCloudSyncItem[]) {
    return this.txAddAndUpdateSyncItems({
      tx: {} as ILocalDBTransaction,
      items,
    });
  }
}

describe('LocalDbBase public snapshot optimistic write', () => {
  it.each([
    { data: 'test-ciphertext-future', dataTime: 2 },
    { isDeleted: true, dataTime: 2 },
  ])(
    'does not write or echo a v1 candidate after a different record arrives: %j',
    async (change) => {
      const db = new SnapshotWriteTestDb();
      const previous = item();
      const update = rememberPublicAccountSnapshotWrite(
        { ...previous, data: 'new-v1-test-ciphertext', dataTime: 3 },
        previous,
      );
      const current = { ...previous, ...change };
      db.records.set(current.id, current);
      await db.run([update]);
      expect(db.records.get(current.id)).toEqual(current);
      expect(db.writes).toBe(0);
      expect(db.apiUploadItems).not.toHaveBeenCalled();
      expect(isRejectedPublicAccountSnapshotWrite(update)).toBe(true);
    },
  );

  it('does not create over a future record that arrived after the initial scan', async () => {
    const db = new SnapshotWriteTestDb();
    const update = rememberPublicAccountSnapshotWrite({
      ...item(),
      dataTime: 3,
    });
    db.records.set(update.id, {
      ...item(),
      data: 'test-ciphertext-future',
      dataTime: 2,
    });
    await db.run([update]);
    expect(db.writes).toBe(0);
    expect(db.apiUploadItems).not.toHaveBeenCalled();
    expect(isRejectedPublicAccountSnapshotWrite(update)).toBe(true);
  });

  it('writes and uploads a candidate when its captured previous version is unchanged', async () => {
    const db = new SnapshotWriteTestDb();
    const previous = item();
    const update = rememberPublicAccountSnapshotWrite(
      { ...item(), data: 'new-v1-test-ciphertext', dataTime: 3 },
      previous,
    );
    db.records.set(previous.id, {
      ...previous,
      serverUploaded: true,
      localSceneUpdated: true,
    });
    await db.run([update]);
    expect(db.records.get(update.id)?.data).toBe(update.data);
    expect(db.apiUploadItems).toHaveBeenCalledWith({ localItems: [update] });
    expect(isRejectedPublicAccountSnapshotWrite(update)).toBe(false);
  });

  it('filters only the rejected sources from mixed DB writes and upload arguments', async () => {
    const db = new SnapshotWriteTestDb();
    const rejected = rememberPublicAccountSnapshotWrite({
      ...item(),
      dataTime: 3,
    });
    const serverDownload = {
      ...item('other-server-item'),
      data: 'server-download',
      dataTime: 4,
    };
    db.records.set(rejected.id, { ...item(), isDeleted: true, dataTime: 2 });
    await db.run([rejected, serverDownload]);
    expect(db.records.get(rejected.id)?.isDeleted).toBe(true);
    expect(db.records.get(serverDownload.id)?.data).toBe('server-download');
    expect(db.apiUploadItems).toHaveBeenCalledWith({
      localItems: [serverDownload],
    });
    // Caller-owned arrays retain object identity for the outer echo filter.
    expect(
      [rejected, serverDownload].filter(
        (source) => !isRejectedPublicAccountSnapshotWrite(source),
      ),
    ).toEqual([serverDownload]);
  });

  it('leaves unguarded server updates on the existing last-writer-wins path', async () => {
    const db = new SnapshotWriteTestDb();
    db.records.set(item().id, item());
    const update = { ...item(), data: 'server-future-schema', dataTime: 4 };
    await db.run([update]);
    expect(db.reads).toBe(0);
    expect(db.records.get(update.id)?.data).toBe('server-future-schema');
  });
});
