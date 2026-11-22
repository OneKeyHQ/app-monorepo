import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCredential,
  ICloudSyncUploadResult,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { devSettingsPersistAtom } from '../../states/jotai/atoms';

import { isRetainedHardwareCloudCopy } from './cloudSyncCheckUtils';
import cloudSyncItemBuilder from './cloudSyncItemBuilder';

import type { IWalletNameDeferredObserver } from './CloudSyncFlowManager/CloudSyncFlowManagerBase';
import type { CloudSyncFlowManagerWallet } from './CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import type ServicePrimeCloudSync from './ServicePrimeCloudSync';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { LocalDbBase as ILocalDb } from '../../dbs/local/LocalDbBase';
import type { IDBCloudSyncItem, IDBWallet } from '../../dbs/local/types';

type IUploadRequestOptions = { signal: AbortSignal; timeout: number };

export async function runIncrementalCloudSync({
  service,
  params: {
    localItems,
    isFlush,
    setUndefinedTimeToNow,
    encryptedSecurityPasswordR1ForServer,
    isFullDBChecking,
    noDebounceUpload,
  },
  expectedCredential,
  signal,
  isCurrent,
  guard,
  assertSelectedKey,
  uploadItemsWithRequestOptions,
  filterDivergentPendingWalletNames,
  hasDurableDeferredWalletName,
  updateLastSyncTime,
}: {
  service: Pick<
    ServicePrimeCloudSync,
    | 'getActiveSyncMode'
    | 'checkServerStatusWithRequestOptions'
    | 'saveServerSyncItemsToLocal'
    | 'saveServerDeletedItemsToLocal'
  >;
  params: Parameters<ServicePrimeCloudSync['startServerSyncFlowForItems']>[0];
  expectedCredential: ICloudSyncCredential | undefined;
  signal: AbortSignal;
  isCurrent: () => boolean;
  guard: () => void;
  assertSelectedKey: () => Promise<void>;
  uploadItemsWithRequestOptions: (
    params: {
      localItems: IDBCloudSyncItem[];
      isFlush: boolean;
      setUndefinedTimeToNow: boolean;
      syncCredential: ICloudSyncCredential | undefined;
      encryptedSecurityPasswordR1ForServer?: string;
      noDebounceUpload?: boolean;
    },
    requestOptions: IUploadRequestOptions,
    skipLastSyncTime: boolean,
  ) => Promise<ICloudSyncUploadResult | void>;
  filterDivergentPendingWalletNames: (params: {
    items: IDBCloudSyncItem[];
    credential: ICloudSyncCredential | undefined;
    signal: AbortSignal;
    isCurrent: () => boolean;
  }) => Promise<IDBCloudSyncItem[]>;
  hasDurableDeferredWalletName: (
    rows: Map<string, IDBCloudSyncItem>,
    scope: {
      syncCredential: ICloudSyncCredential;
      isCurrent: () => boolean;
    },
  ) => Promise<boolean>;
  updateLastSyncTime: (params: {
    syncMode: ECloudSyncMode;
    isCurrent: () => boolean;
  }) => Promise<void>;
}) {
  const requestOptions = { signal, timeout: 10_000 };
  let stopStampScopeObservation: (() => void) | undefined;
  let stampScopeChanged = false;
  const stampIsCurrent = () => !stampScopeChanged && isCurrent();
  try {
    const ownsLastSyncTime = !isFlush && !isFullDBChecking;
    const readStampScope = () =>
      resolveBeforeTimeout(
        Promise.all([
          service.getActiveSyncMode(),
          getEndpointByServiceName(EServiceEndpointEnum.Prime),
        ]).catch(() => undefined),
        250,
      );
    if (ownsLastSyncTime) {
      try {
        // Endpoint settings can leave and return to the same value during
        // a request. Invalidate only this timestamp, never the data path.
        stopStampScopeObservation = devSettingsPersistAtom.sub(() => {
          stampScopeChanged = true;
        });
      } catch {
        stampScopeChanged = true;
      }
    }
    const stampScope = ownsLastSyncTime ? await readStampScope() : undefined;
    guard();
    const checkRequestItems = localItems.map((item) => ({ ...item }));
    const serverStatus = await service.checkServerStatusWithRequestOptions(
      {
        localItems,
        isFullDBChecking,
      },
      requestOptions,
    );
    guard();
    const syncCredential = expectedCredential;
    await assertSelectedKey();
    guard();

    const spaceId = cloudSyncItemBuilder.getPwdHash(syncCredential);
    const deferredWalletNames = new Map<string, IDBCloudSyncItem>();
    const observeDeferredWalletName: IWalletNameDeferredObserver =
      Object.assign(
        (item: IDBCloudSyncItem) => {
          if (
            isCurrent() &&
            item.serverUploaded &&
            item.data &&
            !item.isDeleted &&
            !item.localSceneUpdated &&
            item.pwdHash === spaceId
          )
            deferredWalletNames.set(item.id, item);
        },
        { observeCanonicalWrite: true as const },
      );
    let completedWork = false;
    let heldOutgoing = false;
    let outboundSettled = true;
    let uploadIncomplete = false;
    if (serverStatus.obsoleted.length || isFlush) {
      const itemsToUpload = localItems.filter((item) =>
        serverStatus.obsoleted.includes(item.id),
      );
      await assertSelectedKey();
      const outgoing = isFlush
        ? itemsToUpload
        : await filterDivergentPendingWalletNames({
            items: itemsToUpload,
            credential: syncCredential,
            signal,
            isCurrent,
          });
      heldOutgoing = outgoing.length < itemsToUpload.length;
      const upload =
        outgoing.length || outgoing.length === itemsToUpload.length
          ? await uploadItemsWithRequestOptions(
              {
                localItems: outgoing,
                isFlush: isFlush ?? false,
                setUndefinedTimeToNow: setUndefinedTimeToNow ?? true,
                syncCredential,
                encryptedSecurityPasswordR1ForServer,
                noDebounceUpload,
              },
              requestOptions,
              ownsLastSyncTime || heldOutgoing,
            )
          : undefined;
      await assertSelectedKey();
      guard();
      const acknowledged = (upload?.created ?? 0) + (upload?.updated ?? 0);
      uploadIncomplete = !isFlush && acknowledged < outgoing.length;
      if (outgoing.length) {
        outboundSettled =
          acknowledged === outgoing.length &&
          Number.isSafeInteger(upload?.created) &&
          Number.isSafeInteger(upload?.updated) &&
          (upload?.created ?? -1) >= 0 &&
          (upload?.updated ?? -1) >= 0;
        completedWork = outboundSettled;
      }
    }

    for (const serverItems of [serverStatus.diff, serverStatus.updated]) {
      guard();
      await assertSelectedKey();
      if (serverItems.length) {
        const applied = await service.saveServerSyncItemsToLocal({
          serverItems,
          shouldSyncToScene: true,
          syncCredential,
          serverPwdHash: serverStatus.pwdHash,
          isCurrent,
          ...(ownsLastSyncTime
            ? {
                skipLastSyncTime: true,
                onWalletNameHistoryDeferred: observeDeferredWalletName,
              }
            : {}),
        });
        completedWork ||= applied === true;
      }
    }
    guard();
    await assertSelectedKey();
    if (serverStatus.deleted.length) {
      const applied = await service.saveServerDeletedItemsToLocal({
        deletedItemIds: serverStatus.deleted,
        requestItems: checkRequestItems,
        shouldSyncToScene: true,
        syncCredential,
        serverPwdHash: serverStatus.pwdHash,
        isCurrent,
        ...(ownsLastSyncTime ? { skipLastSyncTime: true } : {}),
      });
      completedWork ||= applied === true;
    }
    guard();
    if (uploadIncomplete) {
      throw new OneKeyLocalError({
        message: 'Cloud sync upload was only partially acknowledged',
        autoToast: false,
      });
    }
    if (
      ownsLastSyncTime &&
      completedWork &&
      outboundSettled &&
      !heldOutgoing &&
      !!syncCredential &&
      !!spaceId &&
      spaceId === serverStatus.pwdHash &&
      stampScope &&
      stampScope[0] !== ECloudSyncMode.None &&
      !(await hasDurableDeferredWalletName(deferredWalletNames, {
        syncCredential,
        isCurrent: stampIsCurrent,
      })) &&
      stampIsCurrent()
    ) {
      const currentStampScope = await readStampScope();
      if (
        currentStampScope?.[0] !== stampScope[0] ||
        currentStampScope[1] !== stampScope[1]
      )
        return;
      await assertSelectedKey();
      guard();
      await updateLastSyncTime({
        syncMode: stampScope[0],
        isCurrent: stampIsCurrent,
      });
    }
  } finally {
    stopStampScopeObservation?.();
  }
}

