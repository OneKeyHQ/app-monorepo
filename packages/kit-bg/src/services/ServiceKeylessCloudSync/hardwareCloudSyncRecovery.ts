import { isEqual, isPlainObject, omit } from 'lodash';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSniSupported } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import timerUtils, {
  resolveBeforeTimeout,
} from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type {
  IHardwareCloudSyncSession,
  IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCheckServerStatusResult,
  ICloudSyncCredential,
  ICloudSyncPayloadWallet,
  ICloudSyncRawDataJson,
  ICloudSyncTargetWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { devSettingsPersistAtom } from '../../states/jotai/atoms';
import {
  buildOnlyCheckLocalDataTypes,
  canReplaceSettledPublicAccountCache,
  isRetainedHardwareCloudCopy,
  isSupportedCloudSyncDataType,
  isUnverifiedPendingHardwareWalletCopy,
} from '../ServicePrimeCloudSync/cloudSyncCheckUtils';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';
import {
  normalizePublicAccountSnapshotRecord,
  publicAccountIdentityEqual,
} from '../ServicePrimeCloudSync/publicAccountSnapshot';

import {
  createHardwareCloudSyncDataError,
  logHardwareCloudSyncDiagnostic,
  summarizeHardwareCloudSyncRestoreItems,
} from './hardwareCloudSyncLog';
import {
  computeHardwareCloudSyncPwdHash,
  isHardwareCloudSyncKeyEnvelopeItem,
  readEnvelope,
  requestRawWithHardwareCloudSyncSession,
  verifiedSessionBaseURL,
} from './hardwareCloudSyncSession';

import type {
  IHardwareCloudSyncHistory,
  IServerSyncRecord,
} from './hardwareCloudSyncSession';
import type ServiceKeylessCloudSync from './ServiceKeylessCloudSync';
import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBSetWalletNameAndAvatarParams,
  IDBWallet,
} from '../../dbs/local/types';
import type { CloudSyncFlowManagerWallet } from '../ServicePrimeCloudSync/CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import type ServicePrimeCloudSync from '../ServicePrimeCloudSync/ServicePrimeCloudSync';
import type { AxiosResponse } from 'axios';

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
  scene?: {
    payload: ICloudSyncPayloadWallet;
    target: ICloudSyncTargetWallet;
  };
};

const isVersion = (time: number | undefined): time is number =>
  typeof time === 'number' && Number.isSafeInteger(time) && time > 0;

function validRecoveryAvatar(avatar: ICloudSyncPayloadWallet['avatar']) {
  return (
    avatar === undefined ||
    (isPlainObject(avatar) &&
      typeof avatar.img === 'string' &&
      !!avatar.img &&
      (avatar.emoji === undefined || typeof avatar.emoji === 'string') &&
      (avatar.bgColor === undefined || typeof avatar.bgColor === 'string'))
  );
}

function matchesRetainedWalletPreimage({
  previous,
  wallet,
  payload,
  device,
  requireChange = true,
}: {
  previous: IDBCloudSyncItem;
  wallet: IDBWallet;
  payload: ICloudSyncPayloadWallet;
  device?: IDBDevice;
  requireChange?: boolean;
}) {
  // Realm materializes an unset optional hash as null; IndexedDB omits it.
  const walletHash = payload.walletHash ?? undefined;
  const firstEvmAddress = payload.firstEvmAddress ?? undefined;
  if (
    wallet.isTemp ||
    wallet.isMocked ||
    !payload.name.trim() ||
    !validRecoveryAvatar(payload.avatar) ||
    payload.walletType !== wallet.type ||
    (payload.passphraseState ?? '') !== (wallet.passphraseState ?? '') ||
    payload.hwDeviceId !== device?.deviceId ||
    walletHash !== (wallet.hash ?? undefined) ||
    firstEvmAddress === '' ||
    firstEvmAddress !== (wallet.firstEvmAddress ?? undefined) ||
    !previous.rawData ||
    previous.rawData.length > 16_384 ||
    !/^(?:[a-f0-9]{2}){28,}$/i.test(previous.data ?? '')
  )
    return false;
  try {
    // An old plaintext cache can only veto a change. It never supplies a
    // value, timestamp or scope for the authenticated incoming scene.
    const old = JSON.parse(previous.rawData) as ICloudSyncRawDataJson;
    if (old?.dataType !== EPrimeCloudSyncDataType.Wallet || !old.payload)
      return false;
    const avatar: unknown = wallet.avatar ? JSON.parse(wallet.avatar) : {};
    const canonicalAvatar =
      isPlainObject(avatar) && Object.keys(avatar as object).length
        ? avatar
        : undefined;
    return (
      isPlainObject(avatar) &&
      old.rawKey === previous.rawKey &&
      old.payload.walletType === payload.walletType &&
      (old.payload.walletHash ?? undefined) === walletHash &&
      old.payload.hwDeviceId === payload.hwDeviceId &&
      old.payload.passphraseState === payload.passphraseState &&
      (old.payload.firstEvmAddress ?? undefined) === firstEvmAddress &&
      old.payload.name === wallet.name &&
      validRecoveryAvatar(old.payload.avatar) &&
      isEqual(old.payload.avatar, canonicalAvatar) &&
      // The ordinary scene does not clear an omitted avatar.
      (payload.avatar !== undefined || canonicalAvatar === undefined) &&
      (!requireChange ||
        payload.name !== wallet.name ||
        !isEqual(payload.avatar, canonicalAvatar))
    );
  } catch {
    return false;
  }
}

