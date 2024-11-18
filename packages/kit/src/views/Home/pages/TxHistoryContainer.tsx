import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { isEmpty } from 'lodash';

import { useMedia, useTabIsRefreshingFocused } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
// import { sortHistoryTxsByTime } from '@onekeyhq/shared/src/utils/historyUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { TxHistoryListView } from '../../../components/TxHistoryListView';
// import { useAllNetworkRequests } from '../../../hooks/useAllNetwork';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useHistoryListActions,
  withHistoryListProvider,
} from '../../../states/jotai/contexts/historyList';

function TxHistoryListContainer(props: ITabPageProps) {
  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const { updateSearchKey } = useHistoryListActions().current;

  const [historyData, setHistoryData] = useState<IAccountHistoryTx[]>([]);

  const [historyState, setHistoryState] = useState({
    initialized: false,
    isRefreshing: false,
  });

  const refreshAllNetworksHistory = useRef(false);

  const media = useMedia();
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const handleHistoryItemPress = useCallback(
    async (history: IAccountHistoryTx) => {
      if (!account || !network) return;

      if (
        history.decodedTx.status === EDecodedTxStatus.Pending &&
        history.isLocalCreated
      ) {
        const localTx =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId: history.decodedTx.accountId,
            networkId: history.decodedTx.networkId,
            historyId: history.id,
          });

        // tx has been replaced by another tx
        if (!localTx || localTx.replacedNextId) {
          return;
        }
      }

      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.HistoryDetails,
        params: {
          networkId: history.decodedTx.networkId,
          accountId: history.decodedTx.accountId,
          historyTx: history,
          isAllNetworks: network.isAllNetworks,
        },
      });
    },
    [account, navigation, network],
  );

  const isManualRefresh = useRef(false);
  const { run } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.HISTORY,
        accountId: account.id,
        networkId: network.id,
      });
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
        isManualRefresh: isManualRefresh.current,
      });
      setHistoryState({
        initialized: true,
        isRefreshing: false,
      });
      setIsHeaderRefreshing(false);
      setHistoryData(r.txs);
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.HISTORY,
        accountId: account.id,
        networkId: network.id,
      });
      if (r.accountsWithChangedPendingTxs.length > 0) {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
          accounts: r.accountsWithChangedPendingTxs,
        });
      }
      isManualRefresh.current = false;
    },
    [account, network, setIsHeaderRefreshing],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  useEffect(() => {
    const initHistoryState = async (accountId: string, networkId: string) => {
      const accountHistoryTxs =
        await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
          accountId,
          networkId,
        });

      if (!isEmpty(accountHistoryTxs)) {
        setHistoryData(accountHistoryTxs);
        setHistoryState({
          initialized: true,
          isRefreshing: false,
        });
      } else {
        setHistoryState({
          initialized: false,
          isRefreshing: true,
        });
      }

      updateSearchKey('');
      refreshAllNetworksHistory.current = false;
    };
    if (account?.id && network?.id && wallet?.id) {
      void initHistoryState(account.id, network.id);
    }
  }, [account?.id, network?.id, updateSearchKey, wallet?.id]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      void run();
    }
  }, [isHeaderRefreshing, run]);

  useEffect(() => {
    const refresh = () => {
      if (isFocused) {
        isManualRefresh.current = true;
        void run();
      }
    };
    const clearCallback = () =>
      setHistoryData((prev) =>
        prev.filter((tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending),
      );
    appEventBus.on(
      EAppEventBusNames.ClearLocalHistoryPendingTxs,
      clearCallback,
    );
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);

    return () => {
      appEventBus.off(
        EAppEventBusNames.ClearLocalHistoryPendingTxs,
        clearCallback,
      );
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
    };
  }, [isFocused, run]);

  useEffect(() => {
    const reloadCallback = () => run({ alwaysSetState: true });

    const fn = () => {
      if (isFocused) {
        void run();
      }
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, fn);

    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, fn);
    };
  }, [isFocused, run]);

  return (
    <TxHistoryListView
      showIcon
      inTabList
      hideValue
      data={historyData ?? []}
      onPressHistory={handleHistoryItemPress}
      showHeader
      isLoading={historyState.isRefreshing}
      initialized={historyState.initialized}
      {...(media.gtLg && {
        tableLayout: true,
      })}
    />
  );
}

const TxHistoryListContainerWithProvider = memo(
  withHistoryListProvider(TxHistoryListContainer),
);

export { TxHistoryListContainerWithProvider };
