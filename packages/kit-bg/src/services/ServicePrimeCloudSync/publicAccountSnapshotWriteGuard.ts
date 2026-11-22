import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import type { ICloudSyncServerItem } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

type IPreviousSnapshotVersion = Pick<
  IDBCloudSyncItem,
  'id' | 'dataType' | 'data' | 'dataTime' | 'pwdHash' | 'isDeleted'
> & {
  rawData?: string;
  rawKey?: string;
  pendingPublicAccountDeletionAt?: number;
  pendingPublicAccountDeletionHash?: string;
};

// These guards belong to one background operation, never to DB or wire data.
const previousVersions = new WeakMap<
  IDBCloudSyncItem,
  IPreviousSnapshotVersion | null
>();
const rejectedWrites = new WeakSet<IDBCloudSyncItem>();
export type IWalletTieState = {
  accepted: Map<string, IDBCloudSyncItem>;
  held: Map<string, number>;
  checked: ReadonlySet<string>;
  sameNode?: boolean;
  cleaned: Set<string>;
  requested: Map<string, IDBCloudSyncItem>;
  wire: ICloudSyncServerItem[];
  isCurrent: () => boolean;
};

const walletTies = new WeakMap<
  IDBCloudSyncItem,
  { state: IWalletTieState; verified?: IPreviousSnapshotVersion }
>();

export function guardWalletTie(item: IDBCloudSyncItem, state: IWalletTieState) {
  walletTies.set(item, { state });
}

export function recordWalletTieProof(
  item: IDBCloudSyncItem,
  previous: IDBCloudSyncItem,
) {
  const tie = walletTies.get(item);
  if (tie) tie.verified = versionOf(previous);
}
const rawPublicAccountFills = new WeakSet<IDBCloudSyncItem>();
const localOnlyRemovals = new WeakSet<IDBCloudSyncItem>();

export function removeUnsyncedPublicAccountSnapshot(
  previous: IDBCloudSyncItem,
): IDBCloudSyncItem {
  const removal = rememberPublicAccountSnapshotWrite({ ...previous }, previous);
  localOnlyRemovals.add(removal);
  return removal;
}

export function isUnsyncedPublicAccountSnapshotRemoval(
  item: IDBCloudSyncItem,
): boolean {
  return localOnlyRemovals.has(item);
}