// Only adopt data already authenticated by the current key and displayed by
// the business Wallet. A verified equal live server version wins the cache
// tie without changing the business Wallet or creating an outbound edit.
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
  walletManager: Pick<
    CloudSyncFlowManagerWallet,
    | 'canUploadPendingWalletName'
    | 'findWalletSyncTargetReadOnly'
    | 'buildSyncKeyInfo'
  >;
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
      row.dataTimestamp < previous.dataTime ||
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
    // Keep the existing equal/business-identical path unchanged.
    let canonicalWasEqual = false;
    await walletManager.canUploadPendingWalletName({
      item: { ...incoming, serverUploaded: false },
      syncCredential,
      onVerifiedWallet: (wallet, device) => {
        canonicalWasEqual = true;
        if (isCurrent() && !wallet.isTemp && !wallet.isMocked)
          result.push({ previous, incoming, wallet, device });
      },
    });
    if (
      canonicalWasEqual ||
      !isCurrent() ||
      (incoming.dataTime ?? 0) <= (previous.dataTime ?? 0)
    )
      return;

    // A differing scene needs a separate exact current AEAD and identity
    // check. The normal upload verifier continues to reject divergent data.
    try {
      const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
        item: { ...incoming },
        syncCredential,
      });
      if (
        !isCurrent() ||
        rawDataJson?.dataType !== EPrimeCloudSyncDataType.Wallet ||
        rawDataJson.rawKey !== previous.rawKey ||
        !rawDataJson.payload ||
        typeof rawDataJson.payload.name !== 'string'
      )
        return;
      const { payload } = rawDataJson;
      const matched = await walletManager.findWalletSyncTargetReadOnly({
        payload,
        isCurrent,
      });
      if (!matched || !isCurrent()) return;
      const { target, device } = matched;
      const syncKey = await walletManager.buildSyncKeyInfo({ target });
      if (
        !isCurrent() ||
        syncKey?.key !== id ||
        syncKey.rawKey !== previous.rawKey
      )
        return;
      const wallet = await localDb.getRecordById({
        name: ELocalDBStoreNames.Wallet,
        id: target.wallet.id,
      });
      if (
        wallet &&
        isCurrent() &&
        matchesRetainedWalletPreimage({ previous, wallet, payload, device })
      )
        result.push({
          previous,
          incoming: { ...incoming, localSceneUpdated: false },
          wallet,
          device,
          scene: { target, payload },
        });
    } catch {
      // Unreadable or unauthenticated records stay in the original pool slot.
    }
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
  verifiedEdit?: IDBSetWalletNameAndAvatarParams,
) {
  if (!candidates.length || !isCurrent()) return false;
  return localDb.withTransaction(
    EIndexedDBBucketNames.account,
    async (tx) => {
      const { records: wallets } = await localDb.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
      });
      let applied = false;
      const commit = async ({
        previous,
        incoming,
        wallet,
        device,
        scene,
      }: IVerifiedWalletCache) => {
        if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
        if (
          scene &&
          (!verifiedEdit ||
            verifiedEdit.walletId !== wallet.id ||
            verifiedEdit.expectedCloudSyncWalletName !== wallet.name ||
            verifiedEdit.cloudSyncSource !== incoming ||
            verifiedEdit.name !== scene.payload.name ||
            verifiedEdit.avatar !== scene.payload.avatar ||
            verifiedEdit.deferCloudSyncWalletName)
        )
          return;
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
          // Query reads refill these fields, while Realm returns the raw
          // Device inside the transaction. Compare every persisted field.
          const projections = [
            'deviceStateInfo',
            'settings',
            'vendor',
            'featuresInfo',
          ];
          const current = records[0];
          if (
            !current ||
            !isEqual(omit(current, projections), omit(device, projections))
          )
            return;
        }
        const { records } = await localDb.txGetRecordsByIds({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [previous.id],
        });
        if (!isEqual(records[0], previous)) return;
        if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
        if (scene && verifiedEdit) {
          await localDb.txUpdateWallet({
            tx,
            walletId: wallet.id,
            updater: (record) => {
              if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
              if (verifiedEdit.name) record.name = verifiedEdit.name;
              if (verifiedEdit.avatar)
                record.avatar = JSON.stringify(verifiedEdit.avatar);
              return record;
            },
          });
        }
        await localDb.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [previous.id],
          updater: (record) => {
            if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
            record.data = incoming.data;
            record.dataTime = incoming.dataTime;
            record.pwdHash = incoming.pwdHash;
            record.rawData = '';
            return record;
          },
        });
        if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
        applied = true;
      };
      for (const candidate of candidates) await commit(candidate);
      return applied;
    },
    { skipCloudCredentialWarmup: true, confirmRollbackOnError: true },
  );
}