const walletVersionFields = [
  'id',
  'name',
  'avatar',
  'firstEvmAddress',
  'associatedDevice',
  'walletNo',
  'type',
  'hash',
  'xfp',
  'passphraseState',
  'isTemp',
  'isMocked',
] as const;
export type IWalletEditVersion = Pick<
  IDBWallet,
  (typeof walletVersionFields)[number]
>;
const cacheVersionFields = [
  'id',
  'rawKey',
  'rawData',
  'dataType',
  'data',
  'dataTime',
  'isDeleted',
  'pwdHash',
  'localSceneUpdated',
  'serverUploaded',
  'pendingPublicAccountDeletionAt',
  'pendingPublicAccountDeletionHash',
  'remoteHardwareAccountTombstoneProof',
] as const;

async function admitWalletCacheWrite<T>(
  verify: (claim: () => boolean) => Promise<T | undefined>,
) {
  let allowWrite = true;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<undefined>((resolve) => {
    timeout = setTimeout(() => {
      allowWrite = false;
      resolve(undefined);
    }, 250);
  });
  const claim = () => {
    clearTimeout(timeout);
    return allowWrite;
  };
  try {
    return await Promise.race([elapsed, verify(claim)]);
  } finally {
    allowWrite = false;
    clearTimeout(timeout);
  }
}

