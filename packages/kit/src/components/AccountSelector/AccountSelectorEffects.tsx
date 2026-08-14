import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { throttle } from 'lodash';

import type { IDBExternalAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  type IAccountSelectorActiveAccountInfo,
  type IAccountSelectorUpdateMeta,
  accountSelectorUpdateMetaAtom,
  useAccountSelectorContextData,
  useAccountSelectorContextDataAtom,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useAccountSelectorUpdateMetaByNum,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';
import {
  buildActiveAccountPerfSummary,
  buildSelectedAccountPerfSummary,
  getAccountSelectorPerfTimestamp,
  getActiveAccountPerfCommitMeta,
  getNextAccountSelectorPerfOperationId,
  getSelectedAccountPerfCommitMeta,
  isAccountSelectorPerfDebugEnabled,
} from '../../states/jotai/contexts/accountSelector/perfDebug';

import { useAutoSelectAccount } from './hooks/useAutoSelectAccount';
import { useAutoSelectDeriveType } from './hooks/useAutoSelectDeriveType';
import { useAutoSelectNetwork } from './hooks/useAutoSelectNetwork';

const swapToAnotherAccountSwitchOnAtom = selectAtom(
  settingsAtom.atom(),
  (settings) => settings.swapToAnotherAccountSwitchOn,
);

type IActiveAccountReloadRequest = {
  coalescedCount: number;
  coalescedTriggers: string[];
  generation: number;
  perfEnabled: boolean;
  scheduleId: number;
  scheduledAt: number | undefined;
  selectedAccount: IAccountSelectorSelectedAccount;
  selectionStateUpdatedAt?: number;
  selectionReason?: string;
  selectionTransitionId?: number;
  trigger: string;
};

type IAccountSelectorEffectsPerfObserverProps = {
  effectInstanceId: number;
  isReady: boolean;
  num: number;
  sceneName: EAccountSelectorSceneName;
  sceneUrl: string | undefined;
  selectedAccount: IAccountSelectorSelectedAccount;
  swapToAnotherAccountSwitchOn: boolean;
  updateMeta: IAccountSelectorUpdateMeta | undefined;
};

const AccountSelectorEffectsPerfObserver = memo(
  function AccountSelectorEffectsPerfObserver({
    effectInstanceId,
    isReady,
    num,
    sceneName,
    sceneUrl,
    selectedAccount,
    swapToAnotherAccountSwitchOn,
    updateMeta,
  }: IAccountSelectorEffectsPerfObserverProps) {
    const { activeAccount } = useActiveAccount({ num });
    const observedStateRef = useRef<{
      activeAccount: IAccountSelectorActiveAccountInfo;
      isReady: boolean;
      observationCount: number;
      observedAt: number;
      sceneName: EAccountSelectorSceneName;
      sceneUrl: string | undefined;
      selectedAccount: IAccountSelectorSelectedAccount;
      swapToAnotherAccountSwitchOn: boolean;
      updateMeta: IAccountSelectorUpdateMeta | undefined;
    }>(undefined);

    // This observer is mounted only while AccountSelector perf diagnostics are
    // enabled. It tracks semantic state commits without adding production
    // subscriptions or counting StrictMode effect replays as new observations.
    // oxlint-disable-next-line use-effect-no-deps/use-effect-no-deps
    useEffect(() => {
      if (!isAccountSelectorPerfDebugEnabled()) {
        return;
      }
      const previous = observedStateRef.current;
      if (
        previous?.selectedAccount === selectedAccount &&
        previous.activeAccount === activeAccount &&
        previous.updateMeta === updateMeta &&
        previous.isReady === isReady &&
        previous.sceneName === sceneName &&
        previous.sceneUrl === sceneUrl &&
        previous.swapToAnotherAccountSwitchOn === swapToAnotherAccountSwitchOn
      ) {
        return;
      }
      const observedAt = getAccountSelectorPerfTimestamp();
      const changedChannels = previous
        ? [
            previous.selectedAccount !== selectedAccount
              ? 'selectedAccount'
              : undefined,
            previous.activeAccount !== activeAccount
              ? 'activeAccount'
              : undefined,
            previous.updateMeta !== updateMeta ? 'updateMeta' : undefined,
            previous.isReady !== isReady ? 'storageReady' : undefined,
            previous.sceneName !== sceneName || previous.sceneUrl !== sceneUrl
              ? 'scene'
              : undefined,
            previous.swapToAnotherAccountSwitchOn !==
            swapToAnotherAccountSwitchOn
              ? 'swapToAnotherAccountSwitchOn'
              : undefined,
          ].filter(Boolean)
        : ['mount'];
      const observationCount = (previous?.observationCount || 0) + 1;
      const selectedChanged = previous?.selectedAccount !== selectedAccount;
      const activeChanged = previous?.activeAccount !== activeAccount;
      const transitionMeta = selectedChanged
        ? getSelectedAccountPerfCommitMeta(selectedAccount)
        : undefined;
      const activeMeta = activeChanged
        ? getActiveAccountPerfCommitMeta(activeAccount)
        : undefined;
      defaultLogger.accountSelector.perf.trace('effectsStateObserved', {
        activeAccount: buildActiveAccountPerfSummary(activeAccount),
        activeReloadId: activeMeta?.reloadId,
        activeScheduleId: activeMeta?.scheduleId,
        activeStateToEffectMs: activeMeta
          ? Math.round(observedAt - activeMeta.stateUpdatedAt)
          : undefined,
        changedChannels,
        effectInstanceId,
        num,
        observationCount,
        sceneName,
        selection: buildSelectedAccountPerfSummary(selectedAccount),
        selectionParentOperationId: transitionMeta?.parentOperationId,
        selectionStateToEffectMs: transitionMeta
          ? Math.round(observedAt - transitionMeta.stateUpdatedAt)
          : undefined,
        sincePreviousObservationMs: previous
          ? Math.round(observedAt - previous.observedAt)
          : undefined,
        transitionId: transitionMeta?.transitionId,
      });
      observedStateRef.current = {
        activeAccount,
        isReady,
        observationCount,
        observedAt,
        sceneName,
        sceneUrl,
        selectedAccount,
        swapToAnotherAccountSwitchOn,
        updateMeta,
      };
    });

    return null;
  },
);

function useExternalAccountActivate({
  effectInstanceId,
  num,
  sceneName,
}: {
  effectInstanceId?: number;
  num: number;
  sceneName: EAccountSelectorSceneName;
}) {
  const { activeAccount } = useActiveAccount({ num });
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;
  const accountId = activeAccount.account?.id;
  const networkId = activeAccount.network?.id;

  useEffect(() => {
    if (
      !accountId ||
      !accountUtils.isExternalAccount({
        accountId,
      })
    ) {
      return undefined;
    }

    const connectionInfo = (
      activeAccountRef.current?.account as IDBExternalAccount | undefined
    )?.connectionInfo;

    if (!connectionInfo) {
      return undefined;
    }
    const perfEnabled = isAccountSelectorPerfDebugEnabled();
    const operationId = perfEnabled
      ? getNextAccountSelectorPerfOperationId()
      : undefined;
    const requestedAt = perfEnabled
      ? getAccountSelectorPerfTimestamp()
      : undefined;
    const activeMeta = perfEnabled
      ? getActiveAccountPerfCommitMeta(activeAccountRef.current)
      : undefined;
    let cancelled = false;
    let resultLogged = false;
    const logResult = (outcome: 'cancelled' | 'error' | 'synced') => {
      if (!perfEnabled || resultLogged) {
        return;
      }
      resultLogged = true;
      defaultLogger.accountSelector.perf.trace('externalActivationResult', {
        activeReloadId: activeMeta?.reloadId,
        effectInstanceId,
        num,
        operationId,
        outcome,
        sceneName,
        totalMs:
          requestedAt === undefined
            ? undefined
            : Math.round(getAccountSelectorPerfTimestamp() - requestedAt),
      });
    };
    if (perfEnabled) {
      defaultLogger.accountSelector.perf.trace('externalActivationRequested', {
        activeReloadId: activeMeta?.reloadId,
        effectInstanceId,
        num,
        operationId,
        sceneName,
      });
    }
    void (async () => {
      try {
        // activate connector will register account events
        // throw error if external wallet not installed
        //    EVM EIP6963 provider not found: so.onekey.app.wallet
        await backgroundApiProxy.serviceDappSide.activateConnector({
          connectionInfo,
        });
        if (cancelled) {
          logResult('cancelled');
          return;
        }
        if (accountId && networkId) {
          await timerUtils.wait(600);
          if (
            cancelled ||
            activeAccountRef.current.account?.id !== accountId ||
            activeAccountRef.current.network?.id !== networkId
          ) {
            logResult('cancelled');
            return;
          }
          await backgroundApiProxy.serviceDappSide.syncAccountFromPeerWallet({
            accountId,
            networkId,
          });
        }
        logResult('synced');
      } catch {
        logResult(cancelled ? 'cancelled' : 'error');
      }
    })();
    return () => {
      cancelled = true;
      logResult('cancelled');
    };
  }, [accountId, effectInstanceId, num, networkId, sceneName]);
}

function AccountSelectorEffectsCmp({ num }: { num: number }) {
  const actions = useAccountSelectorActions();
  const { selectedAccount, isSelectedAccountDefaultValue } = useSelectedAccount(
    { num },
  );
  const updateMeta = useAccountSelectorUpdateMetaByNum(num);
  const { store } = useAccountSelectorContextData();
  const selectedAccountRef = useRef(selectedAccount);
  selectedAccountRef.current = selectedAccount;

  const [, setContextData] = useAccountSelectorContextDataAtom();
  const swapToAnotherAccountSwitchOn = useAtomValue(
    swapToAnotherAccountSwitchOnAtom,
  );

  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const effectInstanceIdRef = useRef<number | undefined>(undefined);
  const perfDebugEnabled = isAccountSelectorPerfDebugEnabled();
  if (perfDebugEnabled && effectInstanceIdRef.current === undefined) {
    effectInstanceIdRef.current = getNextAccountSelectorPerfOperationId();
  }
  const effectInstanceId = effectInstanceIdRef.current;

  useDebugComponentRemountLog({
    name: `AccountSelectorEffects:${sceneName}:${sceneUrl || ''}:${num}`,
  });

  useEffect(() => {
    setContextData({
      sceneName,
      sceneUrl,
    });
  }, [sceneName, sceneUrl, setContextData]);

  const sceneNameRef = useRef(sceneName);
  sceneNameRef.current = sceneName;
  const sceneUrlRef = useRef(sceneUrl);
  sceneUrlRef.current = sceneUrl;
  const activeReloadGenerationRef = useRef(0);
  const nonPerfActiveReloadScheduleIdRef = useRef(0);
  const pendingActiveReloadRequestRef = useRef<
    IActiveAccountReloadRequest | undefined
  >(undefined);

  useAutoSelectAccount({ num });
  useAutoSelectNetwork({ num });
  useAutoSelectDeriveType({ num });
  useExternalAccountActivate({ effectInstanceId, num, sceneName });

  const activeAccountReloadDeps = useMemo(
    () => [
      selectedAccount.walletId,
      selectedAccount.indexedAccountId,
      selectedAccount.othersWalletAccountId,
      selectedAccount.networkId,
      selectedAccount.deriveType,
    ],
    [
      selectedAccount.walletId,
      selectedAccount.indexedAccountId,
      selectedAccount.othersWalletAccountId,
      selectedAccount.networkId,
      selectedAccount.deriveType,
    ],
  );
  const throttledReloadActiveAccountInfo = useMemo(
    () =>
      throttle(
        async (request: IActiveAccountReloadRequest) => {
          if (
            pendingActiveReloadRequestRef.current?.scheduleId ===
            request.scheduleId
          ) {
            pendingActiveReloadRequestRef.current = undefined;
          }
          const getElapsedMs = (
            startedAt: number | undefined,
            completedAt?: number,
          ) =>
            startedAt === undefined
              ? undefined
              : Math.round(
                  (completedAt ?? getAccountSelectorPerfTimestamp()) -
                    startedAt,
                );
          const logDispatch = (payload: Record<string, unknown>) => {
            if (!request.perfEnabled) {
              return;
            }
            defaultLogger.accountSelector.perf.trace('activeReloadDispatch', {
              coalescedCount: request.coalescedCount,
              coalescedTriggers: request.coalescedTriggers,
              effectInstanceId,
              num,
              scheduleId: request.scheduleId,
              sceneName,
              trigger: request.trigger,
              ...payload,
            });
          };
          if (request.generation !== activeReloadGenerationRef.current) {
            logDispatch({ outcome: 'cancelled-stale-scheduler' });
            return;
          }
          if (!isReady) {
            logDispatch({
              outcome: 'skip-not-ready',
              throttleWaitMs: getElapsedMs(request.scheduledAt),
            });
            return;
          }
          const gateStartedAt = request.perfEnabled
            ? getAccountSelectorPerfTimestamp()
            : undefined;
          let isInTransferImportOrBackupRestoreFlow: boolean;
          try {
            isInTransferImportOrBackupRestoreFlow =
              await backgroundApiProxy.servicePrimeTransfer.isInTransferImportOrBackupRestoreFlow();
          } catch {
            logDispatch({
              gateMs: getElapsedMs(gateStartedAt),
              outcome: 'error',
              phase: 'transfer-gate',
            });
            return;
          }
          if (request.generation !== activeReloadGenerationRef.current) {
            logDispatch({
              gateMs: getElapsedMs(gateStartedAt),
              outcome: 'cancelled-stale-scheduler',
              phase: 'after-transfer-gate',
            });
            return;
          }
          if (isInTransferImportOrBackupRestoreFlow) {
            logDispatch({
              gateMs: getElapsedMs(gateStartedAt),
              outcome: 'skip-transfer-flow',
              throttleWaitMs: getElapsedMs(request.scheduledAt, gateStartedAt),
            });
            return;
          }
          logDispatch({
            gateMs: getElapsedMs(gateStartedAt),
            outcome: 'dispatch',
            throttleWaitMs: getElapsedMs(request.scheduledAt, gateStartedAt),
          });
          let activeAccount: IAccountSelectorActiveAccountInfo;
          let reloadOutcome: string;
          try {
            const reloadResult = await actions.current.reloadActiveAccountInfo({
              num,
              perfContext: {
                coalescedCount: request.coalescedCount,
                coalescedTriggers: request.coalescedTriggers,
                effectInstanceId,
                perfEnabled: request.perfEnabled,
                scheduleId: request.scheduleId,
                sceneName,
                selectionStateUpdatedAt: request.selectionStateUpdatedAt,
                selectionReason: request.selectionReason,
                selectionTransitionId: request.selectionTransitionId,
                trigger: request.trigger,
              },
              selectedAccount: request.selectedAccount,
              shouldReload: () =>
                request.generation === activeReloadGenerationRef.current,
            });
            activeAccount = reloadResult.activeAccount;
            reloadOutcome = reloadResult.outcome;
          } catch {
            logDispatch({ outcome: 'error', phase: 'reload-action' });
            return;
          }
          if (
            reloadOutcome === 'stale-schedule-before-build' ||
            reloadOutcome === 'stale-before-build' ||
            reloadOutcome === 'stale-after-build'
          ) {
            if (request.perfEnabled) {
              defaultLogger.accountSelector.perf.trace(
                'activeReloadPostProcessResult',
                {
                  actionOutcome: reloadOutcome,
                  effectInstanceId,
                  num,
                  outcome: 'skip-stale-action',
                  scheduleId: request.scheduleId,
                  sceneName,
                  trigger: request.trigger,
                },
              );
            }
            return;
          }
          const postProcessStartedAt = request.perfEnabled
            ? getAccountSelectorPerfTimestamp()
            : undefined;
          if (request.generation !== activeReloadGenerationRef.current) {
            if (request.perfEnabled) {
              defaultLogger.accountSelector.perf.trace(
                'activeReloadPostProcessResult',
                {
                  effectInstanceId,
                  num,
                  outcome: 'skip-stale-scheduler',
                  scheduleId: request.scheduleId,
                  sceneName,
                  trigger: request.trigger,
                },
              );
            }
            return;
          }
          let snapshotOutcome = 'success';
          try {
            await actions.current.flushCurrentAccountSelectorColdStartSnapshot({
              sceneName: sceneNameRef.current,
              sceneUrl: sceneUrlRef.current,
              includeActiveAccounts: true,
            });
          } catch {
            snapshotOutcome = 'error';
          }
          if (activeAccount.account && activeAccount.network?.id) {
            void backgroundApiProxy.serviceAccount
              .saveAccountAddresses({
                account: activeAccount.account,
                networkId: activeAccount.network?.id,
              })
              .catch(() => undefined);
          }
          if (request.perfEnabled) {
            defaultLogger.accountSelector.perf.trace(
              'activeReloadPostProcessResult',
              {
                num,
                effectInstanceId,
                outcome:
                  snapshotOutcome === 'success'
                    ? 'completed'
                    : 'snapshot-error',
                saveAddressesScheduled: Boolean(
                  activeAccount.account && activeAccount.network?.id,
                ),
                scheduleId: request.scheduleId,
                sceneName,
                snapshotMs: getElapsedMs(postProcessStartedAt),
                trigger: request.trigger,
              },
            );
          }
        },
        150,
        {
          leading: false,
          trailing: true,
        },
      ),
    [actions, effectInstanceId, isReady, num, sceneName],
  );
  const scheduleActiveAccountReload = useCallback(
    (trigger: string) => {
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const selectedAccountForReload = selectedAccountRef.current;
      const transitionMeta =
        perfEnabled && trigger === 'selection-change'
          ? getSelectedAccountPerfCommitMeta(selectedAccountForReload)
          : undefined;
      const scheduleId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : -(nonPerfActiveReloadScheduleIdRef.current += 1);
      const previousRequest = pendingActiveReloadRequestRef.current;
      const generation = (activeReloadGenerationRef.current += 1);
      const previousTracedRequest = previousRequest?.perfEnabled
        ? previousRequest
        : undefined;
      const previousRelatedRequest =
        previousTracedRequest?.selectedAccount === selectedAccountForReload
          ? previousTracedRequest
          : undefined;
      const coalescedTriggers = perfEnabled
        ? Array.from(
            new Set([
              ...(previousTracedRequest?.coalescedTriggers || []),
              trigger,
            ]),
          )
        : [];
      const request: IActiveAccountReloadRequest = {
        coalescedCount: previousTracedRequest
          ? previousTracedRequest.coalescedCount + 1
          : 0,
        coalescedTriggers,
        generation,
        perfEnabled,
        scheduleId,
        scheduledAt: perfEnabled
          ? getAccountSelectorPerfTimestamp()
          : undefined,
        selectedAccount: selectedAccountForReload,
        selectionStateUpdatedAt:
          transitionMeta?.stateUpdatedAt ??
          previousRelatedRequest?.selectionStateUpdatedAt,
        selectionReason:
          transitionMeta?.reason ?? previousRelatedRequest?.selectionReason,
        selectionTransitionId:
          transitionMeta?.transitionId ??
          previousRelatedRequest?.selectionTransitionId,
        trigger,
      };
      if (previousTracedRequest && perfEnabled) {
        defaultLogger.accountSelector.perf.trace('activeReloadCoalesced', {
          coalescedCount: request.coalescedCount,
          coalescedTriggers,
          effectInstanceId,
          num,
          replacementScheduleId: scheduleId,
          replacementTrigger: trigger,
          sameSelection:
            previousTracedRequest.selectedAccount === selectedAccountForReload,
          sceneName,
          scheduleId: previousTracedRequest.scheduleId,
          trigger: previousTracedRequest.trigger,
        });
      }
      pendingActiveReloadRequestRef.current = request;
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('activeReloadScheduled', {
          changedFields: transitionMeta?.changedFields,
          coalescedCount: request.coalescedCount,
          coalescedTriggers,
          effectInstanceId,
          num,
          reason: request.selectionReason,
          scheduleId,
          sceneName,
          transitionId: request.selectionTransitionId,
          trigger,
        });
      }
      void throttledReloadActiveAccountInfo(request);
    },
    [effectInstanceId, num, sceneName, throttledReloadActiveAccountInfo],
  );

  useEffect(
    () => () => {
      const pendingRequest = pendingActiveReloadRequestRef.current;
      activeReloadGenerationRef.current += 1;
      throttledReloadActiveAccountInfo.cancel();
      pendingActiveReloadRequestRef.current = undefined;
      if (pendingRequest?.perfEnabled) {
        defaultLogger.accountSelector.perf.trace('activeReloadCancelled', {
          effectInstanceId,
          num,
          outcome: 'cancelled-cleanup',
          sceneName,
          scheduleId: pendingRequest.scheduleId,
          trigger: pendingRequest.trigger,
        });
      }
    },
    [effectInstanceId, num, sceneName, throttledReloadActiveAccountInfo],
  );

  const lastAutoSavedUpdatedAtRef = useRef<number | undefined>(undefined);
  const autoSaveToStorage = useCallback(async () => {
    // do not save before initFromStorage() completes
    if (!isReady) {
      if (isAccountSelectorPerfDebugEnabled()) {
        defaultLogger.accountSelector.perf.trace('selectionStorageSkipped', {
          effectInstanceId,
          num,
          outcome: 'skip-not-ready',
          sceneName,
          trigger: 'selection-effect',
        });
      }
      return;
    }
    if (
      updateMeta?.updatedAt !== undefined &&
      lastAutoSavedUpdatedAtRef.current === updateMeta.updatedAt
    ) {
      if (isAccountSelectorPerfDebugEnabled()) {
        defaultLogger.accountSelector.perf.trace('selectionStorageSkipped', {
          effectInstanceId,
          num,
          outcome: 'skip-duplicate-revision',
          sceneName,
          trigger: 'selection-effect',
        });
      }
      return;
    }
    // do not save initial value to storage
    if (!isSelectedAccountDefaultValue) {
      // check initFromStorage() at AccountSelectorStorageInit
      await actions.current.saveToStorage({
        trigger: 'selection-effect',
        selectedAccount,
        sceneName,
        sceneUrl,
        num,
        selectedAccountUpdatedAt: updateMeta?.updatedAt,
      });
      lastAutoSavedUpdatedAtRef.current = updateMeta?.updatedAt;
    } else {
      if (isAccountSelectorPerfDebugEnabled()) {
        defaultLogger.accountSelector.perf.trace('selectionStorageSkipped', {
          effectInstanceId,
          num,
          outcome: 'skip-default-selection',
          sceneName,
          trigger: 'selection-effect',
        });
      }
    }
  }, [
    actions,
    effectInstanceId,
    isReady,
    isSelectedAccountDefaultValue,
    num,
    sceneName,
    sceneUrl,
    selectedAccount,
    updateMeta,
  ]);

  useEffect(() => {
    void autoSaveToStorage().catch(() => undefined);
  }, [autoSaveToStorage]);

  useEffect(() => {
    noopObject(activeAccountReloadDeps);
    scheduleActiveAccountReload('selection-change');
  }, [activeAccountReloadDeps, scheduleActiveAccountReload]);

  const lastReloadNotRequiredTransitionIdRef = useRef<number | undefined>(
    undefined,
  );
  useEffect(() => {
    const transitionMeta = getSelectedAccountPerfCommitMeta(selectedAccount);
    if (
      !transitionMeta ||
      transitionMeta.num !== num ||
      lastReloadNotRequiredTransitionIdRef.current ===
        transitionMeta.transitionId
    ) {
      return;
    }
    lastReloadNotRequiredTransitionIdRef.current = transitionMeta.transitionId;
    const activeReloadFields = new Set([
      'walletId',
      'indexedAccountId',
      'othersWalletAccountId',
      'networkId',
      'deriveType',
    ]);
    if (
      !transitionMeta.changedFields.some((field) =>
        activeReloadFields.has(field),
      ) &&
      isAccountSelectorPerfDebugEnabled()
    ) {
      defaultLogger.accountSelector.perf.trace('activeReloadNotRequired', {
        changedFields: transitionMeta.changedFields,
        effectInstanceId,
        num,
        reason: transitionMeta.reason,
        sceneName,
        transitionId: transitionMeta.transitionId,
      });
    }
  }, [effectInstanceId, num, sceneName, selectedAccount]);

  useEffect(() => {
    const updateNetwork = (params: {
      networkId: string;
      sceneName: string;
      sceneUrl: string;
      num: number;
    }) => {
      if (
        params.sceneName === sceneNameRef.current &&
        params.sceneUrl === sceneUrlRef.current &&
        params.num === num
      ) {
        void actions.current.updateSelectedAccountNetwork({
          num: params.num,
          networkId: params.networkId,
          reason: 'dappNetworkEvent',
        });
      }
    };
    const reloadAfterAccountUpdate = () =>
      scheduleActiveAccountReload('account-update');
    const reloadAfterWalletUpdate = () =>
      scheduleActiveAccountReload('wallet-update');
    const reloadAfterCustomNetworkUpdate = () =>
      scheduleActiveAccountReload('custom-network-update');
    appEventBus.on(EAppEventBusNames.AccountUpdate, reloadAfterAccountUpdate);
    appEventBus.on(EAppEventBusNames.WalletUpdate, reloadAfterWalletUpdate);
    appEventBus.on(
      EAppEventBusNames.AddedCustomNetwork,
      reloadAfterCustomNetworkUpdate,
    );
    appEventBus.on(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountUpdate,
        reloadAfterAccountUpdate,
      );
      appEventBus.off(EAppEventBusNames.WalletUpdate, reloadAfterWalletUpdate);
      appEventBus.off(
        EAppEventBusNames.AddedCustomNetwork,
        reloadAfterCustomNetworkUpdate,
      );
      appEventBus.off(EAppEventBusNames.DAppNetworkUpdate, updateNetwork);
    };
  }, [actions, num, scheduleActiveAccountReload]);

  const syncHomeAndSwap = useCallback(
    (eventPayload: {
      selectedAccount: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string | undefined;
      num: number;
      sourceOperationId?: number;
      sourceRuntimeId?: string;
      sourceTransitionId?: number;
      trigger?: string;
    }) =>
      actions.current.syncHomeAndSwapSelectedAccount({
        eventPayload,
        sceneName,
        sceneUrl,
        num,
      }),
    [actions, num, sceneName, sceneUrl],
  );
  const syncSceneData = useCallback(
    async (eventPayload: {
      selectedAccount: IAccountSelectorSelectedAccount;
      selectedAccountUpdatedAt: number | undefined;
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string | undefined;
      num: number;
      sourceOperationId?: number;
      sourceRuntimeId?: string;
      sourceTransitionId?: number;
      trigger?: string;
    }) => {
      if (
        sceneName === EAccountSelectorSceneName.discover &&
        eventPayload &&
        eventPayload.selectedAccount &&
        eventPayload.sceneName === sceneName &&
        eventPayload.sceneUrl === sceneUrl &&
        eventPayload.num === num &&
        // @ts-ignore
        eventPayload?.$$isRemoteEvent // ext background event emit
      ) {
        const eventPayloadUpdatedAt = eventPayload.selectedAccountUpdatedAt;
        const currentUpdatedAt = store?.get(accountSelectorUpdateMetaAtom())?.[
          eventPayload.num
        ]?.updatedAt;
        const expectedSelection = actions.current.getSelectedAccount({
          num: eventPayload.num,
        });

        defaultLogger.accountSelector.storage.syncSceneData({
          selectedAccount: eventPayload.selectedAccount,
          eventPayloadUpdatedAt,
          currentUpdatedAt,
        });

        let shouldUpdateAtom = true;
        if (
          eventPayloadUpdatedAt &&
          currentUpdatedAt &&
          currentUpdatedAt >= eventPayloadUpdatedAt
        ) {
          shouldUpdateAtom = false;
        }

        if (shouldUpdateAtom) {
          await actions.current.updateSelectedAccount({
            expectedSelection,
            expectedUpdatedAt: currentUpdatedAt ?? null,
            num: eventPayload.num,
            parentOperationId: eventPayload.sourceOperationId,
            reason: 'syncSceneData',
            builder: () => eventPayload.selectedAccount,
            updateMeta: {
              eventEmitDisabled: true, // avoid infinite loop: event -> updateSelectedAccount -> event
              updatedAt: eventPayloadUpdatedAt ?? Date.now(),
            },
          });
        }
      }

      await syncHomeAndSwap(eventPayload);
    },
    [actions, num, sceneName, sceneUrl, store, syncHomeAndSwap],
  );

  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      syncSceneData,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        syncSceneData,
      );
    };
  }, [syncSceneData]);

  useEffect(() => {
    void (async () => {
      if (
        !swapToAnotherAccountSwitchOn &&
        sceneName === EAccountSelectorSceneName.swap &&
        num === 1
      ) {
        await actions.current.reloadSwapToAccountFromHome();
      }
    })();
  }, [actions, num, sceneName, swapToAnotherAccountSwitchOn]);

  return perfDebugEnabled && effectInstanceId !== undefined ? (
    <AccountSelectorEffectsPerfObserver
      effectInstanceId={effectInstanceId}
      isReady={isReady}
      num={num}
      sceneName={sceneName}
      sceneUrl={sceneUrl}
      selectedAccount={selectedAccount}
      swapToAnotherAccountSwitchOn={swapToAnotherAccountSwitchOn}
      updateMeta={updateMeta}
    />
  ) : null;
}

export const AccountSelectorEffects = memo(AccountSelectorEffectsCmp);