type IVerifiedAccountRotation = {
  previous: IDBCloudSyncItem;
  incoming: IDBCloudSyncItem;
  snapshot: ReturnType<typeof normalizePublicAccountSnapshotRecord>['snapshot'];
};

// The caller alone supplies history from the verified current hardware
// session. An ordinary /check has no pre-rotation lineage and cannot use this.
async function* prepareVerifiedAccountRotations({
  items,
  records,
  knownPwdHashes,
  syncCredential,
  isCurrent,
}: Omit<Parameters<typeof prepareVerifiedWalletCaches>[0], 'walletManager'>) {
  const pwdHash = cloudSyncItemBuilder.getPwdHash(syncCredential);
  const old = new Map(
    items
      .filter(
        (item) =>
          item.dataType === EPrimeCloudSyncDataType.Account &&
          knownPwdHashes.has(item.pwdHash),
      )
      .map((item) => [item.id, item]),
  );
  if (!old.size) return;
  const remote = new Map<string, IServerSyncRecord | undefined>();
  for (const row of records)
    if (row && old.has(row.key))
      remote.set(row.key, remote.has(row.key) ? undefined : row);

  const candidates: IVerifiedAccountRotation[] = [];
  let probes = 0;
  for (const [id, row] of remote) {
    if (!isCurrent()) return;
    const previous = old.get(id);
    if (
      !previous ||
      row?.dataType !== EPrimeCloudSyncDataType.Account ||
      row.isDeleted !== false ||
      !isVersion(row.dataTimestamp) ||
      row.dataTimestamp !== previous.dataTime ||
      typeof row.data !== 'string' ||
      !row.data ||
      row.data.length > 64 * 1024
    )
      // eslint-disable-next-line no-continue
      continue;
    const incoming = {
      id,
      rawKey: previous.rawKey,
      rawData: '',
      pwdHash,
      data: row.data,
      dataTime: row.dataTimestamp,
      dataType: EPrimeCloudSyncDataType.Account,
      serverUploaded: true,
      localSceneUpdated: true,
      isDeleted: false,
    };
    if (
      !canReplaceSettledPublicAccountCache(
        previous,
        incoming,
        previous.rawKey,
        true,
      )
    )
      // eslint-disable-next-line no-continue
      continue;
    probes += 1;
    try {
      const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
        item: { ...incoming },
        syncCredential,
      });
      const { rawKey, snapshot } =
        normalizePublicAccountSnapshotRecord(rawDataJson);
      if (rawKey === previous.rawKey && isCurrent())
        candidates.push({ incoming, previous, snapshot });
    } catch {
      // Leave malformed, legacy, or unauthenticated candidates untouched.
    }
    // Bound each DB batch, not the number of rows examined. Yield even
    // after a fully rejected batch so the outer deadline can run.
    if (probes === 10) {
      if (candidates.length && isCurrent()) yield candidates.splice(0);
      await timerUtils.wait(0);
      probes = 0;
    }
  }
  if (candidates.length && isCurrent()) yield candidates;
}

async function commitVerifiedAccountRotations(
  candidates: readonly IVerifiedAccountRotation[],
  isCurrent: () => boolean,
) {
  if (!candidates.length || !isCurrent()) return;
  await localDb.withTransaction(
    EIndexedDBBucketNames.account,
    async (tx) => {
      const current = () => {
        if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
      };
      const { records: wallets } = await localDb.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
      });
      const adopt = async ({
        previous,
        incoming,
        snapshot,
      }: IVerifiedAccountRotation) => {
        current();
        const projections = localDb.getPublicAccountSnapshotAccountProjections(
          snapshot,
          wallets,
        );
        if (projections.size !== 1) return;
        const match = projections.values().next().value;
        if (!match) return;
        const { wallet, expected } = match;
        if (snapshot.wallet.kind === 'hardware') {
          if (!wallet.associatedDevice) return;
          const {
            records: [device],
          } = await localDb.txGetRecordsByIds({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [wallet.associatedDevice],
          });
          if (!device) return;
          try {
            const settings = JSON.parse(device.settingsRaw || '{}') as {
              vendor?: EHardwareVendor;
            };
            if (
              !settings ||
              typeof settings !== 'object' ||
              Array.isArray(settings) ||
              (settings.vendor ?? EHardwareVendor.onekey) !==
                EHardwareVendor.onekey
            )
              return;
          } catch {
            return;
          }
        } else {
          const {
            records: [credential],
          } = await localDb.txGetRecordsByIds({
            tx,
            name: ELocalDBStoreNames.Credential,
            ids: [wallet.id],
          });
          if (!credential?.credential) return;
        }
        current();
        const indexedId = expected.indexedAccountId;
        if (!indexedId) return;
        const {
          records: [account],
        } = await localDb.txGetRecordsByIds({
          tx,
          name: ELocalDBStoreNames.Account,
          ids: [expected.id],
        });
        const {
          records: [indexed],
        } = await localDb.txGetRecordsByIds({
          tx,
          name: ELocalDBStoreNames.IndexedAccount,
          ids: [indexedId],
        });
        if (
          !account ||
          account.indexedAccountId !== indexedId ||
          indexed?.walletId !== wallet.id ||
          indexed.index !== expected.pathIndex ||
          account.name !== expected.name ||
          (indexed.name && indexed.name !== expected.name) ||
          !publicAccountIdentityEqual(
            {
              ...account,
              createAtNetwork: account.createAtNetwork ?? undefined,
              relPath: account.relPath ?? undefined,
            },
            expected,
          )
        )
          return;

        const {
          records: [source],
        } = await localDb.txGetRecordsByIds({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [previous.id],
        });
        current();
        if (!isEqual(source, previous)) return;
        await localDb.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [previous.id],
          updater: (row) => {
            row.data = incoming.data;
            row.pwdHash = incoming.pwdHash;
            return row;
          },
        });
        current();
      };
      for (const candidate of candidates) await adopt(candidate);
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

