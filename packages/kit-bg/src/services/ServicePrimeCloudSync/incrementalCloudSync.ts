import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCredential,
  ICloudSyncUploadResult,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { devSettingsPersistAtom } from '../../states/jotai/atoms';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';

import type { IWalletNameDeferredObserver } from './CloudSyncFlowManager/CloudSyncFlowManagerBase';
import type ServicePrimeCloudSync from './ServicePrimeCloudSync';
import type { IDBCloudSyncItem } from '../../dbs/local/types';

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