export async function replaceSettledWalletCacheAfterEdit(
  api: IBackgroundApi,
  {
    candidate,
    previous,
    wallet,
    isCurrent: scopeIsCurrent,
  }: {
    candidate: IDBCloudSyncItem;
    previous: IDBCloudSyncItem;
    wallet: IWalletEditVersion;
    isCurrent: () => boolean;
  },
) {
  const { serviceKeylessCloudSync: keyless, localDb } = api;
  let nodeChanged = false;
  const isCurrent = () => !nodeChanged && scopeIsCurrent();
  if (
    !isCurrent() ||
    wallet.isTemp ||
    wallet.isMocked ||
    candidate.dataType !== EPrimeCloudSyncDataType.Wallet ||
    previous.dataType !== candidate.dataType ||
    previous.isDeleted !== false ||
    previous.localSceneUpdated !== true ||
    previous.serverUploaded !== true ||
    previous.pendingPublicAccountDeletionAt !== undefined ||
    previous.pendingPublicAccountDeletionHash ||
    previous.remoteHardwareAccountTombstoneProof ||
    !isRetainedHardwareCloudCopy(previous, candidate.pwdHash) ||
    !previous.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) ||
    !/^[a-f0-9]{64}$/.test(
      previous.pwdHash.slice(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX.length),
    ) ||
    !previous.data ||
    !/^(?:[a-f0-9]{2}){28,}$/i.test(previous.data) ||
    previous.rawKey !== candidate.rawKey ||
    previous.id !== candidate.id ||
    sha512ProSync({ data: candidate.rawKey }) !== candidate.id ||
    !Number.isSafeInteger(previous.dataTime) ||
    !Number.isSafeInteger(candidate.dataTime) ||
    (previous.dataTime ?? 0) <= 0 ||
    (candidate.dataTime ?? 0) <= (previous.dataTime ?? 0)
  )
    return;
  const stop = devSettingsPersistAtom.sub(() => {
    nodeChanged = true;
  });
  try {
    const admission = await resolveBeforeTimeout(
      (async () => {
        const credential = await keyless.getLocalMutationSyncCredential();
        const selected = credential?.keylessCredential;
        const session = selected?.hardwareSession;
        if (
          !isCurrent() ||
          selected?.source?.type !== 'hardware' ||
          selected.pwdHash !== candidate.pwdHash ||
          !session?.boundBaseURL ||
          session.boundBaseURL !==
            (await keyless.getHardwareWalletRetryOrigin()) ||
          !isCurrent()
        )
          return undefined;
        const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
          item: { ...candidate },
          syncCredential: credential,
        });
        if (rawDataJson?.dataType !== EPrimeCloudSyncDataType.Wallet)
          return undefined;
        const manager = api.servicePrimeCloudSync.syncManagers.wallet;
        const match = await manager.findWalletSyncTargetReadOnly({
          payload: rawDataJson.payload,
          isCurrent,
        });
        if (match?.target.wallet.id !== wallet.id || !isCurrent())
          return undefined;
        if (match.device && wallet.associatedDevice !== match.device.id)
          return undefined;
        const key = await manager.buildSyncKeyInfo({ target: match.target });
        if (key?.key !== candidate.id || key.rawKey !== candidate.rawKey)
          return undefined;
        return { match, selected };
      })(),
      1500,
    );
    if (!admission || !isCurrent()) return;
    const committed = await keyless.runWithCloudSyncKeyLock(() =>
      admitWalletCacheWrite((claim) =>
        keyless.runWithVerifiedHardwareAccountArchiveSession(
          admission.selected,
          () => {
            if (!isCurrent() || !claim()) return Promise.resolve(false);
            return localDb.withTransaction(
              EIndexedDBBucketNames.account,
              async (tx) => {
                const [currentWallet] = await localDb.txGetWallet({
                  tx,
                  walletId: wallet.id,
                });
                const [currentCache] = await localDb.txGetRecordById({
                  tx,
                  name: ELocalDBStoreNames.CloudSyncItem,
                  id: previous.id,
                });
                const device = admission.match.device;
                if (device) {
                  const [currentDevice] = await localDb.txGetRecordById({
                    tx,
                    name: ELocalDBStoreNames.Device,
                    id: device.id,
                  });
                  if (
                    !currentDevice ||
                    currentDevice.deviceId !== device.deviceId ||
                    currentDevice.deviceType !== device.deviceType ||
                    currentDevice.settingsRaw !== device.settingsRaw
                  )
                    return false;
                }
                if (
                  !isCurrent() ||
                  !currentWallet ||
                  !currentCache ||
                  !walletVersionFields.every(
                    (field) => currentWallet[field] === wallet[field],
                  ) ||
                  !cacheVersionFields.every(
                    (field) => currentCache[field] === previous[field],
                  )
                )
                  return false;
                await localDb.txAddAndUpdateFreshSyncItems({
                  tx,
                  items: [candidate],
                  skipUploadToServer: true,
                });
                if (!isCurrent())
                  throw new OneKeyLocalError({
                    message: 'Wallet sync selection changed',
                    autoToast: false,
                  });
                return true;
              },
              { skipCloudCredentialWarmup: true, confirmRollbackOnError: true },
            );
          },
        ),
      ),
    );
    if (committed && isCurrent())
      await api.servicePrimeCloudSync.startServerSyncFlowSilently({
        callerName: 'Wallet metadata edit',
        localMutation: true,
      });
  } finally {
    stop();
  }
}

