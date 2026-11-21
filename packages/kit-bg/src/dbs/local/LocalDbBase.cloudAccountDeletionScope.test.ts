import { EDeviceType } from '@onekeyfe/hd-shared';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { CloudSyncFlowManagerAccount } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';
import {
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
  normalizePublicAccountSnapshotRecord,
  publicAccountSnapshotToAccount,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot';
import {
  publicAccountAllChainFixtures,
  publicAccountAllChainWallet,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.allChains.test-utils';
import {
  PUBLIC_ACCOUNT_TEST_XFP,
  publicAccountTestSnapshot,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.test-utils';
import { rememberOfflinePublicAccountSnapshotFill } from '../../services/ServicePrimeCloudSync/publicAccountSnapshotWriteGuard';

import { INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE } from './consts';
import { IndexedDBAgent } from './indexed/IndexedDBAgent';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { RealmSchemaAccount } from './realm/schemas/RealmSchemaAccount';
import { EIndexedDBBucketNames } from './types';

import type { IDBCloudSyncItem, IDBWallet } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// Exercise Realm's record getter with synthetic native field values.
jest.mock('./realm/base/RealmObjectBase', () => ({
  RealmObjectBase: jest.fn(),
}));

const currentTime = 5000;
const hardware: IKeylessCloudSyncCredential = {
  keylessWalletId: 'hardware-delete-fixture',
  pwdHash: 'hw-dek-delete-fixture',
  signingPrivateKey: '11'.repeat(32),
  signingPublicKey: '02'.repeat(33),
  encryptionKey: '22'.repeat(32),
  source: {
    type: 'hardware',
    credentialId: 'hardware-delete-fixture',
    derivationVersion: 1,
    deviceName: 'Fixture',
    deviceType: EDeviceType.Pro,
  },
  hardwareSession: {
    sessionId: 'fixture-scope-session',
    dekId: 'fixture-scope-dek',
    deviceKeyJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', d: 'd' },
    accessToken: 'fixture-access',
    accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
    refreshToken: 'fixture-refresh',
  },
};
const syncCredential: ICloudSyncCredential = {
  keylessCredential: hardware,
  masterPasswordUUID: '',
  securityPasswordR1: '',
  primeAccountSalt: '',
};

async function fixture({
  refuseAuthority = false,
  rejectPreflight = false,
  beforeAuthority,
  beforeKey,
  unsent = false,
  missingCredential = false,
  beforeTime,
  foreign,
  snapshotOverride,
}: {
  refuseAuthority?: boolean;
  rejectPreflight?: boolean;
  beforeAuthority?: () => Promise<void>;
  beforeKey?: () => Promise<void>;
  unsent?: boolean;
  missingCredential?: boolean;
  beforeTime?: (
    db: LocalDbIndexed,
    id: string,
    accountId: string,
  ) => Promise<void>;
  foreign?: Partial<IDBCloudSyncItem>;
  snapshotOverride?: ICloudPublicAccountSnapshot;
} = {}) {
  const db = new LocalDbIndexed();
  const other = new LocalDbIndexed();
  const wallet: IDBWallet = {
    id: 'hd-200',
    xfp: PUBLIC_ACCOUNT_TEST_XFP,
    name: 'Fixture wallet',
    type: 'hd',
    accounts: [],
    nextIds: {},
    walletNo: 200,
    backuped: true,
  };
  const snapshot = {
    ...(snapshotOverride ?? publicAccountTestSnapshot()),
    wallet: {
      kind: 'hd' as const,
      xfp: PUBLIC_ACCOUNT_TEST_XFP,
      hidden: false,
    },
  };
  const account = publicAccountSnapshotToAccount(snapshot, wallet.id);
  wallet.accounts = [account.id];
  const getCloudSyncDataTime = jest.fn(
    async (
      params: Parameters<
        IBackgroundApi['servicePrimeCloudSync']['getCloudSyncDataTime']
      >[0],
    ) => {
      const wireId = params?.syncItemKey?.split(':').at(-1);
      if (wireId) await beforeTime?.(other, wireId, account.id);
      return currentTime;
    },
  );
  const syncLater = jest.fn(async () => undefined);
  const readCredential = jest.fn(async () =>
    missingCredential ? undefined : syncCredential,
  );
  const stages: string[] = [];
  const managers: { account?: CloudSyncFlowManagerAccount } = {};
  const scoped = {
    localDb: db,
    serviceKeylessCloudSync: {
      getLocalMutationSyncCredential: readCredential,
      runWithCloudSyncKeyLock: async <T>(fn: () => Promise<T>) => {
        stages.push('key');
        await beforeKey?.();
        if (rejectPreflight)
          throw new OneKeyLocalError('Fixture storage unreadable');
        return fn();
      },
      runWithCloudAccountImportLock: async <T>(fn: () => Promise<T>) => {
        stages.push('import');
        return fn();
      },
      runWithVerifiedHardwareAccountArchiveSession: async <T>(
        selected: IKeylessCloudSyncCredential,
        fn: () => Promise<T>,
      ) => {
        stages.push('repair');
        expect(selected).toBe(hardware);
        await beforeAuthority?.();
        return refuseAuthority ? undefined : fn();
      },
    },
    servicePrimeCloudSync: {
      getCloudSyncDataTime,
      startServerSyncFlowSilently: syncLater,
      syncManagers: managers,
    },
  };
  const backgroundApi = scoped as unknown as IBackgroundApi;
  const accountManager = new CloudSyncFlowManagerAccount({ backgroundApi });
  managers.account = accountManager;
  db.setBackgroundApi(backgroundApi);
  const rawKey = `${EPrimeCloudSyncDataType.Account} >> ${getPublicAccountSnapshotId(snapshot)}`;
  const syncItemId = accountManager.rawKeyToHashKey(rawKey);
  const old: IDBCloudSyncItem = {
    id: syncItemId,
    dataType: EPrimeCloudSyncDataType.Account,
    rawData: '',
    rawKey,
    pwdHash: 'keyless-foreign-copy',
    data: 'opaque-foreign-ciphertext',
    dataTime: 9000,
    localSceneUpdated: true,
    serverUploaded: true,
    isDeleted: false,
    ...(unsent
      ? await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
          key: syncItemId,
          rawDataJson: {
            dataType: EPrimeCloudSyncDataType.Account,
            rawKey,
            payload: {
              accountId: getPublicAccountSnapshotId(snapshot),
              name: snapshot.account.name,
              publicAccountSnapshot: snapshot,
            },
          },
          dataTime: 9000,
          syncCredential: undefined,
        })
      : {}),
    ...(unsent ? { localSceneUpdated: true } : {}),
    ...foreign,
  };
  await db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      records: [wallet],
    });
    if (!account.indexedAccountId)
      throw new OneKeyLocalError('Expected indexed fixture account');
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.IndexedAccount,
      records: [
        {
          id: account.indexedAccountId,
          walletId: wallet.id,
          index: 0,
          idHash: 'fixture-index',
          name: account.name,
        },
      ],
    });
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Account,
      records: [account],
    });
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.CloudSyncItem,
      records: [old],
    });
  });
  return {
    db,
    other,
    wallet,
    account,
    old,
    snapshot,
    readCredential,
    async buildFill(previous = old) {
      const item = {
        ...(await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
          key: previous.id,
          rawDataJson: {
            dataType: EPrimeCloudSyncDataType.Account,
            rawKey,
            payload: {
              accountId: getPublicAccountSnapshotId(snapshot),
              name: snapshot.account.name,
              publicAccountSnapshot: snapshot,
            },
          },
          dataTime: previous.dataTime,
          syncCredential,
        })),
        rawData: '',
        localSceneUpdated: previous.localSceneUpdated,
        isDeleted: previous.isDeleted,
      };
      expect(
        rememberOfflinePublicAccountSnapshotFill(
          item,
          previous,
          snapshot,
          hardware.pwdHash,
        ),
      ).toBe(true);
      return item;
    },
    getCloudSyncDataTime,
    syncLater,
    stages,
    remove: () =>
      db.removeAccount({ walletId: wallet.id, accountId: account.id }),
  };
}

