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

it('reads a Wallet and its pending encrypted row in one read-only account transaction', async () => {
  const db = new LocalDbIndexed();
  const wallet: IDBWallet = {
    id: 'hd-wallet-retry-fixture',
    name: 'Latest canonical name',
    type: 'hd',
    accounts: [],
    nextIds: {},
    backuped: true,
    walletNo: 900,
  };
  const item: IDBCloudSyncItem = {
    id: 'wallet-retry-wire-id',
    pwdHash: 'hw-dek-test-current',
    dataType: EPrimeCloudSyncDataType.Wallet,
    data: 'test-encrypted-row',
    dataTime: 1_750_000_000_000,
    rawKey: '',
    rawData: '',
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: false,
  };
  await db.withTransaction(
    EIndexedDBBucketNames.account,
    async (tx) => {
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        records: [wallet],
      });
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        records: [item],
      });
    },
    { skipCloudCredentialWarmup: true },
  );
  const transaction = jest.spyOn(db, 'withTransaction');
  await expect(
    db.readWalletNameUploadRetrySources({
      walletIds: [wallet.id],
      itemIds: [item.id],
      deviceIds: [],
    }),
  ).resolves.toEqual({ wallets: [wallet], items: [item], devices: [] });
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(transaction).toHaveBeenCalledWith(
    EIndexedDBBucketNames.account,
    expect.any(Function),
    { readOnly: true, skipCloudCredentialWarmup: true },
  );
});

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
  'stale-same-key',
  'same-key-fractional-time',
  'verification-read-unavailable',
  'hardware-verification-read-unavailable',
  'hardware-verification-read-timeout',
  'hardware-verification-row-deleted',
  'hardware-verification-row-replaced',
  'verification-read-delayed',
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
    let dataTime = 3000;
    if (scenario === 'stale-same-key') dataTime = 1000;
    if (scenario === 'same-key-fractional-time') dataTime = 3000.5;
    const candidate: IDBCloudSyncItem = {
      ...original,
      pwdHash,
      data:
        scenario === 'without-key' || scenario === 'same-key-without-data'
          ? ''
          : 'cd'.repeat(48),
      dataTime,
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
    const isHardwareRetryFixture = scenario.startsWith('hardware-');
    const schedule = jest.fn();
    const captureWalletUploadReadRetry = jest.fn(() => schedule);
    const hardwareCredential = { hardwareSession: {}, pwdHash };
    const uploaded = Promise.withResolvers<void>();
    const apiUploadItems = jest.fn(async () => uploaded.resolve());
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
        captureWalletUploadReadRetry,
        syncManagers: {
          wallet: {
            getSyncCredential: jest.fn(async () =>
              isHardwareRetryFixture
                ? { keylessCredential: hardwareCredential }
                : undefined,
            ),
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
    if (scenario === 'verification-read-unavailable') {
      jest
        .spyOn(db, 'getSyncItem')
        .mockRejectedValueOnce(
          new OneKeyLocalError('Synthetic verification read error'),
        );
    }
    const blockedHardwareRead =
      scenario === 'hardware-verification-read-timeout'
        ? Promise.withResolvers<void>()
        : undefined;
    const settledHardwareRead = Promise.withResolvers<void>();
    if (isHardwareRetryFixture) {
      const read = db.getRecordById.bind(db);
      jest.spyOn(db, 'getRecordById').mockImplementation(async (params) => {
        if (params.name === ELocalDBStoreNames.CloudSyncItem) {
          if (blockedHardwareRead) {
            await blockedHardwareRead.promise;
            const record = await read(params);
            settledHardwareRead.resolve();
            return record;
          }
          if (scenario === 'hardware-verification-read-unavailable')
            throw new OneKeyLocalError('Synthetic pool read error');
          if (scenario === 'hardware-verification-row-deleted')
            return undefined;
          const record = await read(params);
          return record ? { ...record, data: 'replacement-box' } : record;
        }
        return read(params);
      });
    }
    const delayedRead =
      scenario === 'verification-read-delayed'
        ? Promise.withResolvers<IDBCloudSyncItem>()
        : undefined;
    if (delayedRead) {
      jest
        .spyOn(db, 'getSyncItem')
        .mockImplementationOnce(() => delayedRead.promise);
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
    if (isHardwareRetryFixture) {
      expect(captureWalletUploadReadRetry).toHaveBeenCalledWith(
        hardwareCredential,
      );
      if (scenario === 'hardware-verification-read-unavailable')
        expect(schedule).toHaveBeenCalledWith(
          candidate,
          expect.any(OneKeyLocalError),
        );
      else if (blockedHardwareRead) {
        expect(apiUploadItems).not.toHaveBeenCalled();
        // Let the original read finish after its deadline. The only possible
        // second attempt belongs to the already scoped background queue.
        await new Promise<void>((resolve) => setTimeout(resolve, 1600));
        blockedHardwareRead.resolve();
        await settledHardwareRead.promise;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        expect(schedule).toHaveBeenCalledTimes(1);
        expect(schedule).toHaveBeenCalledWith(candidate, undefined);
      } else expect(schedule).not.toHaveBeenCalled();
      expect(apiUploadItems).not.toHaveBeenCalled();
      // An independent handle still sees the committed business and pool rows.
      await expect(
        new LocalDbIndexed().getSyncItem({ id: candidate.id }),
      ).resolves.toMatchObject({ data: candidate.data, serverUploaded: false });
    } else if (
      scenario === 'same-key' ||
      scenario === 'same-key-fractional-time' ||
      scenario === 'verification-read-unavailable' ||
      scenario === 'verification-read-delayed' ||
      scenario === 'missing-row'
    ) {
      const accepted = await db.getSyncItem({ id: original.id });
      expect(accepted).toMatchObject({
        data: candidate.data,
        pwdHash: original.pwdHash,
        dataTime: Math.floor(candidate.dataTime ?? 0),
      });
      if (scenario === 'verification-read-unavailable') {
        expect(apiUploadItems).not.toHaveBeenCalled();
      } else {
        if (delayedRead) {
          // The Wallet edit is committed (including across adapter reopen)
          // even while the optional verification read has not resolved.
          expect(apiUploadItems).not.toHaveBeenCalled();
          delayedRead.resolve(accepted);
          await uploaded.promise;
        }
        expect(apiUploadItems).toHaveBeenCalledTimes(1);
        expect(apiUploadItems).toHaveBeenCalledWith({ localItems: [accepted] });
      }
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

it.each(['name-changed', 'source-changed', 'same-version'] as const)(
  'revalidates a retained Wallet name in the scene transaction (%s)',
  async (scenario) => {
    const db = new LocalDbIndexed();
    const wallet: IDBWallet = {
      id: `hd-retained-name-cas-${scenario}`,
      name: scenario === 'name-changed' ? 'Later local name' : 'Retained name',
      type: 'hd',
      accounts: [],
      nextIds: {},
      backuped: true,
      walletNo: 212,
    };
    const source: IDBCloudSyncItem = {
      id: `wallet-retained-name-cas-${scenario}`,
      data: 'current-server-box',
      dataTime: 900,
      dataType: EPrimeCloudSyncDataType.Wallet,
      rawKey: 'synthetic',
      rawData: '',
      pwdHash: 'keyless-current',
      isDeleted: false,
      localSceneUpdated: false,
      serverUploaded: true,
    };
    await db.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        await db.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Wallet,
          records: [wallet],
        });
        await db.txAddRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          records: [
            {
              ...source,
              dataTime: scenario === 'source-changed' ? 901 : source.dataTime,
            },
          ],
        });
      },
      { skipCloudCredentialWarmup: true },
    );
    db.setBackgroundApi({
      servicePrimeCloudSync: { syncManagers: {} },
    } as unknown as IBackgroundApi);
    const apply = db.setWalletNameAndAvatar({
      walletId: wallet.id,
      name: 'Server name',
      cloudSyncSource: source,
      expectedCloudSyncWalletName: 'Retained name',
      skipSaveLocalSyncItem: true,
    });
    if (scenario === 'same-version') {
      await expect(apply).resolves.toMatchObject({ name: 'Server name' });
    } else {
      await expect(apply).rejects.toThrow(
        scenario === 'name-changed'
          ? 'Wallet name changed before the Cloud scene update'
          : 'Cloud sync metadata source changed',
      );
    }
    await expect(
      new LocalDbIndexed().getWallet({
        walletId: wallet.id,
        withoutRefill: true,
      }),
    ).resolves.toMatchObject({
      name: scenario === 'same-version' ? 'Server name' : wallet.name,
    });
  },
);
