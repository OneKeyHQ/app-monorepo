import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

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

// An old-space version must not be re-encrypted, replayed, pruned or
// overwritten by a response for the active hardware key.
export function isInactiveHardwareWalletAccount(
  item: Pick<IDBCloudSyncItem, 'pwdHash' | 'dataType'>,
  activePwdHash: string,
): boolean {
  return (
    activePwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
    !!item.pwdHash &&
    item.pwdHash !== activePwdHash &&
    (item.dataType === EPrimeCloudSyncDataType.Wallet ||
      item.dataType === EPrimeCloudSyncDataType.Account)
  );
}

// A settled remote copy is not a pending local action. Leave it under its
// original key until that space is selected again. Its rawData is only a cache.
export function isRetainedHardwareCloudCopy(
  item: IDBCloudSyncItem,
  activePwdHash: string,
): boolean {
  return (
    isInactiveHardwareWalletAccount(item, activePwdHash) &&
    !!item.data &&
    item.serverUploaded &&
    !item.isDeleted &&
    !item.pendingPublicAccountDeletionAt
  );
}
