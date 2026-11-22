import { isEqual } from 'lodash';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { HardwareCloudSyncCancelledError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IHardwareCloudSyncSession,
  IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCredential,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { devSettingsPersistAtom } from '../../states/jotai/atoms';
import {
  isRetainedHardwareCloudCopy,
  isSupportedCloudSyncDataType,
} from '../ServicePrimeCloudSync/cloudSyncCheckUtils';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import {
  createHardwareCloudSyncDataError,
  logHardwareCloudSyncDiagnostic,
  summarizeHardwareCloudSyncRestoreItems,
} from './hardwareCloudSyncLog';
import { verifiedSessionBaseURL } from './hardwareCloudSyncSession';

import type {
  IHardwareCloudSyncHistory,
  IServerSyncRecord,
} from './hardwareCloudSyncSession';
import type ServiceKeylessCloudSync from './ServiceKeylessCloudSync';
import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../dbs/local/types';
import type { CloudSyncFlowManagerWallet } from '../ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import type ServicePrimeCloudSync from '../ServicePrimeCloudSync/ServicePrimeCloudSync';

type IRecoveredItem = {
  original: IDBCloudSyncItem;
  replacement: IDBCloudSyncItem;
  replaceRawData?: boolean;
};

export function hasPendingDeletionFromPreviousHardwareKey({
  items,
  currentPwdHash,
  previousPwdHashes,
}: {
  items: IDBCloudSyncItem[];
  currentPwdHash: string;
  previousPwdHashes: ReadonlySet<string>;
}) {
  return items.some(
    (item) =>
      item.dataType === EPrimeCloudSyncDataType.Account &&
      !!item.pendingPublicAccountDeletionAt &&
      item.pwdHash !== currentPwdHash &&
      previousPwdHashes.has(item.pwdHash),
  );
}

// Only call after authenticating and unwrapping the selected hardware source.
// Local plaintext is sufficient to re-encrypt a business version; historical
// envelopes are not required and must not determine which edit wins.
export async function prepareHardwareCloudSyncLocalRecovery({
  items,
  syncCredential,
  knownPwdHashes,
  loadAuthoritativeItems,
}: {
  items: IDBCloudSyncItem[];
  syncCredential: ICloudSyncCredential;
  knownPwdHashes: ReadonlySet<string>;
  loadAuthoritativeItems?: (
    items: readonly IDBCloudSyncItem[],
  ) => Promise<IDBCloudSyncItem[]>;
}): Promise<IRecoveredItem[]> {
  const currentHash = cloudSyncItemBuilder.getPwdHash(syncCredential);
  const recovered: IRecoveredItem[] = [];
  const isKnownOpaqueCopy = (item: IDBCloudSyncItem) =>
    !item.rawData &&
    !item.isDeleted &&
    !!item.rawKey &&
    item.localSceneUpdated &&
    knownPwdHashes.has(item.pwdHash) &&
    isRetainedHardwareCloudCopy(item, currentHash);
  const opaqueCopies = items.filter(isKnownOpaqueCopy);
  if (loadAuthoritativeItems && opaqueCopies.length) {
    const candidates = await loadAuthoritativeItems(opaqueCopies);
    const byId = new Map<string, IDBCloudSyncItem | undefined>();
    for (const candidate of candidates) {
      byId.set(candidate.id, byId.has(candidate.id) ? undefined : candidate);
    }
    for (const item of opaqueCopies) {
      const replacement = byId.get(item.id);
      if (
        replacement?.data &&
        replacement.rawData &&
        replacement.rawKey === item.rawKey &&
        replacement.dataType === item.dataType &&
        replacement.pwdHash === currentHash &&
        !replacement.isDeleted
      ) {
        recovered.push({
          original: { ...item },
          replacement,
          replaceRawData: true,
        });
      }
    }
  }
  const candidates = items.filter((item) => {
    // Downloaded records can still be waiting for scene decryption. Preserve
    // their ciphertext when the authenticated history already accepts the key.
    const canRetainCiphertext =
      !item.rawData && item.data && knownPwdHashes.has(item.pwdHash);
    return (
      // An encrypted old-space server copy can have stale or corrupt cached
      // plaintext. Retain it unless the scoped loader above rebuilt it.
      !isRetainedHardwareCloudCopy(item, currentHash) &&
      !canRetainCiphertext &&
      (!item.pwdHash ||
        knownPwdHashes.has(item.pwdHash) ||
        // The local write path can create a plaintext-only version before
        // a credential is available, but downloaded ciphertext is not proof
        // that its cached rawData belongs to this source.
        (!item.data &&
          !!item.rawData &&
          item.localSceneUpdated &&
          !item.serverUploaded) ||
        (item.dataType !== EPrimeCloudSyncDataType.Wallet &&
          item.dataType !== EPrimeCloudSyncDataType.Account)) &&
      !item.pendingPublicAccountDeletionAt &&
      isSupportedCloudSyncDataType(item.dataType) &&
      item.dataType !== EPrimeCloudSyncDataType.Lock &&
      (!item.pwdHash ||
        item.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX)) &&
      !(item.pwdHash === currentHash && item.data)
    );
  });
  for (const item of candidates) {
    const original = { ...item };
    let raw: unknown;
    try {
      raw = JSON.parse(original.rawData ?? '');
    } catch {
      throw createHardwareCloudSyncDataError(
        'Local hardware sync record cannot be rebuilt',
      );
    }
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('dataType' in raw) ||
      raw.dataType !== original.dataType ||
      !('rawKey' in raw) ||
      typeof raw.rawKey !== 'string' ||
      (original.rawKey && raw.rawKey !== original.rawKey) ||
      !('payload' in raw) ||
      !raw.payload ||
      typeof raw.payload !== 'object'
    ) {
      throw createHardwareCloudSyncDataError(
        'Local hardware sync record has invalid plaintext metadata',
      );
    }
    const replacement = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson(
      {
        key: original.id,
        rawDataJson: raw as ICloudSyncRawDataJson,
        syncCredential,
        dataTime: original.dataTime,
      },
    );
    recovered.push({ original, replacement });
  }
  return recovered;
}

