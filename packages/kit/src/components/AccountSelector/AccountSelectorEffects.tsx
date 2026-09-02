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
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  type IAccountSelectorActiveAccountInfo,
  type IAccountSelectorUpdateMeta,
  accountSelectorUpdateMetaAtom,
  useAccountSelectorContextData,
  useAccountSelectorContextDataAtom,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageInitDoneAtom,
  useAccountSelectorStorageReadyAtom,
  useAccountSelectorUpdateMetaByNum,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';
import {
  buildActiveReloadFailureKey,
  takeActiveReloadFailureLogSlot,
  takeActiveReloadRecoveryLogSlot,
} from '../../states/jotai/contexts/accountSelector/activeReloadFailureLog';
import {
  EActiveReloadDispatchOutcome,
  EActiveReloadOutcome,
  EActiveReloadPostProcessOutcome,
  EExternalActivateOutcome,
  ESelectionStorageEffectOutcome,
  EStorageSaveOutcome,
} from '../../states/jotai/contexts/accountSelector/outcomes';
import {
  buildActiveAccountPerfSummary,
  buildSelectedAccountPerfSummary,
  getAccountSelectorPerfTimestamp,
  getActiveAccountPerfCommitMeta,
  getNextAccountSelectorPerfOperationId,
  getSelectedAccountPerfCommitMeta,
  isAccountSelectorPerfDebugEnabled,
  takeSelectedAccountReloadAttribution,
} from '../../states/jotai/contexts/accountSelector/perfDebug';
import {
  ACTIVE_ACCOUNT_RELOAD_SELECTION_FIELDS,
  isSameSelectedAccount,
} from '../../states/jotai/contexts/accountSelector/selectedAccountCompare';

import { useAutoSelectAccount } from './hooks/useAutoSelectAccount';
import { useAutoSelectDeriveType } from './hooks/useAutoSelectDeriveType';
import { useAutoSelectNetwork } from './hooks/useAutoSelectNetwork';

const swapToAnotherAccountSwitchOnAtom = selectAtom(
  settingsAtom.atom(),
  (settings) => settings.swapToAnotherAccountSwitchOn,
);

const activeReloadFieldSet = new Set<string>(
  ACTIVE_ACCOUNT_RELOAD_SELECTION_FIELDS,
);

const completedAutoSaveOutcomes = new Set<EStorageSaveOutcome>([
  EStorageSaveOutcome.NoopAlreadySaved,
  EStorageSaveOutcome.Persisted,
  EStorageSaveOutcome.ProcessedNonpersistent,
  EStorageSaveOutcome.ReplayedSideEffects,
  EStorageSaveOutcome.SkipCompletedRevision,
]);

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

function AccountSelectorEffectsPerfCommitObserver({
  effectInstanceId,
  num,
  sceneName,
}: {
  effectInstanceId: number;
  num: number;
  sceneName: EAccountSelectorSceneName;
}) {
  const renderVersionRef = useRef(0);
  const commitCountRef = useRef(0);
  const lastCommittedRenderVersionRef = useRef(0);
  renderVersionRef.current += 1;
  // oxlint-disable-next-line use-effect-no-deps/use-effect-no-deps
  useEffect(() => {
    if (lastCommittedRenderVersionRef.current === renderVersionRef.current) {
      return;
    }
    lastCommittedRenderVersionRef.current = renderVersionRef.current;
    commitCountRef.current += 1;
    defaultLogger.accountSelector.perf.trace('effectsHostCommit', {
      commitCount: commitCountRef.current,
      effectInstanceId,
      num,
      sceneName,
    });
  });
  return null;
}

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

// Which transport the external account connects over. Only the discriminator —
// the payloads underneath carry session topics and peer metadata.
function describeConnectionKind(
  connectionInfo: IExternalConnectionInfo | undefined,
): string {
  if (connectionInfo?.walletConnect) {
    return 'walletConnect';
  }
  if (connectionInfo?.evmEIP6963) {
    return 'evmEIP6963';
  }
  if (connectionInfo?.evmInjected) {
    return 'evmInjected';
  }
  return 'unknown';
}

