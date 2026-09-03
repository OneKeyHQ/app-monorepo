import { useEffect, useRef } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';
import { EAutoSelectDeriveTypeOutcome } from '../../../states/jotai/contexts/accountSelector/outcomes';
import {
  getAccountSelectorPerfTimestamp,
  getNextAccountSelectorPerfOperationId,
  isAccountSelectorPerfDebugEnabled,
} from '../../../states/jotai/contexts/accountSelector/perfDebug';

import type { IAutoSelectDeriveTypeOutcome } from '../../../states/jotai/contexts/accountSelector/outcomes';

export function useAutoSelectDeriveType({ num }: { num: number }) {
  const {
    activeAccount: { deriveInfo, network, isOthersWallet },
  } = useActiveAccount({ num });
  if (deriveInfo) {
    // console.log('useAutoSelectDeriveType deriveInfo: ', deriveInfo);
  }
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const { serviceNetwork } = backgroundApiProxy;
  const networkId = network?.id;
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const networkGlobalSyncRef = useRef<
    | {
        networkId: string;
        promise: Promise<unknown>;
      }
    | undefined
  >(undefined);

  // Global state only needs reconciling when the active network changes.
  // Keeping deriveInfo out of these deps prevents account-info rebuilds from
  // issuing the same background RPC again.
  useEffect(() => {
    let cancelled = false;
    if (!isReady || !networkId || isOthersWallet) {
      networkGlobalSyncRef.current = undefined;
      return;
    }
    const perfEnabled = isAccountSelectorPerfDebugEnabled();
    const operationId = perfEnabled
      ? getNextAccountSelectorPerfOperationId()
      : undefined;
    const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
    if (perfEnabled) {
      defaultLogger.accountSelector.perf.trace('autoDeriveRequested', {
        num,
        operationId,
        sceneName,
        trigger: 'network-change',
      });
    }
    const promise = actions.current.syncLocalDeriveTypeFromGlobal({
      num,
      parentOperationId: operationId,
      sceneName,
      sceneUrl,
      source: 'network-change',
    });
    networkGlobalSyncRef.current = { networkId, promise };
    void promise
      .then((result) => {
        if (cancelled || !perfEnabled) {
          return;
        }
        defaultLogger.accountSelector.perf.trace('autoDeriveResult', {
          num,
          operationId,
          outcome: result.globalDeriveType
            ? `global-${result.selectionResult?.outcome || 'resolved'}`
            : EAutoSelectDeriveTypeOutcome.NoGlobalDerive,
          phase: 'sync-global',
          sceneName,
          stageMs: {
            syncGlobal: Math.round(
              getAccountSelectorPerfTimestamp() - requestedAt,
            ),
          },
          totalMs: Math.round(getAccountSelectorPerfTimestamp() - requestedAt),
          transitionId: result.selectionResult?.transitionId,
          trigger: 'network-change',
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          defaultLogger.app.error.log(
            `[useAutoSelectDeriveType] global derive type sync failed: ${
              (error as Error | undefined)?.message ?? String(error)
            }`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [actions, isOthersWallet, isReady, networkId, num, sceneName, sceneUrl]);

  // Resolve a fallback whenever the current active account has no derive
  // information. This remains reactive to deriveInfo disappearing on the same
  // network, but waits for that network's one global reconciliation first.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isReady || !networkId || isOthersWallet || deriveInfo) {
        return;
      }
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const stageMs: Record<string, number> = {};
      let phase = 'wait-global';
      let resultLogged = false;
      const logResult = (
        outcome: IAutoSelectDeriveTypeOutcome,
        transitionId?: number,
      ) => {
        if (!perfEnabled || resultLogged) {
          return;
        }
        resultLogged = true;
        defaultLogger.accountSelector.perf.trace('autoDeriveResult', {
          num,
          operationId,
          outcome,
          phase,
          sceneName,
          stageMs,
          totalMs: Math.round(getAccountSelectorPerfTimestamp() - requestedAt),
          transitionId,
          trigger: 'derive-missing',
        });
      };
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('autoDeriveRequested', {
          num,
          operationId,
          sceneName,
          trigger: 'derive-missing',
        });
      }
      try {
        let stageStartedAt = perfEnabled
          ? getAccountSelectorPerfTimestamp()
          : 0;
        const globalSync = networkGlobalSyncRef.current;
        if (globalSync?.networkId === networkId) {
          await globalSync.promise.catch(() => undefined);
        }
        if (perfEnabled) {
          stageMs.waitGlobal = Math.round(
            getAccountSelectorPerfTimestamp() - stageStartedAt,
          );
        }
        if (cancelled) {
          logResult(EAutoSelectDeriveTypeOutcome.Cancelled);
          return;
        }
        const expectedSelection = actions.current.getSelectedAccount({ num });
        if (expectedSelection.deriveType) {
          logResult(EAutoSelectDeriveTypeOutcome.SkipExistingDerive);
          return;
        }
        if (expectedSelection.networkId !== networkId) {
          logResult(EAutoSelectDeriveTypeOutcome.StaleNetwork);
          return;
        }
        phase = 'get-derive-options';
        stageStartedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
        const deriveInfoItems =
          await serviceNetwork.getDeriveInfoItemsOfNetwork({
            networkId,
          });
        if (perfEnabled) {
          stageMs.getDeriveOptions = Math.round(
            getAccountSelectorPerfTimestamp() - stageStartedAt,
          );
        }
        if (!deriveInfoItems.length) {
          logResult(EAutoSelectDeriveTypeOutcome.NoDeriveOptions);
          return;
        }
        phase = 'resolve-fallback';
        stageStartedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
        const fallbackDeriveType = expectedSelection.networkId
          ? await serviceNetwork.getDeriveTypeOrFallbackToGlobal({
              deriveType: undefined,
              networkId: expectedSelection.networkId,
            })
          : undefined;
        if (perfEnabled) {
          stageMs.resolveFallback = Math.round(
            getAccountSelectorPerfTimestamp() - stageStartedAt,
          );
        }
        const newDeriveType =
          fallbackDeriveType ||
          (deriveInfoItems[0]?.value as IAccountDeriveTypes) ||
          'default';
        if (cancelled) {
          logResult(EAutoSelectDeriveTypeOutcome.Cancelled);
          return;
        }
        phase = 'update-selection';
        const selectionResult =
          await actions.current.updateSelectedAccountDeriveType({
            num,
            deriveType: newDeriveType,
            // Scoped to the network only: this effect does not re-run when the
            // account changes, so a full-selection guard would drop the fallback
            // for good and leave the account without a derive type.
            expectedNetworkId: networkId,
            parentOperationId: operationId,
            reason: 'autoDeriveFallback',
          });
        logResult(selectionResult.outcome, selectionResult.transitionId);
      } catch (error) {
        logResult(
          cancelled
            ? EAutoSelectDeriveTypeOutcome.Cancelled
            : EAutoSelectDeriveTypeOutcome.Error,
        );
        if (!cancelled) {
          // logResult is perf-debug gated, so in production a failure here
          // leaves no trace while the account keeps no derive type until the
          // user switches network again. A cancelled run re-fires with the new
          // deps and recovers on its own, so only the surviving run is logged.
          defaultLogger.app.error.log(
            `[useAutoSelectDeriveType] auto derive type failed at phase=${phase}: ${
              (error as Error | undefined)?.message ?? String(error)
            }`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    actions,
    deriveInfo,
    isOthersWallet,
    isReady,
    networkId,
    num,
    sceneName,
    sceneUrl,
    serviceNetwork,
  ]);

  // ******** two way sync with global derive type

  // **** selectedAccount.deriveType -> globalDeriveType
  //      (use actions.current.saveToStorage instead, useEffect cause infinite loop)

  // **** globalDeriveType -> selectedAccount.deriveType
  useEffect(() => {
    if (!isReady || isOthersWallet) {
      return;
    }
    const fn = (payload: unknown) => {
      const networkImpl =
        payload &&
        typeof payload === 'object' &&
        'networkImpl' in payload &&
        typeof payload.networkImpl === 'string'
          ? payload.networkImpl
          : undefined;
      if (
        networkImpl &&
        (!networkId ||
          networkUtils.getNetworkImpl({ networkId }) !== networkImpl)
      ) {
        return;
      }
      // Deliberately no retry on a stale sync result. The event carries no
      // value — the sync re-reads the authoritative global value and applies
      // it under a narrow (networkId, deriveType) CAS — so it is a
      // level-triggered idempotent reconciliation, and every change that can
      // still drop it ships its own structural successor:
      //   (a) networkId changed mid-sync -> the network-change effect above
      //       re-runs for the new network and issues a fresh sync;
      //   (b) the user changed deriveType mid-sync -> dropping is the correct
      //       semantics (user intent wins), and their value propagates through
      //       saveGlobalDeriveType into a new global value + a new event;
      //   (c) a peer selection sync wrote the same deriveType -> both sides
      //       already agree and the next change reconciles naturally.
      // A failure-driven retry would add cross-runtime interleaving risk (each
      // UI runtime receives this event and would retry independently) for a
      // window every drop already covers.
      void actions.current
        .syncLocalDeriveTypeFromGlobal({
          num,
          sceneName,
          sceneUrl,
          source: 'global-event',
        })
        .catch((error: unknown) => {
          // Nothing retries this: the listener only runs again on the next
          // global derive type event, so a failure leaves the local selection
          // out of sync until the user changes the derive type themselves.
          defaultLogger.app.error.log(
            `[useAutoSelectDeriveType] global derive type sync failed: ${
              (error as Error | undefined)?.message ?? String(error)
            }`,
          );
        });
    };
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    };
  }, [actions, isOthersWallet, isReady, networkId, num, sceneName, sceneUrl]);
}