export async function commitHardwareCloudSyncLocalRecovery(
  recovered: IRecoveredItem[],
) {
  if (!recovered.length) return;
  const byId = new Map(recovered.map((item) => [item.original.id, item]));
  await localDb.updateSyncItem({
    ids: [...byId.keys()],
    updater: (record) => {
      const item = byId.get(record.id);
      if (
        item &&
        record.pwdHash === item.original.pwdHash &&
        record.data === item.original.data &&
        record.dataType === item.original.dataType &&
        record.rawKey === item.original.rawKey &&
        record.rawData === item.original.rawData &&
        record.serverUploaded === item.original.serverUploaded &&
        record.localSceneUpdated === item.original.localSceneUpdated &&
        record.dataTime === item.original.dataTime &&
        record.isDeleted === item.original.isDeleted &&
        !record.pendingPublicAccountDeletionAt
      ) {
        // Keep the business version, tombstone and pending scene state. A
        // concurrent edit is left untouched for the following full sync.
        record.data = item.replacement.data;
        if (item.replaceRawData) {
          record.rawData = item.replacement.rawData;
        }
        record.pwdHash = item.replacement.pwdHash;
        record.serverUploaded = false;
      }
      return record;
    },
  });
}

type IVerifiedWalletCache = {
  previous: IDBCloudSyncItem;
  incoming: IDBCloudSyncItem;
  wallet: IDBWallet;
  device?: IDBDevice;
};

const isVersion = (time: number | undefined): time is number =>
  typeof time === 'number' && Number.isSafeInteger(time) && time > 0;

