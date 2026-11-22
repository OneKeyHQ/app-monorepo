import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import { Semaphore } from 'async-mutex';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { getDeviceAvatarImage } from '@onekeyhq/shared/src/utils/avatarUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerWallet } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import cloudSyncItemBuilder from '../../services/ServicePrimeCloudSync/cloudSyncItemBuilder';
import * as incrementalCloudSync from '../../services/ServicePrimeCloudSync/incrementalCloudSync';
import keylessCloudSyncUtils from '../../services/ServicePrimeCloudSync/keylessCloudSyncUtils';
import { SimpleDbEntityChangeHistory } from '../simple/entity/SimpleDbEntityChangeHistory';

import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBSetWalletNameAndAvatarParams,
  IDBWallet,
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('../../services/ServicePrimeCloudSync/incrementalCloudSync', () => ({
  __esModule: true,
  ...jest.requireActual<typeof incrementalCloudSync>(
    '../../services/ServicePrimeCloudSync/incrementalCloudSync',
  ),
}));

it.each([
  'server-current',
  'newer-manual-edit',
  'unchecked-pending',
  'unchecked-pending-with-avatar',
  'newer-pending-matches-local',
  'avatar-only',
] as const)('same-key hardware Off rename then scene: %s', async (scenario) => {
  const db = new LocalDbIndexed();
  const id = `fixture-hw-replay-${scenario}`;
  const wallet: IDBWallet = {
    id: `hw-${id}`,
    name: 'Original local',
    type: 'hw',
    associatedDevice: id,
    accounts: [],
    nextIds: {},
    backuped: true,
    walletNo: 8123,
  };
  const device: IDBDevice = {
    id,
    name: 'Fixture',
    connectId: id,
    deviceId: id,
    uuid: id,
    deviceType: EDeviceType.Pro,
    vendor: EHardwareVendor.onekey,
    features: '{}',
    settingsRaw: '{}',
    createdAt: 1,
    updatedAt: 1,
  };
  const historyBacking = new Map<string, unknown>();
  const history = new SimpleDbEntityChangeHistory();
  history.appStorage = {
    async getItem(key: string) {
      return historyBacking.get(key);
    },
    async setItem(key: string, value: unknown) {
      historyBacking.set(key, value);
    },
  } as unknown as typeof history.appStorage;
  const retainName = history.retainWalletName.bind(history);
  const retain = jest
    .spyOn(history, 'retainWalletName')
    .mockImplementation(async (params) => {
      const saved = await retainName(params);
      if (scenario === 'newer-manual-edit') {
        await db.setWalletNameAndAvatar({
          walletId: wallet.id,
          name: 'Newest manual edit',
          skipSaveLocalSyncItem: true,
        });
      }
      return saved;
    });
  let off = true;
  const apply = jest.fn((params: IDBSetWalletNameAndAvatarParams) =>
    db.setWalletNameAndAvatar(params),
  );
  const api = {
    localDb: db,
    simpleDb: { changeHistory: history },
    serviceAccount: { setWalletNameAndAvatar: apply },
    serviceKeylessCloudSync: {
      isExplicitWalletMetadataSyncOff: async () => off,
    },
    servicePrimeCloudSync: { syncManagers: {} },
  } as unknown as IBackgroundApi;
  db.setBackgroundApi(api);
  const manager = new CloudSyncFlowManagerWallet({ backgroundApi: api });
  jest
    .spyOn(db, 'getWalletBySyncPayload')
    .mockImplementation(async () =>
      db.getWallet({ walletId: wallet.id, withoutRefill: true }),
    );
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
        name: ELocalDBStoreNames.Device,
        records: [device],
      });
    },
    { skipCloudCredentialWarmup: true },
  );
  const keylessCredential = {
    ...(await keylessCloudSyncUtils.deriveKeylessCredential({
      seed: Buffer.alloc(32, 61),
      keylessWalletId: 'hw-fixture-scope',
    })),
    pwdHash: 'hw-dek-fixture-session',
  };
  const credential: ICloudSyncCredential = {
    keylessCredential,
    primeAccountSalt: '',
    masterPasswordUUID: '',
    securityPasswordR1: '',
  };
  const { key, rawKey, payload } = await manager.buildSyncKeyAndPayload({
    target: await manager.buildSyncTargetByDBQuery({
      dbRecord: wallet,
      allDevices: [device],
    }),
  });
  const isPending =
    scenario.startsWith('unchecked-pending') ||
    scenario === 'newer-pending-matches-local';
  let incomingName = 'Previously queued name';
  if (scenario === 'avatar-only') incomingName = '';
  if (scenario === 'newer-pending-matches-local')
    incomingName = 'Manual while off';
  const incoming: ICloudSyncPayloadWallet = {
    ...payload,
    name: incomingName,
    ...(scenario === 'avatar-only' ||
    scenario === 'unchecked-pending-with-avatar'
      ? { avatar: { img: 'bear' } }
      : {}),
  };
  const row: IDBCloudSyncItem = {
    id: key,
    rawKey,
    dataType: EPrimeCloudSyncDataType.Wallet,
    rawData: '',
    dataTime: 42_000,
    pwdHash: keylessCredential.pwdHash,
    serverUploaded: !isPending,
    localSceneUpdated: false,
    isDeleted: false,
    data: await keylessCloudSyncUtils.encryptWithKeylessKey({
      dataType: EPrimeCloudSyncDataType.Wallet,
      itemId: key,
      encryptionKey: keylessCredential.encryptionKey,
      rawData: stringUtils.stableStringify({
        rawKey,
        dataType: EPrimeCloudSyncDataType.Wallet,
        payload: incoming,
      }),
    }),
  };
  await db.withTransaction(
    EIndexedDBBucketNames.account,
    (tx) =>
      db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        records: [row],
      }),
    { skipCloudCredentialWarmup: true },
  );
  await expect(
    db.setWalletNameAndAvatar({
      walletId: wallet.id,
      allowDesktopLocalMetadata: true,
      name: 'Manual while off',
    }),
  ).resolves.toMatchObject({ name: 'Manual while off' });
  expect(await db.getSyncItem({ id: key })).toEqual(row);
  off = false;
  await expect(
    manager.canUploadPendingWalletName({
      item: row,
      syncCredential: credential,
    }),
  ).resolves.toBe(!scenario.startsWith('unchecked-pending'));
  await manager.syncToScene({
    items: [{ ...(await db.getSyncItem({ id: key })) }],
    syncCredential: credential,
  });
  const after = await db.getWallet({
    walletId: wallet.id,
    withoutRefill: true,
  });
  const reopened = new SimpleDbEntityChangeHistory();
  reopened.appStorage = history.appStorage;
  const entries = await reopened.getChangeHistory({
    entityId: wallet.id,
    entityType: EChangeHistoryEntityType.Wallet,
    contentType: EChangeHistoryContentType.Name,
  });
  if (scenario === 'server-current') {
    expect(after.name).toBe('Previously queued name');
    expect(entries.map((x) => x.value)).toEqual(['Manual while off']);
  } else if (scenario === 'newer-manual-edit') {
    expect(after.name).toBe('Newest manual edit');
    expect((await db.getSyncItem({ id: key })).localSceneUpdated).toBe(false);
  } else {
    expect(retain).not.toHaveBeenCalled();
    expect(after.name).toBe('Manual while off');
    if (scenario === 'avatar-only')
      expect(after.avatar).toBe(JSON.stringify({ img: 'bear' }));
    if (scenario.startsWith('unchecked-pending')) {
      expect(apply).not.toHaveBeenCalled();
      expect(await db.getSyncItem({ id: key })).toEqual(row);
      expect(after.avatar).toBeUndefined();

      // A later real server response may legitimately win this same version.
      // Model only that wire acknowledgment and rerun the selected-key scene,
      // never relabel a pending local row as server-originated in production.
      const fromServer = { ...row, serverUploaded: true };
      await db.withTransaction(EIndexedDBBucketNames.account, (tx) =>
        db.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [key],
          updater: (record) => Object.assign(record, { serverUploaded: true }),
        }),
      );
      await manager.syncToScene({
        items: [{ ...fromServer }],
        syncCredential: credential,
      });
      const chosen = await db.getWallet({
        walletId: wallet.id,
        withoutRefill: true,
      });
      expect(chosen.name).toBe('Previously queued name');
      expect(
        (
          await reopened.getChangeHistory({
            entityId: wallet.id,
            entityType: EChangeHistoryEntityType.Wallet,
            contentType: EChangeHistoryContentType.Name,
          })
        ).map((entry) => entry.value),
      ).toEqual(['Manual while off']);
      if (scenario === 'unchecked-pending-with-avatar')
        expect(chosen.avatar).toBe(JSON.stringify({ img: 'bear' }));
    }
    if (scenario === 'newer-pending-matches-local')
      expect((await db.getSyncItem({ id: key })).localSceneUpdated).toBe(true);
  }
});

