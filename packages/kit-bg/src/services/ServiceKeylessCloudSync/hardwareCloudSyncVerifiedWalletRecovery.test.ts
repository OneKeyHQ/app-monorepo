import { EDeviceType } from '@onekeyfe/hd-shared';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { LocalDbIndexed } from '../../dbs/local/indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { CloudSyncFlowManagerWallet } from '../ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';

import {
  commitVerifiedWalletCaches,
  prepareVerifiedWalletCaches,
  recoverVerifiedWalletCaches,
} from './hardwareCloudSyncRecovery';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../dbs/local/types';

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

async function fixture(type: 'hd' | 'hw' = 'hd') {
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
  const wallet: IDBWallet = {
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
  const walletManager = new CloudSyncFlowManagerWallet({
    backgroundApi: { localDb: mockDb } as unknown as IBackgroundApi,
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
  return { wallet, walletManager, previous, row, device };
}

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
