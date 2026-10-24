import type { IDBCloudSyncItem } from '../../dbs/local/types';

type IPreviousSnapshotVersion = Pick<
  IDBCloudSyncItem,
  'id' | 'dataType' | 'data' | 'dataTime' | 'pwdHash' | 'isDeleted'
> & {
  rawData?: string;
  rawKey?: string;
};

// These guards belong to one background operation, never to DB or wire data.
const previousVersions = new WeakMap<
  IDBCloudSyncItem,
  IPreviousSnapshotVersion | null
>();
const rejectedWrites = new WeakSet<IDBCloudSyncItem>();

function versionOf(item: IDBCloudSyncItem): IPreviousSnapshotVersion {
  return {
    id: item.id,
    dataType: item.dataType,
    data: item.data,
    dataTime: item.dataTime,
    pwdHash: item.pwdHash,
    isDeleted: item.isDeleted,
    // With ciphertext, raw fields are only a decryption cache. Without it,
    // they are the actual offline payload and must participate in the guard.
    rawData: item.data ? undefined : item.rawData,
    rawKey: item.data ? undefined : item.rawKey,
  };
}

export function rememberPublicAccountSnapshotWrite(
  item: IDBCloudSyncItem,
  previous?: IDBCloudSyncItem,
): IDBCloudSyncItem {
  previousVersions.set(item, previous ? versionOf(previous) : null);
  return item;
}

export function hasPublicAccountSnapshotWriteGuard(
  item: IDBCloudSyncItem,
): boolean {
  return previousVersions.has(item);
}

export function isRejectedPublicAccountSnapshotWrite(
  item: IDBCloudSyncItem,
): boolean {
  return rejectedWrites.has(item);
}

export function rejectPublicAccountSnapshotWrite(item: IDBCloudSyncItem): void {
  rejectedWrites.add(item);
}

export function matchesPublicAccountSnapshotWrite(
  item: IDBCloudSyncItem,
  current?: IDBCloudSyncItem,
): boolean {
  if (rejectedWrites.has(item)) return false;
  const previous = previousVersions.get(item);
  if (previous === undefined) return true;
  if (previous === null) return current === undefined;
  if (!current) return false;
  const version = versionOf(current);
  return (
    previous.id === version.id &&
    previous.dataType === version.dataType &&
    previous.data === version.data &&
    previous.dataTime === version.dataTime &&
    previous.pwdHash === version.pwdHash &&
    previous.isDeleted === version.isDeleted &&
    previous.rawData === version.rawData &&
    previous.rawKey === version.rawKey
  );
}
