import { EDeviceType } from '@onekeyfe/hd-shared';
import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBCloudSyncItem, IDBDevice, IDBWallet } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

afterEach(() => jest.restoreAllMocks());

async function expectSavedWithoutCloudWarmup(
  save: () => Promise<IDBWallet>,
): Promise<IDBWallet> {
  const started = Promise.withResolvers<'warmup'>();
  const blocked = Promise.withResolvers<void>();
  const hydrate = jest.fn(() => {
    started.resolve('warmup');
    return blocked.promise;
  });
  const property = jest.replaceProperty(appGlobals, '$backgroundApiProxy', {
    serviceKeylessCloudSync: {
      hydrateKeylessSyncCredentialFromStorageIfNeeded: hydrate,
    },
  } as unknown as typeof appGlobals.$backgroundApiProxy);
  const mutation = save();
  try {
    await expect(
      Promise.race([mutation.then(() => 'saved'), started.promise]),
    ).resolves.toBe('saved');
    expect(hydrate).not.toHaveBeenCalled();
    return await mutation;
  } finally {
    blocked.resolve();
    await mutation.catch(() => undefined);
    property.restore();
  }
}

it.each([
  [EHardwareVendor.ledger, true],
  [EHardwareVendor.trezor, true],
  [EHardwareVendor.onekey, false],
] as const)(
  'a stale Cloud key does not prevent device-local metadata for vendor %s',
  async (vendor, isLocalOnly) => {
    const db = new LocalDbIndexed();
    const device: IDBDevice = {
      id: `test-device-${vendor}`,
      name: 'Previous label',
      features: '{}',
      connectId: `test-connection-${vendor}`,
      uuid: `test-hardware-${vendor}`,
      deviceId: `test-device-id-${vendor}`,
      deviceType: EDeviceType.Classic,
      settingsRaw: JSON.stringify({ vendor }),
      createdAt: 1,
      updatedAt: 1,
    };
    const wallet: IDBWallet = {
      id: `hw-test-${vendor}`,
      name: 'Previous name',
      type: 'hw',
      accounts: [],
      nextIds: {},
      backuped: true,
      associatedDevice: device.id,
      walletNo: 100,
    };
    const getSyncCredential = jest.fn();
    const apiUploadItems = jest.fn();
    const runWithCloudSyncKeyLock = jest.fn(async () => {
      throw new OneKeyLocalError('Synthetic unreadable Cloud key');
    });
    db.setBackgroundApi({
      serviceKeylessCloudSync: { runWithCloudSyncKeyLock },
      servicePrimeCloudSync: {
        apiUploadItems,
        syncManagers: { wallet: { getSyncCredential } },
      },
    } as unknown as IBackgroundApi);
    await db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        records: [device],
      });
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        records: [wallet],
      });
    });

    const update = () =>
      db.setWalletNameAndAvatar({
        walletId: wallet.id,
        name: 'New local name',
        avatar: { img: 'bear' },
      });
    if (isLocalOnly) {
      const saved = await expectSavedWithoutCloudWarmup(update);
      expect(saved.name).toBe('New local name');
      await expect(
        db.getRecordById({ name: ELocalDBStoreNames.Wallet, id: wallet.id }),
      ).resolves.toMatchObject({
        name: 'New local name',
        avatar: '{"img":"bear"}',
      });
      expect(runWithCloudSyncKeyLock).not.toHaveBeenCalled();
    } else {
      await expect(update()).rejects.toThrow('Synthetic unreadable Cloud key');
      await expect(
        db.getRecordById({ name: ELocalDBStoreNames.Wallet, id: wallet.id }),
      ).resolves.toMatchObject({ name: wallet.name });
      expect(runWithCloudSyncKeyLock).toHaveBeenCalledTimes(1);
    }
    expect(getSyncCredential).not.toHaveBeenCalled();
    expect(apiUploadItems).not.toHaveBeenCalled();
  },
);

