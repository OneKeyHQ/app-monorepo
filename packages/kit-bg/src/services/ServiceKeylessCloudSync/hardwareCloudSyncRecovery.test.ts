import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { LocalDbBase } from '../../dbs/local/LocalDbBase';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';

import {
  commitHardwareCloudSyncLocalRecovery,
  prepareHardwareCloudSyncLocalRecovery,
} from './hardwareCloudSyncRecovery';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: { updateSyncItem: jest.fn() },
}));

const syncCredential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'public-test-hardware-source',
    signingPrivateKey: '',
    signingPublicKey: '',
    encryptionKey: 'public-test-current-key',
    pwdHash: 'hw-dek-current',
  },
};

function record(dataTime = 200): IDBCloudSyncItem {
  return {
    id: 'public-test-wallet',
    rawKey: 'public-test-raw-key',
    dataType: EPrimeCloudSyncDataType.Wallet,
    rawData: JSON.stringify({
      rawKey: 'public-test-raw-key',
      dataType: EPrimeCloudSyncDataType.Wallet,
      payload: { name: 'B' },
    }),
    data: 'public-test-old-ciphertext',
    dataTime,
    pwdHash: 'hw-dek-no-longer-in-history',
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: false,
  };
}

describe('hardware re-sign recovery preserves business versions', () => {
  let local: IDBCloudSyncItem;
  let build: jest.SpiedFunction<
    typeof cloudSyncItemBuilder.buildSyncItemFromRawDataJson
  >;

  beforeEach(() => {
    local = record();
    build = jest
      .spyOn(cloudSyncItemBuilder, 'buildSyncItemFromRawDataJson')
      .mockImplementation(async ({ dataTime, rawDataJson }) => ({
        ...local,
        rawData: JSON.stringify(rawDataJson),
        data: 'public-test-current-ciphertext',
        dataTime,
        pwdHash: 'hw-dek-current',
      }));
    jest
      .spyOn(localDb, 'updateSyncItem')
      .mockImplementation(async ({ updater }) => {
        await updater(local);
      });
  });

  afterEach(() => jest.restoreAllMocks());

  test.each([
    {
      scenario: 'A edits then B edits',
      localTime: 200,
      serverTime: 100,
      winner: 'B',
    },
    {
      scenario: 'A only rotates and B edits',
      localTime: 200,
      serverTime: 50,
      winner: 'B',
    },
    {
      scenario: 'B edits then A edits',
      localTime: 100,
      serverTime: 200,
      winner: 'A',
    },
  ])(
    '$scenario converges to $winner after B re-signs',
    async ({ localTime, serverTime, winner }) => {
      local.dataTime = localTime;
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
      });
      await commitHardwareCloudSyncLocalRecovery(recovered);
      expect(local).toMatchObject({
        dataTime: localTime,
        pwdHash: 'hw-dek-current',
        serverUploaded: false,
      });
      const server = {
        ...local,
        rawData: 'public-test-A',
        dataTime: serverTime,
        serverUploaded: true,
      };
      LocalDbBase.prototype._updateCloudSyncPoolItemFn({
        item: local,
        updateItem: server,
      });
      expect(local.rawData).toBe(
        winner === 'A' ? server.rawData : recovered[0].original.rawData,
      );
      expect(local.dataTime).toBe(Math.max(localTime, serverTime));
      expect(local.serverUploaded).toBe(winner === 'A');
    },
  );

  test('local deletion remains a deletion with its original version and pending upload', async () => {
    local.isDeleted = true;
    local.serverUploaded = true;
    local.localSceneUpdated = false;
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
    });
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(local).toMatchObject({
      isDeleted: true,
      dataTime: 200,
      localSceneUpdated: false,
      serverUploaded: false,
      pwdHash: 'hw-dek-current',
    });
  });

  test('a concurrent edit is never overwritten by an earlier re-encryption snapshot', async () => {
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
    });
    local.rawData = 'public-test-later-edit';
    local.dataTime = 300;
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(local).toMatchObject({
      rawData: 'public-test-later-edit',
      dataTime: 300,
      pwdHash: 'hw-dek-no-longer-in-history',
    });
  });

  test('an edit made while encryption is waiting is compared to the original snapshot', async () => {
    build.mockImplementationOnce(async () => {
      local.rawData = 'public-test-edit-during-encryption';
      local.dataTime = 300;
      return {
        ...local,
        data: 'public-test-stale-ciphertext',
        pwdHash: 'hw-dek-current',
      };
    });
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
    });
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(local.dataTime).toBe(300);
    expect(local.pwdHash).toBe('hw-dek-no-longer-in-history');
  });

  test.each([
    '',
    '{invalid',
    JSON.stringify({
      dataType: 'Account',
      rawKey: 'public-test-raw-key',
      payload: {},
    }),
  ])(
    'unreadable local plaintext is retained without committing any changes',
    async (rawData) => {
      local.rawData = rawData;
      const before = { ...local };
      await expect(
        prepareHardwareCloudSyncLocalRecovery({
          items: [local],
          syncCredential,
        }),
      ).rejects.toMatchObject({
        reason: expect.stringContaining('Local hardware sync record'),
      });
      expect(local).toEqual(before);
    },
  );

  test('foreign keyless data is not authorized by the hardware recovery path', async () => {
    local.pwdHash = 'keyless-other-source';
    expect(
      await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
      }),
    ).toEqual([]);
    expect(build).not.toHaveBeenCalled();
  });
});