async function archived(db: LocalDbIndexed) {
  const agent = await db.readyDb;
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected IndexedDB agent');
  return (
    await agent
      .getIndexedByBucketName(EIndexedDBBucketNames.account)
      .getAll(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE)
  ).flatMap((item) => ('record' in item ? [item.record] : []));
}

beforeEach(() => {
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
  jest.replaceProperty(platformEnv, 'isDesktop', true);
  jest.replaceProperty(platformEnv, 'isMas', false);
  jest.replaceProperty(platformEnv, 'isDev', false);
  jest.replaceProperty(
    platformEnv,
    'desktopEmbeddedAccountDbCompatibilityVersion',
    22,
  );
});

afterEach(() => jest.restoreAllMocks());

it.each([false, true])('archives on local delete (MAS=%s)', async (mas) => {
  platformEnv.isMas = mas;
  const h = await fixture();
  await h.remove();
  expect(h.stages).toEqual(['key', 'import', 'repair']);
  const tombstone = await h.other.getSyncItem({ id: h.old.id });
  expect(tombstone).toMatchObject({
    pwdHash: hardware.pwdHash,
    dataTime: currentTime,
    isDeleted: true,
    localSceneUpdated: true,
    serverUploaded: false,
    rawData: '',
  });
  expect(tombstone.pendingPublicAccountDeletionAt).toBeUndefined();
  expect(tombstone.data).not.toBe(h.old.data);
  expect(h.getCloudSyncDataTime).toHaveBeenCalledWith(
    expect.objectContaining({
      existingDataTime: undefined,
      syncItemKey: `${hardware.pwdHash}:${h.old.id}`,
    }),
  );
  const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
    item: { ...tombstone },
    syncCredential,
  });
  expect(
    normalizePublicAccountSnapshotRecord(decrypted.rawDataJson).rawKey,
  ).toBe(h.old.rawKey);
  expect(await archived(h.other)).toEqual([h.old]);
  expect(await h.other.getAccountSafe({ accountId: h.account.id })).toBeFalsy();
  expect(
    (await h.other.getWallet({ walletId: h.wallet.id })).accounts,
  ).not.toContain(h.account.id);
  expect(h.syncLater).not.toHaveBeenCalled();
});

