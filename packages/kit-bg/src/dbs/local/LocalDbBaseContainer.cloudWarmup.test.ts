import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBWallet } from './types';

const WALLET: IDBWallet = {
  id: 'hd-local-warmup-test',
  name: 'Local wallet fixture',
  type: WALLET_TYPE_HD,
  backuped: true,
  accounts: [],
  nextIds: {},
  walletNo: 1,
};

afterEach(() => jest.restoreAllMocks());

function blockCloudWarmup() {
  const started = Promise.withResolvers<void>();
  const warmup = Promise.withResolvers<void>();
  const hydrate = jest.fn(() => {
    started.resolve();
    return warmup.promise;
  });
  jest.replaceProperty(appGlobals, '$backgroundApiProxy', {
    serviceKeylessCloudSync: {
      hydrateKeylessSyncCredentialFromStorageIfNeeded: hydrate,
    },
  } as unknown as typeof appGlobals.$backgroundApiProxy);
  return { started: started.promise, warmup, hydrate };
}

test('opted-in local writes and space-freeing deletes never enter Cloud warm-up', async () => {
  const db = new LocalDbIndexed();
  const { warmup, hydrate } = blockCloudWarmup();
  const bucket = EIndexedDBBucketNames.account;
  const name = ELocalDBStoreNames.Wallet;
  const options = { skipCloudCredentialWarmup: true };
  try {
    await db.withTransaction(
      bucket,
      async (tx) => {
        await db.txAddRecords({ tx, name, records: [WALLET] });
      },
      options,
    );
    expect(await db.getRecordById({ name, id: WALLET.id })).toMatchObject({
      name: WALLET.name,
    });

    const error = new OneKeyLocalError('test local commit failure');
    await expect(
      db.withSpaceFreeingTransaction(
        bucket,
        async (tx) => {
          await db.txRemoveRecords({ tx, name, ids: [WALLET.id] });
          throw error;
        },
        options,
      ),
    ).rejects.toBe(error);
    expect(await db.getRecordById({ name, id: WALLET.id })).toBeTruthy();

    await db.withSpaceFreeingTransaction(
      bucket,
      async (tx) => {
        await db.txRemoveRecords({ tx, name, ids: [WALLET.id] });
      },
      options,
    );
    const { records } = await db.getRecordsByIds({ name, ids: [WALLET.id] });
    expect(records[0]).toBeFalsy();
    expect(hydrate).not.toHaveBeenCalled();
  } finally {
    warmup.resolve();
  }
}, 10_000);

test('default account transactions still wait for Cloud warm-up before opening', async () => {
  const db = new LocalDbIndexed();
  const { started, warmup, hydrate } = blockCloudWarmup();
  const callback = jest.fn(async () => 'done');
  const write = db.withTransaction(EIndexedDBBucketNames.account, callback);
  try {
    await started;
    expect(callback).not.toHaveBeenCalled();
    expect(hydrate).toHaveBeenCalledWith({ forDbTransaction: true });
  } finally {
    warmup.resolve();
  }
  await expect(write).resolves.toBe('done');
});
