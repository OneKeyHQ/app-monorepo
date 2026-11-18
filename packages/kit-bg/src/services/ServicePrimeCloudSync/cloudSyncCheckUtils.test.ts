import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

import { buildOnlyCheckLocalDataTypes } from './cloudSyncCheckUtils';

describe('cloudSyncCheckUtils', () => {
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
