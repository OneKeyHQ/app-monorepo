import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import 'fake-indexeddb/auto';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import {
  HARDWARE_CLOUD_SYNC_KEK_VERSION,
  HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCredential,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { LocalDbIndexed } from '../../dbs/local/indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { RealmSchemaAccount } from '../../dbs/local/realm/schemas/RealmSchemaAccount';
import { RealmSchemaWallet } from '../../dbs/local/realm/schemas/RealmSchemaWallet';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { SimpleDbEntityChangeHistory } from '../../dbs/simple/entity/SimpleDbEntityChangeHistory';
import { CloudSyncFlowManagerAccount } from '../ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import { CloudSyncFlowManagerWallet } from '../ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import {
  getPublicAccountSnapshotId,
  publicAccountSnapshotToAccount,
} from '../ServicePrimeCloudSync/publicAccountSnapshot';
import { publicAccountTestSnapshot } from '../ServicePrimeCloudSync/publicAccountSnapshot.test-utils';

import {
  commitVerifiedWalletCaches,
  prepareVerifiedWalletCaches,
  recoverVerifiedWalletCaches,
} from './hardwareCloudSyncRecovery';
import {
  computeHardwareCloudSyncPwdHash,
  reencryptHardwareCloudSyncItems,
} from './hardwareCloudSyncSession';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../dbs/local/types';

// Exercise the actual projection without loading Realm's native engine in Web Jest.
jest.mock('../../dbs/local/realm/base/RealmObjectBase', () => ({
  RealmObjectBase: class {},
}));

let mockDb: LocalDbIndexed;
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    {
      get: (_target, prop) => {
        const val = Reflect.get(mockDb, prop) as unknown;
        return typeof val === 'function' ? (val.bind(mockDb) as unknown) : val;
      },
    },
  ),
}));

const pwdHash = `hw-dek-${'a'.repeat(64)}`;
const oldHash = `hw-dek-${'b'.repeat(64)}`;
const credential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'synthetic',
    signingPrivateKey: '',
    signingPublicKey: '',
    encryptionKey: '37'.repeat(32),
    pwdHash,
  },
};

let count = 0;

async function fixture(
  type: 'hd' | 'hw' = 'hd',
  realm?: { firstEvmAddress?: string | null; bitcoinOnly?: boolean },
) {
  count += 1;
  mockDb = new LocalDbIndexed();
  const device: IDBDevice | undefined =
    type === 'hw'
      ? {
          id: `verified-stored-device-${count}`,
          deviceId: `verified-physical-id-${count}`,
          deviceType: EDeviceType.Pro,
          connectId: `fixture-connect-${count}`,
          uuid: `fixture-serial-${count}`,
          name: 'Canonical device',
          features: '{"$app_fixture":true}',
          deviceState: JSON.stringify({
            identity: { serialNo: `fixture-serial-${count}` },
            status: {},
            settings: {},
            versions: {},
          }),
          settingsRaw: '{}',
          createdAt: 1,
          updatedAt: 1,
        }
      : undefined;
  let wallet: IDBWallet = {
    id: `${type}-verified-cache-${count}`,
    type,
    ...(device ? { associatedDevice: device.id } : {}),
    hash: `fixture-wallet-hash-${count}`,
    walletNo: 1300 + count,
    backuped: true,
    accounts: [],
    nextIds: {},
    name: 'Canonical metadata',
  };
  if (realm) {
    const realmWallet = Object.create(
      RealmSchemaWallet.prototype,
    ) as RealmSchemaWallet;
    const { nextIds: _nextIds, ...fields } = wallet;
    Object.assign(realmWallet, fields, {
      hash: null,
      firstEvmAddress: realm.firstEvmAddress,
      ...(realm.bitcoinOnly
        ? { firmwareTypeAtCreated: EFirmwareType.BitcoinOnly }
        : {}),
    });
    // Realm native engine is not loaded; use the production schema's raw
    // record projection with exactly the value native stores for string?.
    expect(RealmSchemaWallet.schema.properties.hash).toBe('string?');
    expect(RealmSchemaWallet.schema.properties.firstEvmAddress).toBe('string?');
    wallet = realmWallet.record;
    expect(wallet.hash).toBeNull();
  }
  const changeHistory = new SimpleDbEntityChangeHistory();
  let historyValue: string | null = null;
  changeHistory.appStorage = {
    ...changeHistory.appStorage,
    getItem: async () => historyValue,
    setItem: async (_key, value) => {
      historyValue = value;
    },
  };
  const walletManager = new CloudSyncFlowManagerWallet({
    backgroundApi: {
      localDb: mockDb,
      simpleDb: { changeHistory },
    } as unknown as IBackgroundApi,
  });
  if (device) {
    await mockDb.withTransaction(
      EIndexedDBBucketNames.account,
      (tx) =>
        mockDb.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Device,
          records: [device],
        }),
      { skipCloudCredentialWarmup: true },
    );
  }
  const target = await walletManager.buildSyncTargetByDBQuery({
    dbRecord: wallet,
  });
  const { key, rawKey, dataType, payload } =
    await walletManager.buildSyncKeyAndPayload({ target });
  const current = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
    key,
    rawDataJson: { rawKey, dataType, payload },
    syncCredential: credential,
    dataTime: 1_750_000_000_100,
  });
  const previous: IDBCloudSyncItem = {
    ...current,
    pwdHash: oldHash,
    data: 'ab'.repeat(70),
    dataTime: 1_750_000_000_000,
    serverUploaded: true,
    localSceneUpdated: true,
  };
  await mockDb.withTransaction(
    EIndexedDBBucketNames.account,
    async (tx) => {
      await mockDb.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        records: [wallet],
      });
      await mockDb.txAddRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        records: [previous],
      });
    },
    { skipCloudCredentialWarmup: true },
  );
  const row = {
    key,
    dataType: EPrimeCloudSyncDataType.Wallet,
    data: current.data,
    dataTimestamp: current.dataTime,
    isDeleted: false,
  };
  return { wallet, walletManager, previous, row, device, changeHistory };
}

