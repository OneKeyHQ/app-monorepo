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

  // Stable string capturing the source identity tuple. Both the init effect
  // (short-circuit guard) and the dep-change effect (counter bump) consume
  // this so they cannot drift apart on what counts as an identity change.
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

  // Monotonic request id. Bumped on identity dep changes (via the effect
  // below) AND at the start of every `run()` body — so old in-flight fetches
  // are invalidated *before* the next debounced runner even starts, and
  // early-return runs (no network / no account) still produce a fresh id
  // that older runs can compare against.
  const fetchRequestIdRef = useRef(0);
  const { run } = usePromiseResult(
    async () => {
      // Bump UNCONDITIONALLY, before any early return, so an older in-flight
      // run cannot survive across an identity change just because the new
      // run happened to early-return (no account/network). The captured
      // `requestId` is used everywhere below to gate state writes.
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
        } = {
          allAccounts: [],
          txs: [],
          accountsWithChangedTxs: [],
          addressMap: {},
          hasMoreOnChainHistory: false,
          next: undefined,
        };
        let aggregatedHasMoreOnChainHistory = false;

        // Set BEFORE emit so a throwing handler can't strand earlier
        // subscribers that already received the `true` event.
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

        setHasMoreOnChainHistory(aggregatedHasMoreOnChainHistory);
        updateAddressesInfo({
          data: r.addressMap ?? {},
        });
        // Seed the load-more hook with the freshest cursor/hasMore. Must be
        // gated behind isCurrentRequest() (above) so a superseded fetch can't
        // overwrite the new identity's load-more state.
        onFirstPageResponse({
          next: r.next,
          hasMore: aggregatedHasMoreOnChainHistory,
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
        // Always release the request-level latch regardless of error / abort
        // / supersession, otherwise the next polling tick would be wrongly
        // marked as a manual refresh (forcing an on-chain fetch).
        isManualRefresh.current = false;
        // emit-false must mirror emit-true so subscribers are released.
        if (emittedTrue) {
          appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
            isRefreshing: false,
            type: EHomeTab.HISTORY,
            accountId: refreshAccountId,
            networkId: refreshNetworkId,
          });
        }
        // Only the freshest run owns the header refresh indicator.
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
      setHasMoreOnChainHistory,
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

  // Identity of the last in-flight `initHistoryState`. `null` means no init
  // is owned by the current identity (initial mount or identity went
  // invalid). Async reads compare their captured identity against this ref
  // to bail out if a faster identity switch already took ownership.
  const lastInitIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    const initHistoryState = async ({
      accountId,
      networkId,
      indexedAccountId,
      capturedIdentity,
    }: {
      accountId: string;
      networkId: string;
      indexedAccountId?: string;
      capturedIdentity: string;
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

      // Bail out if a faster identity switch already took ownership while we
      // were awaiting — same rationale as the monotonic guard in `run()`.
      if (lastInitIdentityRef.current !== capturedIdentity) {
        return;
      }

      if (!isEmpty(accountHistoryTxs)) {
        updateHistoryData(accountHistoryTxs);
        setHistoryState({
          initialized: true,
          isRefreshing: false,
        });
      } else {
        // No local cache for the new identity — drop any rows still hanging
        // around from the previous account so the user sees a clean skeleton
        // (driven by initialized=false) instead of stale data while the
        // first-page fetch is in flight. Same-reference short-circuit avoids
        // a redundant re-render when state is already empty.
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
      if (lastInitIdentityRef.current === identityKey) {
        // Same identity — let the body refresh; no need to re-clear local
        // state.
        return;
      }
      lastInitIdentityRef.current = identityKey;
      void initHistoryState({
        accountId: account?.id ?? '',
        networkId: network.id,
        indexedAccountId: indexedAccount?.id ?? '',
        capturedIdentity: identityKey,
      });
    } else {
      // Identity went invalid (account/network/wallet became null during a
      // transition). Release ownership so any awaiting `initHistoryState`
      // from the previous valid identity bails out instead of writing stale
      // rows into the new identity's state.
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
    limit,
    identityKey,
  ]);

  // Invalidate in-flight `run()` synchronously on identity change, so an
  // old run resolving during the ~1s `usePromiseResult` debounce window
  // can't write into the new identity's state before the next runner even
  // starts. The runner-body bump alone cannot cover this window.
  useEffect(() => {
    fetchRequestIdRef.current += 1;
  }, [identityKey]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      resetLoadMore();
      void run();
    }
  }, [isHeaderRefreshing, run, resetLoadMore]);

  // Wipe paginated state whenever the source identity changes; first-page fetch
  // will re-initialize it via onFirstPageResponse. The request-id effect above
  // already invalidates any in-flight run, so this only needs to drop the
  // load-more cursor/state.
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
