import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import systemTimeUtils, {
  ECloudSyncDataTimeSource,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';

import {
  buildOnlyCheckLocalDataTypes,
  buildRemoteHardwareAccountTombstoneProof,
  isCloudSyncDeletionNewer,
  isProvenSettledRemoteHardwareAccountTombstone,
} from './cloudSyncCheckUtils';

describe('cloudSyncCheckUtils', () => {
  it('does not treat a known invalid future deletion as newer', () => {
    const now = 1_750_000_000_000;
    const clock = jest
      .spyOn(systemTimeUtils, 'getCorrectedCloudSyncNow')
      .mockReturnValueOnce({
        time: now,
        source: ECloudSyncDataTimeSource.Estimated,
      });
    expect(isCloudSyncDeletionNewer(now + 60 * 60 * 1000, now)).toBe(false);
    clock.mockRestore();
  });

  it('allows full checks to discover public accounts and BotWallet records', () => {
    expect(buildOnlyCheckLocalDataTypes({ isFullDBChecking: true })).toEqual([
      EPrimeCloudSyncDataType.Lock,
      EPrimeCloudSyncDataType.Wallet,
    ]);
  });

  it('includes BotWallet in regular check local data types', () => {
    const dataTypes = buildOnlyCheckLocalDataTypes({
      isFullDBChecking: false,
    });

    expect(dataTypes).toContain(EPrimeCloudSyncDataType.BotWallet);
    expect(dataTypes).toContain(EPrimeCloudSyncDataType.Wallet);
    expect(dataTypes).toContain(EPrimeCloudSyncDataType.Account);
  });

  it('matches the server missing-record filter for a second device with no accounts', () => {
    const remote = Array.from({ length: 60 }, (_, index) => [
      {
        key: `account-${index}`,
        dataType: EPrimeCloudSyncDataType.Account,
        isDeleted: false,
      },
      {
        key: `indexed-${index}`,
        dataType: EPrimeCloudSyncDataType.IndexedAccount,
        isDeleted: false,
      },
    ]).flat();
    remote.push(
      {
        key: 'wallet',
        dataType: EPrimeCloudSyncDataType.Wallet,
        isDeleted: false,
      },
      { key: 'lock', dataType: EPrimeCloudSyncDataType.Lock, isDeleted: false },
      {
        key: 'deleted-account',
        dataType: EPrimeCloudSyncDataType.Account,
        isDeleted: true,
      },
    );
    const localKeys = new Set<string>();
    const updatedFor = (isFullDBChecking: boolean) => {
      const onlyLocal = new Set(
        buildOnlyCheckLocalDataTypes({ isFullDBChecking }),
      );
      // e2ee-server SyncService.check: an absent local key is returned in
      // `updated` only when its type is not local-only and it is not deleted.
      return remote.filter(
        (item) =>
          !localKeys.has(item.key) &&
          !onlyLocal.has(item.dataType) &&
          !item.isDeleted,
      );
    };
    expect(updatedFor(true)).toEqual(remote.slice(0, 120));
    expect(updatedFor(false)).toEqual([]);
  });
});

describe('remote hardware Account tombstone v1 proofs', () => {
  // SHA-512 over the UTF-8 bytes of the previously persisted JSON tuple.
  const legacyProofs = [
    {
      kind: 'portable ASCII',
      fields: {
        id: 'acct-remote',
        pwdHash: 'hw-dek-hash',
        dataTime: 1_731_020_000_123,
        data: 'aB'.repeat(16),
      },
      expected:
        '8ac29072727afee5c4aedca5eeab3ef9e013830e39a3d5f6590d84ac66885e7b50af7b798a7d2f461d7f37009a5018e8154794acea75e7d7b5e6bef4e495b07a',
    },
    {
      kind: 'escaped UTF-8 and safe integer boundary',
      fields: {
        id: 'id"\\\n雪🙂\u2028\u2029\uD800',
        pwdHash: 'hw-dek-\u0000\tquoted"',
        dataTime: Number.MAX_SAFE_INTEGER,
        data: '00ff'.repeat(8),
      },
      expected:
        '997be12de742586e59cc5a0492e43729ac4b095f647d072a3a7681ba13c9011ef4cdce3125daae66fbcd0b5fb0f08cfc69e4d1e55cc3b43744fdcc7a1234dc4e',
    },
  ];

  it.each(legacyProofs)(
    'preserves and verifies an existing v1 proof: $kind',
    ({ fields, expected }) => {
      expect(buildRemoteHardwareAccountTombstoneProof(fields)).toBe(expected);
      expect(
        isProvenSettledRemoteHardwareAccountTombstone({
          ...fields,
          dataType: EPrimeCloudSyncDataType.Account,
          isDeleted: true,
          serverUploaded: true,
          localSceneUpdated: true,
          remoteHardwareAccountTombstoneProof: expected,
        }),
      ).toBe(true);
    },
  );

  it('preserves undefined tuple slots but never verifies an incomplete proof', () => {
    const fields = {
      id: 'absent',
      pwdHash: 'hw-dek-hash',
      dataTime: undefined,
      data: undefined,
    };
    const legacy =
      'ee2ac8adcaaf8fa5372e852a7bb798ab6a4f80a321e84af42c881d880410656589f1e41303ae16310d2d2ac6bd4cfc46a5d0444a44e839a79392efaaba0ff0b1';
    expect(buildRemoteHardwareAccountTombstoneProof(fields)).toBe(legacy);
    expect(
      isProvenSettledRemoteHardwareAccountTombstone({
        ...fields,
        dataType: EPrimeCloudSyncDataType.Account,
        isDeleted: true,
        serverUploaded: true,
        localSceneUpdated: true,
        remoteHardwareAccountTombstoneProof: legacy,
      }),
    ).toBe(false);
  });
});