test.each([
  'valid',
  'realm-null-hash',
  'realm-omitted-wire-hash',
  'realm-concrete-wire-hash',
  'realm-empty-wire-hash',
  'realm-concrete-old-hash',
  'btc-evm-null-wire',
  'btc-evm-omitted-wire',
  'btc-evm-concrete-wire',
  'btc-evm-empty-wire',
  'btc-evm-concrete-old',
  'realm-real-evm-cleared',
  'realm-real-evm-remapped',
  'name-race',
  'avatar-race',
  'device-race',
  'pool-race',
  'rejected-session',
  'scope-switch',
  'history-failure',
  'history-timeout',
  'wrong-origin',
  'pending-before-recovery',
  'equal-version',
  'unknown-lineage',
  'stale-old-cache',
  'malformed-avatar',
] as const)('strict newer authenticated Wallet scene: %s', async (scenario) => {
  const bitcoinOnly = scenario.startsWith('btc-evm');
  const realAddress = `0x${'a'.repeat(40)}`;
  const otherAddress = `0x${'b'.repeat(40)}`;
  const trueSeed = scenario.startsWith('realm-real-evm');
  let localFirstEvmAddress: string | null | undefined;
  if (trueSeed) localFirstEvmAddress = realAddress;
  if (bitcoinOnly) localFirstEvmAddress = null;
  const { previous, wallet, walletManager, changeHistory, row } = await fixture(
    'hw',
    bitcoinOnly || scenario.startsWith('realm-')
      ? {
          bitcoinOnly,
          firstEvmAddress: localFirstEvmAddress,
        }
      : undefined,
  );
  const old = JSON.parse(previous.rawData ?? '') as ICloudSyncRawDataJson;
  if (old.dataType !== EPrimeCloudSyncDataType.Wallet)
    throw new OneKeyLocalError('Missing synthetic Wallet payload');
  if (bitcoinOnly) {
    expect(wallet.firmwareTypeAtCreated).toBe(EFirmwareType.BitcoinOnly);
    expect(wallet.firstEvmAddress).toBeNull();
    expect(old.payload.firstEvmAddress).toBeNull();
  }
  if (scenario.startsWith('realm-')) expect(old.payload.walletHash).toBeNull();
  if (
    scenario === 'realm-concrete-old-hash' ||
    scenario === 'btc-evm-concrete-old'
  ) {
    previous.rawData = cloudSyncItemBuilder.buildRawDataString({
      ...old,
      payload: {
        ...old.payload,
        ...(scenario === 'realm-concrete-old-hash'
          ? { walletHash: 'other-retained-wallet-hash' }
          : { firstEvmAddress: otherAddress }),
      },
    });
    await mockDb.updateSyncItem({
      ids: [row.key],
      updater: (item) => {
        item.rawData = previous.rawData;
        return item;
      },
    });
  }
  const avatar = { img: 'bear' } as const;
  const name = 'Renamed after hardware re-sign';
  if (scenario === 'equal-version') row.dataTimestamp = previous.dataTime;
  if (scenario === 'stale-old-cache') {
    previous.rawData = cloudSyncItemBuilder.buildRawDataString({
      ...old,
      payload: { ...old.payload, name: 'Not the current displayed name' },
    });
  }
  const historyRelease = Promise.withResolvers<void>();
  const historyEntered = Promise.withResolvers<void>();
  if (scenario === 'history-timeout') {
    const write = changeHistory.appStorage.setItem;
    jest
      .spyOn(changeHistory.appStorage, 'setItem')
      .mockImplementationOnce(async (...args) => {
        historyEntered.resolve();
        await historyRelease.promise;
        return write(...args);
      });
  }
  if (scenario === 'history-failure')
    jest
      .spyOn(changeHistory.appStorage, 'setItem')
      .mockRejectedValueOnce(new Error('Synthetic storage write rejected'));
  let incomingHash = old.payload.walletHash;
  if (scenario === 'realm-omitted-wire-hash') incomingHash = undefined;
  if (scenario === 'realm-concrete-wire-hash')
    incomingHash = 'other-wallet-hash';
  if (scenario === 'realm-empty-wire-hash') incomingHash = '';
  let incomingAddress = old.payload.firstEvmAddress;
  if (
    scenario === 'btc-evm-omitted-wire' ||
    scenario === 'realm-real-evm-cleared'
  )
    incomingAddress = undefined;
  if (
    scenario === 'btc-evm-concrete-wire' ||
    scenario === 'realm-real-evm-remapped'
  )
    incomingAddress = otherAddress;
  if (scenario === 'btc-evm-empty-wire') incomingAddress = '';
  const replacement = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
    key: row.key,
    rawDataJson: {
      ...old,
      payload: {
        ...old.payload,
        walletHash: incomingHash,
        firstEvmAddress: incomingAddress,
        name,
        avatar:
          scenario === 'malformed-avatar'
            ? (JSON.parse('{"img":42}') as typeof avatar)
            : avatar,
      },
    },
    syncCredential: credential,
    dataTime: row.dataTimestamp,
  });
  const origin = 'https://wallet-repair.example.test';
  const baseKey = credential.keylessCredential;
  if (!baseKey) throw new OneKeyLocalError('Missing synthetic key');
  const key: IKeylessCloudSyncCredential = {
    ...baseKey,
    hardwareSession: {
      deviceKeyJwk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'fixture',
        y: 'fixture',
        d: 'fixture',
      },
      accessToken: 'synthetic',
      refreshToken: 'synthetic',
      accessTokenExpiresAt: 9_000_000_000_000,
      dekId: 'fixture-dek',
      sessionId: 'fixture-session',
      boundBaseURL: origin,
      boundBaseURLVerified: true,
    },
  };
  let isCurrent = true;
  if (scenario === 'pending-before-recovery') {
    await mockDb.updateSyncItem({
      ids: [row.key],
      updater: (item) => {
        item.serverUploaded = false;
        return item;
      },
    });
    previous.serverUploaded = false;
  }
  const originalPool = await mockDb.getSyncItem({ id: row.key });
  const newerPending = { ...originalPool, serverUploaded: false };
  const editBeforeCommit = async () => {
    await mockDb.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        if (scenario === 'name-race' || scenario === 'avatar-race') {
          await mockDb.txUpdateWallet({
            tx,
            walletId: wallet.id,
            updater: (current) => {
              if (scenario === 'name-race')
                current.name = 'Just edited locally';
              else current.avatar = JSON.stringify({ img: 'dog' });
              return current;
            },
          });
        } else if (scenario === 'device-race' && wallet.associatedDevice) {
          await mockDb.txUpdateRecords({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [wallet.associatedDevice],
            updater: (current) => {
              current.updatedAt += 1;
              return current;
            },
          });
        } else if (scenario === 'pool-race') {
          await mockDb.txUpdateRecords({
            tx,
            name: ELocalDBStoreNames.CloudSyncItem,
            ids: [row.key],
            updater: (current) => {
              current.serverUploaded = false;
              return current;
            },
          });
        }
      },
      { skipCloudCredentialWarmup: true },
    );
  };
  const recovery = recoverVerifiedWalletCaches({
    service: {
      backgroundApi: {
        serviceApp: { isAppLocked: async () => false },
        servicePrimeCloudSync: { syncManagers: { wallet: walletManager } },
      } as unknown as IBackgroundApi,
      buildSyncCredentialWithKeylessCredential: () => credential,
      getHardwareUploadGeneration: () => 55,
      getHardwareWalletRetryOrigin: async () => origin,
      runWithCloudAccountImportLock: async (run) => run(),
      runWithVerifiedHardwareAccountArchiveSession: async (_key, run) => {
        if (scenario === 'rejected-session') return undefined;
        if (scenario === 'scope-switch') isCurrent = false;
        if (scenario.endsWith('-race')) await editBeforeCommit();
        return run();
      },
    },
    history: {
      data: { data: { serverData: [{ ...row, data: replacement.data }] } },
      request: {
        responseURL: `${scenario === 'wrong-origin' ? 'https://other.example.test' : origin}/prime/v1/sync/download`,
      },
    } as Parameters<typeof recoverVerifiedWalletCaches>[0]['history'],
    items: [previous],
    previousPwdHashes: scenario === 'unknown-lineage' ? [] : [oldHash],
    key,
    isCurrent: () => isCurrent,
  });
  if (scenario === 'history-timeout') {
    const entered = await resolveBeforeTimeout(
      historyEntered.promise.then(() => true),
      500,
    );
    expect(entered).toBe(true);
    const lockWasFree = await resolveBeforeTimeout(
      walletManager
        .syncToSceneEachItemByMutex({
          item: { ...previous },
          target: await walletManager.buildSyncTargetByDBQuery({
            dbRecord: wallet,
          }),
          payload: old.payload,
          isCurrent: () => false,
        })
        .then(() => true),
      100,
    );
    expect(lockWasFree).toBe(true);
  }
  await recovery;
  if (scenario === 'history-timeout') {
    historyRelease.resolve();
    await changeHistory.mutex.runExclusive(() => true);
  }
  if (
    scenario !== 'valid' &&
    scenario !== 'history-failure' &&
    scenario !== 'realm-null-hash' &&
    scenario !== 'realm-omitted-wire-hash' &&
    scenario !== 'btc-evm-null-wire' &&
    scenario !== 'btc-evm-omitted-wire'
  ) {
    const expected = { ...wallet };
    if (scenario === 'name-race') expected.name = 'Just edited locally';
    if (scenario === 'avatar-race')
      expected.avatar = JSON.stringify({ img: 'dog' });
    await expect(
      mockDb.getWallet({ walletId: wallet.id, withoutRefill: true }),
    ).resolves.toEqual(expected);
    await expect(mockDb.getSyncItem({ id: row.key })).resolves.toEqual(
      scenario === 'pool-race' ? newerPending : originalPool,
    );
    return;
  }
  await expect(
    mockDb.getWallet({ walletId: wallet.id, withoutRefill: true }),
  ).resolves.toMatchObject({
    name,
    avatar: JSON.stringify(avatar),
    ...(bitcoinOnly ? { firstEvmAddress: null } : {}),
  });
  await expect(mockDb.getSyncItem({ id: row.key })).resolves.toMatchObject({
    data: replacement.data,
    dataTime: row.dataTimestamp,
    pwdHash,
    serverUploaded: true,
    localSceneUpdated: true,
  });
  const reopened = new SimpleDbEntityChangeHistory();
  reopened.appStorage = changeHistory.appStorage;
  const retainedHistory = await reopened.getChangeHistory({
    entityId: wallet.id,
    entityType: EChangeHistoryEntityType.Wallet,
    contentType: EChangeHistoryContentType.Name,
  });
  expect(retainedHistory).toMatchObject(
    scenario === 'history-failure' ? [] : [{ value: wallet.name }],
  );
});

