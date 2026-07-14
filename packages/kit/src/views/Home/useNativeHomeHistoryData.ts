import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_HISTORY } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IEventBusPayloadAccountDataUpdate,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import { useHistoryListLoadMore } from './pages/hooks/useHistoryListLoadMore';

export interface INativeHomeHistoryData {
  data: IAccountHistoryTx[];
  errorCode: string | undefined;
  hasMore: boolean;
  initialized: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNativeHomeHistoryData({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}): INativeHomeHistoryData {
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
  const currencyMapRef = useRef(currencyMap);
  currencyMapRef.current = currencyMap;

  const [data, setData] = useState<IAccountHistoryTx[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestIdRef = useRef(0);
  const networkId = network?.id;

  const mergeDerive =
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1 &&
    vaultSettings?.mergeDeriveAssetsEnabled;
  const loadMoreEnabled =
    enabled && !network?.isAllNetworks && Boolean(networkId);

  const {
    appendedTxs,
    hasMore,
    isLoadingMore,
    loadMore,
    onFirstPageResponse,
    reset: resetLoadMore,
  } = useHistoryListLoadMore({
    enabled: loadMoreEnabled,
    accountId: account?.id ?? '',
    networkId: networkId ?? '',
    filterScam: settings.isFilterScamHistoryEnabled,
    filterLowValue: settings.isFilterLowValueHistoryEnabled,
    excludeTestNetwork: true,
    sourceCurrency: settings.currencyInfo.id,
    currencyMap,
    mergeDerive,
    indexedAccountId: indexedAccount?.id ?? '',
  });

  const ownerKey = useMemo(
    () =>
      [
        account?.id ?? '',
        indexedAccount?.id ?? '',
        networkId ?? '',
        wallet?.id ?? '',
        mergeDerive ? '1' : '0',
      ].join('|'),
    [account?.id, indexedAccount?.id, mergeDerive, networkId, wallet?.id],
  );

  const load = useCallback(
    async (manual: boolean) => {
      if (!enabled || !networkId) {
        return;
      }
      const accountId = mergeDerive ? indexedAccount?.id : account?.id;
      if (!accountId) {
        setData([]);
        setInitialized(true);
        return;
      }

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setIsRefreshing(true);
      setErrorCode(undefined);
      try {
        const common = {
          networkId,
          isManualRefresh: manual,
          filterScam: settings.isFilterScamHistoryEnabled,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          excludeTestNetwork: true,
          sourceCurrency: settings.currencyInfo.id,
          currencyMap: currencyMapRef.current,
        };
        const result = mergeDerive
          ? await backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive(
              {
                ...common,
                indexedAccountId: accountId,
              },
            )
          : await backgroundApiProxy.serviceHistory.fetchAccountHistory({
              ...common,
              accountId,
            });
        if (requestIdRef.current === requestId) {
          setData(result.txs);
          onFirstPageResponse({
            txs: result.txs,
            next: result.next,
            hasMore: !!result.hasMoreOnChainHistory,
            isIndexer: result.isIndexer,
          });
          setInitialized(true);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setErrorCode('history_fetch_failed');
          setInitialized(true);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsRefreshing(false);
        }
      }
    },
    [
      account?.id,
      enabled,
      indexedAccount?.id,
      mergeDerive,
      networkId,
      settings.currencyInfo.id,
      settings.isFilterLowValueHistoryEnabled,
      settings.isFilterScamHistoryEnabled,
      onFirstPageResponse,
    ],
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setData([]);
    setInitialized(false);
    setErrorCode(undefined);
    resetLoadMore();
    if (enabled) {
      void load(false);
    }
  }, [enabled, load, ownerKey, resetLoadMore]);

  useEffect(() => {
    if (!enabled || !visible) {
      return;
    }
    const refresh = () => {
      void load(false);
    };
    const refreshAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') return;
      refresh();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refreshAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, refresh);
    const timer = setInterval(refresh, POLLING_INTERVAL_FOR_HISTORY);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refreshAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, refresh);
    };
  }, [enabled, load, visible]);

  const refresh = useCallback(() => load(true), [load]);

  const mergedData = useMemo(() => {
    if (appendedTxs.length === 0) return data;
    const firstPageIds = new Set(data.map((item) => item.id));
    return [
      ...data,
      ...appendedTxs.filter((item) => !firstPageIds.has(item.id)),
    ];
  }, [appendedTxs, data]);

  return useMemo(
    () => ({
      data: mergedData,
      errorCode,
      hasMore,
      initialized,
      isLoadingMore,
      isRefreshing,
      loadMore,
      refresh,
    }),
    [
      errorCode,
      hasMore,
      initialized,
      isLoadingMore,
      isRefreshing,
      loadMore,
      mergedData,
      refresh,
    ],
  );
}
