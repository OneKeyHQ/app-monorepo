import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import 'fake-indexeddb/auto';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBContext, IDBCreateHwWalletParams } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

afterEach(() => jest.restoreAllMocks());

test.each([false, true])(
  'hardware onboarding commits its first account with asynchronous Cloud preparation=%s',
  async (slowPreparation) => {
    const db = new LocalDbIndexed();
    const walletId = `hw-cloud-onboarding-${slowPreparation}`;
    const deviceId = `db-cloud-onboarding-${slowPreparation}`;
    const prepareIndexedSync = jest.fn(async (_params: { tx?: unknown }) => {
      if (slowPreparation)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return {
        existingSyncItemsInfo: {},
        existingSyncItems: [],
        newSyncItems: [],
      };
    });
    const runSyncWrites = async ({
      runDbTxFn,
    }: {
      runDbTxFn: () => Promise<void>;
    }) => runDbTxFn();
    // Keep the real wallet/IndexedDB path; only the Cloud preparation boundary
    // is stubbed so a cold credential or crypto turn can be reproduced.
    db.setBackgroundApi({
      servicePrimeCloudSync: {
        syncManagers: {
          wallet: {
            buildExistingSyncItemsInfo: async () => ({
              existingSyncItems: [],
              newSyncItems: [],
            }),
            txWithSyncFlowOfDBRecordCreating: runSyncWrites,
          },
          indexedAccount: {
            buildExistingSyncItemsInfo: prepareIndexedSync,
            buildSyncKeyInfo: async ({
              target,
            }: {
              target: { targetId: string };
            }) => ({ key: target.targetId }),
            txWithSyncFlowOfDBRecordCreating: runSyncWrites,
          },
        },
      },
    } as unknown as IBackgroundApi);
    const context: IDBContext = {
      id: DB_MAIN_CONTEXT_ID,
      nextHD: 1,
      nextWalletNo: 1,
      verifyString: DEFAULT_VERIFY_STRING,
      localPasswordKdfUpgradedTargetIterations: 0,
      localSecretEnvelopeCredentialMigrated: false,
      localSecretEnvelopeCredentialMigratedTargetVersion: 0,
      localSecretEnvelopeCredentialMigrationLastScannedCredentialId: '',
      backupUUID: 'public-test-backup',
      nextSignatureMessageId: 1,
      nextSignatureTransactionId: 1,
      nextConnectedSiteId: 1,
    };
    await db.withTransaction(EIndexedDBBucketNames.account, async (tx) =>
      db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Context,
        records: [context],
        skipIfExists: true,
      }),
    );
    jest.spyOn(db, 'buildHwWalletId').mockResolvedValue({
      dbDeviceId: deviceId,
      dbWalletId: walletId,
      deviceUUID: 'public-test-uuid',
      rawDeviceId: 'public-test-device',
    });
    jest.spyOn(db, 'timeNow').mockResolvedValue(1);
    jest
      .spyOn(deviceUtils, 'getDeviceTypeFromFeatures')
      .mockResolvedValue(EDeviceType.Pro2);
    jest
      .spyOn(deviceUtils, 'getFirmwareType')
      .mockResolvedValue(EFirmwareType.Universal);
    jest
      .spyOn(deviceUtils, 'buildDeviceName')
      .mockResolvedValue('Public test hardware');
    jest
      .spyOn(deviceUtils, 'attachAppParamsToFeatures')
      .mockImplementation(async ({ features }) => features);
    const params: IDBCreateHwWalletParams = {
      device: {
        connectId: 'public-test-usb',
        deviceId: 'public-test-device',
        uuid: 'public-test-uuid',
        name: 'Public test hardware',
        deviceType: EDeviceType.Pro2,
      },
      features: {} as IDBCreateHwWalletParams['features'],
    };

    await expect(db.createHwWallet(params)).resolves.toMatchObject({
      wallet: { id: walletId },
    });
    expect(
      prepareIndexedSync.mock.calls.every(([p]) => p.tx === undefined),
    ).toBe(true);
    const { records } = await db.getRecordsByIds({
      name: ELocalDBStoreNames.IndexedAccount,
      ids: [`${walletId}--0`],
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ walletId, index: 0 });
  },
);
