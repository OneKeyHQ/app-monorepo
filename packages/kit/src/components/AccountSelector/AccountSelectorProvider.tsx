import {
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { isEqual } from 'lodash';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  AccountSelectorJotaiProvider,
  accountSelectorAvailableNetworksAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorSyncLoadingAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  selectedAccountsAtom,
  useAccountSelectorAvailableNetworksAtom,
} from '../../states/jotai/contexts/accountSelector/atoms';
import {
  getActiveAccountPerfCommitMeta,
  getNextAccountSelectorPerfOperationId,
  getSelectedAccountPerfCommitMeta,
  isAccountSelectorPerfDebugEnabled,
} from '../../states/jotai/contexts/accountSelector/perfDebug';
import { jotaiContextStore } from '../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { AccountSelectorStorageReady } from './AccountSelectorStorageReady';

import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorAvailableNetworksMap,
  IAccountSelectorContextData,
  IAccountSelectorUpdateMeta,
  ISelectedAccountsAtomMap,
} from '../../states/jotai/contexts/accountSelector/atoms';

function AccountSelectorAvailableNetworksInit(props: {
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
}) {
  const { availableNetworksMap } = props;
  const [, setMap] = useAccountSelectorAvailableNetworksAtom();
  useEffect(() => {
    if (availableNetworksMap) {
      setMap((current) =>
        isEqual(current, availableNetworksMap) ? current : availableNetworksMap,
      );
    }
  }, [availableNetworksMap, setMap]);
  return null;
}
export function AccountSelectorProviderMirror({
  children,
  config,
  enabledNum,
  availableNetworksMap,
  perfDebugName,
  storageReadyFallback,
  waitForStorageReady,
}: {
  children?: ReactNode;
  config: IAccountSelectorContextData;
  enabledNum: number[];
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
  perfDebugName?: string;
  storageReadyFallback?: ReactNode;
  waitForStorageReady?: boolean;
}) {
  if (!enabledNum || enabledNum.length <= 0) {
    throw new OneKeyLocalError(
      'AccountSelectorProviderMirror ERROR: enabledNum is required',
    );
  }

  const stableConfig = useMemo(
    () => ({
      sceneName: config.sceneName,
      sceneUrl: config.sceneUrl,
    }),
    [config.sceneName, config.sceneUrl],
  );
  const enabledNumKey = [...new Set(enabledNum)]
    .toSorted((a, b) => a - b)
    .join(',');
  const stableEnabledNum = useMemo(
    () => enabledNumKey.split(',').map(Number),
    [enabledNumKey],
  );

  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: config.sceneName,
        sceneUrl: config.sceneUrl,
        enabledNum: stableEnabledNum,
      },
    }),
    [config.sceneName, config.sceneUrl, stableEnabledNum],
  );
  const store = jotaiContextStore.getOrCreateStore(data);
  const perfDebugEnabled = isAccountSelectorPerfDebugEnabled();
  const shouldProfile = perfDebugEnabled && Boolean(perfDebugName);
  const providerInstanceIdRef = useRef<number | undefined>(undefined);
  if (shouldProfile && providerInstanceIdRef.current === undefined) {
    providerInstanceIdRef.current = getNextAccountSelectorPerfOperationId();
  }
  const providerPerfStateRef = useRef<{
    activeAccounts: Partial<Record<number, IAccountSelectorActiveAccountInfo>>;
    availableNetworks: IAccountSelectorAvailableNetworksMap;
    commitIndex: number;
    enabledNumKey: string;
    selectedAccounts: ISelectedAccountsAtomMap;
    storageReady: boolean;
    store: typeof store;
    syncLoading: Partial<Record<number, { isLoading: boolean }>>;
    updateMeta: Partial<Record<number, IAccountSelectorUpdateMeta>>;
  }>(undefined);
  const providerUntrackedBatchRef = useRef<{
    commitCount: number;
    firstCommitIndex: number;
    firstCommitTime: number;
    lastCommitIndex: number;
    lastCommitTime: number;
    maxActualDuration: number;
    totalActualDuration: number;
  }>(undefined);
  const providerUntrackedFlushTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const flushProviderUntrackedBatch = useCallback(() => {
    if (providerUntrackedFlushTimerRef.current) {
      clearTimeout(providerUntrackedFlushTimerRef.current);
      providerUntrackedFlushTimerRef.current = undefined;
    }
    const batch = providerUntrackedBatchRef.current;
    if (!batch) {
      return;
    }
    providerUntrackedBatchRef.current = undefined;
    defaultLogger.accountSelector.perf.trace('providerUntrackedCommitBatch', {
      ...batch,
      maxActualDuration: Math.round(batch.maxActualDuration * 100) / 100,
      perfDebugName,
      providerInstanceId: providerInstanceIdRef.current,
      sceneName: stableConfig.sceneName,
      totalActualDuration: Math.round(batch.totalActualDuration * 100) / 100,
    });
  }, [perfDebugName, stableConfig.sceneName]);

  useEffect(
    () => () => {
      flushProviderUntrackedBatch();
    },
    [flushProviderUntrackedBatch],
  );

  const handleProviderRender = useCallback<ProfilerOnRenderCallback>(
    (_id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      if (!isAccountSelectorPerfDebugEnabled()) {
        return;
      }
      const selectedAccounts = store.get(selectedAccountsAtom());
      const activeAccounts = store.get(activeAccountsAtom());
      const availableNetworks = store.get(
        accountSelectorAvailableNetworksAtom(),
      );
      const storageReady = store.get(accountSelectorStorageReadyAtom());
      const syncLoading = store.get(accountSelectorSyncLoadingAtom());
      const updateMeta = store.get(accountSelectorUpdateMetaAtom());
      const previousState = providerPerfStateRef.current;
      const scopeChanged = Boolean(
        previousState &&
        (previousState.store !== store ||
          previousState.enabledNumKey !== enabledNumKey),
      );
      const previous = scopeChanged ? undefined : previousState;
      const initialObservation = !previous;
      const commitIndex = (previous?.commitIndex || 0) + 1;
      const stateChanges = stableEnabledNum.map((num) => {
        const selectedChanged = previous
          ? previous.selectedAccounts[num] !== selectedAccounts[num]
          : true;
        const activeChanged = previous
          ? previous.activeAccounts[num] !== activeAccounts[num]
          : true;
        const availableNetworksChanged = previous
          ? previous.availableNetworks[num] !== availableNetworks[num]
          : true;
        const updateMetaChanged = previous
          ? previous.updateMeta[num] !== updateMeta[num]
          : true;
        const syncLoadingChanged = previous
          ? previous.syncLoading[num] !== syncLoading[num]
          : true;
        const selectionMeta =
          selectedChanged && !initialObservation
            ? getSelectedAccountPerfCommitMeta(selectedAccounts[num])
            : undefined;
        const activeMeta =
          activeChanged && !initialObservation
            ? getActiveAccountPerfCommitMeta(activeAccounts[num])
            : undefined;
        return {
          activeChanged,
          activeChangedFields: activeMeta?.changedFields,
          activeReloadId: activeMeta?.reloadId,
          activeScheduleId: activeMeta?.scheduleId,
          activeStateToProviderCommitMs: activeMeta
            ? Math.round(commitTime - activeMeta.stateUpdatedAt)
            : undefined,
          activeTrigger: activeMeta?.trigger,
          availableNetworksChanged,
          num,
          selectedChanged,
          selectionChangedFields: selectionMeta?.changedFields,
          selectionParentOperationId: selectionMeta?.parentOperationId,
          selectionReason: selectionMeta?.reason,
          selectionStateToProviderCommitMs: selectionMeta
            ? Math.round(commitTime - selectionMeta.stateUpdatedAt)
            : undefined,
          selectionTransitionId: selectionMeta?.transitionId,
          syncLoading: Boolean(syncLoading[num]?.isLoading),
          syncLoadingChanged,
          updateMetaChanged,
        };
      });
      const storageReadyChanged = previous
        ? previous.storageReady !== storageReady
        : true;
      const trackedStateChanged =
        storageReadyChanged ||
        stateChanges.some(
          (change) =>
            change.activeChanged ||
            change.availableNetworksChanged ||
            change.selectedChanged ||
            change.syncLoadingChanged ||
            change.updateMetaChanged,
        );
      const slow = actualDuration > 16;
      if (trackedStateChanged || slow) {
        flushProviderUntrackedBatch();
        let attribution = 'untracked-subtree-or-parent';
        if (initialObservation) {
          attribution = scopeChanged
            ? 'scope-reset-snapshot'
            : 'initial-provider-snapshot';
        } else if (trackedStateChanged) {
          attribution = 'tracked-account-state';
        }
        defaultLogger.accountSelector.perf.trace('providerSubtreeCommit', {
          actualDuration: Math.round(actualDuration * 100) / 100,
          attribution,
          baseDuration: Math.round(baseDuration * 100) / 100,
          commitTime: Math.round(commitTime * 100) / 100,
          commitIndex,
          enabledNum: stableEnabledNum,
          initialObservation,
          perfDebugName,
          phase,
          providerInstanceId: providerInstanceIdRef.current,
          sceneName: stableConfig.sceneName,
          scopeChanged,
          slow,
          startTime: Math.round(startTime * 100) / 100,
          stateChanges,
          storageReadyChanged,
          trackedStateChanged,
        });
      } else {
        const currentBatch = providerUntrackedBatchRef.current;
        providerUntrackedBatchRef.current = currentBatch
          ? {
              ...currentBatch,
              commitCount: currentBatch.commitCount + 1,
              lastCommitIndex: commitIndex,
              lastCommitTime: commitTime,
              maxActualDuration: Math.max(
                currentBatch.maxActualDuration,
                actualDuration,
              ),
              totalActualDuration:
                currentBatch.totalActualDuration + actualDuration,
            }
          : {
              commitCount: 1,
              firstCommitIndex: commitIndex,
              firstCommitTime: commitTime,
              lastCommitIndex: commitIndex,
              lastCommitTime: commitTime,
              maxActualDuration: actualDuration,
              totalActualDuration: actualDuration,
            };
        if (!providerUntrackedFlushTimerRef.current) {
          providerUntrackedFlushTimerRef.current = setTimeout(() => {
            providerUntrackedFlushTimerRef.current = undefined;
            flushProviderUntrackedBatch();
          }, 250);
        }
      }
      providerPerfStateRef.current = {
        activeAccounts,
        availableNetworks,
        commitIndex,
        enabledNumKey,
        selectedAccounts,
        storageReady,
        store,
        syncLoading,
        updateMeta,
      };
    },
    [
      enabledNumKey,
      flushProviderUntrackedBatch,
      perfDebugName,
      stableConfig.sceneName,
      stableEnabledNum,
      store,
    ],
  );

  const providerContent = (
    <AccountSelectorJotaiProvider store={store} config={stableConfig}>
      <AccountSelectorStorageReady
        fallback={storageReadyFallback}
        waitForStorageReady={waitForStorageReady}
      >
        <AccountSelectorAvailableNetworksInit
          availableNetworksMap={availableNetworksMap}
        />
        {children}
      </AccountSelectorStorageReady>
    </AccountSelectorJotaiProvider>
  );

  return (
    <>
      <JotaiContextStoreMirrorTracker {...data} />
      {shouldProfile ? (
        <Profiler
          id={`AccountSelectorProvider:${perfDebugName ?? 'unlabeled'}:${stableConfig.sceneName}:${enabledNumKey}:${providerInstanceIdRef.current ?? 'unknown'}`}
          onRender={handleProviderRender}
        >
          {providerContent}
        </Profiler>
      ) : (
        providerContent
      )}
    </>
  );
}