function useExternalAccountActivate({
  effectInstanceIdRef,
  num,
  sceneName,
}: {
  // Passed as a ref on purpose: the id is diagnostics-only and gets assigned
  // lazily when perf debugging turns on mid-session. Depending on its value
  // would cancel and re-run the activation effect (repeating
  // activateConnector + syncAccountFromPeerWallet) on that flip.
  effectInstanceIdRef: { readonly current: number | undefined };
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
    const logResult = (outcome: EExternalActivateOutcome) => {
      if (!perfEnabled || resultLogged) {
        return;
      }
      resultLogged = true;
      defaultLogger.accountSelector.perf.trace('externalActivationResult', {
        activeReloadId: activeMeta?.reloadId,
        effectInstanceId: effectInstanceIdRef.current,
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
        effectInstanceId: effectInstanceIdRef.current,
        num,
        operationId,
        sceneName,
      });
    }
    let activationPhase = 'activate-connector';
    void (async () => {
      try {
        // activate connector will register account events
        // throw error if external wallet not installed
        //    EVM EIP6963 provider not found: so.onekey.app.wallet
        await backgroundApiProxy.serviceDappSide.activateConnector({
          connectionInfo,
        });
        if (cancelled) {
          logResult(EExternalActivateOutcome.Cancelled);
          return;
        }
        if (accountId && networkId) {
          await timerUtils.wait(600);
          const activeAccountMoved =
            activeAccountRef.current.account?.id !== accountId;
          const activeNetworkMoved =
            activeAccountRef.current.network?.id !== networkId;
          if (cancelled || activeAccountMoved || activeNetworkMoved) {
            logResult(EExternalActivateOutcome.Cancelled);
            // A cancelled effect re-runs with the new ids, so it recovers on its
            // own. This branch is the one that does not: the ids this effect
            // depends on are unchanged, so nothing retries the sync and the
            // external account keeps the chain and address it had before.
            if (!cancelled) {
              defaultLogger.accountSelector.failure.peerSyncSkipped({
                connectionKind: describeConnectionKind(connectionInfo),
                num,
                reason: activeAccountMoved
                  ? 'active-account-changed'
                  : 'active-network-changed',
                sceneName,
              });
            }
            return;
          }
          activationPhase = 'sync-from-peer-wallet';
          await backgroundApiProxy.serviceDappSide.syncAccountFromPeerWallet({
            accountId,
            networkId,
          });
        }
        logResult(EExternalActivateOutcome.Synced);
      } catch (error) {
        logResult(
          cancelled
            ? EExternalActivateOutcome.Cancelled
            : EExternalActivateOutcome.Error,
        );
        if (!cancelled) {
          // The effect only re-runs when accountId/networkId change, so a
          // failure here means this account stops syncing with its peer wallet
          // until the user switches away and back or reloads. Recorded in
          // production because the cause is always on the user's machine.
          defaultLogger.accountSelector.failure.activationFailed({
            connectionKind: describeConnectionKind(connectionInfo),
            errorMessage: (error as Error | undefined)?.message,
            errorName: (error as Error | undefined)?.name,
            num,
            phase: activationPhase,
            sceneName,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      logResult(EExternalActivateOutcome.Cancelled);
    };
  }, [accountId, effectInstanceIdRef, num, networkId, sceneName]);
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
  const [isStorageInitDone] = useAccountSelectorStorageInitDoneAtom();
  const storageInitDoneRef = useRef(isStorageInitDone);
  storageInitDoneRef.current = isStorageInitDone;
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
  useExternalAccountActivate({ effectInstanceIdRef, num, sceneName });

  // Must list exactly ACTIVE_ACCOUNT_RELOAD_SELECTION_FIELDS: reload staleness
  // is judged on those fields, so anything scheduled on a narrower set would be
  // dropped with nothing left to re-schedule it. The literal form is required
  // for react-hooks/exhaustive-deps to analyse the deps array; the key-set test
  // in selectedAccountCompare.test.ts fails when a new selection field is added
  // without an explicit decision, which is what keeps this literal honest.
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
              effectInstanceId: effectInstanceIdRef.current,
              num,
              scheduleId: request.scheduleId,
              sceneName,
              trigger: request.trigger,
              ...payload,
            });
          };
          // Edge triggered, unlike logDispatch: this one is meant to survive
          // into production, so it must not repeat once per retry while the
          // background runtime is unreachable. See activeReloadFailureLog.ts.
          const logActiveReloadFailure = ({
            error,
            phase,
          }: {
            error: unknown;
            phase: string;
          }) => {
            const errorName = (error as Error | undefined)?.name;
            const slot = takeActiveReloadFailureLogSlot({
              errorName,
              key: buildActiveReloadFailureKey({ num, phase, sceneName }),
            });
            if (!slot) {
              return;
            }
            defaultLogger.accountSelector.failure.activeReloadFailed({
              consecutiveFailures: slot.consecutiveFailures,
              errorMessage: (error as Error | undefined)?.message,
              errorName,
              num,
              phase,
              previousFailures: slot.previousFailures,
              sceneName,
            });
          };
          const logActiveReloadRecovery = (phase: string) => {
            const failuresBeforeRecovery = takeActiveReloadRecoveryLogSlot(
              buildActiveReloadFailureKey({ num, phase, sceneName }),
            );
            if (failuresBeforeRecovery === undefined) {
              return;
            }
            defaultLogger.accountSelector.failure.activeReloadRecovered({
              failuresBeforeRecovery,
              num,
              phase,
              sceneName,
            });
          };
          if (request.generation !== activeReloadGenerationRef.current) {
            logDispatch({
              outcome: EActiveReloadDispatchOutcome.CancelledStaleScheduler,
            });
            return;
          }
          if (!isReady) {
            logDispatch({
              outcome: EActiveReloadDispatchOutcome.SkipNotReady,
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
          } catch (error) {
            logDispatch({
              gateMs: getElapsedMs(gateStartedAt),
              outcome: EActiveReloadDispatchOutcome.Error,
              phase: 'transfer-gate',
            });
            logActiveReloadFailure({ error, phase: 'transfer-gate' });
            return;
          }
          logActiveReloadRecovery('transfer-gate');
          if (request.generation !== activeReloadGenerationRef.current) {
            logDispatch({
              gateMs: getElapsedMs(gateStartedAt),
              outcome: EActiveReloadDispatchOutcome.CancelledStaleScheduler,
              phase: 'after-transfer-gate',
            });
            return;
          }
          if (isInTransferImportOrBackupRestoreFlow) {
            // Dropped without a retry of its own, and that is fine: every path
            // that clears the flow flag funnels through
            // ServicePrimeTransfer.finallyImportProgress, which emits
            // WalletUpdate and AccountUpdate - both scheduled below - so the
            // reload is re-issued once the flow ends.
            logDispatch({
              gateMs: getElapsedMs(gateStartedAt),
              outcome: EActiveReloadDispatchOutcome.SkipTransferFlow,
              throttleWaitMs: getElapsedMs(request.scheduledAt, gateStartedAt),
            });
            return;
          }
          logDispatch({
            gateMs: getElapsedMs(gateStartedAt),
            outcome: EActiveReloadDispatchOutcome.Dispatch,
            throttleWaitMs: getElapsedMs(request.scheduledAt, gateStartedAt),
          });
          let activeAccount: IAccountSelectorActiveAccountInfo;
          let reloadOutcome: EActiveReloadOutcome;
          try {
            const reloadResult = await actions.current.reloadActiveAccountInfo({
              num,
              perfContext: {
                coalescedCount: request.coalescedCount,
                coalescedTriggers: request.coalescedTriggers,
                effectInstanceId: effectInstanceIdRef.current,
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
          } catch (error) {
            logDispatch({
              outcome: EActiveReloadDispatchOutcome.Error,
              phase: 'reload-action',
            });
            logActiveReloadFailure({ error, phase: 'reload-action' });
            return;
          }
          logActiveReloadRecovery('reload-action');
          if (
            reloadOutcome === EActiveReloadOutcome.StaleScheduleBeforeBuild ||
            reloadOutcome === EActiveReloadOutcome.StaleBeforeBuild ||
            reloadOutcome === EActiveReloadOutcome.StaleAfterBuild
          ) {
            if (request.perfEnabled) {
              defaultLogger.accountSelector.perf.trace(
                'activeReloadPostProcessResult',
                {
                  actionOutcome: reloadOutcome,
                  effectInstanceId: effectInstanceIdRef.current,
                  num,
                  outcome: EActiveReloadPostProcessOutcome.SkipStaleAction,
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
                  effectInstanceId: effectInstanceIdRef.current,
                  num,
                  outcome: EActiveReloadPostProcessOutcome.SkipStaleScheduler,
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
              .then(() => logActiveReloadRecovery('save-account-addresses'))
              .catch((error: unknown) =>
                logActiveReloadFailure({
                  error,
                  phase: 'save-account-addresses',
                }),
              );
          }
          if (request.perfEnabled) {
            defaultLogger.accountSelector.perf.trace(
              'activeReloadPostProcessResult',
              {
                num,
                effectInstanceId: effectInstanceIdRef.current,
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
    [actions, isReady, num, sceneName],
  );
  const scheduleActiveAccountReload = useCallback(
    (trigger: string) => {
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const selectedAccountForReload = selectedAccountRef.current;
      // Claimed, not just read: an effect re-run over the same selection object
      // would otherwise re-attribute this schedule to a transition that was
      // already accounted for.
      const transitionMeta =
        perfEnabled && trigger === 'selection-change'
          ? takeSelectedAccountReloadAttribution({
              num,
              selectedAccount: selectedAccountForReload,
            })
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
          effectInstanceId: effectInstanceIdRef.current,
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
        // Report the transition only when this schedule claimed it. An
        // inherited attribution belongs to the pending request being coalesced
        // into, which already announced it; re-announcing here would count one
        // transition as two scheduled reloads. The request itself still carries
        // the inherited attribution so the dispatch that finally runs stays
        // correlated with the transition that caused it.
        defaultLogger.accountSelector.perf.trace('activeReloadScheduled', {
          changedFields: transitionMeta?.changedFields,
          coalescedCount: request.coalescedCount,
          coalescedTriggers,
          effectInstanceId: effectInstanceIdRef.current,
          num,
          reason: transitionMeta?.reason,
          scheduleId,
          sceneName,
          transitionId: transitionMeta?.transitionId,
          trigger,
        });
      }
      void throttledReloadActiveAccountInfo(request);
    },
    [num, sceneName, throttledReloadActiveAccountInfo],
  );

  useEffect(
    () => () => {
      const pendingRequest = pendingActiveReloadRequestRef.current;
      activeReloadGenerationRef.current += 1;
      throttledReloadActiveAccountInfo.cancel();
      pendingActiveReloadRequestRef.current = undefined;
      if (pendingRequest?.perfEnabled) {
        defaultLogger.accountSelector.perf.trace('activeReloadCancelled', {
          effectInstanceId: effectInstanceIdRef.current,
          num,
          outcome: ESelectionStorageEffectOutcome.CancelledCleanup,
          sceneName,
          scheduleId: pendingRequest.scheduleId,
          trigger: pendingRequest.trigger,
        });
      }
    },
    [num, sceneName, throttledReloadActiveAccountInfo],
  );

  const lastAutoSavedUpdatedAtRef = useRef<number | undefined>(undefined);
  const lastAutoSavedSelectionRef = useRef<
    IAccountSelectorSelectedAccount | undefined
  >(undefined);
  const autoSaveToStorage = useCallback(async () => {
    // do not save before initFromStorage() completes
    if (!isReady || !isStorageInitDone) {
      if (isAccountSelectorPerfDebugEnabled()) {
        defaultLogger.accountSelector.perf.trace('selectionStorageSkipped', {
          effectInstanceId: effectInstanceIdRef.current,
          num,
          outcome: isReady
            ? ESelectionStorageEffectOutcome.SkipInitPending
            : ESelectionStorageEffectOutcome.SkipNotReady,
          sceneName,
          trigger: 'selection-effect',
        });
      }
      return;
    }
    // The selection has to match too, not just the revision. Writes made with
    // the 'untracked' revision policy (initFromStorage applying the DB map)
    // change a user visible selection while leaving updatedAt alone, and a
    // revision-only check would skip those silently - no write, no event, and
    // no later trigger because the revision never moves again.
    if (
      updateMeta?.updatedAt !== undefined &&
      lastAutoSavedUpdatedAtRef.current === updateMeta.updatedAt &&
      isSameSelectedAccount(lastAutoSavedSelectionRef.current, selectedAccount)
    ) {
      if (isAccountSelectorPerfDebugEnabled()) {
        defaultLogger.accountSelector.perf.trace('selectionStorageSkipped', {
          effectInstanceId: effectInstanceIdRef.current,
          num,
          outcome: ESelectionStorageEffectOutcome.SkipDuplicateRevision,
          sceneName,
          trigger: 'selection-effect',
        });
      }
      return;
    }
    // do not save initial value to storage
    if (!isSelectedAccountDefaultValue) {
      const selectionSaveKey = buildActiveReloadFailureKey({
        num,
        phase: 'selection-save',
        sceneName,
      });
      try {
        // check initFromStorage() at AccountSelectorStorageInit
        const saveOutcome = await actions.current.saveToStorage({
          trigger: 'selection-effect',
          selectedAccount,
          sceneName,
          sceneUrl,
          num,
          selectedAccountUpdatedAt: updateMeta?.updatedAt,
        });
        if (!completedAutoSaveOutcomes.has(saveOutcome)) {
          return;
        }
      } catch (error) {
        // Upstream let this reject into an unhandled rejection, which at least
        // reached Sentry. Now that the caller swallows it, the loss would be
        // invisible: the revision below is left untouched, so the next
        // selection change retries, but standing still keeps the stale account.
        const errorName = (error as Error | undefined)?.name;
        const slot = takeActiveReloadFailureLogSlot({
          errorName,
          key: selectionSaveKey,
        });
        if (slot) {
          defaultLogger.accountSelector.failure.selectionSaveFailed({
            consecutiveFailures: slot.consecutiveFailures,
            errorMessage: (error as Error | undefined)?.message,
            errorName,
            num,
            previousFailures: slot.previousFailures,
            sceneName,
          });
        }
        return;
      }
      const failuresBeforeRecovery =
        takeActiveReloadRecoveryLogSlot(selectionSaveKey);
      if (failuresBeforeRecovery !== undefined) {
        defaultLogger.accountSelector.failure.selectionSaveRecovered({
          failuresBeforeRecovery,
          num,
          sceneName,
        });
      }
      lastAutoSavedUpdatedAtRef.current = updateMeta?.updatedAt;
      lastAutoSavedSelectionRef.current = selectedAccount;
    } else {
      if (isAccountSelectorPerfDebugEnabled()) {
        defaultLogger.accountSelector.perf.trace('selectionStorageSkipped', {
          effectInstanceId: effectInstanceIdRef.current,
          num,
          outcome: ESelectionStorageEffectOutcome.SkipDefaultSelection,
          sceneName,
          trigger: 'selection-effect',
        });
      }
    }
  }, [
    actions,
    isReady,
    isSelectedAccountDefaultValue,
    isStorageInitDone,
    num,
    sceneName,
    sceneUrl,
    selectedAccount,
    updateMeta,
  ]);

  useEffect(() => {
    void autoSaveToStorage().catch(() => undefined);
  }, [autoSaveToStorage]);

  // Mirror-shrink safety net (non-extension targets): when the last sibling UI
  // holding a num releases it, JotaiContextStoreMirrorTracker shrinks
  // enabledNum and unmounts this effects instance. A selection a sibling wrote
  // for this num just before the shrink may not have been saved yet — the
  // auto-save effect above is gone and nothing re-triggers the save, so a
  // process kill inside that window loses the selection. Flush once on
  // unmount. The comparison and the flush read the store directly (not render
  // closures): the write that opened the window may have landed in the same
  // React batch as the unmount and never reached a committed render.
  // lastAutoSavedSelectionRef is a mutable ref updated on save success, so it
  // is not subject to closure staleness; when it already matches the store the
  // window is closed and the flush is skipped. A redundant flush is safe:
  // saveToStorage's ready gate, default-selection gate, already-saved noop and
  // isPayloadStillCurrent checks collapse it (including a race with
  // confirmAccountSelect's explicit save) into a no-op. Fire-and-forget by
  // necessity — cleanups cannot await — and safe after unmount because the
  // jotai context store and the bound setter outlive this component.
  useEffect(
    () => () => {
      if (!storageInitDoneRef.current) {
        return;
      }
      const currentSelectedAccount = actions.current.getSelectedAccount({
        num,
      });
      if (
        isSameSelectedAccount(
          lastAutoSavedSelectionRef.current,
          currentSelectedAccount,
        )
      ) {
        return;
      }
      void actions.current
        .flushSelectionSaveForNum({
          num,
          sceneName,
          sceneUrl,
        })
        .catch(() => undefined);
    },
    [actions, num, sceneName, sceneUrl],
  );

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
    if (
      !transitionMeta.changedFields.some((field) =>
        activeReloadFieldSet.has(field),
      ) &&
      isAccountSelectorPerfDebugEnabled()
    ) {
      defaultLogger.accountSelector.perf.trace('activeReloadNotRequired', {
        changedFields: transitionMeta.changedFields,
        effectInstanceId: effectInstanceIdRef.current,
        num,
        reason: transitionMeta.reason,
        sceneName,
        transitionId: transitionMeta.transitionId,
      });
    }
  }, [num, sceneName, selectedAccount]);

  useEffect(() => {
    const updateNetwork = (params: {
      networkId: string;
      sceneName: string;
      sceneUrl: string;
      num: number;
    }) => {
      // Deliberately not filtered by this instance's num: the event targets
      // params.num, and any mounted sibling instance must be able to apply it
      // in case the instance for that num does not exist. Duplicate handling
      // by multiple instances collapses into a noop in updateSelectedAccount.
      if (
        params.sceneName === sceneNameRef.current &&
        params.sceneUrl === sceneUrlRef.current
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
  }, [actions, scheduleActiveAccountReload]);

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
        // Not filtered by this instance's num on purpose: every read and write
        // below is keyed by eventPayload.num, so any mounted sibling instance
        // handles the event correctly when the instance for that num does not
        // exist. Duplicates and out-of-order bursts are absorbed by the
        // compare-if-newer guard (`eventUpdatedAt`) inside the update mutex.
        // @ts-ignore
        eventPayload?.$$isRemoteEvent // ext background event emit
      ) {
        const eventPayloadUpdatedAt = eventPayload.selectedAccountUpdatedAt;
        const currentUpdatedAt = store?.get(accountSelectorUpdateMetaAtom())?.[
          eventPayload.num
        ]?.updatedAt;

        defaultLogger.accountSelector.storage.syncSceneData({
          selectedAccount: eventPayload.selectedAccount,
          eventPayloadUpdatedAt,
          currentUpdatedAt,
        });

        // Cheap early exit for an event already visibly older than the
        // committed selection. Only an optimization: this read happens outside
        // the update mutex and can go stale, so the authoritative verdict is
        // the `eventUpdatedAt` comparison inside the mutex.
        let shouldUpdateAtom = true;
        if (
          eventPayloadUpdatedAt &&
          currentUpdatedAt &&
          currentUpdatedAt > eventPayloadUpdatedAt
        ) {
          shouldUpdateAtom = false;
        }

        if (shouldUpdateAtom) {
          await actions.current.updateSelectedAccount({
            // An event without a revision maps to null: apply only into an
            // unversioned slot, never over a committed revision.
            eventUpdatedAt: eventPayloadUpdatedAt ?? null,
            num: eventPayload.num,
            parentOperationId: eventPayload.sourceOperationId,
            reason: 'syncSceneData',
            builder: () => eventPayload.selectedAccount,
            updateMeta: {
              eventEmitDisabled: true, // avoid infinite loop: event -> updateSelectedAccount -> event
              sourceRuntimeId: eventPayload.sourceRuntimeId,
              // The source revision, not the receive time: later events from
              // the peer runtime are only comparable against what we commit
              // here if this revision is the one the event was emitted with.
              // No Date.now() fallback - an unversioned event stays
              // unversioned (the commit path leaves the revision unset for
              // eventUpdatedAt: null), so a later event carrying a real
              // revision can still win instead of losing to our receive time.
              updatedAt: eventPayloadUpdatedAt,
            },
          });
        }
      }

      await syncHomeAndSwap(eventPayload);
    },
    [actions, sceneName, sceneUrl, store, syncHomeAndSwap],
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
    <>
      <AccountSelectorEffectsPerfCommitObserver
        effectInstanceId={effectInstanceId}
        num={num}
        sceneName={sceneName}
      />
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
    </>
  ) : null;
}

export const AccountSelectorEffects = memo(AccountSelectorEffectsCmp);
