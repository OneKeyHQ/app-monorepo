import {
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  accountSelectorAvailableNetworksAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorSyncLoadingAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  selectedAccountsAtom,
} from '../../states/jotai/contexts/accountSelector/atoms';
import {
  getActiveAccountPerfCommitMeta,
  getNextAccountSelectorPerfOperationId,
  getSelectedAccountPerfCommitMeta,
  isAccountSelectorPerfDebugEnabled,
} from '../../states/jotai/contexts/accountSelector/perfDebug';
import { buildJotaiContextStoreId } from '../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorAvailableNetworksMap,
  IAccountSelectorContextData,
  IAccountSelectorUpdateMeta,
  ISelectedAccountsAtomMap,
} from '../../states/jotai/contexts/accountSelector/atoms';
import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';
import type { IJotaiContextStoreMirrorRegistrationChange } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

type IAccountSelectorProviderPerfDebugProps = {
  children?: ReactNode;
  data: IJotaiContextStoreData;
  enabledNumKey: string;
  perfDebugName: string;
  sceneName: IAccountSelectorContextData['sceneName'];
  stableEnabledNum: number[];
  store: IJotaiContextStore;
};

type IAccountSelectorProviderProfilerProps =
  IAccountSelectorProviderPerfDebugProps & {
    providerInstanceId: number;
  };

type IAccountSelectorMirrorPerfTrackerProps = IJotaiContextStoreData & {
  perfDebugName: string;
  providerInstanceId: number;
  sceneName: IAccountSelectorContextData['sceneName'];
};

const AccountSelectorMirrorPerfTracker = memo(
  function AccountSelectorMirrorPerfTracker({
    perfDebugName,
    providerInstanceId,
    sceneName,
    ...data
  }: IAccountSelectorMirrorPerfTrackerProps) {
    const renderVersionRef = useRef(0);
    const commitCountRef = useRef(0);
    const lastCommittedRenderVersionRef = useRef(0);
    renderVersionRef.current += 1;
    const storeId = buildJotaiContextStoreId(data);
    const handleRegistrationChange = useCallback(
      ({
        action,
        registrationCount,
        storeId: registeredStoreId,
      }: IJotaiContextStoreMirrorRegistrationChange) => {
        if (!isAccountSelectorPerfDebugEnabled()) {
          return;
        }
        defaultLogger.accountSelector.perf.trace('mirrorTrackerRegistration', {
          action,
          perfDebugName,
          providerInstanceId,
          registrationCount,
          sceneName,
          storeId: registeredStoreId,
        });
      },
      [perfDebugName, providerInstanceId, sceneName],
    );

    // oxlint-disable-next-line use-effect-no-deps/use-effect-no-deps
    useEffect(() => {
      if (
        !isAccountSelectorPerfDebugEnabled() ||
        lastCommittedRenderVersionRef.current === renderVersionRef.current
      ) {
        return;
      }
      lastCommittedRenderVersionRef.current = renderVersionRef.current;
      commitCountRef.current += 1;
      defaultLogger.accountSelector.perf.trace('mirrorTrackerCommit', {
        commitCount: commitCountRef.current,
        perfDebugName,
        providerInstanceId,
        sceneName,
        storeId,
      });
    });

    return (
      <JotaiContextStoreMirrorTracker
        {...data}
        onRegistrationChange={handleRegistrationChange}
      />
    );
  },
);

function AccountSelectorProviderProfiler({
  children,
  enabledNumKey,
  perfDebugName,
  providerInstanceId,
  sceneName,
  stableEnabledNum,
  store,
}: IAccountSelectorProviderProfilerProps) {
  const providerPerfStateRef = useRef<{
    activeAccounts: Partial<Record<number, IAccountSelectorActiveAccountInfo>>;
    availableNetworks: IAccountSelectorAvailableNetworksMap;
    commitIndex: number;
    enabledNumKey: string;
    selectedAccounts: ISelectedAccountsAtomMap;
    storageReady: boolean;
    store: IJotaiContextStore;
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
      providerInstanceId,
      sceneName,
      totalActualDuration: Math.round(batch.totalActualDuration * 100) / 100,
    });
  }, [perfDebugName, providerInstanceId, sceneName]);

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
          activeStateUpdatedAt: activeMeta?.stateUpdatedAt,
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
          selectionStateUpdatedAt: selectionMeta?.stateUpdatedAt,
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
      const traceStateChanges = stateChanges.map(
        ({ activeStateUpdatedAt, selectionStateUpdatedAt, ...change }) =>
          change,
      );
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
          providerInstanceId,
          sceneName,
          scopeChanged,
          slow,
          startTime: Math.round(startTime * 100) / 100,
          stateChanges: traceStateChanges,
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
      if (
        trackedStateChanged &&
        !initialObservation &&
        typeof requestAnimationFrame === 'function'
      ) {
        requestAnimationFrame((paintTime) => {
          if (!isAccountSelectorPerfDebugEnabled()) {
            return;
          }
          defaultLogger.accountSelector.perf.trace('providerSubtreePaint', {
            commitIndex,
            commitToPaintMs:
              Math.round(Math.max(0, paintTime - commitTime) * 100) / 100,
            enabledNum: stableEnabledNum,
            perfDebugName,
            providerInstanceId,
            sceneName,
            stateChanges: stateChanges.map((change) => ({
              activeChanged: change.activeChanged,
              activeReloadId: change.activeReloadId,
              activeStateToPaintMs:
                change.activeChanged &&
                change.activeStateUpdatedAt !== undefined
                  ? Math.round(paintTime - change.activeStateUpdatedAt)
                  : undefined,
              activeTrigger: change.activeTrigger,
              num: change.num,
              selectedChanged: change.selectedChanged,
              selectionReason: change.selectionReason,
              selectionStateToPaintMs:
                change.selectedChanged &&
                change.selectionStateUpdatedAt !== undefined
                  ? Math.round(paintTime - change.selectionStateUpdatedAt)
                  : undefined,
              selectionTransitionId: change.selectionTransitionId,
            })),
          });
        });
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
      providerInstanceId,
      sceneName,
      stableEnabledNum,
      store,
    ],
  );

  return (
    <Profiler
      id={`AccountSelectorProvider:${perfDebugName}:${sceneName}:${enabledNumKey}:${providerInstanceId}`}
      onRender={handleProviderRender}
    >
      {children}
    </Profiler>
  );
}

export function AccountSelectorProviderPerfDebug(
  props: IAccountSelectorProviderPerfDebugProps,
) {
  const providerInstanceIdRef = useRef<number | undefined>(undefined);
  if (providerInstanceIdRef.current === undefined) {
    providerInstanceIdRef.current = getNextAccountSelectorPerfOperationId();
  }
  const providerInstanceId = providerInstanceIdRef.current;
  const perfDebugEnabled = isAccountSelectorPerfDebugEnabled();

  return (
    <>
      <AccountSelectorMirrorPerfTracker
        {...props.data}
        perfDebugName={props.perfDebugName}
        providerInstanceId={providerInstanceId}
        sceneName={props.sceneName}
      />
      {perfDebugEnabled ? (
        <AccountSelectorProviderProfiler
          {...props}
          providerInstanceId={providerInstanceId}
        />
      ) : (
        props.children
      )}
    </>
  );
}
