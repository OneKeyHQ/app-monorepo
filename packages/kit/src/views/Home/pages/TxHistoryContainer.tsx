import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEmpty, unionBy, uniqBy } from 'lodash';

import {
  onVisibilityStateChange,
  useMedia,
  useScrollContentTabBarOffset,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useCurrencyPersistAtom,
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextHistoryList,
  useHistoryListActions,
} from '../../../states/jotai/contexts/historyList';
import { useAllTokenListMapAtom } from '../../../states/jotai/contexts/tokenList';
import { maybeOpenPrivateSendHistoryDetail } from '../../Swap/utils/privateSendHistory';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { onHomePageRefresh } from '../components/PullToRefresh';

import { useHistoryListLoadMore } from './hooks/useHistoryListLoadMore';

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
  // Outer-route focus: false when user is on Market/Swap (Home tab inactive),
  // when a modal is presented above Home, or when the app is locked. Combined
  // below with `isFocused` (inner Home-tab) so app-resume only refreshes when
  // the user is actually looking at this list.
  const isRouteFocused = useRouteIsFocused();

  const {
    updateSearchKey,
    updateAddressesInfo,
    initAddressesInfoDataFromStorage,
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

  const isAllNetworksList = !!network?.isAllNetworks;
  // Disable load-more for All Networks (server doesn't paginate the aggregate)
  // and for preview lists that already enforce a fixed limit (e.g. Home
  // recent-history block). Merge-derive chains (BTC/LTC) now route through
  // ServiceHistory.fetchAccountHistoryForMergeDerive so they participate too.
  const loadMoreEnabled = !isAllNetworksList && !limit && !plainMode;
  const handleLoadMoreAddressMap = useCallback(
    (addressMap: Record<string, IAddressBadge>) => {
      updateAddressesInfo({ data: addressMap });
    },
    [updateAddressesInfo],
  );
  const {
    appendedTxs,
    hasMore: loadMoreHasMore,
    isLoadingMore,
    loadMore,
    reset: resetLoadMore,
    onFirstPageResponse,
  } = useHistoryListLoadMore({
    enabled: loadMoreEnabled,
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    filterScam: settings.isFilterScamHistoryEnabled,
    filterLowValue: settings.isFilterLowValueHistoryEnabled,
    excludeTestNetwork: true,
    sourceCurrency: settings.currencyInfo.id,
    currencyMap,
    limit,
    mergeDerive: mergeDeriveAddressData,
    indexedAccountId: indexedAccount?.id ?? '',
    onAddressMap: handleLoadMoreAddressMap,
  });

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

      const openedPrivateSendHistory = await maybeOpenPrivateSendHistoryDetail({
        historyTx: history,
        navigation,
        accountId: history.decodedTx.accountId,
        accountAddress: account.address,
        network,
        currencySymbol: settings.currencyInfo.symbol,
      });
      if (openedPrivateSendHistory) return;

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
    [account, navigation, network, settings.currencyInfo.symbol],
  );

  const isManualRefresh = useRef(false);

  // Stable identity tuple shared by the init guard and request-id effect so
  // they can't drift on what counts as an identity change.
  const identityKey = useMemo(
    () =>
      [
        account?.id ?? '',
        indexedAccount?.id ?? '',
        network?.id ?? '',
        wallet?.id ?? '',
        mergeDeriveAddressData ? '1' : '0',
      ].join('|'),
    [
      account?.id,
      indexedAccount?.id,
      mergeDeriveAddressData,
      network?.id,
      wallet?.id,
    ],
  );

  // Monotonic request id; bumped on identity change AND at the start of every
  // `run()` body (before any early return) so older in-flight fetches can't
  // outlive an identity switch.
  const fetchRequestIdRef = useRef(0);
  const { run } = usePromiseResult(
    async () => {
      fetchRequestIdRef.current += 1;
      const requestId = fetchRequestIdRef.current;
      const isCurrentRequest = () => fetchRequestIdRef.current === requestId;

      let emittedTrue = false;
      let refreshAccountId = '';
      let refreshNetworkId = '';

      try {
        if (!network) return;

        let accountId = account?.id ?? '';

        if (mergeDeriveAddressData) {
          accountId = indexedAccount?.id ?? '';
        } else if (!account) return;

        refreshNetworkId = network.id;
        refreshAccountId = accountId;

        let r: {
          allAccounts: IAllNetworkAccountInfo[];
          txs: IAccountHistoryTx[];
          accountsWithChangedTxs: {
            accountId: string;
            networkId: string;
          }[];
          addressMap?: Record<string, IAddressBadge>;
          hasMoreOnChainHistory?: boolean;
          next?: string;
          isIndexer?: boolean;
        } = {
          allAccounts: [],
          txs: [],
          accountsWithChangedTxs: [],
          addressMap: {},
          hasMoreOnChainHistory: false,
          next: undefined,
          isIndexer: false,
        };
        let aggregatedHasMoreOnChainHistory = false;

        emittedTrue = true;
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.HISTORY,
          accountId: refreshAccountId,
          networkId: refreshNetworkId,
        });

        if (mergeDeriveAddressData) {
          // ServiceHistory does the per-deriveType fan-out, dedupe, sort, and
          // cursor bookkeeping; we receive a single aggregate response shaped
          // identically to the single-deriveType branch, so the rest of the
          // function can treat both paths the same.
          r =
            await backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive(
              {
                indexedAccountId: indexedAccount?.id ?? '',
                networkId: network.id,
                isManualRefresh: isManualRefresh.current,
                filterScam: settings.isFilterScamHistoryEnabled,
                filterLowValue: settings.isFilterLowValueHistoryEnabled,
                excludeTestNetwork: true,
                sourceCurrency: settings.currencyInfo.id,
                currencyMap,
                limit,
              },
            );
          aggregatedHasMoreOnChainHistory = !!r.hasMoreOnChainHistory;
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
          aggregatedHasMoreOnChainHistory = !!r.hasMoreOnChainHistory;
        }

        // Skip every state write past this point if a newer fetch already
        // took over — a stale body would clobber the new identity's data.
        if (!isCurrentRequest()) {
          return;
        }

        updateAddressesInfo({
          data: r.addressMap ?? {},
        });
        onFirstPageResponse({
          next: r.next,
          hasMore: aggregatedHasMoreOnChainHistory,
          isIndexer: r.isIndexer,
        });

        updateAllNetworksState({
          visibleCount: uniqBy(r.allAccounts, 'networkId').length,
        });

        setHistoryState({
          initialized: true,
          isRefreshing: false,
        });
        updateHistoryData(r.txs);

        if (r.accountsWithChangedTxs.length > 0) {
          appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
            accounts: r.accountsWithChangedTxs,
          });
        }
      } finally {
        // Must clear unconditionally — otherwise the next polling tick would
        // be wrongly treated as a manual refresh.
        isManualRefresh.current = false;
        if (emittedTrue) {
          appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
            isRefreshing: false,
            type: EHomeTab.HISTORY,
            accountId: refreshAccountId,
            networkId: refreshNetworkId,
          });
        }
        if (isCurrentRequest()) {
          setIsHeaderRefreshing(false);
        }
      }
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
      limit,
      updateHistoryData,
      onFirstPageResponse,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
      revalidateOnFocus: true,
    },
  );

  // Owner of the current `initHistoryState`. `null` means no valid identity
  // (initial mount or transition); async reads bail when this no longer
  // matches their captured identity.
  const lastInitIdentityRef = useRef<string | null>(null);
  // Bumped on every `initHistoryState` launch so a same-identity rerun (e.g.
  // filter/currency change) supersedes any older slow read.
  const initRequestIdRef = useRef(0);
  useEffect(() => {
    const initHistoryState = async ({
      accountId,
      networkId,
      indexedAccountId,
      capturedIdentity,
      requestId,
    }: {
      accountId: string;
      networkId: string;
      indexedAccountId?: string;
      capturedIdentity: string;
      requestId: number;
    }) => {
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
          .toSorted(
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

      // Bail if a faster identity switch or a newer same-identity rerun took
      // ownership during the await — stale rows must not clobber fresh state.
      if (
        lastInitIdentityRef.current !== capturedIdentity ||
        initRequestIdRef.current !== requestId
      ) {
        return;
      }

      if (!isEmpty(accountHistoryTxs)) {
        updateHistoryData(accountHistoryTxs);
        setHistoryState({
          initialized: true,
          isRefreshing: false,
        });
      } else {
        // No local cache — drop stale rows so the skeleton shows instead of
        // the previous identity's data while the first-page fetch is in
        // flight. Same-reference short-circuit avoids a redundant render.
        setHistoryData((prev) => (prev.length === 0 ? prev : []));
        setHistoryState({
          initialized: false,
          isRefreshing: true,
        });
      }

      updateSearchKey('');
      refreshAllNetworksHistory.current = false;
    };
    if ((account?.id || mergeDeriveAddressData) && network?.id && wallet?.id) {
      // Rerun on every dep change so the local cache view stays in sync with
      // the latest filter inputs; older runs bail via the guards above.
      lastInitIdentityRef.current = identityKey;
      initRequestIdRef.current += 1;
      const requestId = initRequestIdRef.current;
      void initHistoryState({
        accountId: account?.id ?? '',
        networkId: network.id,
        indexedAccountId: indexedAccount?.id ?? '',
        capturedIdentity: identityKey,
        requestId,
      });
    } else {
      // Identity went invalid — release ownership so the prior identity's
      // awaiting init bails out instead of writing into the new state.
      lastInitIdentityRef.current = null;
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
    identityKey,
  ]);

  // Invalidate in-flight `run()` synchronously on identity change — covers the
  // ~1s `usePromiseResult` debounce window where the runner-body bump can't.
  useEffect(() => {
    fetchRequestIdRef.current += 1;
  }, [identityKey]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      resetLoadMore();
      void run();
    }
  }, [isHeaderRefreshing, run, resetLoadMore]);

  // Drop load-more cursor on identity change; first-page fetch re-seeds it.
  useEffect(() => {
    resetLoadMore();
  }, [
    account?.id,
    network?.id,
    indexedAccount?.id,
    mergeDeriveAddressData,
    settings.isFilterScamHistoryEnabled,
    settings.isFilterLowValueHistoryEnabled,
    settings.currencyInfo.id,
    resetLoadMore,
  ]);

  const combinedHistoryData = useMemo(
    () =>
      appendedTxs.length
        ? unionBy([...historyData, ...appendedTxs], (tx) => tx.id)
        : historyData,
    [historyData, appendedTxs],
  );

  const lastVisibilityRefreshAtRef = useRef(0);
  const handleRefreshOnVisibilityActive = useCallback(() => {
    const now = Date.now();
    if (
      now - lastVisibilityRefreshAtRef.current <
      POLLING_INTERVAL_FOR_HISTORY
    ) {
      return;
    }
    lastVisibilityRefreshAtRef.current = now;
    isManualRefresh.current = true;
    void run({ alwaysSetState: true });
  }, [run]);

  useEffect(() => {
    const removeSubscription = onVisibilityStateChange((visible) => {
      if (visible && isFocused && isRouteFocused) {
        handleRefreshOnVisibilityActive();
      }
    });
    return removeSubscription;
  }, [handleRefreshOnVisibilityActive, isFocused, isRouteFocused]);

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

  const tabBarHeight = useScrollContentTabBarOffset();

  // On native, the Alert renders inside the list header so it sits below the
  // sticky TabBar and scrolls with the list. On web, the same Alert renders
  // via Tabs.Container's `renderSubHeader` slot so its height changes cannot
  // invalidate the virtualized list's CellMeasurer cache mid-scroll.
  const listHeaderComponent = useMemo(
    () =>
      platformEnv.isNative ? (
        <NotificationEnableAlert scene="txHistory" />
      ) : null,
    [],
  );

  return (
    <TxHistoryListView
      plainMode={plainMode}
      isTabFocused={isFocused}
      showIcon
      inTabList
      hideValue
      onRefresh={onHomePageRefresh}
      data={combinedHistoryData}
      onPressHistory={handleHistoryItemPress}
      showHeader
      showFooter
      walletId={wallet?.id}
      accountId={account?.id}
      networkId={network?.id}
      indexedAccountId={indexedAccount?.id}
      initialized={historyState.initialized}
      tableLayout={tableLayout ?? media.gtMd}
      listViewStyleProps={{
        contentContainerStyle: {
          mt: '$3',
          pb: tabBarHeight,
        },
      }}
      tokenMap={allTokenListMap}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      ListHeaderComponent={listHeaderComponent}
      onEndReached={loadMoreEnabled ? loadMore : undefined}
      isLoadingMore={isLoadingMore}
      hasMore={loadMoreHasMore}
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