it.each(['hw', 'qr'] as const)(
  'retains the removed %s proxy and checks its pending name using its existing upload eligibility',
  async (type) => {
    const isQr = type === 'qr';
    const db = new LocalDbIndexed();
    const id = `fixture-name-upload-removed-proxy-${type}`;
    const wallet: IDBWallet = {
      id: `${type}-${id}`,
      name: 'Pending hardware name',
      type,
      associatedDevice: id,
      accounts: [],
      nextIds: {},
      backuped: true,
      walletNo: 8124,
    };
    const device: IDBDevice = {
      id,
      name: 'Synthetic device',
      connectId: id,
      deviceId: id,
      uuid: id,
      deviceType: EDeviceType.Pro,
      vendor: EHardwareVendor.onekey,
      features: '{}',
      settingsRaw: '{}',
      createdAt: 1,
      updatedAt: 1,
    };
    const api = {
      localDb: db,
      servicePrimeCloudSync: {
        syncManagers: {},
        getCloudSyncDataTime: async () => 100,
      },
    } as unknown as IBackgroundApi;
    db.setBackgroundApi(api);
    const manager = new CloudSyncFlowManagerWallet({ backgroundApi: api });
    api.servicePrimeCloudSync.syncManagers.wallet = manager;

    const credential: ICloudSyncCredential = {
      keylessCredential: {
        ...(await keylessCloudSyncUtils.deriveKeylessCredential({
          seed: Buffer.alloc(32, 62),
          keylessWalletId: 'hw-fixture-removed-proxy-scope',
        })),
        pwdHash: 'hw-dek-fixture-removed-proxy-scope',
      },
      primeAccountSalt: '',
      masterPasswordUUID: '',
      securityPasswordR1: '',
    };
    const target = await manager.buildSyncTargetByDBQuery({
      dbRecord: wallet,
      allDevices: [device],
    });
    const item = await manager.buildSyncItem({
      target,
      syncCredential: credential,
      dataTime: 100,
    });
    if (!item?.data)
      throw new OneKeyLocalError('Missing encrypted Wallet fixture');
    expect(item.serverUploaded).toBeFalsy();

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
          name: ELocalDBStoreNames.Device,
          records: [device],
        });
        await db.txAddRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          records: [item],
        });
      },
      { skipCloudCredentialWarmup: true },
    );
    const onReadFailure = jest.fn();
    const onVerifiedWallet = jest.fn();
    const uploadCandidate = { item, syncCredential: credential };
    await expect(
      manager.canUploadPendingWalletName({
        ...uploadCandidate,
        onReadFailure,
      }),
    ).resolves.toBe(true);
    await expect(
      manager.canUploadPendingWalletName({
        ...uploadCandidate,
        onVerifiedWallet,
      }),
    ).resolves.toBe(true);
    expect(onVerifiedWallet).toHaveBeenCalledTimes(1);

    await db.removeWallet({ walletId: wallet.id, isRemoveToMocked: true });
    expect(
      await db.getRecordById({
        name: ELocalDBStoreNames.Wallet,
        id: wallet.id,
      }),
    ).toMatchObject({ id: wallet.id, name: wallet.name, isMocked: true });
    await expect(
      manager.canUploadPendingWalletName({
        ...uploadCandidate,
        onReadFailure,
      }),
    ).resolves.toBe(isQr);
    await expect(
      manager.canUploadPendingWalletName({
        ...uploadCandidate,
        onVerifiedWallet,
      }),
    ).resolves.toBe(isQr);
    expect(onReadFailure).not.toHaveBeenCalled();
    expect(onVerifiedWallet).toHaveBeenCalledTimes(isQr ? 2 : 1);
    expect(await db.getSyncItem({ id: item.id })).toMatchObject({
      data: item.data,
      dataTime: item.dataTime,
      serverUploaded: false,
    });
  },
);

