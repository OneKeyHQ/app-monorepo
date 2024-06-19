import { memo, useCallback, useEffect, useRef, useState } from 'react';

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
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { TxHistoryListView } from '../../../components/TxHistoryListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useHistoryListActions,
  withHistoryListProvider,
} from '../../../states/jotai/contexts/historyList';

function TxHistoryListContainer(props: ITabPageProps) {
  const { onContentSizeChange } = props;
  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const { updateSearchKey } = useHistoryListActions().current;

  const [historyData, setHistoryData] = useState<IAccountHistoryTx[]>([]);

  const [historyState, setHistoryState] = useState({
    initialized: false,
    isRefreshing: false,
  });

  const media = useMedia();
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const handleHistoryItemPress = useCallback(
    async (history: IAccountHistoryTx) => {
      if (!account || !network) return;
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.HistoryDetails,
        params: {
          networkId: network.id,
          accountId: account.id,
          accountAddress: account.address,
          historyTx: history,
          xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
            accountId: account.id,
            networkId: network.id,
          }),
        },
      });
    },
    [account, navigation, network],
  );

  const { run } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const [xpub, vaultSettings] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId: account.id,
          networkId: network.id,
        }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: network.id,
        }),
      ]);
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
        accountAddress: account.address,
        xpub,
        onChainHistoryDisabled: vaultSettings.onChainHistoryDisabled,
      });
      setHistoryState({
        initialized: true,
        isRefreshing: false,
      });
      setIsHeaderRefreshing(false);
      setHistoryData(r);
    },
    [account, network, setIsHeaderRefreshing],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      setHistoryState({
        initialized: false,
        isRefreshing: true,
      });
      updateSearchKey('');
    }
  }, [account?.id, network?.id, updateSearchKey, wallet?.id]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      void run();
    }
  }, [isHeaderRefreshing, run]);

  useEffect(() => {
    const callback = () => {
      setHistoryData((prev) =>
        prev.filter((tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending),
      );
    };
    appEventBus.on(EAppEventBusNames.ClearLocalHistoryPendingTxs, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.ClearLocalHistoryPendingTxs, callback);
    };
  }, []);

  return (
    <TxHistoryListView
      showIcon
      data={historyData ?? []}
      onPressHistory={handleHistoryItemPress}
      showHeader
      isLoading={historyState.isRefreshing}
      initialized={historyState.initialized}
      onContentSizeChange={onContentSizeChange}
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