it.each([
  { confirmedOff: true, type: 'hd' },
  { confirmedOff: true, type: 'hw' },
  { confirmedOff: false, type: 'hd' },
] as const)(
  'uses the common local-only Wallet path only for confirmed Off (Off=$confirmedOff, type=$type)',
  async ({ confirmedOff, type }) => {
    const db = new LocalDbIndexed();
    const wallet: IDBWallet = {
      id: `${type}-explicit-off-v21-${String(confirmedOff)}`,
      name: 'Prior name',
      type,
      associatedDevice:
        type === 'hw' ? 'missing-hw-read-must-not-start' : undefined,
      accounts: [],
      nextIds: {},
      backuped: true,
      walletNo: 200,
      avatar: '{"img":"bear"}',
    };
    const changedName = confirmedOff
      ? `Changed while Off ${type}`
      : 'Changed after guard';
    const getWalletDevice = jest.spyOn(db, 'getWalletDeviceSafe');
    const getSyncCredential = jest.fn(async () => undefined);
    const buildSyncItemByDBQuery = jest.fn(async () => undefined);
    const prime = {
      apiUploadItems: jest.fn(async () => undefined),
      syncManagers: { wallet: { getSyncCredential, buildSyncItemByDBQuery } },
    };
    const recoveryStarted = Promise.withResolvers<void>();
    const recovery = Promise.withResolvers<void>();
    const runWithCloudSyncKeyLock = jest.fn(
      async <T>(operation: () => Promise<T>) => {
        recoveryStarted.resolve();
        await recovery.promise;
        return operation();
      },
    );
    db.setBackgroundApi({
      serviceKeylessCloudSync: {
        isExplicitWalletMetadataSyncOff: async () => confirmedOff,
        runWithCloudSyncKeyLock,
      },
      servicePrimeCloudSync: prime,
    } as unknown as IBackgroundApi);
    await db.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) =>
        db.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Wallet,
          records: [wallet],
        }),
      { skipCloudCredentialWarmup: true },
    );
    const rename = (name = changedName) =>
      db.setWalletNameAndAvatar({
        walletId: wallet.id,
        name,
        shouldCheckDuplicate: true,
        allowDesktopLocalMetadata: true,
      });
    const read = () =>
      new LocalDbIndexed().getRecordById({
        name: ELocalDBStoreNames.Wallet,
        id: wallet.id,
      });
    try {
      if (confirmedOff) {
        const saved = await expectSavedWithoutCloudWarmup(() => rename());
        expect(saved.name).toBe(changedName);
        expect(runWithCloudSyncKeyLock).not.toHaveBeenCalled();
        expect(getWalletDevice).not.toHaveBeenCalled();
        expect(getSyncCredential).not.toHaveBeenCalled();
        expect(buildSyncItemByDBQuery).not.toHaveBeenCalled();
      } else {
        const saving = rename();
        await recoveryStarted.promise;
        await expect(read()).resolves.toMatchObject({ name: 'Prior name' });
        expect(buildSyncItemByDBQuery).not.toHaveBeenCalled();
        recovery.resolve();
        await expect(saving).resolves.toMatchObject({ name: changedName });
        expect(runWithCloudSyncKeyLock).toHaveBeenCalledTimes(1);
        expect(getSyncCredential).toHaveBeenCalledTimes(1);
        expect(buildSyncItemByDBQuery).toHaveBeenCalledTimes(1);
      }
      await expect(read()).resolves.toMatchObject({
        name: changedName,
        avatar: '{"img":"bear"}',
      });
      expect(prime.apiUploadItems).not.toHaveBeenCalled();
    } finally {
      recovery.resolve();
    }
  },
);

