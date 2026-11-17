import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

// The server suppresses missing remote records for these types. Public account
// snapshots must remain discoverable on another device during full reconciliation.
// Wallet and Lock metadata still require an existing local counterpart.
const FULL_DB_CHECK_LOCAL_DATA_TYPES: EPrimeCloudSyncDataType[] = [
  EPrimeCloudSyncDataType.Lock,
  EPrimeCloudSyncDataType.Wallet,
];

const ALL_CHECK_LOCAL_DATA_TYPES = Object.values(EPrimeCloudSyncDataType);
const SUPPORTED_DATA_TYPES: ReadonlySet<string> = new Set(
  ALL_CHECK_LOCAL_DATA_TYPES,
);

export function isSupportedCloudSyncDataType(
  dataType: unknown,
): dataType is EPrimeCloudSyncDataType {
  return typeof dataType === 'string' && SUPPORTED_DATA_TYPES.has(dataType);
}

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