type IHardwareWalletRecoveryService = Pick<
  ServiceKeylessCloudSync,
  | 'backgroundApi'
  | 'buildSyncCredentialWithKeylessCredential'
  | 'getHardwareUploadGeneration'
  | 'getHardwareWalletRetryOrigin'
  | 'runWithCloudAccountImportLock'
  | 'runWithVerifiedHardwareAccountArchiveSession'
>;

async function applyVerifiedWalletRecoveryScene({
  walletManager,
  candidate,
  scene,
  isCurrent,
  commit,
}: {
  walletManager: CloudSyncFlowManagerWallet;
  candidate: IVerifiedWalletCache;
  scene: NonNullable<IVerifiedWalletCache['scene']>;
  isCurrent: () => boolean;
  commit: <T>(apply: () => Promise<T>) => Promise<T | undefined>;
}) {
  const prepared = {
    ...scene,
    item: candidate.incoming,
    isCurrent,
    applyVerifiedRecovery: async (update: IDBSetWalletNameAndAvatarParams) =>
      !update.deferCloudSyncWalletName &&
      update.expectedCloudSyncWalletName === candidate.wallet.name &&
      (await commit(() =>
        commitVerifiedWalletCaches([candidate], isCurrent, update),
      )) === true,
  };
  try {
    // Optional history can stall. Do not hold the Wallet scene
    // mutex; the final exact transaction is the concurrency gate.
    if (await walletManager.syncToSceneEachItem(prepared)) {
      appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
      return true;
    }
  } catch {
    // Leave the exact old cache and newer local business data.
  }
  return false;
}

type IManualHardwareCheckResponse = AxiosResponse<
  IApiClientResponse<ICloudSyncCheckServerStatusResult>
>;

export type IManualHardwareWalletRecovery = {
  observe: (response: IManualHardwareCheckResponse) => void;
  apply: (signal: AbortSignal) => Promise<boolean>;
  dispose: () => void;
};

export function supportsManualHardwareWalletRecoveryTransport() {
  // The native selected-IP bridge does not pass final-URL proof through
  // to Axios, and its choice vs original-domain transport varies per call.
  return !(platformEnv.isNative && isSniSupported());
}

