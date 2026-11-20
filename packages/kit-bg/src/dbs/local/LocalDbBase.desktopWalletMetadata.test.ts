import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  OneKeyLocalError,
  RenameDuplicateNameError,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE } from './consts';
import { IndexedDBAgent } from './indexed/IndexedDBAgent';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBCloudSyncItem, IDBWallet } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function walletFixture(index: number): IDBWallet {
  return {
    id: `hd-${9000 + index}`,
    type: 'hd',
    name: 'Canonical name',
    xfp: 'synthetic-test-xfp',
    accounts: [],
    nextIds: {},
    backuped: true,
    walletNo: 9000 + index,
  };
}

async function setUp(index: number) {
  const db = new LocalDbIndexed();
  const wallet = walletFixture(index);
  const pool: IDBCloudSyncItem = {
    id: `synthetic-wallet-row-${index}`,
    data: 'retained-synthetic-ciphertext',
    rawData: undefined,
    rawKey: 'synthetic-canonical-wallet-key',
    dataType: EPrimeCloudSyncDataType.Wallet,
    dataTime: 42,
    serverUploaded: true,
    localSceneUpdated: true,
    isDeleted: false,
    pwdHash: 'retained-synthetic-scope',
  };
  const verifiedCredential: ICloudSyncCredential = {
    primeAccountSalt: 'synthetic',
    securityPasswordR1: 'synthetic',
    masterPasswordUUID: pool.pwdHash,
  };
  const apiUploadItems = jest.fn(async () => undefined);
  const runWithCloudSyncKeyLock = jest.fn(
    async (task: () => Promise<unknown>) => task(),
  );
  const runWithDesktopWalletMetadataKey = jest.fn(
    async (
      _cloud: (
        credential: ICloudSyncCredential | undefined,
        claimWrite: () => boolean,
      ) => Promise<unknown>,
      local: () => Promise<unknown>,
    ) => local(),
  );
  const syncManagers = {
    wallet: {
      buildSyncTargetByDBQuery: jest.fn(async () => ({})),
      isSupportSync: jest.fn(async () => true),
      buildSyncRawKey: jest.fn(async () => 'canonical-synthetic-key'),
      buildSyncKeyAndPayload: jest.fn(async () => ({ key: pool.id })),
      getSyncCredential: jest.fn(async () => undefined),
      buildSyncItemByDBQuery: jest.fn(
        async (_params: { dbRecord: IDBWallet }) => ({
          ...pool,
          data: 'new-synthetic-ciphertext',
          dataTime: 43,
          serverUploaded: false,
        }),
      ),
    },
  };
  db.setBackgroundApi({
    serviceKeylessCloudSync: {
      runWithDesktopWalletMetadataKey,
      runWithCloudSyncKeyLock,
    },
    servicePrimeCloudSync: { syncManagers, apiUploadItems },
  } as unknown as IBackgroundApi);
  await db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      records: [wallet],
    });
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Credential,
      records: [{ id: wallet.id, credential: 'synthetic-credential-fixture' }],
    });
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.CloudSyncItem,
      records: [pool],
    });
  });
  return {
    db,
    wallet,
    pool,
    verifiedCredential,
    apiUploadItems,
    runWithDesktopWalletMetadataKey,
    syncManagers,
  };
}

beforeEach(() => {
  jest.replaceProperty(platformEnv, 'isDesktop', true);
  jest.replaceProperty(platformEnv, 'isMas', false);
  jest.replaceProperty(platformEnv, 'isDev', false);
});

afterEach(() => jest.restoreAllMocks());

