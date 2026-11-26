import { EDeviceType } from '@onekeyfe/hd-shared';
import { IDBFactory, IDBTransaction } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { CloudSyncFlowManagerAccount } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';
import {
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
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
  beforeKey,
  selectedCredential = syncCredential,
  isCurrent = () => true,
  unsent = false,
  missingCredential = false,
  beforeTime,
  useHistoricalTime = false,
  historicalClockAdjustment = 0,
  historicalClockCeiling,
  foreign,
  snapshotOverride,
}: {
  refuseAuthority?: boolean;
  rejectPreflight?: boolean;
  beforeKey?: () => Promise<void>;
  selectedCredential?: ICloudSyncCredential;
  isCurrent?: () => boolean;
  unsent?: boolean;
  missingCredential?: boolean;
  useHistoricalTime?: boolean;
  historicalClockAdjustment?: number;
  historicalClockCeiling?: number;
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
      if (useHistoricalTime) {
        if (
          params?.allowHistoricalTime &&
          params.explicitHistoricalTime !== undefined
        )
          return Math.min(
            params.explicitHistoricalTime + historicalClockAdjustment,
            historicalClockCeiling ?? Infinity,
          );
        return Math.max(Date.now(), (params?.existingDataTime ?? 0) + 1);
      }
      return currentTime;
    },
  );
  const syncLater = jest.fn(async () => undefined);
  const readCredential = jest.fn(async () =>
    missingCredential ? undefined : selectedCredential,
  );
  const stages: string[] = [];
  const managers: { account?: CloudSyncFlowManagerAccount } = {};
  const scoped = {
    localDb: db,
    serviceKeylessCloudSync: {
      getLocalMutationSyncCredential: readCredential,
      captureLocalAccountDeleteScope: () => ({ isCurrent, release: jest.fn() }),
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
    accountManager,
    syncLater,
    stages,
    remove: () =>
      db.removeAccount({ walletId: wallet.id, accountId: account.id }),
  };
}

beforeEach(() => {
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
});

afterEach(() => jest.restoreAllMocks());

it('deletes only the local account and keeps the foreign settled ciphertext exactly', async () => {
  const h = await fixture();
  await expect(h.remove()).resolves.toBeUndefined();
  expect(await h.other.getAccountSafe({ accountId: h.account.id })).toBeFalsy();
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(h.old);
  expect(h.stages).toEqual(['key']);
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

it.each([false, true])(
  'local delete cancels exact plaintext before a late fill even when key locking times out (batch=%s)',
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
      expect(await h.other.getSyncItemSafe({ id: h.old.id })).toBeFalsy();
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
    const expectedCreateAtNetwork = createAtNetwork ?? undefined;
    const realmRecord = Object.assign(
      Object.create(RealmSchemaAccount.prototype) as RealmSchemaAccount,
      h.account,
      { createAtNetwork },
    ).record;
    expect(h.snapshot.account.createAtNetwork).toBeUndefined();
    expect(realmRecord.createAtNetwork).toBe(expectedCreateAtNetwork);
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
    ).toBe(expectedCreateAtNetwork);
  },
);

