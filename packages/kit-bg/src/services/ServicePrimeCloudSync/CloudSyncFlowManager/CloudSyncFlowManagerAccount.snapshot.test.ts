import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type {
  ICloudSyncCredential,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import cloudSyncItemBuilder from '../cloudSyncItemBuilder';
import {
  getPublicAccountSnapshotId,
  publicAccountSnapshotToAccount,
} from '../publicAccountSnapshot';
import {
  PUBLIC_ACCOUNT_TEST_XFP,
  publicAccountTestSnapshot,
} from '../publicAccountSnapshot.test-utils';
import { importPublicAccountSnapshots } from '../publicAccountSnapshotImport';

import { CloudSyncFlowManagerAccount } from './CloudSyncFlowManagerAccount';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBCloudSyncItem, IDBWallet } from '../../../dbs/local/types';
import type { IPrimeCloudSyncPersistAtomData } from '../../../states/jotai/atoms/prime';

let mockConfig: IPrimeCloudSyncPersistAtomData;
jest.mock('../../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    set: jest.fn(
      async (
        update: (
          value: IPrimeCloudSyncPersistAtomData,
        ) => IPrimeCloudSyncPersistAtomData,
      ) => {
        mockConfig = update(mockConfig);
      },
    ),
  },
}));
jest.mock('../publicAccountSnapshotImport', () => ({
  importPublicAccountSnapshots: jest.fn(),
}));

const credential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'public-crypto-fixture',
    signingPrivateKey: '11'.repeat(32),
    signingPublicKey: '02'.repeat(33),
    encryptionKey: '22'.repeat(32),
    pwdHash: 'keyless-public-fixture',
  },
};

function harness() {
  let generation = 0;
  const pool = new Map<string, IDBCloudSyncItem>();
  const wallet: IDBWallet = {
    id: 'hw-target',
    type: 'hw',
    name: 'Local hardware',
    xfp: PUBLIC_ACCOUNT_TEST_XFP,
    associatedDevice: 'local-device',
    backuped: true,
    walletNo: 1,
    accounts: [],
    nextIds: {},
  };
  const updateSyncItem = jest.fn(
    async ({
      ids,
      updater,
    }: Parameters<IBackgroundApi['localDb']['updateSyncItem']>[0]) => {
      for (const id of ids) {
        const row = pool.get(id);
        if (row) pool.set(id, await updater(row));
      }
    },
  );
  const getWalletSafe = jest.fn(async () => wallet);
  const getDeviceSafe = jest.fn(async () => ({
    id: 'local-device',
    vendor: 'onekey',
  }));
  const bg = {
    localDb: {
      getWalletSafe,
      getDeviceSafe,
      getAllWallets: jest.fn(async () => ({ wallets: [wallet] })),
      getSyncItemSafe: jest.fn(async ({ id }: { id: string }) => pool.get(id)),
      getAccountSafe: jest.fn(async () => undefined),
      updateSyncItem,
    },
    serviceKeylessCloudSync: {
      getCloudAccountImportGeneration: () => generation,
      runWithCloudAccountImportLock: async <T>(operation: () => Promise<T>) =>
        operation(),
    },
    servicePrimeCloudSync: {
      getSyncCredentialSafe: jest.fn(async () => credential),
      getPublicAccountSnapshotImportGeneration: () => 0,
      getAllLocalSyncItems: jest.fn(async () => ({
        items: Array.from(pool.values()),
      })),
      getCloudSyncDataTime: jest.fn(async () => 1_750_000_000_000),
    },
  };
  const manager = new CloudSyncFlowManagerAccount({
    backgroundApi: bg as unknown as IBackgroundApi,
  });
  return {
    manager,
    pool,
    wallet,
    bg,
    updateSyncItem,
    cancel: () => {
      generation += 1;
    },
  };
}

async function encryptedItem(
  manager: CloudSyncFlowManagerAccount,
  snapshot: unknown = publicAccountTestSnapshot(),
  accountId = getPublicAccountSnapshotId(publicAccountTestSnapshot()),
) {
  const rawKey = `${EPrimeCloudSyncDataType.Account} >> ${accountId}`;
  const item = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
    key: manager.rawKeyToHashKey(rawKey),
    rawDataJson: {
      dataType: EPrimeCloudSyncDataType.Account,
      rawKey,
      payload: {
        name: (snapshot as { account?: { name?: string } }).account?.name ?? '',
        accountId,
        publicAccountSnapshot: snapshot,
      },
    } as ICloudSyncRawDataJson,
    syncCredential: credential,
    dataTime: 1_750_000_000_000,
  });
  item.rawData = '';
  item.rawKey = '';
  item.serverUploaded = true;
  return item;
}