it('stores only an unbound display value in the already-v22 account bucket, surviving a new adapter', async () => {
  const { db, wallet, pool, apiUploadItems } = await setUp(1);
  const agent = await db.readyDb;
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected IndexedDB');
  const accountDb = agent.getIndexedByBucketName(EIndexedDBBucketNames.account);
  expect((await accountDb.open()).version).toBe(22);
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      name: 'Only on this device',
      avatar: { img: 'bear' },
    }),
  ).resolves.toMatchObject({
    name: 'Only on this device',
    hasDesktopLocalMetadata: true,
  });
  expect(apiUploadItems).not.toHaveBeenCalled();
  const reopened = new LocalDbIndexed();
  const canonical = await reopened.getWallet({ walletId: wallet.id });
  expect(canonical).toMatchObject({ name: wallet.name });
  expect(canonical.hasDesktopLocalMetadata).toBeUndefined();
  expect(await reopened.getSyncItem({ id: pool.id })).toEqual(pool);
  await expect(
    reopened.getWalletsForMetadataPresentation([canonical]),
  ).resolves.toMatchObject([
    {
      name: 'Only on this device',
      hasDesktopLocalMetadata: true,
      avatarInfo: { img: 'bear' },
    },
  ]);
  expect(await accountDb.getAll(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'wallet-local-metadata',
        name: 'Only on this device',
      }),
    ]),
  );
});

it('preserves the local display through canonical replay without changing the canonical getter', async () => {
  const { db, wallet, apiUploadItems } = await setUp(2);
  await db.setWalletNameAndAvatar({
    walletId: wallet.id,
    allowDesktopLocalMetadata: true,
    name: 'Local edit only',
  });
  await db.setWalletNameAndAvatar({
    walletId: wallet.id,
    skipSaveLocalSyncItem: true,
    name: 'New canonical value',
  });
  const canonical = await db.getWallet({ walletId: wallet.id });
  expect(canonical.name).toBe('New canonical value');
  await expect(
    db.getWalletsForMetadataPresentation([canonical]),
  ).resolves.toMatchObject([
    { name: 'Local edit only', hasDesktopLocalMetadata: true },
  ]);
  expect(apiUploadItems).not.toHaveBeenCalled();
});

it('local-only entry does not derive any Cloud identity or key', async () => {
  const { db, wallet, syncManagers, apiUploadItems } = await setUp(3);
  syncManagers.wallet.buildSyncRawKey.mockRejectedValueOnce(
    new OneKeyLocalError('No Cloud key for this Wallet'),
  );
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      name: 'Local-only edit',
    }),
  ).resolves.toMatchObject({ name: 'Local-only edit' });
  expect(syncManagers.wallet.buildSyncRawKey).not.toHaveBeenCalled();
  expect(syncManagers.wallet.getSyncCredential).not.toHaveBeenCalled();
  expect(apiUploadItems).not.toHaveBeenCalled();
});

it('does not report success or change either canonical row when the overlay transaction aborts', async () => {
  const { db, wallet, pool, apiUploadItems } = await setUp(4);
  const actualTransaction = db.withTransaction.bind(db);
  const spy = jest
    .spyOn(db, 'withTransaction')
    .mockImplementation(async (bucket, task, options) =>
      actualTransaction(
        bucket,
        async (tx) => {
          const adapter = tx.desktopWalletLocalMetadata;
          if (
            adapter &&
            options?.skipCloudCredentialWarmup &&
            !options.readOnly
          ) {
            const actualWrite = adapter.write.bind(adapter);
            adapter.write = async (record) => {
              await actualWrite(record);
              throw new OneKeyLocalError('Synthetic overlay commit failure');
            };
          }
          return task(tx);
        },
        options,
      ),
    );
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      name: 'Do not survive abort',
    }),
  ).rejects.toThrow('Synthetic overlay commit failure');
  spy.mockRestore();
  const canonical = await db.getWallet({ walletId: wallet.id });
  expect(canonical.name).toBe(wallet.name);
  await expect(
    db.getWalletsForMetadataPresentation([canonical]),
  ).resolves.toEqual([canonical]);
  await expect(db.getSyncItem({ id: pool.id })).resolves.toEqual(pool);
  expect(apiUploadItems).not.toHaveBeenCalled();
});