// Only adopt data already authenticated by the current key and displayed by
// the business Wallet. Equal versions and intentional local edits stay out.
export async function prepareVerifiedWalletCaches({
  items,
  records,
  knownPwdHashes,
  syncCredential,
  walletManager,
  isCurrent,
}: {
  items: readonly IDBCloudSyncItem[];
  records: readonly IServerSyncRecord[];
  knownPwdHashes: ReadonlySet<string>;
  syncCredential: ICloudSyncCredential;
  walletManager: Pick<CloudSyncFlowManagerWallet, 'canUploadPendingWalletName'>;
  isCurrent: () => boolean;
}): Promise<IVerifiedWalletCache[]> {
  const currentHash = cloudSyncItemBuilder.getPwdHash(syncCredential);
  const old = new Map(
    items
      .filter(
        (item) =>
          item.dataType === EPrimeCloudSyncDataType.Wallet &&
          item.isDeleted === false &&
          item.localSceneUpdated === true &&
          item.serverUploaded === true &&
          !!item.rawData &&
          !!item.rawKey &&
          item.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
          knownPwdHashes.has(item.pwdHash) &&
          !item.pendingPublicAccountDeletionHash &&
          !item.remoteHardwareAccountTombstoneProof &&
          isVersion(item.dataTime) &&
          isRetainedHardwareCloudCopy(item, currentHash),
      )
      .map((item) => [item.id, item]),
  );
  if (!old.size) return [];
  const remote = new Map<string, IServerSyncRecord | undefined>();
  for (const record of records)
    if (record && old.has(record.key)) {
      remote.set(record.key, remote.has(record.key) ? undefined : record);
    }
  const result: IVerifiedWalletCache[] = [];
  const verify = async (id: string, row: IServerSyncRecord | undefined) => {
    const previous = old.get(id);
    if (
      !previous ||
      row?.dataType !== EPrimeCloudSyncDataType.Wallet ||
      row.isDeleted !== false ||
      typeof row.data !== 'string' ||
      !row.data ||
      row.data.length > 16_384 ||
      !isVersion(row.dataTimestamp) ||
      !isVersion(previous.dataTime) ||
      row.dataTimestamp <= previous.dataTime ||
      sha512ProSync({ data: previous.rawKey }) !== id
    )
      return;
    const incoming: IDBCloudSyncItem = {
      id,
      rawKey: previous.rawKey,
      rawData: undefined,
      data: row.data,
      dataType: EPrimeCloudSyncDataType.Wallet,
      dataTime: row.dataTimestamp,
      pwdHash: currentHash,
      isDeleted: false,
      localSceneUpdated: true,
      serverUploaded: true,
    };
    // Use the existing exact AEAD, wire identity and canonical field
    // verification. Only its observed Wallet/Device may authorize adoption.
    await walletManager.canUploadPendingWalletName({
      item: { ...incoming, serverUploaded: false },
      syncCredential,
      onVerifiedWallet: (wallet, device) => {
        if (isCurrent() && !wallet.isTemp && !wallet.isMocked)
          result.push({ previous, incoming, wallet, device });
      },
    });
  };
  for (const [id, row] of remote) {
    if (!isCurrent()) return [];
    if (result.length >= 10) break;
    await verify(id, row);
  }
  return result;
}

export async function commitVerifiedWalletCaches(
  candidates: readonly IVerifiedWalletCache[],
  isCurrent: () => boolean,
) {
  if (!candidates.length || !isCurrent()) return;
  await localDb.withTransaction(
    EIndexedDBBucketNames.account,
    async (tx) => {
      const { records: wallets } = await localDb.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
      });
      const commit = async ({
        previous,
        incoming,
        wallet,
        device,
      }: IVerifiedWalletCache) => {
        if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
        const matching = wallets.filter(
          (entry) =>
            entry?.type === wallet.type &&
            (device
              ? entry.associatedDevice === device.id &&
                (entry.passphraseState || '') === (wallet.passphraseState || '')
              : entry.hash === wallet.hash),
        );
        if (matching.length !== 1 || !isEqual(matching[0], wallet)) return;
        if (device) {
          const { records } = await localDb.txGetRecordsByIds({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [device.id],
          });
          if (!isEqual(records[0], device)) return;
        }
        const { records } = await localDb.txGetRecordsByIds({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [previous.id],
        });
        if (!isEqual(records[0], previous)) return;
        if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
        await localDb.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [previous.id],
          updater: (record) => {
            record.data = incoming.data;
            record.dataTime = incoming.dataTime;
            record.pwdHash = incoming.pwdHash;
            record.rawData = '';
            return record;
          },
        });
        if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
      };
      for (const candidate of candidates) await commit(candidate);
    },
    { skipCloudCredentialWarmup: true, confirmRollbackOnError: true },
  );
}

export function getVerifiedRecoveryRecords(
  history: IHardwareCloudSyncHistory,
  session: IHardwareCloudSyncSession | undefined,
  pwdHash: string,
): readonly IServerSyncRecord[] | undefined {
  if (
    !session?.boundBaseURLVerified ||
    !session.boundBaseURL?.startsWith('https://')
  )
    return undefined;
  const { serverData, pwdHash: responseHash } = history.data.data;
  if (responseHash !== undefined && responseHash !== pwdHash) return undefined;
  try {
    if (
      verifiedSessionBaseURL(
        history,
        session.boundBaseURL,
        '/prime/v1/sync/download',
      )
    )
      return serverData;
  } catch {
    // Unverifiable transport cannot authorize a cache change.
  }
  return undefined;
}

