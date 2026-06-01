import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

import { buildOnlyCheckLocalDataTypes } from './cloudSyncCheckUtils';

describe('cloudSyncCheckUtils', () => {
  it('excludes BotWallet from full DB check local data types', () => {
    expect(buildOnlyCheckLocalDataTypes({ isFullDBChecking: true })).toEqual([
      EPrimeCloudSyncDataType.Lock,
      EPrimeCloudSyncDataType.Wallet,
      EPrimeCloudSyncDataType.Account,
      EPrimeCloudSyncDataType.IndexedAccount,
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
});