it('a later intentional canonical edit does not export a different pending local field', async () => {
  const {
    db,
    wallet,
    apiUploadItems,
    runWithDesktopWalletMetadataKey,
    syncManagers,
    verifiedCredential,
  } = await setUp(5);
  await db.setWalletNameAndAvatar({
    walletId: wallet.id,
    allowDesktopLocalMetadata: true,
    name: 'Unbound prior name',
    avatar: { img: 'bear' },
  });
  runWithDesktopWalletMetadataKey.mockImplementationOnce(async (cloud) =>
    cloud(verifiedCredential, () => true),
  );
  const result = await db.setWalletNameAndAvatar({
    walletId: wallet.id,
    allowDesktopLocalMetadata: true,
    name: 'Intentional new name',
  });
  const submitted =
    syncManagers.wallet.buildSyncItemByDBQuery.mock.calls[0]?.[0].dbRecord;
  expect(submitted).toMatchObject({ name: 'Intentional new name' });
  expect(submitted?.avatarInfo).not.toEqual({ img: 'bear' });
  expect(result).toMatchObject({
    name: 'Intentional new name',
    avatarInfo: { img: 'bear' },
    hasDesktopLocalMetadata: true,
  });
  expect(await db.getWallet({ walletId: wallet.id })).not.toMatchObject({
    avatarInfo: { img: 'bear' },
  });
  expect(apiUploadItems).toHaveBeenCalledTimes(1);
});

it('uses disjoint namespaces for existing archive bytes and local display changes', async () => {
  const { db, wallet, pool } = await setUp(6);
  await db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
    await tx.cloudAccountArchive?.retain(pool);
  });
  await db.setWalletNameAndAvatar({
    walletId: wallet.id,
    allowDesktopLocalMetadata: true,
    name: 'Separate record',
  });
  await db.removeWallet({ walletId: wallet.id });
  const agent = await db.readyDb;
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected IndexedDB');
  const accountDb = agent.getIndexedByBucketName(EIndexedDBBucketNames.account);
  expect((await accountDb.open()).version).toBe(22);
  const rows = await accountDb.getAll(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE);
  expect(rows).toEqual(
    expect.arrayContaining([expect.objectContaining({ record: pool })]),
  );
  expect(rows).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: `wallet-local-metadata:${wallet.id}` }),
    ]),
  );
});

it('preserves a foreign row even during an intentional edit with a verified current key', async () => {
  const {
    db,
    wallet,
    pool,
    apiUploadItems,
    runWithDesktopWalletMetadataKey,
    syncManagers,
  } = await setUp(7);
  const current: ICloudSyncCredential = {
    primeAccountSalt: 'synthetic',
    securityPasswordR1: 'synthetic',
    masterPasswordUUID: 'different-verified-scope',
  };
  syncManagers.wallet.buildSyncItemByDBQuery.mockResolvedValueOnce({
    ...pool,
    pwdHash: current.masterPasswordUUID,
    data: 'new-scope-synthetic-data',
    dataTime: 43,
    serverUploaded: false,
  });
  runWithDesktopWalletMetadataKey.mockImplementationOnce(async (apply) =>
    apply(current, () => true),
  );
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      name: 'Preserved local edit',
    }),
  ).resolves.toMatchObject({
    name: 'Preserved local edit',
    hasDesktopLocalMetadata: true,
  });
  expect((await db.getWallet({ walletId: wallet.id })).name).toBe(wallet.name);
  await expect(db.getSyncItem({ id: pool.id })).resolves.toEqual(pool);
  expect(apiUploadItems).not.toHaveBeenCalled();
});