it.each([
  { relPath: null, matches: true },
  { relPath: '0/0', matches: false },
  { relPath: '', matches: false },
])(
  'only treats an absent Realm TRON relative path as matching: $relPath',
  async ({ relPath, matches }) => {
    const expectedRelPath = relPath ?? undefined;
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
    expect(realmRecord.relPath).toBe(expectedRelPath);
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
    ).toBe(expectedRelPath);
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
  const remove = h.db.txRemoveRecords.bind(h.db);
  const removal = jest
    .spyOn(h.db, 'txRemoveRecords')
    .mockImplementation(async (params) => {
      await remove(params);
      if (params.name === ELocalDBStoreNames.CloudSyncItem)
        throw new OneKeyLocalError('Synthetic optional pool failure');
    });
  try {
    await h.remove();
  } finally {
    removal.mockRestore();
  }
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

it.each(['same-identity-peer', 'newer-plaintext', 'cipher-first'] as const)(
  'does not remove uncertain or still-used pool rows after local deletion: %s',
  async (scenario) => {
    const h = await fixture({ unsent: true, rejectPreflight: true });
    let retained = h.old;
    if (scenario === 'same-identity-peer') {
      const duplicateWallet = { ...h.wallet, id: 'hd-201', walletNo: 201 };
      const duplicateAccount = publicAccountSnapshotToAccount(
        h.snapshot,
        duplicateWallet.id,
      );
      duplicateWallet.accounts = [duplicateAccount.id];
      const indexedAccountId = duplicateAccount.indexedAccountId;
      if (!indexedAccountId) throw new OneKeyLocalError('Missing peer index');
      await h.db.withTransaction(
        EIndexedDBBucketNames.account,
        async (tx) => {
          await h.db.txAddRecords({
            tx,
            name: ELocalDBStoreNames.Wallet,
            records: [duplicateWallet],
          });
          await h.db.txAddRecords({
            tx,
            name: ELocalDBStoreNames.IndexedAccount,
            records: [
              {
                id: indexedAccountId,
                index: 0,
                idHash: 'duplicate-peer-index',
                walletId: duplicateWallet.id,
                name: duplicateAccount.name,
              },
            ],
          });
          await h.db.txAddRecords({
            tx,
            name: ELocalDBStoreNames.Account,
            records: [duplicateAccount],
          });
        },
        { skipCloudCredentialWarmup: true },
      );
      const peerRecord = {
        name: ELocalDBStoreNames.Account,
        id: duplicateAccount.id,
      } as const;
      expect(duplicateAccount.id).not.toBe(h.account.id);
      expect(await h.other.getRecordById(peerRecord)).toMatchObject({
        id: duplicateAccount.id,
      });
      await h.remove();
      expect(await h.other.getRecordById(peerRecord)).toMatchObject({
        id: duplicateAccount.id,
      });
    } else {
      retained =
        scenario === 'cipher-first'
          ? await h.buildFill()
          : { ...h.old, dataTime: Date.now() + 60_000 };
      await h.other.addAndUpdateSyncItems({
        items: [retained],
        skipUploadToServer: true,
      });
      await h.remove();
    }
    expect(
      await h.other.getAccountSafe({ accountId: h.account.id }),
    ).toBeFalsy();
    expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(retained);
    expect(h.syncLater).not.toHaveBeenCalled();
  },
);

it('rolls back an actual plaintext cancellation if the primary Account write fails', async () => {
  const h = await fixture({ unsent: true, rejectPreflight: true });
  const remove = h.db.txRemoveRecords.bind(h.db);
  const primaryFailure = new OneKeyLocalError(
    'Synthetic business Account write failure',
  );
  let removedPoolRow = false;
  const removal = jest
    .spyOn(h.db, 'txRemoveRecords')
    .mockImplementation(async (params) => {
      await remove(params);
      if (params.name === ELocalDBStoreNames.CloudSyncItem)
        removedPoolRow = true;
      if (params.name === ELocalDBStoreNames.Account) throw primaryFailure;
    });
  try {
    await expect(h.remove()).rejects.toBe(primaryFailure);
  } finally {
    removal.mockRestore();
  }
  expect(removedPoolRow).toBe(true);
  expect(
    await h.other.getAccountSafe({ accountId: h.account.id }),
  ).toMatchObject({ id: h.account.id });
  expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(h.old);
});

it.each([
  { batch: false, delta: -100, clockAdjustment: 0 },
  { batch: true, delta: -100, clockAdjustment: 0 },
  { batch: false, delta: 0, clockAdjustment: 0 },
  { batch: true, delta: 100, clockAdjustment: 0 },
  { batch: false, delta: -100, clockAdjustment: -1 },
  { batch: true, delta: -100, clockAdjustment: 0, lateConflict: true },
  { batch: true, delta: -100, clockAdjustment: 0, deadline: true },
  {
    batch: true,
    delta: -100,
    clockAdjustment: 0,
    deadline: true,
    newerPrefix: true,
  },
  {
    batch: true,
    delta: -100,
    clockAdjustment: 0,
    deadline: true,
    software: true,
  },
  {
    batch: true,
    delta: -100,
    clockAdjustment: 0,
    deadline: true,
    switchAtCommit: true,
  },
  {
    batch: true,
    delta: -100,
    clockAdjustment: 0,
    deadline: true,
    software: true,
    switchAtCommit: true,
  },
  {
    batch: true,
    delta: -100,
    clockAdjustment: 0,
    deadline: true,
    unsupportedCommit: true,
  },
])(
  'uses the original time only on the existing authenticated Account path (batch=$batch delta=$delta adjustment=$clockAdjustment lateConflict=$lateConflict deadline=$deadline newerPrefix=$newerPrefix software=$software switchAtCommit=$switchAtCommit unsupportedCommit=$unsupportedCommit)',
  async ({
    batch,
    delta,
    clockAdjustment,
    lateConflict,
    deadline,
    newerPrefix,
    software,
    switchAtCommit,
    unsupportedCommit,
  }) => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let stalledWireId: string | undefined;
    const requestedAt = 1_750_000_000_000;
    let conflictingWireId: string | undefined;
    let sameSource = true;
    const selectedCredential: ICloudSyncCredential = software
      ? {
          ...syncCredential,
          keylessCredential: {
            ...hardware,
            keylessWalletId: 'fixture-software',
            source: undefined,
            hardwareSession: undefined,
            pwdHash: 'keyless-delete-fixture',
          },
        }
      : syncCredential;
    const h = await fixture({
      selectedCredential,
      isCurrent: () => sameSource,
      useHistoricalTime: true,
      historicalClockAdjustment: clockAdjustment,
      beforeTime: async (db, wireId) => {
        if (wireId === stalledWireId) {
          started.resolve();
          await release.promise;
        }
        if (wireId !== conflictingWireId) return;
        await db.withTransaction(EIndexedDBBucketNames.account, (tx) =>
          db.txUpdateRecords({
            tx,
            name: ELocalDBStoreNames.CloudSyncItem,
            ids: [wireId],
            updater: (row) =>
              Object.assign(row, { dataTime: requestedAt + 100 }),
          }),
        );
      },
      beforeKey: async () => {
        jest.setSystemTime(requestedAt + 250);
      },
    });
    const second = {
      ...publicAccountTestSnapshot(1),
      wallet: h.snapshot.wallet,
    };
    const source = batch ? [h.snapshot, second] : [h.snapshot];
    if (deadline)
      source.push({
        ...publicAccountTestSnapshot(2),
        wallet: h.snapshot.wallet,
      });
    const accounts = source.map((snapshot) =>
      publicAccountSnapshotToAccount(snapshot, h.wallet.id),
    );
    const syncItems = await Promise.all(
      source.map(async (snapshot, index) => {
        const accountId = getPublicAccountSnapshotId(snapshot);
        const rawKey = `${EPrimeCloudSyncDataType.Account} >> ${accountId}`;
        const key = h.accountManager.rawKeyToHashKey(rawKey);
        return {
          ...(await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
            key,
            rawDataJson: {
              rawKey,
              dataType: EPrimeCloudSyncDataType.Account,
              payload: {
                accountId,
                name: snapshot.account.name,
                publicAccountSnapshot: snapshot,
              },
            },
            dataTime: requestedAt + (index === 0 ? delta : -100),
            syncCredential: index === 2 ? undefined : selectedCredential,
          })),
          ...(index === 2 ? {} : { rawData: '', serverUploaded: true }),
          localSceneUpdated: true,
          isDeleted: false,
        };
      }),
    );
    if (lateConflict) conflictingWireId = syncItems[1].id;
    if (deadline) stalledWireId = syncItems[1].id;
    await h.db.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        await h.db.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [h.old.id],
          updater: (row) => Object.assign(row, syncItems[0]),
        });
        if (batch) {
          await h.db.txAddRecords({
            tx,
            name: ELocalDBStoreNames.Account,
            records: accounts.slice(1),
          });
          await h.db.txAddRecords({
            tx,
            name: ELocalDBStoreNames.CloudSyncItem,
            records: syncItems.slice(1),
          });
          await h.db.txUpdateWallet({
            tx,
            walletId: h.wallet.id,
            updater: (wallet) =>
              Object.assign(wallet, {
                accounts: accounts.map((item) => item.id),
              }),
          });
        }
      },
      { skipCloudCredentialWarmup: true },
    );
    if (switchAtCommit) {
      const remove = h.db.txRemoveRecords.bind(h.db);
      jest.spyOn(h.db, 'txRemoveRecords').mockImplementation(async (params) => {
        const result = await remove(params);
        if (params.name === ELocalDBStoreNames.Account) sameSource = false;
        return result;
      });
    }
    const beforeCommit = Object.getOwnPropertyDescriptor(
      IDBTransaction.prototype,
      'commit',
    );
    if (unsupportedCommit) {
      Object.defineProperty(IDBTransaction.prototype, 'commit', {
        ...beforeCommit,
        value: undefined,
      });
    }
    const didRemove = jest.spyOn(h.db, 'txRemoveRecords');
    jest.useFakeTimers({
      now: requestedAt,
      doNotFake: ['setImmediate', 'nextTick'],
    });
    try {
      if (batch) {
        const removing = h.db.removeAccountsByIds({
          ids: accounts.map((item) => item.id),
        });
        if (deadline) {
          await started.promise;
          if (newerPrefix) {
            await h.other.withTransaction(EIndexedDBBucketNames.account, (tx) =>
              h.other.txUpdateRecords({
                tx,
                name: ELocalDBStoreNames.CloudSyncItem,
                ids: [syncItems[0].id],
                updater: (row) =>
                  Object.assign(row, { dataTime: requestedAt + 101 }),
              }),
            );
          }
          await jest.advanceTimersByTimeAsync(1000);
        }
        await removing;
      } else await h.remove();
      expect(Date.now()).toBe(requestedAt + (deadline ? 1250 : 250));
      if (unsupportedCommit)
        expect(
          didRemove.mock.calls.filter(
            ([operation]) => operation.name === ELocalDBStoreNames.Account,
          ),
        ).toHaveLength(1);
      for (let index = 0; index < accounts.length; index += 1) {
        const account = accounts[index];
        const original = syncItems[index];
        expect(
          await h.other.getAccountSafe({ accountId: account.id }),
        ).toBeFalsy();
        if (deadline && index === 2) {
          expect(
            await h.other.getSyncItemSafe({ id: original.id }),
          ).toBeFalsy();
          // eslint-disable-next-line no-continue
          continue;
        }
        const pool = await h.other.getSyncItem({ id: original.id });
        if (deadline && (index === 1 || switchAtCommit || unsupportedCommit)) {
          expect(pool).toEqual(original);
        } else if (newerPrefix && index === 0) {
          expect(pool).toEqual({ ...original, dataTime: requestedAt + 101 });
        } else if (lateConflict && index === 1) {
          expect(pool).toMatchObject({
            isDeleted: false,
            dataTime: requestedAt + 100,
            data: original.data,
          });
        } else if ((delta >= 0 && index === 0) || clockAdjustment) {
          expect(pool).toMatchObject({
            isDeleted: false,
            dataTime: original.dataTime,
            data: original.data,
          });
        } else {
          expect(pool).toMatchObject({
            isDeleted: true,
            dataTime: requestedAt,
            pwdHash: selectedCredential.keylessCredential?.pwdHash,
            serverUploaded: false,
          });
        }
      }
      release.resolve();
      await jest.advanceTimersByTimeAsync(1000);
      if (deadline)
        expect(await h.other.getSyncItem({ id: syncItems[1].id })).toEqual(
          syncItems[1],
        );
      expect(h.syncLater).toHaveBeenCalledTimes(
        !clockAdjustment &&
          !newerPrefix &&
          !switchAtCommit &&
          !unsupportedCommit &&
          (batch || delta < 0)
          ? 1
          : 0,
      );
    } finally {
      if (unsupportedCommit && beforeCommit)
        Object.defineProperty(IDBTransaction.prototype, 'commit', beforeCommit);
      release.resolve();
      jest.useRealTimers();
    }
  },
);