export async function probeDurableWalletNameDeferral(
  localDb: Pick<ILocalDb, 'getRecordsByIds'>,
  wallet: CloudSyncFlowManagerWallet,
  deferredWalletNames: Map<string, IDBCloudSyncItem>,
  scope?: {
    syncCredential: ICloudSyncCredential;
    isCurrent: () => boolean;
  },
) {
  if (!deferredWalletNames.size) return false;
  try {
    const check = await resolveBeforeTimeout(
      localDb.getRecordsByIds({
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: [...deferredWalletNames.keys()],
      }),
      1500,
    );
    const newerPending: IDBCloudSyncItem[] = [];
    const stillDeferred =
      !check ||
      check.records.length !== deferredWalletNames.size ||
      check.records.some((current) => {
        if (!current) return false;
        const observed = deferredWalletNames.get(current.id);
        if (!observed) return true;
        if (
          current.dataType !== EPrimeCloudSyncDataType.Wallet ||
          current.pwdHash !== observed.pwdHash
        )
          return true;
        if (
          current.data === observed.data &&
          current.dataTime === observed.dataTime &&
          !current.isDeleted
        )
          return !current.serverUploaded || !current.localSceneUpdated;
        const timestamp = current.dataTime;
        const isVersionNewer = !!(
          (current.data || current.isDeleted) &&
          typeof timestamp === 'number' &&
          Number.isSafeInteger(timestamp) &&
          timestamp > (observed.dataTime ?? 0)
        );
        if (
          isVersionNewer &&
          scope &&
          current.serverUploaded === true &&
          current.localSceneUpdated === false &&
          !current.isDeleted &&
          current.data
        )
          newerPending.push(current);
        return !isVersionNewer;
      });
    if (stillDeferred || !scope || !newerPending.length) return stillDeferred;
    // Server storage alone does not prove the new ciphertext is usable
    // Wallet data for this selected source and target. Scoped callers can
    // prove it here; full reconciliation keeps its supersession rules.
    let expired = false;
    const isProbeCurrent = () => !expired && scope.isCurrent();
    try {
      const verified = await resolveBeforeTimeout(
        (async () => {
          for (const item of newerPending) {
            if (!isProbeCurrent()) return false;
            try {
              const { rawDataJson } =
                await cloudSyncItemBuilder.decryptSyncItem({
                  item: { ...item },
                  syncCredential: scope.syncCredential,
                });
              if (
                !isProbeCurrent() ||
                rawDataJson?.dataType !== EPrimeCloudSyncDataType.Wallet ||
                typeof rawDataJson.payload?.name !== 'string' ||
                !rawDataJson.payload.name.trim() ||
                typeof rawDataJson.rawKey !== 'string' ||
                !rawDataJson.rawKey ||
                wallet.rawKeyToHashKey(rawDataJson.rawKey) !== item.id
              )
                // eslint-disable-next-line no-continue -- Check other authenticated candidates.
                continue;
              const match = await wallet.findWalletSyncTargetReadOnly({
                payload: rawDataJson.payload,
                isCurrent: isProbeCurrent,
              });
              if (!isProbeCurrent()) return false;
              const target = match?.target;
              if (
                !target?.wallet.name.trim() ||
                target.wallet.name === rawDataJson.payload.name
              )
                // eslint-disable-next-line no-continue -- Check other authenticated candidates.
                continue;
              const key = await wallet.buildSyncKeyInfo({ target });
              if (!isProbeCurrent()) return false;
              if (key?.key === item.id && key.rawKey === rawDataJson.rawKey)
                return true;
            } catch (error) {
              errorUtils.autoPrintErrorIgnore(error);
            }
          }
          return false;
        })(),
        1500,
      );
      return verified === true;
    } finally {
      expired = true;
    }
  } catch (error) {
    errorUtils.autoPrintErrorIgnore(error);
    return true;
  }
}
