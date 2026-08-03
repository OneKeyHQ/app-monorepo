import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { maybeOpenPrivateSendHistoryDetail } from '../../../Swap/utils/privateSendHistory';
import { createHomeAuthorityId } from '../core/homeIdentity';
import { HOME_HISTORY_ACTION_IDS } from '../sections/history/homeHistoryStoreModel';

import type { IHomeStoreIntent } from '../store/homeStoreTypes';

export function useHomeHistoryIntents() {
  const facts = useHomeFacts();
  const historySection = useHomeSection('history');
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();

  const dispatchHistoryIntent = useCallback(
    (
      intent: Omit<
        Extract<
          IHomeStoreIntent,
          { type: 'sectionActionInvoked' | 'sectionRefreshRequested' }
        >,
        'authority' | 'intentId' | 'owner' | 'sectionId' | 'sessionId'
      >,
    ) => {
      if (!facts) {
        return false;
      }
      const effects = dispatchHomeIntent({
        ...intent,
        authority: {
          kind: 'sectionCommands',
          revision: historySection.sectionCommandRevision,
          sectionId: 'history',
        },
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sectionId: 'history',
        sessionId: facts.ownerToken.sessionId,
      } as IHomeStoreIntent);
      return !effects.some((effect) => effect.kind === 'traceReject');
    },
    [dispatchHomeIntent, facts, historySection.sectionCommandRevision],
  );

  const refresh = useCallback(() => {
    dispatchHistoryIntent({
      type: 'sectionRefreshRequested',
      actionId: HOME_HISTORY_ACTION_IDS.refresh,
      execution: 'controller',
    });
  }, [dispatchHistoryIntent]);

  const loadMore = useCallback(() => {
    dispatchHistoryIntent({
      type: 'sectionActionInvoked',
      actionId: HOME_HISTORY_ACTION_IDS.loadMore,
      execution: 'controller',
    });
  }, [dispatchHistoryIntent]);

  const openDetails = useCallback(
    async (history: IAccountHistoryTx) => {
      if (
        !account ||
        !network ||
        !dispatchHistoryIntent({
          type: 'sectionActionInvoked',
          actionId: HOME_HISTORY_ACTION_IDS.openDetails,
          execution: 'caller',
          itemId: history.id,
        })
      ) {
        return;
      }
      if (
        history.decodedTx.status === EDecodedTxStatus.Pending &&
        history.isLocalCreated
      ) {
        const localTx =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId: history.decodedTx.accountId,
            historyId: history.id,
            networkId: history.decodedTx.networkId,
          });
        if (!localTx || localTx.replacedNextId) {
          return;
        }
      }
      const openedPrivateSendHistory = await maybeOpenPrivateSendHistoryDetail({
        accountAddress: account.address,
        accountId: history.decodedTx.accountId,
        currencySymbol: settings.currencyInfo.symbol,
        historyTx: history,
        navigation,
        network,
      });
      if (openedPrivateSendHistory) {
        return;
      }
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.HistoryDetails,
        params: {
          accountId: history.decodedTx.accountId,
          historyTx: history,
          isAllNetworks: network.isAllNetworks,
          networkId: history.decodedTx.networkId,
        },
      });
    },
    [
      account,
      dispatchHistoryIntent,
      navigation,
      network,
      settings.currencyInfo.symbol,
    ],
  );

  return { loadMore, openDetails, refresh };
}
