import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

const FULL_DB_CHECK_LOCAL_DATA_TYPES: EPrimeCloudSyncDataType[] = [
  EPrimeCloudSyncDataType.Lock,
  EPrimeCloudSyncDataType.Wallet,
  EPrimeCloudSyncDataType.Account,
  EPrimeCloudSyncDataType.IndexedAccount,
];

const ALL_CHECK_LOCAL_DATA_TYPES = Object.values(EPrimeCloudSyncDataType);

export function buildOnlyCheckLocalDataTypes({
  isFullDBChecking,
}: {
  isFullDBChecking?: boolean;
}): EPrimeCloudSyncDataType[] {
  return [
    ...(isFullDBChecking
      ? FULL_DB_CHECK_LOCAL_DATA_TYPES
      : ALL_CHECK_LOCAL_DATA_TYPES),
  ];
}
