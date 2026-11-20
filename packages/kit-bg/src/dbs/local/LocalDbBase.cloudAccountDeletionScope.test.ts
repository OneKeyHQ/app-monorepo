import { EDeviceType } from '@onekeyfe/hd-shared';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerAccount } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';
import {
  getPublicAccountSnapshotId,
  normalizePublicAccountSnapshotRecord,
  publicAccountSnapshotToAccount,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot';
import {
  PUBLIC_ACCOUNT_TEST_XFP,
  publicAccountTestSnapshot,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.test-utils';

import { INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE } from './consts';
import { IndexedDBAgent } from './indexed/IndexedDBAgent';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBCloudSyncItem, IDBWallet } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

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
  beforeTime,
  foreign,
}: {
  refuseAuthority?: boolean;
  beforeTime?: (
    db: LocalDbIndexed,
    id: string,
    accountId: string,
  ) => Promise<void>;
  foreign?: Partial<IDBCloudSyncItem>;
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
    ...publicAccountTestSnapshot(),
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
  const stages: string[] = [];
  const managers: { account?: CloudSyncFlowManagerAccount } = {};
  const scoped = {
    localDb: db,
    serviceKeylessCloudSync: {
      runWithCloudSyncKeyLock: async <T>(fn: () => Promise<T>) => {
        stages.push('key');
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
      getSyncCredentialSafe: async () => syncCredential,
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
  ).map((item) => item.record);
}

beforeEach(() => {
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
  jest.replaceProperty(platformEnv, 'isDesktop', true);
  jest.replaceProperty(platformEnv, 'isMas', false);
  jest.replaceProperty(platformEnv, 'isDev', false);
});

afterEach(() => jest.restoreAllMocks());

it('stores the actual current encrypted tombstone plus old foreign archive in the local deletion commit', async () => {
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
] as const)(
  'preserves the original foreign row and does not pretend to delete or upload: %s',
  async (scenario) => {
    let newest: IDBCloudSyncItem | undefined;
    const h = await fixture({
      refuseAuthority: scenario === 'revoked',
      foreign:
        scenario === 'prior-intent'
          ? {
              pendingPublicAccountDeletionAt: 9100,
              pendingPublicAccountDeletionHash: 'prior-live-intent',
            }
          : undefined,
      beforeTime: async (other, id, accountId) => {
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
    await expect(h.remove()).rejects.toThrow();
    expect(await h.other.getSyncItem({ id: h.old.id })).toEqual(
      newest ?? h.old,
    );
    expect(await archived(h.other)).toEqual([]);
    expect(
      await h.other.getAccountSafe({ accountId: h.account.id }),
    ).toBeTruthy();
    expect(h.syncLater).not.toHaveBeenCalled();
  },
);