describe('public account snapshot Cloud scene integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = { isCloudSyncEnabled: false, isCloudSyncEnabledKeyless: true };
    jest
      .mocked(importPublicAccountSnapshots)
      .mockImplementation(async ({ snapshots }) => ({
        appliedSnapshotIds: snapshots.map((value) =>
          getPublicAccountSnapshotId(
            value as ReturnType<typeof publicAccountTestSnapshot>,
          ),
        ),
        added: snapshots.length,
        unchanged: 0,
        pending: 0,
        conflicts: 0,
        rejected: 0,
        cancelled: false,
      }));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('decrypts real Cloud ciphertext, copies data and acknowledges in batches without an echo', async () => {
    const h = harness();
    const items = await Promise.all(
      Array.from({ length: 100 }, async (_, index) => {
        const snapshot = publicAccountTestSnapshot(index);
        return encryptedItem(
          h.manager,
          snapshot,
          getPublicAccountSnapshotId(snapshot),
        );
      }),
    );
    items.forEach((item) => h.pool.set(item.id, item));
    await h.manager.syncToScene({ syncCredential: credential, items });
    expect(importPublicAccountSnapshots).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(importPublicAccountSnapshots).mock.calls[0][0].snapshots,
    ).toHaveLength(100);
    expect(h.updateSyncItem).toHaveBeenCalledTimes(2);
    expect(
      Array.from(h.pool.values()).every(
        (item) =>
          item.localSceneUpdated && item.serverUploaded && !item.rawData,
      ),
    ).toBe(true);
    expect(h.bg.localDb.getAccountSafe).not.toHaveBeenCalled();
    expect(mockConfig.publicAccountSnapshotStatus?.added).toBe(100);
  });

  test('future formats, unknown fields, wrong keys and oversized records never reach import', async () => {
    const h = harness();
    const known = await encryptedItem(h.manager);
    const future = await encryptedItem(
      h.manager,
      { ...publicAccountTestSnapshot(), version: 2, futureField: true },
      'cloud-public-account:v2:future',
    );
    const unknownField = await encryptedItem(
      h.manager,
      { ...publicAccountTestSnapshot(), secret: 'invalid-field' },
      'cloud-public-account:v1:bad-fields',
    );
    const wrongKey = await encryptedItem(
      h.manager,
      publicAccountTestSnapshot(),
      'cloud-public-account:v1:wrong-key',
    );
    const large = {
      ...known,
      id: 'oversized',
      data: 'x'.repeat(64 * 1024 + 1),
    };
    const items = [future, unknownField, wrongKey, large, known];
    items.forEach((item) => h.pool.set(item.id, item));
    await h.manager.syncToScene({ syncCredential: credential, items });
    expect(
      jest.mocked(importPublicAccountSnapshots).mock.calls[0][0].snapshots,
    ).toHaveLength(1);
    expect(h.pool.get(future.id)?.localSceneUpdated).toBe(false);
    expect(h.pool.get(unknownField.id)?.localSceneUpdated).toBe(false);
    expect(h.pool.get(known.id)?.localSceneUpdated).toBe(true);
    expect(mockConfig.publicAccountSnapshotStatus).toMatchObject({
      needsUpdate: 1,
      rejected: 3,
      added: 1,
    });
    expect(h.pool.size).toBe(5);
  });

  test('retains an acknowledged tombstone without importing or deleting any account', async () => {
    const h = harness();
    const item = await encryptedItem(h.manager);
    item.isDeleted = true;
    h.pool.set(item.id, item);
    await h.manager.syncToScene({ syncCredential: credential, items: [item] });
    expect(importPublicAccountSnapshots).not.toHaveBeenCalled();
    expect(h.pool.get(item.id)).toMatchObject({
      isDeleted: true,
      localSceneUpdated: true,
    });
    expect(h.manager.removeSyncItemIfServerDeleted).toBe(false);
  });

  test('cancellation during decryption does not copy data or acknowledge records', async () => {
    const h = harness();
    const item = await encryptedItem(h.manager);
    h.pool.set(item.id, item);
    const decrypt =
      cloudSyncItemBuilder.decryptSyncItem.bind(cloudSyncItemBuilder);
    jest
      .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
      .mockImplementationOnce(async (params) => {
        const result = await decrypt(params);
        h.cancel();
        return result;
      });
    await h.manager.syncToScene({ syncCredential: credential, items: [item] });
    expect(importPublicAccountSnapshots).not.toHaveBeenCalled();
    expect(h.updateSyncItem).not.toHaveBeenCalled();
  });

  test('a repeated full scan builds no snapshot when its key already exists', async () => {
    const h = harness();
    const snapshot = publicAccountTestSnapshot();
    const item = await encryptedItem(h.manager);
    h.pool.set(item.id, item);
    const account = publicAccountSnapshotToAccount(snapshot, h.wallet.id);
    await expect(
      h.manager.buildInitSyncDBItems({
        dbRecords: [account],
        allDevices: [
          { id: 'local-device', vendor: 'onekey' },
        ] as unknown as Parameters<
          CloudSyncFlowManagerAccount['buildInitSyncDBItems']
        >[0]['allDevices'],
        initDataTime: undefined,
        syncCredential: credential,
      }),
    ).resolves.toEqual([]);
    expect(h.bg.localDb.getAllWallets).toHaveBeenCalledTimes(1);
  });

  test('the shared initializer bounds 1000 lookups and does not re-encrypt unchanged Keyless rows', async () => {
    const h = harness();
    let active = 0;
    let maximum = 0;
    h.bg.localDb.getSyncItemSafe.mockImplementation(async ({ id }) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      active -= 1;
      return {
        id,
        rawKey: '',
        rawData: '',
        dataType: EPrimeCloudSyncDataType.Account,
        data: 'existing encrypted fixture',
        pwdHash: cloudSyncItemBuilder.getPwdHash(credential),
        dataTime: 1_750_000_000_000,
        isDeleted: false,
        localSceneUpdated: true,
        serverUploaded: true,
      };
    });
    const encrypt = jest.spyOn(cloudSyncItemBuilder, 'encryptSyncItem');
    const records = Array.from({ length: 1000 }, (_, index) => ({
      ...publicAccountSnapshotToAccount(
        publicAccountTestSnapshot(),
        'hw-unused',
      ),
      id: `watching--60--public-fixture-${index}`,
      indexedAccountId: undefined,
    }));
    await expect(
      h.manager._buildInitSyncDBItems({
        dbRecords: records,
        syncCredential: credential,
        initDataTime: undefined,
      }),
    ).resolves.toEqual([]);
    expect(h.bg.localDb.getSyncItemSafe).toHaveBeenCalledTimes(1000);
    expect(maximum).toBe(50);
    expect(encrypt).not.toHaveBeenCalled();
  });

  test('a tombstone is sticky and unknown future records cannot be renamed or deleted', async () => {
    const h = harness();
    const snapshot = publicAccountTestSnapshot();
    const account = publicAccountSnapshotToAccount(snapshot, h.wallet.id);
    const item = await encryptedItem(h.manager);
    h.pool.set(item.id, { ...item, isDeleted: true });
    await expect(
      h.manager.buildSyncItemByDBQuery({
        dbRecord: account,
        isDeleted: false,
        dataTime: undefined,
        syncCredential: credential,
      }),
    ).resolves.toBeUndefined();
    const future = await encryptedItem(h.manager, { ...snapshot, version: 2 });
    h.pool.set(item.id, future);
    await expect(
      h.manager.buildSyncItemByDBQuery({
        dbRecord: account,
        isDeleted: false,
        dataTime: undefined,
        syncCredential: credential,
      }),
    ).resolves.toBeUndefined();
    await expect(
      h.manager.buildSyncItemByDBQuery({
        dbRecord: account,
        isDeleted: true,
        dataTime: undefined,
        syncCredential: credential,
      }),
    ).rejects.toThrow('compatible App version');
    expect(h.pool.get(item.id)?.data).toBe(future.data);
  });
});