export async function prepareManualHardwareWalletRecovery(
  service: IHardwareWalletRecoveryService &
    Pick<
      ServiceKeylessCloudSync,
      'getClient' | 'getLocalMutationSyncCredential'
    >,
  key: IKeylessCloudSyncCredential,
  isCurrent: () => boolean,
): Promise<IManualHardwareWalletRecovery | undefined> {
  const session = key.hardwareSession;
  const origin = session?.boundBaseURL;
  if (!session?.boundBaseURLVerified || !origin?.startsWith('https://'))
    return undefined;
  const generation = service.getHardwareUploadGeneration();
  let expired = false;
  const current = () =>
    !expired &&
    isCurrent() &&
    generation !== undefined &&
    generation === service.getHardwareUploadGeneration();
  const disposeWatch = devSettingsPersistAtom.sub(() => {
    expired = true;
  });
  let handedOff = false;
  const dispose = () => {
    expired = true;
    disposeWatch();
  };
  try {
    const { serviceApp, servicePrimeCloudSync } = service.backgroundApi;
    if ((await serviceApp.isAppLocked()) || !current()) return undefined;
    const walletManager = servicePrimeCloudSync.syncManagers.wallet;
    let preparing = true;
    const canPrepare = () => preparing && current();
    const witness = await resolveBeforeTimeout(
      (async () => {
        const { syncItems } = await localDb.getAllSyncItems();
        const candidates = new Map<
          string,
          { row: IDBCloudSyncItem; wallet: IDBWallet; device?: IDBDevice }
        >();
        let probes = 0;
        for (const row of syncItems) {
          if (!preparing || !current() || candidates.size >= 10 || probes >= 30)
            break;
          if (
            row.dataType === EPrimeCloudSyncDataType.Wallet &&
            isRetainedHardwareCloudCopy(row, key.pwdHash) &&
            row.localSceneUpdated &&
            !row.isDeleted &&
            row.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
            !row.pendingPublicAccountDeletionHash &&
            !row.remoteHardwareAccountTombstoneProof &&
            isVersion(row.dataTime) &&
            row.rawData &&
            row.rawData.length <= 16_384 &&
            sha512ProSync({ data: row.rawKey }) === row.id
          ) {
            probes += 1;
            try {
              const decoded = JSON.parse(row.rawData) as ICloudSyncRawDataJson;
              if (
                decoded.dataType === EPrimeCloudSyncDataType.Wallet &&
                decoded.rawKey === row.rawKey &&
                typeof decoded.payload?.name === 'string'
              ) {
                const payload = decoded.payload;
                const match = await walletManager.findWalletSyncTargetReadOnly({
                  payload,
                  isCurrent: canPrepare,
                });
                if (match && preparing && current()) {
                  const wire = await walletManager.buildSyncKeyInfo({
                    target: match.target,
                  });
                  const wallet = await localDb.getRecordById({
                    name: ELocalDBStoreNames.Wallet,
                    id: match.target.wallet.id,
                  });
                  if (
                    wallet &&
                    preparing &&
                    current() &&
                    wire?.key === row.id &&
                    wire.rawKey === row.rawKey &&
                    matchesRetainedWalletPreimage({
                      previous: row,
                      wallet,
                      payload,
                      device: match.device,
                      requireChange: false,
                    })
                  )
                    candidates.set(row.id, {
                      row,
                      wallet,
                      device: match.device,
                    });
                }
              }
            } catch {
              // A corrupt or unrelated cache is not a request hint.
            }
          }
        }
        return candidates;
      })(),
      350,
    ).finally(() => {
      preparing = false;
    });
    if (!witness?.size || !current()) return undefined;

    const summary = Array.from(witness.values(), ({ row }) => ({
      key: row.id,
      dataTimestamp: row.dataTime,
      dataType: EPrimeCloudSyncDataType.Wallet,
    }));
    let verifiedLegacyLineage: Set<string> | undefined;
    let initialNonce: number | undefined;
    const offeredNewer = new Set<string>();
    const requested = new Set<string>();
    const route = '/prime/v1/sync/check';
    const checkedBody = (
      response: IManualHardwareCheckResponse,
    ): ICloudSyncCheckServerStatusPostData | undefined => {
      const data = response.data.data;
      if (
        response.status !== 200 ||
        response.data.code !== 0 ||
        !data ||
        data.reconciliation !== undefined ||
        (data.pwdHash && data.pwdHash !== key.pwdHash) ||
        !Array.isArray(data.updated) ||
        !Array.isArray(data.diff) ||
        !Array.isArray(data.deleted) ||
        !Array.isArray(data.obsoleted) ||
        response.config?.baseURL !== origin ||
        response.config?.method?.toLowerCase() !== 'post' ||
        response.config?.url !== route ||
        response.config.headers.get('authorization') !==
          `DPoP ${session.accessToken}` ||
        !verifiedSessionBaseURL(response, origin, route)
      )
        return undefined;
      const body = (
        typeof response.config.data === 'string'
          ? JSON.parse(response.config.data)
          : response.config.data
      ) as ICloudSyncCheckServerStatusPostData;
      return body?.pwdHash === key.pwdHash && Array.isArray(body.localData)
        ? body
        : undefined;
    };

    const readHistoryHashes = (data: ICloudSyncCheckServerStatusResult) => {
      const records = [...data.updated, ...data.diff];
      const envelopes = new Map<string, ReturnType<typeof readEnvelope>>();
      const envelopeKeys = new Set<string>();
      const duplicateEnvelopeKeys = new Set<string>();
      let envelopeCount = 0;
      for (const row of records) {
        if (isHardwareCloudSyncKeyEnvelopeItem(row)) {
          envelopeCount += 1;
          if (envelopeCount > 100) return;
          if (envelopeKeys.has(row.key)) duplicateEnvelopeKeys.add(row.key);
          envelopeKeys.add(row.key);
          if (
            row.isDeleted === false &&
            typeof row.data === 'string' &&
            row.data.length <= 16_384
          ) {
            const envelope = readEnvelope(row.data);
            if (envelope && row.key === `dek:${envelope.dekId}`)
              envelopes.set(
                envelope.dekId,
                envelopes.has(envelope.dekId) ? null : envelope,
              );
          }
        }
      }
      const active = envelopes.get(session.dekId);
      if (
        !active ||
        duplicateEnvelopeKeys.has(`dek:${active.dekId}`) ||
        data.deleted.includes(`dek:${active.dekId}`) ||
        computeHardwareCloudSyncPwdHash(active.dekId) !== key.pwdHash
      )
        return;
      const known = new Set<string>();
      for (const envelope of envelopes.values())
        if (
          envelope &&
          !duplicateEnvelopeKeys.has(`dek:${envelope.dekId}`) &&
          !data.deleted.includes(`dek:${envelope.dekId}`) &&
          envelope.generation < active.generation
        )
          known.add(computeHardwareCloudSyncPwdHash(envelope.dekId));
      return known;
    };

    const observe: IManualHardwareWalletRecovery['observe'] = (response) => {
      if (!current()) return;
      try {
        const body = checkedBody(response);
        if (body && Number.isSafeInteger(body.nonce)) {
          verifiedLegacyLineage = readHistoryHashes(response.data.data);
          initialNonce = body.nonce;
        }
      } catch {
        // Do not infer an endpoint or capability from the normal result.
      }
    };

    const verifySupplement = (response: IManualHardwareCheckResponse) => {
      try {
        const data = response.data.data;
        if (
          !Array.isArray(data?.updated) ||
          !Array.isArray(data?.diff) ||
          !Array.isArray(data?.deleted) ||
          !Array.isArray(data?.obsoleted) ||
          data.updated.length +
            data.diff.length +
            data.deleted.length +
            data.obsoleted.length >
            150
        )
          return undefined;
        const records = [...data.updated, ...data.diff];
        let bytes = 0;
        for (const row of records) {
          if (typeof row?.key !== 'string' || row.key.length > 512)
            return undefined;
          bytes +=
            row.key.length +
            (typeof row.data === 'string' ? row.data.length : 0);
          if (bytes > 2 * 1024 * 1024) return undefined;
          const old = witness.get(row.key)?.row;
          if (
            old &&
            requested.has(row.key) &&
            row.dataType === EPrimeCloudSyncDataType.Wallet &&
            row.isDeleted === false &&
            isVersion(row.dataTimestamp) &&
            (row.dataTimestamp ?? 0) > (old.dataTime ?? 0)
          )
            offeredNewer.add(row.key);
        }
        const body = checkedBody(response);
        if (!body || body.reconciliation !== undefined || !offeredNewer.size)
          return undefined;
        const headerTime = Date.parse(String(response.headers.date ?? ''));
        const serverTime = isVersion(headerTime)
          ? headerTime + 999
          : data.serverTime;
        if (!isVersion(serverTime)) return undefined;
        const known = readHistoryHashes(data);
        if (!known?.size) return undefined;
        const rows = records.filter((row) => {
          const old = witness.get(row?.key)?.row;
          return (
            old &&
            requested.has(row.key) &&
            known.has(old.pwdHash) &&
            body.localData.filter(({ key: id }) => id === row.key).length ===
              1 &&
            body.localData.some(
              (entry) =>
                entry.key === row.key &&
                entry.dataType === EPrimeCloudSyncDataType.Wallet &&
                entry.dataTimestamp === old.dataTime,
            ) &&
            records.filter((other) => other?.key === row.key).length === 1 &&
            !data.obsoleted.includes(row.key) &&
            !data.deleted.includes(row.key) &&
            row.dataType === EPrimeCloudSyncDataType.Wallet &&
            row.isDeleted === false &&
            (!row.pwdHash || row.pwdHash === key.pwdHash) &&
            isVersion(row.dataTimestamp) &&
            row.dataTimestamp <= serverTime &&
            (row.dataTimestamp ?? 0) > (old.dataTime ?? 0)
          );
        });
        return rows.length ? { rows, known } : undefined;
      } catch {
        // Endpoint/protocol proof failed: this is not a recovery response.
        return undefined;
      }
    };

    const apply: IManualHardwareWalletRecovery['apply'] = async (signal) => {
      const initialLineage = verifiedLegacyLineage;
      verifiedLegacyLineage = undefined;
      if (
        !initialLineage?.size ||
        initialNonce === undefined ||
        !current() ||
        signal.aborted
      )
        return true;
      // A manual run may supplement its proven legacy comparison once. No
      // retry, clock/credential refresh, synthetic ACK or normal runner input.
      const abort = new AbortController();
      const cancel = () => abort.abort();
      signal.addEventListener('abort', cancel, { once: true });
      const guard = () => current() && !signal.aborted && !abort.signal.aborted;
      try {
        const complete = await resolveBeforeTimeout(
          (async () => {
            const selected = (await service.getLocalMutationSyncCredential())
              ?.keylessCredential;
            const actual = selected?.hardwareSession;
            if (
              !guard() ||
              !selected ||
              !actual ||
              selected.source?.type !== 'hardware' ||
              selected.source.credentialId !== key.source?.credentialId ||
              selected.keylessWalletId !== key.keylessWalletId ||
              selected.pwdHash !== key.pwdHash ||
              selected.encryptionKey !== key.encryptionKey ||
              actual.sessionId !== session.sessionId ||
              actual.dekId !== session.dekId ||
              actual.accessToken !== session.accessToken ||
              actual.boundBaseURL !== origin ||
              actual.boundBaseURLVerified !== true
            )
              return true;
            const { records: retained } = await localDb.getRecordsByIds({
              name: ELocalDBStoreNames.CloudSyncItem,
              ids: summary.map((item) => item.key),
            });
            const exact = summary.filter(({ key: id }, index) => {
              const old = witness.get(id)?.row;
              return (
                old &&
                initialLineage.has(old.pwdHash) &&
                isEqual(retained[index], old)
              );
            });
            if (!guard() || !exact.length) return true;
            const client = await service.getClient(EServiceEndpointEnum.Prime);
            if (!guard() || client.defaults.baseURL !== origin) return true;
            for (const item of exact) requested.add(item.key);
            const response =
              await requestRawWithHardwareCloudSyncSession<ICloudSyncCheckServerStatusResult>(
                {
                  client,
                  session: actual,
                  method: 'POST',
                  urlPath: route,
                  boundBaseURL: origin,
                  oneShotCheck: true,
                  requestOptions: { signal: abort.signal, timeout: 650 },
                  assertCanSend: () => {
                    if (!guard()) throw new HardwareCloudSyncCancelledError();
                  },
                  data: {
                    localData: exact,
                    onlyCheckLocalDataType: buildOnlyCheckLocalDataTypes({}),
                    nonce: initialNonce,
                    pwdHash: key.pwdHash,
                  } satisfies ICloudSyncCheckServerStatusPostData,
                },
              );
            if (!guard()) return true;
            const verified = verifySupplement(response);
            if (!verified) return !offeredNewer.size;
            const candidates = await prepareVerifiedWalletCaches({
              items: [...witness.values()].map(({ row }) => row),
              records: verified.rows,
              knownPwdHashes: verified.known,
              syncCredential:
                service.buildSyncCredentialWithKeylessCredential(key),
              walletManager,
              isCurrent: guard,
            });
            const applied = new Set<string>();
            for (const candidate of candidates) {
              if (!guard()) return false;
              const before = witness.get(candidate.incoming.id);
              if (
                before &&
                candidate.scene &&
                isEqual(before.wallet, candidate.wallet) &&
                isEqual(before.device, candidate.device)
              ) {
                const committed = await applyVerifiedWalletRecoveryScene({
                  walletManager,
                  candidate,
                  scene: candidate.scene,
                  isCurrent: guard,
                  commit: async (run) => {
                    if (
                      !guard() ||
                      (await service.getHardwareWalletRetryOrigin()) !==
                        origin ||
                      (await serviceApp.isAppLocked()) ||
                      !guard()
                    )
                      return undefined;
                    return service.runWithCloudAccountImportLock(() =>
                      guard()
                        ? service.runWithVerifiedHardwareAccountArchiveSession(
                            key,
                            run,
                          )
                        : Promise.resolve(undefined),
                    );
                  },
                });
                if (committed) applied.add(candidate.incoming.id);
              }
            }
            return applied.size === offeredNewer.size;
          })(),
          1000,
        );
        return complete ?? !offeredNewer.size;
      } catch {
        // An optional supplemental read never replaces the ordinary outcome.
        return !offeredNewer.size;
      } finally {
        abort.abort();
        signal.removeEventListener('abort', cancel);
      }
    };
    handedOff = true;
    return { observe, apply, dispose };
  } finally {
    if (!handedOff) dispose();
  }
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
  service: IHardwareWalletRecoveryService;
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
        const recovery = {
          items,
          records,
          knownPwdHashes: new Set(previousPwdHashes),
          syncCredential: service.buildSyncCredentialWithKeylessCredential(key),
          isCurrent: stillSelected,
        };
        const commit = async <T>(apply: () => Promise<T>) => {
          if (
            !stillSelected() ||
            (await service.getHardwareWalletRetryOrigin()) !==
              session.boundBaseURL ||
            (await serviceApp.isAppLocked()) ||
            !stillSelected()
          )
            return;
          return service.runWithCloudAccountImportLock(async () => {
            if (!stillSelected()) return;
            // Import -> repair -> prepared DB write excludes source changes
            // and session revocation; no account scene or vault work here.
            return service.runWithVerifiedHardwareAccountArchiveSession(
              key,
              apply,
            );
          });
        };
        const walletManager =
          service.backgroundApi.servicePrimeCloudSync.syncManagers.wallet;
        // An optional Account read/decode must not gate Wallet cache repair.
        await Promise.allSettled([
          prepareVerifiedWalletCaches({ ...recovery, walletManager }).then(
            async (candidates) => {
              const safe = candidates.filter((candidate) => !candidate.scene);
              if (safe.length)
                await commit(() =>
                  commitVerifiedWalletCaches(safe, stillSelected),
                ).catch(() => undefined);
              const scenes = candidates.flatMap((candidate) =>
                candidate.scene ? [{ candidate, scene: candidate.scene }] : [],
              );
              for (const { candidate, scene } of scenes) {
                if (!stillSelected()) return;
                await applyVerifiedWalletRecoveryScene({
                  walletManager,
                  candidate,
                  scene,
                  isCurrent: stillSelected,
                  commit,
                });
              }
            },
          ),
          (async () => {
            for await (const accounts of prepareVerifiedAccountRotations(
              recovery,
            )) {
              if (!stillSelected()) return;
              await commit(() =>
                commitVerifiedAccountRotations(accounts, stillSelected),
              );
            }
          })(),
        ]);
      })(),
      1000,
    );
  } finally {
    invalidate();
    watch();
  }
}

