import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

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

import { CloudSyncFlowManagerAccount as V1Reader } from './CloudSyncFlowManagerAccount.v1.test-utils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBCloudSyncItem, IDBWallet } from '../../../dbs/local/types';

jest.mock('../publicAccountSnapshotImport', () => ({
  importPublicAccountSnapshots: jest.fn(),
}));

// Synthetic test-only encryption material, never used with a real Cloud space.
const credential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'v1-compatibility-test',
    signingPrivateKey: '11'.repeat(32),
    signingPublicKey: '02'.repeat(33),
    encryptionKey: '22'.repeat(32),
    pwdHash: 'keyless-v1-compatibility-test',
  },
};

test('frozen 5e352660 reader retains v2 records and tombstones and cannot echo v1 over them', async () => {
  const wallet: IDBWallet = {
    id: 'hw-local',
    type: 'hw',
    name: 'Local',
    xfp: PUBLIC_ACCOUNT_TEST_XFP,
    associatedDevice: 'local-device',
    accounts: [],
    nextIds: {},
    walletNo: 1,
    backuped: true,
  };
  const pool = new Map<string, IDBCloudSyncItem>();
  const updateSyncItem = jest.fn();
  const removeAccount = jest.fn();
  const removeCloudSyncPoolItems = jest.fn();
  const publishPublicAccountSnapshotStatus = jest.fn(async () => undefined);
  const bg = {
    localDb: {
      getWalletSafe: jest.fn(async () => wallet),
      getDeviceSafe: jest.fn(async () => ({
        id: 'local-device',
        vendor: 'onekey',
      })),
      getAllWallets: jest.fn(async () => ({ wallets: [wallet] })),
      getSyncItemSafe: jest.fn(async ({ id }: { id: string }) => {
        const item = pool.get(id);
        return item ? { ...item } : undefined;
      }),
      getAccountSafe: jest.fn(async () => undefined),
      updateSyncItem,
      removeAccount,
      removeCloudSyncPoolItems,
    },
    serviceKeylessCloudSync: {
      getCloudAccountImportGeneration: () => 0,
      runWithCloudAccountImportLock: async <T>(operation: () => Promise<T>) =>
        operation(),
    },
    servicePrimeCloudSync: {
      getSyncCredentialSafe: async () => credential,
      getPublicAccountSnapshotImportGeneration: () => 0,
      getAllLocalSyncItems: async () => ({
        items: [...pool.values()].map((item) => ({ ...item })),
      }),
      getCloudSyncDataTime: async () => 1_750_000_000_000,
      publishPublicAccountSnapshotStatus,
    },
  };
  const manager = new V1Reader({
    backgroundApi: bg as unknown as IBackgroundApi,
  });
  const snapshots: ICloudPublicAccountSnapshot[] = [false, true].map(
    (deleted) => {
      const base = publicAccountTestSnapshot(deleted ? 1 : 0);
      return { ...base, version: 2, capabilities: ['account-copy-v2'] };
    },
  );
  for (const [index, snapshot] of snapshots.entries()) {
    const accountId = getPublicAccountSnapshotId(snapshot);
    const rawKey = `Account >> ${accountId}`;
    const item = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
      key: manager.rawKeyToHashKey(rawKey),
      dataTime: 1_750_000_000_000,
      syncCredential: credential,
      rawDataJson: {
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey,
        payload: {
          accountId,
          name: snapshot.account.name,
          publicAccountSnapshot: snapshot,
        },
      },
    });
    item.rawData = '';
    item.isDeleted = index === 1;
    pool.set(item.id, item);
  }
  const before = [...pool.values()].map((item) => ({ ...item }));
  await manager.syncToScene({
    syncCredential: credential,
    items: [...pool.values()].map((item) => ({ ...item })),
  });
  expect(importPublicAccountSnapshots).not.toHaveBeenCalled();
  expect(removeAccount).not.toHaveBeenCalled();
  expect(removeCloudSyncPoolItems).not.toHaveBeenCalled();
  expect(updateSyncItem).not.toHaveBeenCalled();
  expect([...pool.values()]).toEqual(before);
  expect(publishPublicAccountSnapshotStatus).toHaveBeenCalledWith(
    expect.objectContaining({
      counts: expect.objectContaining({ needsUpdate: 2 }),
    }),
  );
  const initialized = await manager.buildInitSyncDBItems({
    dbRecords: snapshots.map((snapshot) =>
      publicAccountSnapshotToAccount(snapshot, wallet.id),
    ),
    allDevices: [
      { id: 'local-device', vendor: 'onekey' },
    ] as unknown as Parameters<
      V1Reader['buildInitSyncDBItems']
    >[0]['allDevices'],
    initDataTime: undefined,
    syncCredential: credential,
  });
  expect(initialized).toEqual([]);
  expect([...pool.values()]).toEqual(before);
});
