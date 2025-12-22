import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEmpty, uniqBy } from 'lodash';

import { useMedia, useTabIsRefreshingFocused } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useCurrencyPersistAtom,
  useNotificationsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HISTORY_PAGE_SIZE,
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
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { NotificationEnableAlert } from '../../../components/NotificationEnableAlert';
import { TxHistoryListView } from '../../../components/TxHistoryListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextHistoryList,
  useHistoryListActions,
} from '../../../states/jotai/contexts/historyList';
import { useAllTokenListMapAtom } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { onHomePageRefresh } from '../components/PullToRefresh';

function TxHistoryListContainer(
  params:
    | {
        plainMode?: boolean;
        tableLayout?: boolean;
        limit?: number;
        emptyTitle?: string;
        emptyDescription?: string;
      }
    | undefined,
) {
  const { plainMode, tableLayout, limit, emptyTitle, emptyDescription } =
    params ?? {};

  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const {
    updateSearchKey,
    updateAddressesInfo,
    initAddressesInfoDataFromStorage,
    setHasMoreOnChainHistory,
  } = useHistoryListActions().current;
  const { updateAllNetworksState } = useAccountOverviewActions().current;

  const [allTokenListMap] = useAllTokenListMapAtom();

  const [historyData, setHistoryData] = useState<IAccountHistoryTx[]>([]);

  const [historyState, setHistoryState] = useState({
    initialized: false,
    isRefreshing: false,
  });

  const refreshAllNetworksHistory = useRef(false);

  const media = useMedia();
  const navigation = useAppNavigation();
  const {
    activeAccount: {
      account,
      network,
      wallet,
      deriveInfoItems,
      vaultSettings,
      indexedAccount,
    },
  } = useActiveAccount({ num: 0 });

  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ txHistoryAlertDismissed }] = useNotificationsAtom();

  const updateHistoryData = useCallback(
    (txs: IAccountHistoryTx[]) => {
      if (limit) {
        const tempTxs: IAccountHistoryTx[] = [];
        let tempLimit = 0;

        for (let i = 0; i < txs.length; i += 1) {
          const tx = txs[i];
          if (tx.decodedTx.status !== EDecodedTxStatus.Pending) {
            tempLimit += 1;
          }
          tempTxs.push(tx);
          if (tempLimit >= limit) {
            break;
          }
        }
        setHistoryData(tempTxs);
      } else {
        setHistoryData(txs);
      }
    },
    [limit],
  );

  const mergeDeriveAddressData =
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1 &&
    vaultSettings?.mergeDeriveAssetsEnabled;

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
      if (!network) return;

      let accountId = account?.id ?? '';

      if (mergeDeriveAddressData) {
        accountId = indexedAccount?.id ?? '';
      } else if (!account) return;

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.HISTORY,
        accountId,
        networkId: network.id,
      });

      let r: {
        allAccounts: IAllNetworkAccountInfo[];
        txs: IAccountHistoryTx[];
        accountsWithChangedPendingTxs: {
          accountId: string;
          networkId: string;
        }[];
        addressMap?: Record<string, IAddressBadge>;
        hasMoreOnChainHistory?: boolean;
      } = {
        allAccounts: [],
        txs: [],
        accountsWithChangedPendingTxs: [],
        addressMap: {},
        hasMoreOnChainHistory: false,
      };

      if (mergeDeriveAddressData) {
        let hasMoreOnChainHistory = false;
        const { networkAccounts } =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId: network.id,
              indexedAccountId: indexedAccount?.id ?? '',
              excludeEmptyAccount: true,
            },
          );
        const resp = await Promise.all(
          networkAccounts.map((networkAccount) =>
            backgroundApiProxy.serviceHistory.fetchAccountHistory({
              accountId: networkAccount.account?.id ?? '',
              networkId: network.id,
              isManualRefresh: isManualRefresh.current,
              filterScam: settings.isFilterScamHistoryEnabled,
              filterLowValue: settings.isFilterLowValueHistoryEnabled,
              sourceCurrency: settings.currencyInfo.id,
              currencyMap,
              limit,
            }),
          ),
        );

        resp.forEach((item) => {
          r.txs = [...r.txs, ...item.txs];
          r.allAccounts = [...r.allAccounts, ...item.allAccounts];
          r.accountsWithChangedPendingTxs = [
            ...r.accountsWithChangedPendingTxs,
            ...item.accountsWithChangedPendingTxs,
          ];
          r.addressMap = { ...r.addressMap, ...item.addressMap };
          if (item.hasMoreOnChainHistory) {
            hasMoreOnChainHistory = true;
          }
        });

        r.txs = r.txs
          .sort(
            (b, a) =>
              (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
              (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
          )
          .slice(0, HISTORY_PAGE_SIZE);
        setHasMoreOnChainHistory(hasMoreOnChainHistory);
        updateAddressesInfo({
          data: r.addressMap ?? {},
        });
      } else {
        r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId,
          networkId: network.id,
          isManualRefresh: isManualRefresh.current,
          filterScam: settings.isFilterScamHistoryEnabled,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          excludeTestNetwork: true,
          sourceCurrency: settings.currencyInfo.id,
          currencyMap,
          limit,
        });
        setHasMoreOnChainHistory(!!r.hasMoreOnChainHistory);
        updateAddressesInfo({
          data: r.addressMap ?? {},
        });
      }

      updateAllNetworksState({
        visibleCount: uniqBy(r.allAccounts, 'networkId').length,
      });

      setHistoryState({
        initialized: true,
        isRefreshing: false,
      });
      setIsHeaderRefreshing(false);
      updateHistoryData(r.txs);

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.HISTORY,
        accountId,
        networkId: network.id,
      });
      if (r.accountsWithChangedPendingTxs.length > 0) {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
          accounts: r.accountsWithChangedPendingTxs,
        });
      }
      isManualRefresh.current = false;
    },
    [
      network,
      account,
      mergeDeriveAddressData,
      updateAllNetworksState,
      setIsHeaderRefreshing,
      indexedAccount?.id,
      updateAddressesInfo,
      settings.isFilterScamHistoryEnabled,
      settings.isFilterLowValueHistoryEnabled,
      settings.currencyInfo.id,
      currencyMap,
      setHasMoreOnChainHistory,
      limit,
      updateHistoryData,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  useEffect(() => {
    const initHistoryState = async (
      accountId: string,
      networkId: string,
      indexedAccountId: string | undefined,
    ) => {
      let accountHistoryTxs: IAccountHistoryTx[] = [];

      if (mergeDeriveAddressData) {
        const { networkAccounts } =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId,
              indexedAccountId: indexedAccountId ?? '',
              excludeEmptyAccount: true,
            },
          );

        const resp = await Promise.all(
          networkAccounts.map((networkAccount) =>
            backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
              accountId: networkAccount.account?.id ?? '',
              networkId,
              filterScam: settings.isFilterScamHistoryEnabled,
              filterLowValue: settings.isFilterLowValueHistoryEnabled,
              sourceCurrency: settings.currencyInfo.id,
              currencyMap,
            }),
          ),
        );
        accountHistoryTxs = resp
          .flat()
          .sort(
            (b, a) =>
              (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
              (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
          )
          .slice(0, HISTORY_PAGE_SIZE);
      } else {
        accountHistoryTxs =
          await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
            accountId,
            networkId,
            filterScam: settings.isFilterScamHistoryEnabled,
            filterLowValue: settings.isFilterLowValueHistoryEnabled,
            excludeTestNetwork: true,
            sourceCurrency: settings.currencyInfo.id,
            currencyMap,
          });
      }

      if (!isEmpty(accountHistoryTxs)) {
        updateHistoryData(accountHistoryTxs);
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
    if ((account?.id || mergeDeriveAddressData) && network?.id && wallet?.id) {
      void initHistoryState(
        account?.id ?? '',
        network.id,
        indexedAccount?.id ?? '',
      );
    }
  }, [
    account?.id,
    indexedAccount?.id,
    mergeDeriveAddressData,
    network?.id,
    settings.isFilterScamHistoryEnabled,
    settings.isFilterLowValueHistoryEnabled,
    updateHistoryData,
    updateSearchKey,
    wallet?.id,
    settings.currencyInfo.id,
    currencyMap,
    limit,
  ]);

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

    const reloadCallback = () => run({ alwaysSetState: true });

    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    appEventBus.on(
      EAppEventBusNames.ClearLocalHistoryPendingTxs,
      clearCallback,
    );
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, refresh);

    return () => {
      appEventBus.off(
        EAppEventBusNames.ClearLocalHistoryPendingTxs,
        clearCallback,
      );
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, refresh);
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    };
  }, [isFocused, run]);

  useEffect(() => {
    void initAddressesInfoDataFromStorage();
  }, [initAddressesInfoDataFromStorage]);

  const listHeaderComponent = useMemo(
    () => <NotificationEnableAlert scene="txHistory" />,
    [],
  );

  return (
    <TxHistoryListView
      key={`tx-history-${txHistoryAlertDismissed ? 'dismissed' : 'shown'}`}
      plainMode={plainMode}
      isTabFocused={isFocused}
      showIcon
      inTabList
      hideValue
      onRefresh={onHomePageRefresh}
      data={historyData ?? []}
      onPressHistory={handleHistoryItemPress}
      showHeader
      showFooter
      walletId={wallet?.id}
      accountId={account?.id}
      networkId={network?.id}
      indexedAccountId={indexedAccount?.id}
      isLoading={historyState.isRefreshing}
      initialized={historyState.initialized}
      tableLayout={tableLayout ?? media.gtLg}
      listViewStyleProps={{
        contentContainerStyle: {
          mt: '$3',
        },
      }}
      tokenMap={allTokenListMap}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      ListHeaderComponent={listHeaderComponent}
    />
  );
}

const TxHistoryListContainerWithProvider = memo(() => {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <ProviderJotaiContextHistoryList>
        <TxHistoryListContainer />
      </ProviderJotaiContextHistoryList>
    </HomeTokenListProviderMirrorWrapper>
  );
});
TxHistoryListContainerWithProvider.displayName =
  'TxHistoryListContainerWithProvider';

export { TxHistoryListContainer, TxHistoryListContainerWithProvider };
