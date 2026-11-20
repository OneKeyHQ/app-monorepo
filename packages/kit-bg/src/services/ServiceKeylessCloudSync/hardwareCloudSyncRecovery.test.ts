import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { LocalDbBase } from '../../dbs/local/LocalDbBase';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';

import {
  commitHardwareCloudSyncLocalRecovery,
  hasPendingDeletionFromPreviousHardwareKey,
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

test.each([
  ['previous key known from history', 'history-key', 200, true],
  ['only the stored credential knows the old key', 'stored-key', 200, true],
  [
    'current key can still authenticate the deletion',
    'current-key',
    200,
    false,
  ],
  ['a different space is not rewritten', 'foreign-key', 200, false],
  [
    'an ordinary previous-key record has no pending deletion',
    'history-key',
    undefined,
    false,
  ],
] as const)('%s', (_scenario, pwdHash, pendingAt, expected) => {
  const item: IDBCloudSyncItem = {
    ...record(),
    dataType: EPrimeCloudSyncDataType.Account,
    pendingPublicAccountDeletionAt: pendingAt,
    pwdHash,
  };
  const original = { ...item };
  expect(
    hasPendingDeletionFromPreviousHardwareKey({
      items: [item],
      currentPwdHash: 'current-key',
      previousPwdHashes: new Set(['history-key', 'stored-key']),
    }),
  ).toBe(expected);
  expect(item).toEqual(original);
});

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
        knownPwdHashes: new Set([local.pwdHash]),
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
      knownPwdHashes: new Set([local.pwdHash]),
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
      knownPwdHashes: new Set([local.pwdHash]),
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

  test('a pending account deletion written after recovery preparation is preserved', async () => {
    local.dataType = EPrimeCloudSyncDataType.Account;
    local.rawData = JSON.stringify({
      rawKey: local.rawKey,
      dataType: local.dataType,
      payload: { name: 'B' },
    });
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set([local.pwdHash]),
    });
    expect(recovered).toHaveLength(1);
    local.pendingPublicAccountDeletionAt = 300;
    local.pendingPublicAccountDeletionHash = 'public-test-account-identity';
    const before = { ...local };

    await commitHardwareCloudSyncLocalRecovery(recovered);

    expect(local).toEqual(before);
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
      knownPwdHashes: new Set([local.pwdHash]),
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
      if (!rawData) local.data = '';
      const before = { ...local };
      await expect(
        prepareHardwareCloudSyncLocalRecovery({
          items: [local],
          syncCredential,
          knownPwdHashes: new Set([local.pwdHash]),
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
        knownPwdHashes: new Set(),
      }),
    ).toEqual([]);
    expect(build).not.toHaveBeenCalled();
  });

  test('an unknown cached plaintext copy is never migrated into the current key', async () => {
    local.serverUploaded = true;
    const before = { ...local };
    const loadAuthoritativeItems = jest.fn();
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set(),
      loadAuthoritativeItems,
    });
    expect(recovered).toEqual([]);
    expect(loadAuthoritativeItems).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    expect(local).toEqual(before);
  });

  test.each([true, false])(
    'requires exact authoritative identity (matches=%s)',
    async (matches) => {
      local.rawData = '';
      local.serverUploaded = true;
      const before = { ...local };
      const replacement = {
        ...local,
        rawKey: matches ? local.rawKey : 'different-raw-key',
        rawData: 'canonical-local-business-record',
        data: 'current-canonical-ciphertext',
        pwdHash: 'hw-dek-current',
        dataTime: undefined,
      };
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([local.pwdHash]),
        loadAuthoritativeItems: async () => [replacement],
      });
      await commitHardwareCloudSyncLocalRecovery(recovered);
      expect(local).toEqual(
        matches
          ? {
              ...before,
              rawData: replacement.rawData,
              data: replacement.data,
              pwdHash: replacement.pwdHash,
              serverUploaded: false,
            }
          : before,
      );
      expect(build).not.toHaveBeenCalled();
    },
  );

  test('an opaque record accepted by key history is retained without re-encryption', async () => {
    local.rawData = '';
    const before = { ...local };
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set([local.pwdHash]),
    });
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(recovered).toEqual([]);
    expect(build).not.toHaveBeenCalled();
    expect(local).toEqual(before);
  });

  test('key history cannot recover a record with neither ciphertext nor plaintext', async () => {
    local.rawData = '';
    local.data = '';
    await expect(
      prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([local.pwdHash]),
      }),
    ).rejects.toMatchObject({
      reason: expect.stringContaining('Local hardware sync record'),
    });
  });
});