it.each([
  'revoked',
  'foreign-row-changed',
  'business-identity-changed',
  'transaction-aborted',
  'prior-intent',
  'preflight',
  'missing-credential',
  'preparation',
] as const)(
  'preserves foreign rows and conditionally commits only local removal: %s',
  async (scenario) => {
    let newest: IDBCloudSyncItem | undefined;
    const h = await fixture({
      refuseAuthority: scenario === 'revoked',
      rejectPreflight: scenario === 'preflight',
      missingCredential: scenario === 'missing-credential',
      foreign:
        scenario === 'prior-intent'
          ? {
              pendingPublicAccountDeletionAt: 9100,
              pendingPublicAccountDeletionHash: 'prior-live-intent',
            }
          : undefined,
      beforeTime: async (other, id, accountId) => {
        if (scenario === 'preparation')
          throw new OneKeyLocalError('Fixture Cloud preparation failed');
        if (scenario === 'foreign-row-changed') {
          await other.updateSyncItem({
            ids: [id],
            updater: (row) => {
              Object.assign(row, {
                data: 'foreign copy advanced concurrently',
              });
              return row;
            },
          });
          newest = await other.getSyncItem({ id });
        }
        if (scenario === 'business-identity-changed') {
          await other.withTransaction(
            EIndexedDBBucketNames.account,
            async (tx) =>
              other.txUpdateRecords({
                tx,
                name: ELocalDBStoreNames.Account,
                ids: [accountId],
                updater: (row) =>
                  Object.assign(row, {
                    address: '0x2222222222222222222222222222222222222222',
                  }),
              }),
          );
        }
      },
    });
    if (scenario === 'transaction-aborted') {
      const remove = h.db.txRemoveRecords.bind(h.db);
      jest.spyOn(h.db, 'txRemoveRecords').mockImplementation(async (params) => {
        await remove(params);
        if (params.name === ELocalDBStoreNames.Account)
          throw new OneKeyLocalError('Forced abort after local account write');
      });
    }
    const localCommitted = scenario !== 'transaction-aborted';
    if (localCommitted) {
      await expect(h.remove()).resolves.toBeUndefined();
    } else {
      await expect(h.remove()).rejects.toThrow(
        'Forced abort after local account write',
      );
    }
    expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(
      newest ?? h.old,
    );
    expect(await archived(h.other)).toEqual([]);
    expect(
      Boolean(await h.other.getAccountSafe({ accountId: h.account.id })),
    ).toBe(!localCommitted);
    expect(
      (await h.other.getWallet({ walletId: h.wallet.id })).accounts.includes(
        h.account.id,
      ),
    ).toBe(!localCommitted);
    expect(h.syncLater).not.toHaveBeenCalled();
  },
);

