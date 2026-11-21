import { EDeviceType } from '@onekeyfe/hd-shared';
import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBDevice, IDBWallet } from './types';
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