function versionOf(item: IDBCloudSyncItem): IPreviousSnapshotVersion {
  return {
    id: item.id,
    dataType: item.dataType,
    data: item.data,
    dataTime: item.dataTime,
    pwdHash: item.pwdHash,
    isDeleted: item.isDeleted,
    pendingPublicAccountDeletionAt: item.pendingPublicAccountDeletionAt,
    pendingPublicAccountDeletionHash: item.pendingPublicAccountDeletionHash,
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
  return previousVersions.has(item) || walletTies.has(item);
}

export function isRejectedPublicAccountSnapshotWrite(
  item: IDBCloudSyncItem,
): boolean {
  return rejectedWrites.has(item);
}

export function rejectPublicAccountSnapshotWrite(item: IDBCloudSyncItem): void {
  rejectedWrites.add(item);
}

function sameVersion(
  previous: IPreviousSnapshotVersion,
  current: IDBCloudSyncItem,
) {
  const version = versionOf(current);
  return (
    previous.id === version.id &&
    previous.dataType === version.dataType &&
    previous.data === version.data &&
    previous.dataTime === version.dataTime &&
    previous.pwdHash === version.pwdHash &&
    previous.isDeleted === version.isDeleted &&
    previous.pendingPublicAccountDeletionAt ===
      version.pendingPublicAccountDeletionAt &&
    previous.pendingPublicAccountDeletionHash ===
      version.pendingPublicAccountDeletionHash &&
    previous.rawData === version.rawData &&
    previous.rawKey === version.rawKey
  );
}

export function matchesPublicAccountSnapshotWrite(
  item: IDBCloudSyncItem,
  current?: IDBCloudSyncItem,
): boolean {
  if (rejectedWrites.has(item)) return false;
  const tie = walletTies.get(item);
  if (tie && item.dataTime !== undefined) {
    const requested = tie.state.requested.get(item.id);
    if (
      (requested?.dataType === EPrimeCloudSyncDataType.Wallet &&
        requested.dataTime === item.dataTime) ||
      (current?.dataType === EPrimeCloudSyncDataType.Wallet &&
        current.dataTime === item.dataTime)
    ) {
      const accepted = tie.state.accepted.get(item.id);
      if (accepted && current) {
        const prior = versionOf(accepted);
        if (sameVersion(prior, item) && sameVersion(prior, current))
          return false;
      }
      const verified = tie.verified;
      if (
        !tie.state.isCurrent() ||
        !verified ||
        !current ||
        !sameVersion(verified, current)
      ) {
        tie.state.held.set(
          item.id,
          Math.max(item.dataTime, tie.state.held.get(item.id) ?? 0),
        );
        return false;
      }
      tie.state.accepted.set(item.id, item);
    }
  }
  const previous = previousVersions.get(item);
  if (previous === undefined) return true;
  if (previous === null) return current === undefined;
  if (!current) return false;
  if (
    rawPublicAccountFills.has(item) &&
    current.remoteHardwareAccountTombstoneProof !== undefined
  )
    return false;
  return sameVersion(previous, current);
}

// Proven only for this local delete operation; no scope credential or old
// ciphertext reference can leak into the serialized/uploaded tombstone.
type IForeignAccountDeletion = {
  previous: IDBCloudSyncItem;
  credential: IKeylessCloudSyncCredential;
  accountId: string;
  identityHash: string;
};

const foreignAccountDeletions = new WeakMap<
  IDBCloudSyncItem,
  IForeignAccountDeletion
>();

export function rememberForeignAccountDeletion(
  tombstone: IDBCloudSyncItem,
  intent: IForeignAccountDeletion,
) {
  foreignAccountDeletions.set(tombstone, intent);
  return tombstone;
}

export function getForeignAccountDeletion(tombstone: IDBCloudSyncItem) {
  return foreignAccountDeletions.get(tombstone);
}

// This provenance exists only until the final pool transaction.
const offlineSnapshotFills = new WeakMap<
  IDBCloudSyncItem,
  { previous: IDBCloudSyncItem; snapshot: ICloudPublicAccountSnapshot }
>();

export function rememberOfflinePublicAccountSnapshotFill(
  item: IDBCloudSyncItem,
  previous: IDBCloudSyncItem,
  snapshot: ICloudPublicAccountSnapshot,
  expectedPwdHash: string,
): boolean {
  if (
    previous.dataType !== EPrimeCloudSyncDataType.Account ||
    previous.remoteHardwareAccountTombstoneProof !== undefined ||
    item.dataType !== EPrimeCloudSyncDataType.Account ||
    item.id !== previous.id ||
    item.rawKey !== previous.rawKey ||
    item.isDeleted !== previous.isDeleted ||
    !item.data ||
    !/^(?:[a-f\d]{2}){16,}$/i.test(item.data) ||
    item.rawData !== '' ||
    !expectedPwdHash ||
    item.pwdHash !== expectedPwdHash
  )
    return false;
  rememberPublicAccountSnapshotWrite(item, previous);
  rawPublicAccountFills.add(item);
  if (
    !previous.data &&
    previous.pwdHash === '' &&
    previous.rawKey === item.rawKey &&
    previous.serverUploaded === false &&
    previous.localSceneUpdated === true &&
    previous.isDeleted === false &&
    previous.pendingPublicAccountDeletionAt === undefined &&
    previous.pendingPublicAccountDeletionHash === undefined
  ) {
    offlineSnapshotFills.set(item, { previous: { ...previous }, snapshot });
  }
  return true;
}

export function getOfflinePublicAccountSnapshotFill(item: IDBCloudSyncItem) {
  return offlineSnapshotFills.get(item);
}