it('does not wait for late Desktop Cloud authorization or repeat the local commit', async () => {
  const waiting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const h = await fixture({
    beforeAuthority: () => {
      waiting.resolve();
      return release.promise;
    },
  });
  const remove = jest.spyOn(h.db, 'txRemoveRecords');
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  try {
    const removing = h.remove();
    await waiting.promise;
    await jest.advanceTimersByTimeAsync(1000);
    await expect(removing).resolves.toBeUndefined();
    expect(
      await h.other.getAccountSafe({ accountId: h.account.id }),
    ).toBeFalsy();
    expect(remove).toHaveBeenCalledTimes(1);
    release.resolve();
    await jest.advanceTimersByTimeAsync(1000);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(h.old);
    expect(await archived(h.other)).toEqual([]);
    expect(h.syncLater).not.toHaveBeenCalled();
  } finally {
    release.resolve();
    jest.useRealTimers();
  }
});

it.each([false, true])(
  'normal raw fill cancels a pending snapshot after actual local deletion (batch=%s)',
  async (batch) => {
    const waiting = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const h = await fixture({
      unsent: true,
      beforeKey: () => {
        waiting.resolve();
        return release.promise;
      },
    });
    const builtBeforeDelete = await h.buildFill();
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      const deleting = batch
        ? h.db.removeAccountsByIds({ ids: [h.account.id] })
        : h.remove();
      await waiting.promise;
      await jest.advanceTimersByTimeAsync(1000);
      await deleting;
      expect(
        await h.other.getAccountSafe({ accountId: h.account.id }),
      ).toBeFalsy();
      expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(h.old);
      expect(h.readCredential).not.toHaveBeenCalled();

      await h.other.addAndUpdateSyncItems({
        items: [builtBeforeDelete],
        skipUploadToServer: true,
      });
      expect(await h.other.getSyncItemSafe({ id: h.old.id })).toBeFalsy();
      release.resolve();
      await jest.advanceTimersByTimeAsync(1000);
      expect(h.readCredential).not.toHaveBeenCalled();
      expect(h.syncLater).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      jest.useRealTimers();
    }
  },
);

it('still completes a normal surviving offline snapshot and retains its original time', async () => {
  const h = await fixture({ unsent: true });
  const fill = await h.buildFill();
  await h.other.addAndUpdateSyncItems({
    items: [fill],
    skipUploadToServer: true,
  });
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(fill);
});

it.each([
  { createAtNetwork: null, matches: true },
  { createAtNetwork: 'evm--1', matches: false },
  { createAtNetwork: '', matches: false },
])(
  'only treats an absent Realm creation network as matching: $createAtNetwork',
  async ({ createAtNetwork, matches }) => {
    const h = await fixture({ unsent: true });
    const realmRecord = Object.assign(
      Object.create(RealmSchemaAccount.prototype) as RealmSchemaAccount,
      h.account,
      { createAtNetwork },
    ).record;
    expect(h.snapshot.account.createAtNetwork).toBeUndefined();
    expect(realmRecord.createAtNetwork).toBe(createAtNetwork);
    await h.db.withTransaction(
      EIndexedDBBucketNames.account,
      (tx) =>
        h.db.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Account,
          ids: [h.account.id],
          updater: (row) => Object.assign(row, realmRecord),
        }),
      { skipCloudCredentialWarmup: true },
    );
    const fill = await h.buildFill();
    await h.other.addAndUpdateSyncItems({
      items: [fill],
      skipUploadToServer: true,
    });
    expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(
      matches ? fill : h.old,
    );
    expect(
      (await h.other.getAccountSafe({ accountId: h.account.id }))
        ?.createAtNetwork,
    ).toBe(createAtNetwork);
  },
);

