import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

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
    // A tombstone may still need scene application even after server ACK.
    (!item.isDeleted || item.localSceneUpdated) &&
    !item.pendingPublicAccountDeletionAt
  );
}

// Skipping an unreadable local edit is not proof that its bytes belong to
// the selected source. This is only an admission check for re-signing.
export function isUnverifiedPendingHardwareWalletCopy(
  item: IDBCloudSyncItem,
): boolean {
  const keySuffix = item.pwdHash.slice(
    HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX.length,
  );
  return (
    item.dataType === EPrimeCloudSyncDataType.Wallet &&
    item.serverUploaded === false &&
    item.localSceneUpdated === true &&
    !item.isDeleted &&
    item.pendingPublicAccountDeletionAt === undefined &&
    !item.pendingPublicAccountDeletionHash &&
    item.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
    /^[a-f0-9]{64}$/.test(keySuffix) &&
    !!item.rawKey &&
    sha512ProSync({ data: item.rawKey }) === item.id &&
    typeof item.dataTime === 'number' &&
    Number.isSafeInteger(item.dataTime) &&
    item.dataTime > 0 &&
    !!item.data &&
    item.data.length >= 56 &&
    item.data.length % 2 === 0 &&
    !/[^a-f0-9]/i.test(item.data)
  );
}

// Only a settled foreign Account cache can vacate its wire ID. Intent and
// unapplied scenes/tombstones stay in their original pool row.
export function canArchiveForeignAccountCopy(
  item: IDBCloudSyncItem,
  activePwdHash: string,
): boolean {
  return (
    item.dataType === EPrimeCloudSyncDataType.Account &&
    !item.isDeleted &&
    item.localSceneUpdated &&
    !item.pendingPublicAccountDeletionHash &&
    isRetainedHardwareCloudCopy(item, activePwdHash)
  );
}

export function buildRemoteHardwareAccountTombstoneProof({
  id,
  pwdHash,
  data,
  dataTime,
}: Pick<IDBCloudSyncItem, 'id' | 'pwdHash' | 'data' | 'dataTime'>): string {
  return sha512ProSync({
    // Keep the v1 primitive tuple in its original wire order.
    data: stableStringify([
      'remote-hardware-account-tombstone-v1',
      id,
      pwdHash,
      dataTime,
      data,
    ]),
  });
}

const remoteTombstonePromotions = new WeakSet<object>();

export function rememberRemoteHardwareTombstonePromotion<T extends object>(
  row: T,
): T {
  remoteTombstonePromotions.add(row);
  return row;
}

export function consumeRemoteHardwareTombstonePromotion(row: object): boolean {
  return remoteTombstonePromotions.delete(row);
}

export function isProvenSettledRemoteHardwareAccountTombstone(
  item: unknown,
): boolean {
  return (
    !!item &&
    typeof item === 'object' &&
    'id' in item &&
    typeof item.id === 'string' &&
    !!item.id &&
    'isDeleted' in item &&
    item.isDeleted === true &&
    'dataType' in item &&
    item.dataType === EPrimeCloudSyncDataType.Account &&
    'pwdHash' in item &&
    typeof item.pwdHash === 'string' &&
    item.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
    'serverUploaded' in item &&
    item.serverUploaded === true &&
    'localSceneUpdated' in item &&
    item.localSceneUpdated === true &&
    (!('pendingPublicAccountDeletionAt' in item) ||
      item.pendingPublicAccountDeletionAt === undefined) &&
    (!('pendingPublicAccountDeletionHash' in item) ||
      item.pendingPublicAccountDeletionHash === undefined) &&
    'dataTime' in item &&
    typeof item.dataTime === 'number' &&
    Number.isSafeInteger(item.dataTime) &&
    item.dataTime > 0 &&
    'data' in item &&
    typeof item.data === 'string' &&
    item.data.length >= 32 &&
    item.data.length % 2 === 0 &&
    /^[0-9a-f]+$/i.test(item.data) &&
    'remoteHardwareAccountTombstoneProof' in item &&
    typeof item.remoteHardwareAccountTombstoneProof === 'string' &&
    item.remoteHardwareAccountTombstoneProof ===
      buildRemoteHardwareAccountTombstoneProof({
        id: item.id,
        pwdHash: item.pwdHash,
        dataTime: item.dataTime,
        data: item.data,
      })
  );
}

// Only authenticated remote handoffs may move another hardware space's fully
// applied deletion into the archive. Local mutation fallback stays live-only.
export function canArchiveSettledForeignAccountHandoff(
  item: IDBCloudSyncItem,
  activePwdHash: string,
): boolean {
  if (!item.isDeleted) return canArchiveForeignAccountCopy(item, activePwdHash);
  return (
    isInactiveHardwareWalletAccount(item, activePwdHash) &&
    isProvenSettledRemoteHardwareAccountTombstone(item)
  );
}
