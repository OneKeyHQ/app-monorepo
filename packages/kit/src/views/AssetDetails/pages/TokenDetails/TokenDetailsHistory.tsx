import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { unionBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AppPagerContent } from '@onekeyhq/kit/src/components/AppPager/AppPagerContent';
import { useAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/useAppPagerPage';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  useHistoryListActions,
  withHistoryListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/historyList';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { NativeHistoryList } from '@onekeyhq/kit/src/views/Home/components/HomeHistoryListView/NativeHistoryList';
import { useFrozenTopHistoryData } from '@onekeyhq/kit/src/views/Home/pages/hooks/useFrozenTopHistoryData';
import { useHistoryListLoadMore } from '@onekeyhq/kit/src/views/Home/pages/hooks/useHistoryListLoadMore';
import { maybeOpenPrivateSendHistoryDetail } from '@onekeyhq/kit/src/views/Swap/utils/privateSendHistory';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { TokenDetailsPaginationObserver } from './TokenDetailsPager';

import type { IProps } from '.';

const tokenHistoryCache = new cacheUtils.LRUCache<string, IAccountHistoryTx[]>({
  max: 20,
  ttl: timerUtils.getTimeDurationMs({ minute: 5 }),
  ttlAutopurge: true,
});

const TokenDetailsNativeHistoryList = withBrowserProvider(NativeHistoryList);
const historyContentPadding = { top: 0, bottom: 0 };

function TokenDetailsHistoryContent({
  focusParam,
  ...props
}: IProps & { focusParam: boolean }) {
  const navigation = useAppNavigation();

  const {
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    tokenInfo,
    ListHeaderComponent,
    isTabView,
    inTabList,
  } = props;

  const isRouteFocused = useRouteIsFocused();
  const pagerPage = useAppPagerPage();

  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { updateAddressesInfo } = useHistoryListActions().current;
  const historyCacheKey = useMemo(
    () =>
      [
        accountId,
        networkId,
        tokenInfo.address ?? '',
        settings.isFilterScamHistoryEnabled ? '1' : '0',
        settings.isFilterLowValueHistoryEnabled ? '1' : '0',
        settings.currencyInfo.id,
      ].join('_'),
    [
      accountId,
      networkId,
      tokenInfo.address,
      settings.isFilterScamHistoryEnabled,
      settings.isFilterLowValueHistoryEnabled,
      settings.currencyInfo.id,
    ],
  );
  const cachedHistory = useMemo(
    () => tokenHistoryCache.get(historyCacheKey),
    [historyCacheKey],
  );

  const [historyInit, setHistoryInit] = useState(cachedHistory !== undefined);

  useEffect(() => {
    setHistoryInit(cachedHistory !== undefined);
  }, [cachedHistory]);

  /**
   * since some tokens are slow to load history,
   * they are loaded separately from the token details
   * so as not to block the display of the top details.
   */
  const historyPromiseOptions = useMemo(
    () => ({
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      overrideIsFocused: (isPageFocused: boolean) =>
        isPageFocused && (isTabView ? focusParam : true),
      ...(cachedHistory !== undefined ? { initResult: cachedHistory } : {}),
    }),
    [cachedHistory, focusParam, isTabView],
  );
  const {
    appendedTxs,
    hasMore: loadMoreHasMore,
    isLoadingMore,
    loadMore,
    reset: resetLoadMore,
    onFirstPageResponse,
  } = useHistoryListLoadMore({
    enabled: true,
    accountId,
    networkId,
    tokenIdOnNetwork: tokenInfo.address,
    filterScam: settings.isFilterScamHistoryEnabled,
    filterLowValue: settings.isFilterLowValueHistoryEnabled,
    sourceCurrency: settings.currencyInfo.id,
    currencyMap,
  });

  // Monotonic request id; bumped on identity change AND at the start of every
  // `run()` body so a slow stale response can't re-seed the load-more cursor
  // after `resetLoadMore()` ran.
  const fetchRequestIdRef = useRef(0);
  const activeRef = useRef(false);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      fetchRequestIdRef.current += 1;
    };
  }, []);
  const { result: tokenHistory, run } = usePromiseResult(
    async () => {
      fetchRequestIdRef.current += 1;
      const requestId = fetchRequestIdRef.current;
      const isCurrentRequest = () =>
        activeRef.current && fetchRequestIdRef.current === requestId;
      try {
        const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId,
          networkId,
          tokenIdOnNetwork: tokenInfo.address,
          filterScam: settings.isFilterScamHistoryEnabled,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          sourceCurrency: settings.currencyInfo.id,
          currencyMap,
        });
        // Skip side effects if a newer fetch superseded this one.
        if (!isCurrentRequest()) {
          return r.txs ?? [];
        }
        updateAddressesInfo({
          data: r.addressMap ?? {},
        });
        // Persist only first-page rows in the LRU cache; appended pages are
        // session-scoped and would bloat the cache if stored here.
        tokenHistoryCache.set(historyCacheKey, r.txs ?? []);
        onFirstPageResponse({
          txs: r.txs ?? [],
          next: r.next,
          hasMore: r.hasMoreOnChainHistory,
          isIndexer: r.isIndexer,
        });
        return r.txs ?? [];
      } finally {
        if (isCurrentRequest()) {
          setHistoryInit(true);
        }
      }
    },
    [
      accountId,
      networkId,
      tokenInfo.address,
      settings.isFilterScamHistoryEnabled,
      settings.isFilterLowValueHistoryEnabled,
      settings.currencyInfo.id,
      currencyMap,
      updateAddressesInfo,
      historyCacheKey,
      onFirstPageResponse,
    ],
    historyPromiseOptions,
  );

  // Reset load-more on identity change; bump the request id so an in-flight
  // body resolving during the debounce window detects supersession.
  useEffect(() => {
    fetchRequestIdRef.current += 1;
    resetLoadMore();
  }, [historyCacheKey, resetLoadMore]);

  const resolvedHistory = useMemo(() => {
    const firstPageHistory = tokenHistory ?? cachedHistory ?? [];
    return appendedTxs.length
      ? unionBy([...firstPageHistory, ...appendedTxs], (tx) => tx.id)
      : firstPageHistory;
  }, [tokenHistory, cachedHistory, appendedTxs]);

  // OK-57070: same native top-insertion jitter fix as the wallet history tab.
  // Only engages inside the collapsible tab (where the scroll position is
  // meaningful and the user can be scrolled deep); a pass-through otherwise.
  // Standalone details do not have a pager scroll position to freeze.
  const frozenTopEnabled = !!inTabList && focusParam && isRouteFocused;
  // `historyCacheKey` doubles as the freeze identity: it changes exactly when
  // the rows switch to a different history stream (account / network / token /
  // filters / currency), which must drop the frozen baseline.
  const { displayedHistoryData: displayedHistory, onAwayFromTopChange } =
    useFrozenTopHistoryData(resolvedHistory, frozenTopEnabled, historyCacheKey);
  // Derive initialized synchronously to avoid one-frame flash of empty history
  // when historyCacheKey changes and cachedHistory becomes undefined
  const effectiveInit = historyInit || cachedHistory !== undefined;
  const historyKeyRef = useRef(historyCacheKey);
  historyKeyRef.current = historyCacheKey;
  const actionFocusRef = useRef({ focusParam, isRouteFocused });
  actionFocusRef.current = { focusParam, isRouteFocused };

  const handleHistoryItemPress = useCallback(
    async (tx: IAccountHistoryTx) => {
      const isCurrentAction = () =>
        activeRef.current && historyKeyRef.current === historyCacheKey;
      const canNavigate = () =>
        isCurrentAction() &&
        actionFocusRef.current.isRouteFocused &&
        (!isTabView || actionFocusRef.current.focusParam);
      if (!canNavigate()) return;
      if (
        tx.decodedTx.status === EDecodedTxStatus.Pending &&
        tx.isLocalCreated
      ) {
        const localTx =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId,
            networkId,
            historyId: tx.id,
          });

        // tx has been replaced by another tx
        if (!canNavigate() || !localTx || localTx.replacedNextId) {
          return;
        }
      }

      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      if (!canNavigate()) return;
      const guardedNavigation: Parameters<
        typeof maybeOpenPrivateSendHistoryDetail
      >[0]['navigation'] = {
        pushModal: (route, params) => {
          if (canNavigate()) navigation.pushModal(route, params);
        },
      };
      const openedPrivateSendHistory = await maybeOpenPrivateSendHistoryDetail({
        historyTx: tx,
        navigation: guardedNavigation,
        accountId,
        accountAddress,
        network: { id: networkId },
        tokenInfo,
        currencySymbol: settings.currencyInfo.symbol,
      });
      if (!canNavigate() || openedPrivateSendHistory) return;

      const xpub = await backgroundApiProxy.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      });
      if (!canNavigate()) return;

      navigation.push(EModalAssetDetailRoutes.HistoryDetails, {
        accountId,
        networkId,
        accountAddress,
        xpub,
        historyTx: tx,
      });
    },
    [
      accountId,
      navigation,
      networkId,
      settings.currencyInfo.symbol,
      tokenInfo,
      historyCacheKey,
      isTabView,
    ],
  );

  useEffect(() => {
    const reloadCallback = () => run({ alwaysSetState: true });
    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, reloadCallback);
    };
  }, [run]);

  const webScrollHost =
    !platformEnv.isNative && isTabView
      ? (focusParam && pagerPage.owner) || null
      : undefined;
  const historyList = (
    <TokenDetailsNativeHistoryList
      key={historyCacheKey}
      hideValue
      showIcon={false}
      showFooter
      refreshEnabled={false}
      isAllNetworks={networkUtils.isAllNetwork({ networkId })}
      walletId={walletId}
      accountId={accountId}
      networkId={networkId}
      indexedAccountId={indexedAccountId}
      inTabList={inTabList}
      initialized={effectiveInit}
      data={displayedHistory}
      onPressHistory={handleHistoryItemPress}
      ListHeaderComponent={ListHeaderComponent as React.ReactElement}
      isSingleAccount
      onEndReached={isTabView && !focusParam ? undefined : loadMore}
      isLoadingMore={isLoadingMore}
      hasMore={loadMoreHasMore}
      frozenTopEnabled={frozenTopEnabled}
      frozenTopIdentityKey={historyCacheKey}
      observeFrozenTop={!!inTabList}
      onAwayFromTopChange={onAwayFromTopChange}
      webScrollHost={webScrollHost}
      webContentPadding={historyContentPadding}
    />
  );

  if (!platformEnv.isNative && isTabView) {
    return (
      <AppPagerContent>
        {historyList}
        <TokenDetailsPaginationObserver
          enabled={effectiveInit && displayedHistory.length > 0 && focusParam}
          hasMore={loadMoreHasMore}
          isLoadingMore={isLoadingMore}
          progressKey={`${historyCacheKey}:${displayedHistory.length}:${displayedHistory.at(-1)?.id ?? ''}`}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          padding={historyContentPadding}
        />
      </AppPagerContent>
    );
  }

  return historyList;
}

function TokenDetailsHistoryWithTabFocus(props: IProps) {
  const { isFocused } = useAppPagerPage();
  const isRouteFocused = useRouteIsFocused();

  return (
    <TokenDetailsHistoryContent
      {...props}
      focusParam={isFocused && isRouteFocused}
    />
  );
}

function TokenDetailsHistory(props: IProps) {
  if (props.isTabView) {
    return <TokenDetailsHistoryWithTabFocus {...props} />;
  }

  return <TokenDetailsHistoryContent {...props} focusParam />;
}

const TokenDetailsHistoryWithProvider = memo(
  withHistoryListProvider(TokenDetailsHistory),
);
TokenDetailsHistoryWithProvider.displayName = 'TokenDetailsHistoryWithProvider';

export default memo(TokenDetailsHistoryWithProvider);