it.each([
  'retained-off',
  'different-key',
  'without-key',
  'same-key-without-data',
  'same-key',
  'missing-row',
  'local-error',
] as const)(
  'preserves a bound Wallet copy without pretending the local edit synced (%s)',
  async (scenario) => {
    const db = new LocalDbIndexed();
    const wallet: IDBWallet = {
      id: `hd-retained-wallet-${scenario}`,
      name: 'Previous name',
      type: 'hd',
      accounts: [],
      nextIds: {},
      backuped: true,
      walletNo: 501,
    };
    const original: IDBCloudSyncItem = {
      id: `fixture-wallet-pool-${scenario}`,
      data: 'ab'.repeat(48),
      dataTime: 2000,
      dataType: EPrimeCloudSyncDataType.Wallet,
      rawKey: 'Wallet >> synthetic-same-wallet',
      rawData: '',
      pwdHash: 'hw-dek-original-fixture',
      // The status bit is not evidence of whether the key owns the ciphertext.
      serverUploaded: false,
      localSceneUpdated: true,
      isDeleted: false,
    };
    let pwdHash = original.pwdHash;
    if (scenario === 'without-key') pwdHash = '';
    if (scenario === 'different-key' || scenario === 'retained-off')
      pwdHash = 'hw-dek-different-fixture';
    const candidate: IDBCloudSyncItem = {
      ...original,
      pwdHash,
      data:
        scenario === 'without-key' || scenario === 'same-key-without-data'
          ? ''
          : 'cd'.repeat(48),
      dataTime: 3000,
    };
    await db.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        await db.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Wallet,
          records: [wallet],
        });
        if (scenario !== 'missing-row')
          await db.txAddRecords({
            tx,
            name: ELocalDBStoreNames.CloudSyncItem,
            records: [original],
          });
      },
      { skipCloudCredentialWarmup: true },
    );
    const before = await db.getSyncItemSafe({ id: original.id });
    const apiUploadItems = jest.fn(async () => undefined);
    const buildSyncItemByDBQuery = jest.fn(async () => candidate);
    const runWithCloudSyncKeyLock = jest.fn(async <T>(work: () => Promise<T>) =>
      work(),
    );
    db.setBackgroundApi({
      serviceKeylessCloudSync: {
        isExplicitWalletMetadataSyncOff: async () =>
          scenario === 'retained-off',
        runWithCloudSyncKeyLock,
      },
      servicePrimeCloudSync: {
        apiUploadItems,
        syncManagers: {
          wallet: {
            getSyncCredential: jest.fn(async () => undefined),
            buildSyncItemByDBQuery,
          },
        },
      },
    } as unknown as IBackgroundApi);
    if (scenario === 'local-error') {
      jest
        .spyOn(db, 'txUpdateWallet')
        .mockRejectedValueOnce(
          new OneKeyLocalError('Synthetic real wallet write error'),
        );
    }
    const rename = db.setWalletNameAndAvatar({
      walletId: wallet.id,
      name: `New local ${scenario}`,
      avatar: { img: 'bear' },
      allowDesktopLocalMetadata: true,
    });
    if (scenario === 'local-error') {
      await expect(rename).rejects.toThrow('Synthetic real wallet write error');
    } else {
      await expect(rename).resolves.toMatchObject({
        name: `New local ${scenario}`,
      });
    }
    await expect(
      new LocalDbIndexed().getWallet({
        walletId: wallet.id,
        withoutRefill: true,
      }),
    ).resolves.toMatchObject({
      name: scenario === 'local-error' ? wallet.name : `New local ${scenario}`,
    });
    if (scenario === 'same-key' || scenario === 'missing-row') {
      await expect(db.getSyncItem({ id: original.id })).resolves.toMatchObject({
        data: candidate.data,
        pwdHash: original.pwdHash,
        dataTime: candidate.dataTime,
      });
      expect(apiUploadItems).toHaveBeenCalledTimes(1);
      expect(apiUploadItems).toHaveBeenCalledWith({ localItems: [candidate] });
    } else {
      await expect(db.getSyncItem({ id: original.id })).resolves.toEqual(
        before,
      );
      expect(apiUploadItems).not.toHaveBeenCalled();
    }
    if (scenario === 'retained-off') {
      expect(runWithCloudSyncKeyLock).not.toHaveBeenCalled();
      expect(buildSyncItemByDBQuery).not.toHaveBeenCalled();
    }
  },
);