test.each(['equal', 'newer'] as const)(
  'adopts the %s authenticated Wallet in the actual account transaction',
  async (version) => {
    const { previous, row, wallet, walletManager } = await fixture();
    if (version === 'equal') row.dataTimestamp = previous.dataTime;
    const expected = await prepareVerifiedWalletCaches({
      items: [previous],
      records: [row],
      knownPwdHashes: new Set([oldHash]),
      syncCredential: credential,
      walletManager,
      isCurrent: () => true,
    });
    expect(expected).toHaveLength(1);
    await commitVerifiedWalletCaches(expected, () => true);
    await expect(mockDb.getSyncItem({ id: row.key })).resolves.toMatchObject({
      pwdHash,
      data: row.data,
      dataTime: row.dataTimestamp,
      rawData: '',
      localSceneUpdated: true,
      serverUploaded: true,
    });
    await expect(
      mockDb.getWallet({ walletId: wallet.id, withoutRefill: true }),
    ).resolves.toEqual(wallet);
  },
);

test.each([
  undefined,
  'deviceId',
  'features',
  'deviceState',
  'settingsRaw',
] as const)(
  'adopts an authenticated hardware Wallet only while the stored Device is unchanged (%s)',
  async (changedField) => {
    const { previous, row, walletManager, device } = await fixture('hw');
    if (!device) throw new OneKeyLocalError('Missing synthetic device');
    const prepared = await prepareVerifiedWalletCaches({
      items: [previous],
      records: [row],
      knownPwdHashes: new Set([oldHash]),
      syncCredential: credential,
      walletManager,
      isCurrent: () => true,
    });
    expect(prepared).toHaveLength(1);
    expect(prepared[0].device).toMatchObject({
      id: device.id,
      featuresInfo: expect.any(Object),
      deviceStateInfo: expect.any(Object),
      settings: expect.any(Object),
      vendor: expect.any(String),
    });
    if (changedField) {
      await mockDb.withTransaction(
        EIndexedDBBucketNames.account,
        async (tx) => {
          await mockDb.txUpdateRecords({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [device.id],
            updater: (current) => {
              current[changedField] = `${current[changedField]}-changed`;
              return current;
            },
          });
        },
        { skipCloudCredentialWarmup: true },
      );
    }
    await commitVerifiedWalletCaches(prepared, () => true);
    if (changedField)
      await expect(mockDb.getSyncItem({ id: row.key })).resolves.toEqual(
        previous,
      );
    else
      await expect(mockDb.getSyncItem({ id: row.key })).resolves.toMatchObject({
        pwdHash,
        data: row.data,
        dataTime: row.dataTimestamp,
        rawData: '',
        localSceneUpdated: true,
        serverUploaded: true,
      });
  },
);