it.each([
  'name',
  'avatar',
  'pending',
  'newer',
  'tombstone',
  'source-changed',
  'local-advanced',
  'revoked',
  'late-repair',
  'serial-refill',
  'serial-avatar-race',
  'serial-device-race',
  'serial-device-race-after-admission',
  'serial-state-refill',
  'serial-state-race',
  'serial-state-race-after-admission',
] as const)(
  'fresh Wallet metadata edit only replaces a recognized older settled cache: %s',
  async (scenario) => {
    const db = new LocalDbIndexed();
    const id = `fixture-current-edit-lww-${scenario}`;
    const usesRealRefill = scenario.startsWith('serial-');
    const serialNo = 'PRO-REPLAY-FIXTURE-1';
    const usesDeviceState = scenario.startsWith('serial-state-');
    const buildDeviceState = (serial: string) =>
      JSON.stringify({
        schemaVersion: 1,
        revision: 1,
        updatedAt: 1,
        protocol: 'V2',
        identity: {
          deviceType: EDeviceType.Pro,
          firmwareType: EFirmwareType.Universal,
          serialNo: serial,
          deviceId: id,
          vendor: EHardwareVendor.onekey,
          model: 'pro',
          label: null,
          bleName: null,
        },
        status: { mode: 'normal' },
        settings: {},
        versions: { firmware: '1.0.0' },
        capabilities: [],
      });
    const wallet: IDBWallet = {
      id: `hw-${id}`,
      name: 'Active local wallet',
      type: 'hw',
      associatedDevice: id,
      accounts: [],
      nextIds: {},
      backuped: true,
      walletNo: 8125,
    };
    const device: IDBDevice = {
      id,
      name: 'Synthetic device',
      connectId: id,
      deviceId: id,
      uuid: id,
      deviceType: EDeviceType.Pro,
      vendor: EHardwareVendor.onekey,
      features: JSON.stringify(
        usesRealRefill && !usesDeviceState ? { serialNo } : {},
      ),
      deviceState: usesDeviceState ? buildDeviceState(serialNo) : undefined,
      settingsRaw: '{}',
      createdAt: 1,
      updatedAt: 1,
    };
    const scope = (hex: string, bound: boolean): ICloudSyncCredential => ({
      masterPasswordUUID: '',
      primeAccountSalt: '',
      securityPasswordR1: '',
      keylessCredential: {
        keylessWalletId: 'synthetic-selected-scope',
        encryptionKey: hex.repeat(32),
        pwdHash: `hw-dek-${hex.repeat(32)}`,
        signingPrivateKey: '',
        signingPublicKey: '',
        source: {
          type: 'hardware',
          credentialId: 'synthetic-selected-scope',
          derivationVersion: 1,
          deviceName: 'Synthetic device',
          deviceType: EDeviceType.Pro,
        },
        ...(bound
          ? {
              hardwareSession: {
                sessionId: 'synthetic-session',
                dekId: 'synthetic-dek',
                deviceKeyJwk: {
                  kty: 'EC',
                  crv: 'P-256',
                  x: 'x',
                  y: 'y',
                  d: 'd',
                },
                accessToken: 'synthetic-access',
                accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
                refreshToken: 'synthetic-refresh',
                boundBaseURL: 'https://synthetic.invalid',
              },
            }
          : {}),
      },
    });
    const selected = scope('bb', true);
    const former = scope('aa', false);
    const direct = jest.fn(async () => undefined);
    const reconciles = jest.fn(async () => undefined);
    const keyLock = new Semaphore(1);
    const repairEntered = Promise.withResolvers<void>();
    const releaseRepair = Promise.withResolvers<void>();
    const lateRepairFinished = Promise.withResolvers<void>();
    let gen = 1;
    const changeSerial = () =>
      db.withTransaction(
        EIndexedDBBucketNames.account,
        (tx) =>
          db.txUpdateRecords({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [device.id],
            updater: (row) => {
              const nextSerialNo = 'PRO-REPLAY-FIXTURE-2';
              if (usesDeviceState)
                row.deviceState = buildDeviceState(nextSerialNo);
              else row.features = JSON.stringify({ serialNo: nextSerialNo });
              return row;
            },
          }),
        { skipCloudCredentialWarmup: true },
      );
    const api = {
      localDb: db,
      servicePrimeCloudSync: {
        syncManagers: {},
        getCloudSyncDataTime: async () => 200,
        getSyncCredentialSafe: async () => selected,
        captureWalletUploadReadRetry: () => undefined,
        captureHardwareDirectUploadScope: () => {
          const captured = gen;
          return () => gen === captured;
        },
        startServerSyncFlowSilently: reconciles,
        apiUploadItems: direct,
      },
      serviceKeylessCloudSync: {
        getCloudAccountImportGeneration: () => gen,
        getLocalMutationSyncCredential: async () => {
          if (scenario === 'source-changed') gen += 1;
          if (
            scenario === 'serial-device-race' ||
            scenario === 'serial-state-race'
          )
            await changeSerial();
          if (
            scenario === 'local-advanced' ||
            scenario === 'serial-avatar-race'
          )
            await db.withTransaction(
              EIndexedDBBucketNames.account,
              (tx) =>
                db.txUpdateWallet({
                  tx,
                  walletId: wallet.id,
                  updater: (row) => {
                    if (scenario === 'serial-avatar-race')
                      row.avatar = '{"img":"bear"}';
                    else row.name = 'Later canonical edit';
                    return row;
                  },
                }),
              { skipCloudCredentialWarmup: true },
            );
          return selected;
        },
        isExplicitWalletMetadataSyncOff: async () => false,
        getHardwareWalletRetryOrigin: async () => 'https://synthetic.invalid',
        runWithVerifiedHardwareAccountArchiveSession: async <T>(
          _credential: NonNullable<ICloudSyncCredential['keylessCredential']>,
          fn: () => Promise<T>,
        ) => {
          if (scenario === 'revoked') return undefined;
          if (
            scenario === 'serial-device-race-after-admission' ||
            scenario === 'serial-state-race-after-admission'
          )
            await changeSerial();
          if (scenario !== 'late-repair') return fn();
          repairEntered.resolve();
          await releaseRepair.promise;
          try {
            return await fn();
          } finally {
            lateRepairFinished.resolve();
          }
        },
        runWithCloudSyncKeyLock: async <T>(fn: () => Promise<T>) =>
          keyLock.runExclusive(fn),
      },
    } as unknown as IBackgroundApi;
    db.setBackgroundApi(api);
    const manager = new CloudSyncFlowManagerWallet({ backgroundApi: api });
    api.servicePrimeCloudSync.syncManagers.wallet = manager;
    const target = await manager.buildSyncTargetByDBQuery({
      dbRecord: wallet,
      allDevices: [device],
    });
    const key = await manager.buildSyncKeyInfo({ target });
    if (!key) throw new OneKeyLocalError('Missing Wallet sync identity');
    const old = {
      ...(await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
        key: key.key,
        dataTime: scenario === 'newer' ? 300 : 100,
        syncCredential: former,
        rawDataJson: {
          rawKey: key.rawKey,
          dataType: EPrimeCloudSyncDataType.Wallet,
          payload: { ...key.payload, name: 'Older inaccessible name' },
        },
      })),
      localSceneUpdated: true,
      serverUploaded: scenario !== 'pending',
      isDeleted: scenario === 'tombstone',
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
          name: ELocalDBStoreNames.Device,
          records: [device],
        });
        await db.txAddRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          records: [old],
        });
      },
      { skipCloudCredentialWarmup: true },
    );
    if (!usesRealRefill)
      jest
        .spyOn(db, 'refillWalletInfo')
        .mockImplementation(async ({ wallet: record }) => record);
    const derivedAvatar = {
      img: getDeviceAvatarImage(device.deviceType, serialNo),
    };
    if (usesRealRefill) {
      const initial = await db.getWallet({ walletId: wallet.id });
      expect(initial.avatar).toBeUndefined();
      expect(initial.avatarInfo).toEqual(derivedAvatar);
    }
    const actualReplace =
      incrementalCloudSync.replaceSettledWalletCacheAfterEdit;
    const detachedComplete = Promise.withResolvers<void>();
    const replace = jest
      .spyOn(incrementalCloudSync, 'replaceSettledWalletCacheAfterEdit')
      .mockImplementation(async (...args) => {
        try {
          await actualReplace(...args);
          detachedComplete.resolve();
        } catch (error) {
          detachedComplete.reject(error);
          throw error;
        }
      });
    const avatar = { img: 'bear' } as const;
    try {
      const saved = await db.setWalletNameAndAvatar({
        walletId: wallet.id,
        allowDesktopLocalMetadata: true,
        ...(scenario === 'avatar'
          ? { avatar }
          : { name: 'New actual local name' }),
      });
      expect(saved.name).toBe(
        scenario === 'avatar' ? wallet.name : 'New actual local name',
      );
      if (scenario === 'late-repair') {
        await repairEntered.promise;
        // Another ordinary action can acquire the key lock before the
        // optional read is released; its late callback must not write.
        await expect(keyLock.runExclusive(() => true)).resolves.toBe(true);
        releaseRepair.resolve();
        await lateRepairFinished.promise;
      }
      await detachedComplete.promise;
      if (scenario === 'serial-avatar-race')
        expect(
          (await db.getWallet({ walletId: wallet.id, withoutRefill: true }))
            .avatar,
        ).toBe('{"img":"bear"}');
      expect(direct).not.toHaveBeenCalled();
      const stored = await db.getSyncItem({ id: old.id });
      if (
        scenario === 'name' ||
        scenario === 'avatar' ||
        scenario === 'serial-refill' ||
        scenario === 'serial-state-refill'
      ) {
        const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
          item: { ...stored },
          syncCredential: selected,
        });
        expect(stored).toMatchObject({
          pwdHash: selected.keylessCredential?.pwdHash,
          dataTime: 200,
          serverUploaded: false,
        });
        expect(decrypted.rawDataJson?.payload).toMatchObject(
          scenario === 'avatar'
            ? { name: wallet.name, avatar }
            : { name: 'New actual local name' },
        );
        if (
          scenario === 'serial-refill' ||
          scenario === 'serial-state-refill'
        ) {
          expect(decrypted.rawDataJson?.payload).toMatchObject({
            avatar: derivedAvatar,
          });
          expect(JSON.stringify(decrypted.rawDataJson)).not.toContain(serialNo);
          expect(
            (await db.getWallet({ walletId: wallet.id, withoutRefill: true }))
              .avatar,
          ).toBe(JSON.stringify(derivedAvatar));
        }
        expect(reconciles).toHaveBeenCalledTimes(1);
      } else {
        expect(stored).toMatchObject({
          pwdHash: old.pwdHash,
          data: old.data,
          dataTime: old.dataTime,
          isDeleted: old.isDeleted,
        });
        expect(reconciles).not.toHaveBeenCalled();
      }
    } finally {
      replace.mockRestore();
    }
  },
  10_000,
);
