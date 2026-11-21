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
