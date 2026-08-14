import { useEffect } from 'react';

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
import {
  getAccountSelectorPerfTimestamp,
  getNextAccountSelectorPerfOperationId,
  isAccountSelectorPerfDebugEnabled,
} from '../../../states/jotai/contexts/accountSelector/perfDebug';

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

  // Sync the global derive type first, then resolve a network fallback only
  // when no global choice exists. Keeping the steps in one task avoids two
  // concurrent global-derive RPCs after a network change.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isReady || !networkId || isOthersWallet) {
        return;
      }
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const stageMs: Record<string, number> = {};
      let phase = 'sync-global';
      let resultLogged = false;
      const logResult = (outcome: string, transitionId?: number) => {
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
          trigger: 'network-change',
        });
      };
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('autoDeriveRequested', {
          num,
          operationId,
          sceneName,
          trigger: 'network-change',
        });
      }
      try {
        let stageStartedAt = perfEnabled
          ? getAccountSelectorPerfTimestamp()
          : 0;
        const globalSyncResult =
          await actions.current.syncLocalDeriveTypeFromGlobal({
            num,
            parentOperationId: operationId,
            sceneName,
            sceneUrl,
            source: 'network-change',
          });
        if (perfEnabled) {
          stageMs.syncGlobal = Math.round(
            getAccountSelectorPerfTimestamp() - stageStartedAt,
          );
        }
        if (cancelled) {
          logResult('cancelled');
          return;
        }
        if (globalSyncResult.globalDeriveType) {
          logResult(
            `global-${globalSyncResult.selectionResult?.outcome || 'resolved'}`,
            globalSyncResult.selectionResult?.transitionId,
          );
          return;
        }
        if (deriveInfo) {
          logResult('skip-existing-derive');
          return;
        }
        const expectedSelection = actions.current.getSelectedAccount({ num });
        if (expectedSelection.networkId !== networkId) {
          logResult('stale-network');
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
          logResult('no-derive-options');
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
          logResult('cancelled');
          return;
        }
        phase = 'update-selection';
        const selectionResult =
          await actions.current.updateSelectedAccountDeriveType({
            num,
            deriveType: newDeriveType,
            expectedSelection,
            parentOperationId: operationId,
            reason: 'autoDeriveFallback',
          });
        logResult(selectionResult.outcome, selectionResult.transitionId);
      } catch {
        logResult(cancelled ? 'cancelled' : 'error');
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
      void actions.current
        .syncLocalDeriveTypeFromGlobal({
          num,
          sceneName,
          sceneUrl,
          source: 'global-event',
        })
        .catch(() => undefined);
    };
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    };
  }, [actions, isOthersWallet, isReady, networkId, num, sceneName, sceneUrl]);
}