it.each([
  { relPath: null, matches: true },
  { relPath: '0/0', matches: false },
  { relPath: '', matches: false },
])(
  'only treats an absent Realm TRON relative path as matching: $relPath',
  async ({ relPath, matches }) => {
    const tron = (await publicAccountAllChainFixtures()).find(
      (item) => item.impl === 'tron' && item.kind === 'hd',
    );
    if (!tron) throw new OneKeyLocalError('Missing public TRON fixture');
    const snapshot = buildPublicAccountSnapshot({
      wallet: publicAccountAllChainWallet('hd'),
      account: tron.account,
    });
    if (!snapshot) throw new OneKeyLocalError('Missing public TRON snapshot');
    expect(snapshot.version).toBe(2);
    expect(snapshot.account.relPath).toBeUndefined();

    const h = await fixture({ unsent: true, snapshotOverride: snapshot });
    const realmRecord = Object.assign(
      Object.create(RealmSchemaAccount.prototype) as RealmSchemaAccount,
      h.account,
      { relPath },
    ).record;
    expect(realmRecord.relPath).toBe(relPath);
    await h.db.withTransaction(
      EIndexedDBBucketNames.account,
      (tx) =>
        h.db.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Account,
          ids: [h.account.id],
          updater: (row) => Object.assign(row, realmRecord),
        }),
      { skipCloudCredentialWarmup: true },
    );
    const fill = await h.buildFill();
    await h.other.addAndUpdateSyncItems({
      items: [fill],
      skipUploadToServer: true,
    });
    expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(
      matches ? fill : h.old,
    );
    expect(
      (await h.other.getAccountSafe({ accountId: h.account.id }))?.relPath,
    ).toBe(relPath);
  },
);

it('does not cancel newly replaced plaintext, even if the original account is gone', async () => {
  const h = await fixture({ unsent: true, rejectPreflight: true });
  const fill = await h.buildFill();
  await h.remove();
  const newer = { ...h.old, dataTime: 9001 };
  await h.other.addAndUpdateSyncItems({
    items: [newer],
    skipUploadToServer: true,
  });
  await h.other.addAndUpdateSyncItems({
    items: [fill],
    skipUploadToServer: true,
  });
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(newer);
});

it('preserves plaintext with no real local wallet or a conflicting local account', async () => {
  const h = await fixture({ unsent: true, rejectPreflight: true });
  const fill = await h.buildFill();
  await h.db.withTransaction(
    EIndexedDBBucketNames.account,
    (tx) =>
      h.db.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ids: [h.account.id],
        updater: (account) => {
          account.address = '0x2222222222222222222222222222222222222222';
          return account;
        },
      }),
    { skipCloudCredentialWarmup: true },
  );
  await h.other.addAndUpdateSyncItems({
    items: [fill],
    skipUploadToServer: true,
  });
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(h.old);
  await h.db.withTransaction(
    EIndexedDBBucketNames.account,
    (tx) =>
      h.db.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        ids: [h.wallet.id],
        updater: (wallet) => {
          wallet.isTemp = true;
          return wallet;
        },
      }),
    { skipCloudCredentialWarmup: true },
  );
  await h.other.addAndUpdateSyncItems({
    items: [await h.buildFill()],
    skipUploadToServer: true,
  });
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(h.old);
});

it('rolls back sync-side cancellation on a later pool transaction failure', async () => {
  const h = await fixture({ unsent: true, rejectPreflight: true });
  await h.remove();
  await expect(
    h.other.addAndUpdateSyncItems({
      items: [await h.buildFill()],
      skipUploadToServer: true,
      fn: () => Promise.reject(new OneKeyLocalError('fixture abort')),
    }),
  ).rejects.toThrow('fixture abort');
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(h.old);
  expect(await h.other.getAccountSafe({ accountId: h.account.id })).toBeFalsy();
});

it('preserves a remote tombstone proof added while an older plaintext tombstone was being sealed', async () => {
  const h = await fixture({ unsent: true, foreign: { isDeleted: true } });
  const fill = await h.buildFill();
  const proof = 'new-fixture-proof';
  const previousWithProof = {
    ...h.old,
    remoteHardwareAccountTombstoneProof: proof,
  };
  await h.db.withTransaction(
    EIndexedDBBucketNames.account,
    async (tx) => {
      // A direct IndexedDB fixture represents existing persisted proof.
      // The public adapter must not allow an ordinary write to mint it.
      const store = tx.stores?.[ELocalDBStoreNames.CloudSyncItem];
      if (!store)
        throw new OneKeyLocalError('Expected IndexedDB account store');
      await store.put(previousWithProof);
    },
    { skipCloudCredentialWarmup: true },
  );
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(
    previousWithProof,
  );
  await h.other.addAndUpdateSyncItems({
    items: [fill],
    skipUploadToServer: true,
  });
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual({
    ...h.old,
    remoteHardwareAccountTombstoneProof: proof,
  });
});