it('does not claim a successful Cloud rename over a different local Wallet display name', async () => {
  const {
    db,
    wallet,
    pool,
    apiUploadItems,
    runWithDesktopWalletMetadataKey,
    verifiedCredential,
  } = await setUp(8);
  const other = walletFixture(100);
  await db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      records: [other],
    });
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Credential,
      records: [{ id: other.id, credential: 'synthetic-credential-fixture' }],
    });
  });
  await db.setWalletNameAndAvatar({
    walletId: other.id,
    allowDesktopLocalMetadata: true,
    name: 'Other device-only Wallet name',
  });
  runWithDesktopWalletMetadataKey.mockImplementationOnce(async (cloud) =>
    cloud(verifiedCredential, () => true),
  );
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      shouldCheckDuplicate: true,
      name: 'Other device-only Wallet name',
    }),
  ).rejects.toBeInstanceOf(RenameDuplicateNameError);
  expect(await db.getSyncItem({ id: pool.id })).toEqual(pool);
  expect((await db.getWallet({ walletId: wallet.id })).name).toBe(wallet.name);
  expect(apiUploadItems).not.toHaveBeenCalled();
});

it('rolls back an actual Cloud pool put before committing exactly one local display edit', async () => {
  const {
    db,
    wallet,
    pool,
    apiUploadItems,
    runWithDesktopWalletMetadataKey,
    verifiedCredential,
  } = await setUp(9);
  const withTransaction = db.withTransaction.bind(db);
  let failedAfterPoolPut = false;
  const attempt = jest
    .spyOn(db, 'withTransaction')
    .mockImplementation(async (bucket, task, options) =>
      withTransaction(
        bucket,
        async (tx) => {
          const store = tx.stores?.[ELocalDBStoreNames.CloudSyncItem];
          if (options?.confirmRollbackOnError && store) {
            const put = store.put.bind(store);
            jest.spyOn(store, 'put').mockImplementationOnce(async (...args) => {
              await put(...args);
              failedAfterPoolPut = true;
              throw new OneKeyLocalError('Synthetic Cloud store write failure');
            });
          }
          return task(tx);
        },
        options,
      ),
    );
  runWithDesktopWalletMetadataKey.mockImplementationOnce(async (cloud) =>
    cloud(verifiedCredential, () => true),
  );
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      name: 'Local despite Cloud store failure',
    }),
  ).resolves.toMatchObject({
    name: 'Local despite Cloud store failure',
    hasDesktopLocalMetadata: true,
  });
  attempt.mockRestore();
  expect(failedAfterPoolPut).toBe(true);
  expect(await db.getSyncItem({ id: pool.id })).toEqual(pool);
  const canonical = await db.getWallet({ walletId: wallet.id });
  expect(canonical.name).toBe(wallet.name);
  await expect(
    db.getWalletsForMetadataPresentation([canonical]),
  ).resolves.toMatchObject([{ name: 'Local despite Cloud store failure' }]);
  expect(apiUploadItems).not.toHaveBeenCalled();
});

it('does not attempt a side save if only the actual Wallet store rejects', async () => {
  const {
    db,
    wallet,
    pool,
    apiUploadItems,
    runWithDesktopWalletMetadataKey,
    verifiedCredential,
  } = await setUp(10);
  const withTransaction = db.withTransaction.bind(db);
  const localFailure = new OneKeyLocalError('Synthetic Wallet store failure');
  const attempt = jest
    .spyOn(db, 'withTransaction')
    .mockImplementation(async (bucket, task, options) =>
      withTransaction(
        bucket,
        async (tx) => {
          const store = tx.stores?.[ELocalDBStoreNames.Wallet];
          if (options?.confirmRollbackOnError && store)
            jest.spyOn(store, 'put').mockRejectedValueOnce(localFailure);
          return task(tx);
        },
        options,
      ),
    );
  runWithDesktopWalletMetadataKey.mockImplementationOnce(async (cloud) =>
    cloud(verifiedCredential, () => true),
  );
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      name: 'Must not persist',
    }),
  ).rejects.toBe(localFailure);
  attempt.mockRestore();
  const canonical = await db.getWallet({ walletId: wallet.id });
  expect(canonical.name).toBe(wallet.name);
  await expect(
    db.getWalletsForMetadataPresentation([canonical]),
  ).resolves.toEqual([canonical]);
  expect(await db.getSyncItem({ id: pool.id })).toEqual(pool);
  expect(apiUploadItems).not.toHaveBeenCalled();
});