test.each([
  'older',
  'equal-tombstone',
  'equal-bad-cipher',
  'tombstone',
  'equal-unknown-lineage',
  'pending',
  'missing',
  'bad-cipher',
  'duplicate',
] as const)(
  'holds %s Wallet copies without rekeying or changing the timestamp',
  async (reason) => {
    const { previous, row, walletManager } = await fixture();
    let dataTimestamp = row.dataTimestamp;
    if (reason.startsWith('equal-')) dataTimestamp = previous.dataTime;
    if (reason === 'older') dataTimestamp = 1_749_999_999_999;
    const records =
      reason === 'missing'
        ? []
        : [
            {
              ...row,
              dataTimestamp,
              isDeleted: reason === 'tombstone' || reason === 'equal-tombstone',
              data: reason.endsWith('bad-cipher') ? 'ab'.repeat(70) : row.data,
            },
          ];
    if (reason === 'duplicate') records.push(row);
    const expected = await prepareVerifiedWalletCaches({
      items: [{ ...previous, serverUploaded: reason !== 'pending' }],
      records,
      knownPwdHashes: new Set(
        reason === 'equal-unknown-lineage' ? [] : [oldHash],
      ),
      syncCredential: credential,
      walletManager,
      isCurrent: () => true,
    });
    expect(expected).toEqual([]);
    await expect(mockDb.getSyncItem({ id: row.key })).resolves.toEqual(
      previous,
    );
  },
);