export async function recoverVerifiedWalletCaches({
  service,
  items,
  history,
  previousPwdHashes,
  key,
  isCurrent,
}: {
  items: readonly IDBCloudSyncItem[];
  history: IHardwareCloudSyncHistory;
  previousPwdHashes: readonly string[];
  key: IKeylessCloudSyncCredential;
  isCurrent: () => boolean;
  service: Pick<
    ServiceKeylessCloudSync,
    | 'backgroundApi'
    | 'buildSyncCredentialWithKeylessCredential'
    | 'getHardwareUploadGeneration'
    | 'getHardwareWalletRetryOrigin'
    | 'runWithCloudAccountImportLock'
    | 'runWithVerifiedHardwareAccountArchiveSession'
  >;
}) {
  const session = key.hardwareSession;
  const records = getVerifiedRecoveryRecords(history, session, key.pwdHash);
  if (!records || !session) return;
  const generation = service.getHardwareUploadGeneration();
  let changed = false;
  const invalidate = () => {
    changed = true;
  };
  const watch = devSettingsPersistAtom.sub(invalidate);
  const stillSelected = () =>
    !changed &&
    isCurrent() &&
    generation !== undefined &&
    generation === service.getHardwareUploadGeneration();
  try {
    await resolveBeforeTimeout(
      (async () => {
        const { serviceApp } = service.backgroundApi;
        // The original sign-in may commit after a late app lock. Its optional
        // recovery must not start reading Wallet metadata under the new epoch.
        if ((await serviceApp.isAppLocked()) || !stillSelected()) return;
        const candidates = await prepareVerifiedWalletCaches({
          items,
          records,
          knownPwdHashes: new Set(previousPwdHashes),
          syncCredential: service.buildSyncCredentialWithKeylessCredential(key),
          walletManager:
            service.backgroundApi.servicePrimeCloudSync.syncManagers.wallet,
          isCurrent: stillSelected,
        });
        if (
          !candidates.length ||
          !stillSelected() ||
          (await service.getHardwareWalletRetryOrigin()) !==
            session.boundBaseURL ||
          (await serviceApp.isAppLocked()) ||
          !stillSelected()
        )
          return;
        await service.runWithCloudAccountImportLock(async () => {
          if (!stillSelected()) return;
          // The repair mutex serializes the last persisted credential check
          // with revocation, including deletion before a generation bump.
          await service.runWithVerifiedHardwareAccountArchiveSession(key, () =>
            commitVerifiedWalletCaches(candidates, stillSelected),
          );
        });
      })(),
      1000,
    );
  } finally {
    invalidate();
    watch();
  }
}

export function logRestoreKeyCompatibility(
  items: IDBCloudSyncItem[],
  knownPwdHashes: ReadonlySet<string>,
  recoveredLocalItemCount: number,
  rebuildsLocalItemsNow: boolean,
  existing: IKeylessCloudSyncCredential | null | undefined,
  credential: IKeylessCloudSyncCredential,
  localItemKeyMismatch: (item: IDBCloudSyncItem) => boolean,
  existingHashRecoverable: boolean | undefined,
) {
  logHardwareCloudSyncDiagnostic('restore_key_compatibility_guard', () => ({
    rebuildsLocalItems: rebuildsLocalItemsNow,
    localItemCount: items.length,
    ...summarizeHardwareCloudSyncRestoreItems(items, knownPwdHashes),
    knownHashCount: knownPwdHashes.size,
    recoveredLocalItemCount,
    ignoredLegacyLockCount: items.filter(
      (item) =>
        item.dataType === EPrimeCloudSyncDataType.Lock &&
        item.pwdHash &&
        keylessCloudSyncUtils.isKeylessPwdHash(item.pwdHash),
    ).length,
    existingSigningPublicKeyEmpty: !!existing && !existing.signingPublicKey,
    currentSigningPublicKeyEmpty: !credential.signingPublicKey,
    hasExistingCredential: !!existing,
    localItemsMismatch:
      !rebuildsLocalItemsNow && items.some(localItemKeyMismatch),
    existingPwdHashMismatch:
      !!existing &&
      !knownPwdHashes.has(existing.pwdHash) &&
      !existingHashRecoverable,
    existingSigningPublicKeyMismatch:
      !!existing && existing.signingPublicKey !== credential.signingPublicKey,
  }));
}

export function makeWalletRecoveryEpoch(
  prime: Pick<
    ServicePrimeCloudSync,
    'clearCachedSyncCredential' | 'getPublicAccountSnapshotImportGeneration'
  >,
  atStart: number,
  isCurrent: () => boolean,
) {
  const get = () => prime.getPublicAccountSnapshotImportGeneration();
  let expected: number | undefined = atStart;
  return {
    clear: () => {
      // Adopt only this commit's own synchronous epoch change. App lock can
      // clear Cloud work before its atom records the transition.
      const same = expected === get();
      const done = prime.clearCachedSyncCredential();
      expected = same ? get() : undefined;
      return done;
    },
    isCurrent: () =>
      expected !== undefined && expected === get() && isCurrent(),
  };
}