it.each([
  { delta: -40, shouldDeleteInCloud: true },
  { delta: 0, shouldDeleteInCloud: false },
  { delta: 40, shouldDeleteInCloud: false },
  { delta: -40, shouldDeleteInCloud: false, unverified: true },
])(
  'uses the authenticated Account and normalized click ($delta cloud=$shouldDeleteInCloud unverified=$unverified)',
  async ({ delta, shouldDeleteInCloud, unverified }) => {
    const wallClick = 1_750_000_000_000;
    const correctedClick = wallClick - 300;
    const h = await fixture({
      useHistoricalTime: true,
      historicalClockCeiling: wallClick - 50,
      beforeKey: async () => {
        jest.setSystemTime(wallClick + 250);
      },
    });
    const rawKey = h.old.rawKey;
    const sealed = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
      key: h.old.id,
      rawDataJson: {
        rawKey,
        dataType: EPrimeCloudSyncDataType.Account,
        payload: {
          accountId: getPublicAccountSnapshotId(h.snapshot),
          name: h.snapshot.account.name,
          publicAccountSnapshot: h.snapshot,
        },
      },
      dataTime: correctedClick + delta,
      syncCredential,
    });
    await h.db.withTransaction(EIndexedDBBucketNames.account, (tx) =>
      h.db.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: [h.old.id],
        updater: (row) =>
          Object.assign(row, {
            ...sealed,
            rawData: '',
            localSceneUpdated: true,
            serverUploaded: true,
          }),
      }),
    );
    jest.useFakeTimers({
      now: wallClick,
      doNotFake: ['setImmediate', 'nextTick'],
    });
    const capture = jest
      .spyOn(systemTimeUtils, 'captureColdCloudActionTime')
      .mockImplementation((time) => () => (unverified ? time : correctedClick));
    try {
      await h.remove();
      expect(capture).toHaveBeenCalledWith(wallClick);
      expect(
        await h.other.getAccountSafe({ accountId: h.account.id }),
      ).toBeFalsy();
      expect(await h.other.getSyncItem({ id: h.old.id })).toMatchObject({
        isDeleted: shouldDeleteInCloud,
        dataTime: shouldDeleteInCloud ? correctedClick : correctedClick + delta,
      });
      await jest.advanceTimersByTimeAsync(1000);
      expect(h.syncLater).toHaveBeenCalledTimes(shouldDeleteInCloud ? 1 : 0);
    } finally {
      capture.mockRestore();
      jest.useRealTimers();
    }
  },
);