test('a concurrent local-only rename stops equal-version adoption even though the old pool bytes remain', async () => {
  const { previous, row, wallet, walletManager } = await fixture();
  row.dataTimestamp = previous.dataTime;
  const expected = await prepareVerifiedWalletCaches({
    items: [previous],
    records: [row],
    knownPwdHashes: new Set([oldHash]),
    syncCredential: credential,
    walletManager,
    isCurrent: () => true,
  });
  expect(expected).toHaveLength(1);
  await mockDb.withTransaction(
    EIndexedDBBucketNames.account,
    async (tx) => {
      await mockDb.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        ids: [wallet.id],
        updater: (current) => {
          current.name = 'Concurrent local edit';
          return current;
        },
      });
    },
    { skipCloudCredentialWarmup: true },
  );
  await commitVerifiedWalletCaches(expected, () => true);
  await expect(mockDb.getSyncItem({ id: row.key })).resolves.toEqual(previous);
});

test.each([
  'removed',
  'expired',
  'current',
  'equal-current',
  'locked-before',
  'locked-before-commit',
] as const)(
  '%s persisted repair decision only permits authoritative cache adoption',
  async (outcome) => {
    const { previous, row, walletManager } = await fixture();
    if (outcome === 'equal-current') row.dataTimestamp = previous.dataTime;
    const origin = 'https://wallet-repair.example.test';
    const candidateKey = credential.keylessCredential;
    if (!candidateKey) throw new OneKeyLocalError('Missing synthetic key');
    const syncCredential: ICloudSyncCredential = {
      ...credential,
      keylessCredential: {
        ...candidateKey,
        hardwareSession: {
          deviceKeyJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: 'fixture',
            y: 'fixture',
            d: 'fixture',
          },
          accessToken: 'synthetic',
          refreshToken: 'synthetic',
          accessTokenExpiresAt: 9_000_000_000_000,
          dekId: 'public-fixture-dek',
          sessionId: 'public-fixture-session',
          boundBaseURL: origin,
          boundBaseURLVerified: true,
        },
      },
    };
    const admitted = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let allowed = true;
    const verifyWallet = jest.spyOn(
      walletManager,
      'canUploadPendingWalletName',
    );
    const locked = jest.fn(async () => outcome === 'locked-before');
    if (outcome === 'locked-before-commit')
      locked.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const repair = jest.fn();
    const service: Parameters<
      typeof recoverVerifiedWalletCaches
    >[0]['service'] = {
      backgroundApi: {
        serviceApp: { isAppLocked: locked },
        servicePrimeCloudSync: { syncManagers: { wallet: walletManager } },
      } as unknown as IBackgroundApi,
      buildSyncCredentialWithKeylessCredential: () => syncCredential,
      getHardwareUploadGeneration: () => 42,
      getHardwareWalletRetryOrigin: async () => origin,
      runWithCloudAccountImportLock: async <T>(run: () => Promise<T>) => run(),
      runWithVerifiedHardwareAccountArchiveSession: async <T>(
        expected: IKeylessCloudSyncCredential,
        commit: () => Promise<T>,
      ) => {
        repair();
        expect(expected).toBe(syncCredential.keylessCredential);
        admitted.resolve();
        await release.promise;
        return allowed ? commit() : undefined;
      },
    };
    const run = recoverVerifiedWalletCaches({
      service,
      history: {
        data: { data: { serverData: [row] } },
        request: { responseURL: `${origin}/prime/v1/sync/download` },
      } as Parameters<typeof recoverVerifiedWalletCaches>[0]['history'],
      items: [previous],
      previousPwdHashes: [oldHash],
      key: syncCredential.keylessCredential ?? candidateKey,
      isCurrent: () => true,
    });
    if (outcome === 'locked-before' || outcome === 'locked-before-commit') {
      await run;
      expect(repair).not.toHaveBeenCalled();
      expect(verifyWallet).toHaveBeenCalledTimes(
        outcome === 'locked-before' ? 0 : 1,
      );
    } else {
      await Promise.race([admitted.promise, run]);
      expect(repair).toHaveBeenCalled();
      if (outcome === 'removed') allowed = false;
      if (outcome === 'expired') await run;
      release.resolve();
      await run;
    }
    // Let the already-admitted callback settle after a possible timeout.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    await expect(mockDb.getSyncItem({ id: row.key })).resolves.toMatchObject({
      pwdHash: outcome.endsWith('current') ? pwdHash : oldHash,
      dataTime: outcome.endsWith('current')
        ? row.dataTimestamp
        : previous.dataTime,
    });
  },
);

