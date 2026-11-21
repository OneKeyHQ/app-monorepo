import { EDeviceType } from '@onekeyfe/hd-shared';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerWallet } from '../../services/ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerWallet';
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