function logRestoreKeyCompatibility(
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

export async function prepareHardwareResign({
  items,
  previousPwdHashes,
  existing,
  credential,
  rebuildsLocalItemsNow,
  sameSelectedSource,
  sameSelectedWallet,
  makeCredential,
  loadAuthoritativeItems,
}: {
  items: IDBCloudSyncItem[];
  previousPwdHashes: readonly string[];
  existing: IKeylessCloudSyncCredential | null;
  credential: IKeylessCloudSyncCredential;
  rebuildsLocalItemsNow: boolean;
  sameSelectedSource: boolean;
  sameSelectedWallet: boolean;
  makeCredential: () => ICloudSyncCredential;
  loadAuthoritativeItems: (
    credential: ICloudSyncCredential,
    rows: readonly IDBCloudSyncItem[],
  ) => Promise<IDBCloudSyncItem[]>;
}) {
  // Records under an earlier data key of this wallet (another device
  // reset it) are rebuilt with the current one.
  const knownPwdHashes = new Set([credential.pwdHash, ...previousPwdHashes]);
  const previousPwdHashesForSource = new Set(previousPwdHashes);
  if (existing?.pwdHash) {
    previousPwdHashesForSource.add(existing.pwdHash);
  }

  // A pending removal cannot use the new key to authenticate its old
  // ciphertext. Keep the original credential and snapshot intact.
  if (
    hasPendingDeletionFromPreviousHardwareKey({
      items,
      currentPwdHash: credential.pwdHash,
      previousPwdHashes: previousPwdHashesForSource,
    })
  ) {
    throw new HardwareCloudSyncError(
      ETranslations.cloud_sync_data_changed_during_key_change__msg,
      'Sync pending account deletions with the original Cloud key before changing the encryption key.',
    );
  }
  const restoresRotatedHardwareKey =
    !rebuildsLocalItemsNow &&
    sameSelectedSource &&
    credential.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX);
  const recoveredItems = restoresRotatedHardwareKey
    ? await prepareHardwareCloudSyncLocalRecovery({
        items,
        knownPwdHashes,
        syncCredential: makeCredential(),
        loadAuthoritativeItems: (opaqueCopies) =>
          loadAuthoritativeItems(makeCredential(), opaqueCopies),
      })
    : [];
  const recoveredIds = new Set(recoveredItems.map((item) => item.original.id));
  const canSkipUnverifiedPendingWallet =
    restoresRotatedHardwareKey && sameSelectedWallet;
  const localItemKeyMismatch = (item: IDBCloudSyncItem) =>
    !!item.pwdHash &&
    !(
      item.dataType === EPrimeCloudSyncDataType.Lock &&
      keylessCloudSyncUtils.isKeylessPwdHash(item.pwdHash)
    ) &&
    !knownPwdHashes.has(item.pwdHash) &&
    !recoveredIds.has(item.id) &&
    !(
      restoresRotatedHardwareKey &&
      isRetainedHardwareCloudCopy(item, credential.pwdHash)
    ) &&
    !(
      canSkipUnverifiedPendingWallet &&
      isUnverifiedPendingHardwareWalletCopy(item)
    );
  const existingHashRecoverable =
    restoresRotatedHardwareKey &&
    existing?.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
    !existing.signingPublicKey;
  logRestoreKeyCompatibility(
    items,
    knownPwdHashes,
    recoveredItems.length,
    rebuildsLocalItemsNow,
    existing,
    credential,
    localItemKeyMismatch,
    existingHashRecoverable,
  );
  // Same-source recovery can rebuild readable hardware business rows
  // without complete server key history. Opaque and foreign records
  // still require their original key checks.
  if (
    (!rebuildsLocalItemsNow && items.some(localItemKeyMismatch)) ||
    (existing &&
      ((!knownPwdHashes.has(existing.pwdHash) && !existingHashRecoverable) ||
        existing.signingPublicKey !== credential.signingPublicKey))
  ) {
    throw new HardwareCloudSyncError(
      ETranslations.cloud_sync_hardware_different_key__msg,
      "This hardware wallet can't unlock your synced data. Your existing data has been kept.",
    );
  }
  return { recoveredItems, restoresRotatedHardwareKey };
}