test.each([
  'current',
  'current-realm-optionals',
  'after-ten-failed-probes',
  'two-ready-pages',
  'expire-before-second-commit',
  'resume-after-fast-deadline',
  'resume-foreign-lineage',
  'resume-wrong-origin',
  'nonempty-realm-network',
  'empty-realm-network',
  'foreign-lineage',
  'missing',
  'older-encrypted-version',
  'local-name-diverged',
  'local-index-name-diverged',
  'missing-time',
  'remote-tombstone',
  'local-identity-diverged',
  'local-newer-pool',
  'wrong-origin',
] as const)(
  'after same-source key rotation, only exact live Account recovery permits ordinary deletion (%s)',
  async (scenario) => {
    const {
      wallet,
      walletManager,
      previous: walletPrevious,
      row: walletRow,
    } = await fixture('hw');
    const snapshot = publicAccountTestSnapshot(count);
    snapshot.wallet.xfp = snapshot.wallet.xfp.replace(
      /^[a-f0-9]{8}/i,
      count.toString(16).padStart(8, '0'),
    );
    const account = publicAccountSnapshotToAccount(snapshot, wallet.id);
    const accountId = getPublicAccountSnapshotId(snapshot);
    const rawKey = `Account >> ${accountId}`;
    const id = sha512ProSync({ data: rawKey });
    const origin = 'https://wallet-rotation.example.test';
    const base = credential.keylessCredential;
    if (!base || !account.indexedAccountId)
      throw new OneKeyLocalError('Missing fixture data');
    const current = {
      ...base,
      source: {
        type: 'hardware' as const,
        credentialId: base.keylessWalletId,
        derivationVersion: 1 as const,
        deviceType: EDeviceType.Pro,
        deviceName: 'Fixture',
      },
      hardwareSession: {
        deviceKeyJwk: {
          kty: 'EC',
          crv: 'P-256',
          x: 'fixture',
          y: 'fixture',
          d: 'fixture',
        },
        accessToken: 'fixture',
        refreshToken: 'fixture',
        accessTokenExpiresAt: 9_000_000_000_000,
        dekId: 'new-dek',
        sessionId: 'new-session',
        boundBaseURL: origin,
        boundBaseURLVerified: true,
      },
    } satisfies IKeylessCloudSyncCredential;
    const resumes = scenario.startsWith('resume-');
    const oldDekId = 'ab'.repeat(16);
    const old = {
      ...base,
      pwdHash: resumes ? computeHardwareCloudSyncPwdHash(oldDekId) : oldHash,
      encryptionKey: '39'.repeat(32),
    };
    const signedCredential = { ...credential, keylessCredential: current };
    const createPrevious = async (value: typeof snapshot) => {
      const payloadId = getPublicAccountSnapshotId(value);
      const key = `Account >> ${payloadId}`;
      const item = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
        key: sha512ProSync({ data: key }),
        rawDataJson: {
          rawKey: key,
          dataType: EPrimeCloudSyncDataType.Account,
          payload: {
            name: value.account.name,
            accountId: payloadId,
            publicAccountSnapshot: value,
          },
        },
        syncCredential: { ...credential, keylessCredential: old },
        dataTime: 1_750_000_000_000,
      });
      return {
        ...item,
        rawData: '',
        serverUploaded: true,
        localSceneUpdated: true,
      };
    };
    const rotate = async (item: IDBCloudSyncItem) =>
      (
        await reencryptHardwareCloudSyncItems({
          items: [item],
          from: {
            dek: old.encryptionKey,
            pwdHash: old.pwdHash,
          },
          to: {
            dek: current.encryptionKey,
            pwdHash,
          },
        })
      )[0];
    const toWire = (item: IDBCloudSyncItem) => ({
      key: item.id,
      dataType: item.dataType,
      data: item.data,
      dataTimestamp: item.dataTime,
      isDeleted: item.isDeleted,
    });
    const previous = await createPrevious(snapshot);
    const rotated = await rotate(previous);
    const failedFirst = scenario === 'after-ten-failed-probes';
    const secondPage =
      scenario === 'two-ready-pages' ||
      scenario === 'expire-before-second-commit';
    const additionalSnapshot = (relative: number) => ({
      ...publicAccountTestSnapshot(count * 100 + relative),
      wallet: snapshot.wallet,
    });
    let failedProbeCount = 0;
    if (failedFirst) failedProbeCount = 12;
    else if (secondPage) failedProbeCount = 9;
    const failures = await Promise.all(
      Array.from({ length: failedProbeCount }, (_, i) =>
        createPrevious(additionalSnapshot(i)),
      ),
    );
    const laterSnapshot = additionalSnapshot(99);
    const laterOld = secondPage
      ? await createPrevious(laterSnapshot)
      : undefined;
    const laterRotated = laterOld ? await rotate(laterOld) : undefined;
    const laterAccount = laterOld
      ? publicAccountSnapshotToAccount(laterSnapshot, wallet.id)
      : undefined;
    expect(rotated.dataTime).toBe(previous.dataTime);
    expect(rotated.data).not.toBe(previous.data);
    const persistedOld =
      scenario === 'local-newer-pool'
        ? { ...previous, dataTime: (previous.dataTime ?? 0) + 1 }
        : previous;
    const businessAccount = {
      ...account,
      ...(scenario === 'local-name-diverged' ? { name: 'Local edit' } : {}),
      ...(scenario === 'local-identity-diverged'
        ? { address: '0x2222222222222222222222222222222222222222' }
        : {}),
    };
    const realmNetworks: Partial<Record<typeof scenario, string | null>> = {
      'current-realm-optionals': null,
      'nonempty-realm-network': 'evm--1',
      'empty-realm-network': '',
    };
    const realmNetwork = realmNetworks[scenario];
    let storedAccount = businessAccount;
    if (realmNetwork !== undefined) {
      const realmAccount = Object.create(
        RealmSchemaAccount.prototype,
      ) as RealmSchemaAccount;
      Object.assign(realmAccount, businessAccount, {
        createAtNetwork: realmNetwork,
        relPath: null,
      });
      storedAccount = realmAccount.record;
    }
    const storedIndex = {
      id: account.indexedAccountId,
      walletId: wallet.id,
      index: snapshot.account.pathIndex,
      name:
        scenario === 'local-index-name-diverged'
          ? 'Local index edit'
          : account.name,
      idHash: 'public fixture',
    };
    await mockDb.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        await mockDb.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Wallet,
          ids: [wallet.id],
          updater: (row) => {
            row.xfp = snapshot.wallet.xfp;
            row.accounts = [account.id];
            return row;
          },
        });
        await mockDb.txAddRecords({
          tx,
          name: ELocalDBStoreNames.IndexedAccount,
          records: [
            storedIndex,
            ...(laterAccount?.indexedAccountId
              ? [
                  {
                    ...storedIndex,
                    id: laterAccount.indexedAccountId,
                    index: laterSnapshot.account.pathIndex,
                    name: laterSnapshot.account.name,
                  },
                ]
              : []),
          ],
        });
        await mockDb.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Account,
          records: [storedAccount, ...(laterAccount ? [laterAccount] : [])],
        });
        await mockDb.txAddRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          records: [persistedOld, ...failures, ...(laterOld ? [laterOld] : [])],
        });
      },
      { skipCloudCredentialWarmup: true },
    );
    const startServerSyncFlowSilently = jest.fn(async () => undefined);
    const secondAdmission = Promise.withResolvers<void>();
    const finishSecondAdmission = Promise.withResolvers<void>();
    const lateCommitSettled = Promise.withResolvers<void>();
    let admitted = 0;
    const service = {
      backgroundApi: {
        localDb: mockDb,
        serviceApp: { isAppLocked: async () => false },
        servicePrimeCloudSync: {
          getCloudSyncDataTime: async (
            params: Parameters<
              IBackgroundApi['servicePrimeCloudSync']['getCloudSyncDataTime']
            >[0],
          ) =>
            params?.allowHistoricalTime &&
            params.explicitHistoricalTime !== undefined
              ? params.explicitHistoricalTime
              : 1_750_000_001_000,
          startServerSyncFlowSilently,
          syncManagers: { wallet: walletManager },
        },
        serviceKeylessCloudSync: {
          getLocalMutationSyncCredential: async () => signedCredential,
          runWithCloudSyncKeyLock: async <T>(run: () => Promise<T>) => run(),
        },
      } as unknown as IBackgroundApi,
      buildSyncCredentialWithKeylessCredential: () => signedCredential,
      getHardwareUploadGeneration: () => 42,
      getHardwareWalletRetryOrigin: async () => origin,
      runWithCloudAccountImportLock: async <T>(run: () => Promise<T>) => run(),
      runWithVerifiedHardwareAccountArchiveSession: async <T>(
        _key: unknown,
        run: () => Promise<T>,
      ) => {
        admitted += 1;
        if (scenario === 'resume-after-fast-deadline') {
          await new Promise<void>((resolve) => setTimeout(resolve, 1100));
        }
        if (scenario !== 'expire-before-second-commit' || admitted !== 2)
          return run();
        secondAdmission.resolve();
        await finishSecondAdmission.promise;
        try {
          return await run();
        } finally {
          lateCommitSettled.resolve();
        }
      },
    };
    service.backgroundApi.servicePrimeCloudSync.syncManagers.account =
      new CloudSyncFlowManagerAccount({ backgroundApi: service.backgroundApi });
    mockDb.setBackgroundApi(service.backgroundApi);
    const row = {
      key: id,
      dataType: EPrimeCloudSyncDataType.Account,
      data:
        scenario === 'older-encrypted-version' ? previous.data : rotated.data,
      dataTimestamp: scenario === 'missing-time' ? undefined : rotated.dataTime,
      isDeleted: scenario === 'remote-tombstone',
    };
    const serverData = failedFirst
      ? [...failures.map(toWire), row, walletRow]
      : [
          row,
          ...failures.map(toWire),
          ...(laterRotated ? [toWire(laterRotated)] : []),
        ];
    const historyDekId =
      scenario === 'resume-foreign-lineage' ? 'cd'.repeat(16) : oldDekId;
    const oldEnvelope = {
      key: `dek:${historyDekId}`,
      dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
      data: JSON.stringify({
        dekId: historyDekId,
        kekVersion: HARDWARE_CLOUD_SYNC_KEK_VERSION,
        kekSalt: 'ef'.repeat(16),
        generation: 1,
        wrappedDek: 'fixture',
      }),
      dataTimestamp: 1,
      isDeleted: false,
    };
    const isWrongOrigin =
      scenario === 'wrong-origin' || scenario === 'resume-wrong-origin';
    const recovery = recoverVerifiedWalletCaches({
      service,
      history: {
        data: {
          data: {
            serverData: [
              ...(scenario === 'missing' ? [] : serverData),
              ...(resumes ? [oldEnvelope] : []),
            ],
            pwdHash,
          },
        },
        request: {
          responseURL: `${isWrongOrigin ? 'https://other.example.test' : origin}/prime/v1/sync/download`,
        },
      } as Parameters<typeof recoverVerifiedWalletCaches>[0]['history'],
      items: [
        previous,
        ...failures,
        ...(laterOld ? [laterOld] : []),
        ...(failedFirst ? [walletPrevious] : []),
      ],
      ...(resumes
        ? { resume: { baseURL: origin, signal: new AbortController().signal } }
        : {
            previousPwdHashes: scenario === 'foreign-lineage' ? [] : [oldHash],
          }),
      key: current,
      isCurrent: () => true,
    });
    if (scenario === 'expire-before-second-commit') {
      await Promise.race([secondAdmission.promise, recovery]);
      expect(admitted).toBe(2);
      await expect(mockDb.getSyncItem({ id })).resolves.toEqual(rotated);
      await recovery;
      finishSecondAdmission.resolve();
      await lateCommitSettled.promise;
    } else {
      await recovery;
    }
    if (failedFirst)
      await expect(
        mockDb.getSyncItem({ id: walletRow.key }),
      ).resolves.toMatchObject({ pwdHash, data: walletRow.data });
    if (laterOld)
      await expect(mockDb.getSyncItem({ id: laterOld.id })).resolves.toEqual(
        scenario === 'two-ready-pages' ? laterRotated : laterOld,
      );
    for (const failed of failures)
      await expect(mockDb.getSyncItem({ id: failed.id })).resolves.toEqual(
        failed,
      );
    await expect(
      mockDb.getRecordById({
        name: ELocalDBStoreNames.Account,
        id: account.id,
      }),
    ).resolves.toEqual(storedAccount);
    const verifiesDeletion =
      scenario === 'current' ||
      scenario === 'current-realm-optionals' ||
      scenario === 'resume-after-fast-deadline' ||
      failedFirst;
    const applies = verifiesDeletion || secondPage;
    await expect(mockDb.getSyncItem({ id })).resolves.toEqual(
      applies ? rotated : persistedOld,
    );
    if (verifiesDeletion) {
      await mockDb.removeAccount({
        accountId: account.id,
        walletId: wallet.id,
      });
      await expect(
        mockDb.getAccountSafe({ accountId: account.id }),
      ).resolves.toBeUndefined();
      await expect(mockDb.getSyncItem({ id })).resolves.toMatchObject({
        pwdHash,
        isDeleted: true,
        serverUploaded: false,
      });
      const tombstone = await mockDb.getSyncItem({ id });
      const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
        item: tombstone,
        syncCredential: signedCredential,
      });
      expect(decrypted.rawDataJson).toMatchObject({
        rawKey,
        dataType: EPrimeCloudSyncDataType.Account,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 1100));
      expect(startServerSyncFlowSilently).toHaveBeenCalledWith({
        callerName: 'Public account deletion',
        localMutation: true,
      });
    }
  },
);
