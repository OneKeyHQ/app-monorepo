import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';

import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAllAssetsFilteredAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpTokenSelectorConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export interface ITokenItem {
  coin: string;
  symbol: string;
  name?: string;
  lastPrice?: string;
  change24h?: string;
}

export interface IPerpTokenSelectorReturn {
  tokens: Array<
    ITokenItem & {
      displayPrice: string;
      displayChange: string;
      displayVolume: string;
      changeColor: 'green' | 'red' | 'gray';
      isPopular: boolean;
    }
  >;
  currentToken: string;
  searchQuery: string;
  filteredTokens: ITokenItem[];
  popularTokens: ITokenItem[];
  setSearchQuery: (query: string) => void;
  selectToken: (symbol: string) => Promise<void>;
  clearSearch: () => void;
  isLoading: boolean;
}

let lastRefreshTradingMetaTime = 0;

function normalizeSearchQuery(query: string) {
  return query.trim().slice(0, 64);
}

export function usePerpTokenSelector() {
  const [searchQuery, setSearchQueryInternal] = useState('');
  const actions = useHyperliquidActions();
  const [{ assetsByDex, query: filteredQuery }] =
    usePerpsAllAssetsFilteredAtom();
  const [selectorConfig] = usePerpTokenSelectorConfigPersistAtom();

  const allAssetsRef = useRef<IPerpsUniverse[][] | undefined>(undefined);

  const refreshAllAssets = useCallback(async () => {
    const { universesByDex } =
      await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
    allAssetsRef.current = universesByDex || [];
    actions.current.updateAllAssetsFiltered({
      allAssetsByDex: allAssetsRef.current,
      query: searchQuery,
    });
  }, [actions, searchQuery]);

  useEffect(() => {
    void refreshAllAssets();
    const now = Date.now();
    if (
      now - lastRefreshTradingMetaTime >
      timerUtils.getTimeDurationMs({
        minute: 5,
      })
    ) {
      lastRefreshTradingMetaTime = now;
      void backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
    }
    return () => {};
  }, [actions, refreshAllAssets]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      actions.current.updateAllAssetsFiltered({
        allAssetsByDex: [],
        query: '',
      });
    };
  }, [actions]);

  const clearSearch = useCallback(() => {
    setSearchQueryInternal('');
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryInternal(normalizeSearchQuery(query));
  }, []);

  const lastLoggedRef = useRef<{
    query: string;
    activeTab: 'all' | 'hip3';
    sortField: string;
    sortDirection: string;
  } | null>(null);

  const logSearchEvent = useMemo(
    () =>
      debounce(
        (params: {
          query: string;
          activeTab: 'all' | 'hip3';
          sortField: string;
          sortDirection: string;
          resultCount: number;
        }) => {
          const queryLength = params.query.length;
          if (queryLength < 1 || queryLength > 10) {
            return;
          }

          lastLoggedRef.current = {
            query: params.query,
            activeTab: params.activeTab,
            sortField: params.sortField,
            sortDirection: params.sortDirection,
          };

          defaultLogger.perp.tokenSelector.perpTokenSelectorSearch({
            query: params.query,
            resultCount: params.resultCount,
            activeTab: params.activeTab,
            sortField: params.sortField,
            sortDirection: params.sortDirection,
          });
        },
        500,
      ),
    [],
  );

  useEffect(() => {
    const activeTab = (selectorConfig?.activeTab ?? 'all') as 'all' | 'hip3';
    const sortField = selectorConfig?.field ?? '';
    const sortDirection = selectorConfig?.direction ?? 'desc';

    const normalizedQuery = normalizeSearchQuery(filteredQuery ?? '');
    const current = {
      query: normalizedQuery,
      activeTab,
      sortField,
      sortDirection,
    };

    const prev = lastLoggedRef.current;
    const shouldLog =
      !prev ||
      prev.query !== current.query ||
      (current.query.length > 0 &&
        (prev.activeTab !== current.activeTab ||
          prev.sortField !== current.sortField ||
          prev.sortDirection !== current.sortDirection));

    if (!shouldLog || current.query.length === 0) {
      return;
    }

    const perDexCounts = (assetsByDex ?? []).map((items) => items?.length ?? 0);
    const resultCount =
      activeTab === 'hip3'
        ? perDexCounts[1] ?? 0
        : perDexCounts.reduce((sum, count) => sum + count, 0);

    logSearchEvent({
      query: current.query,
      activeTab,
      sortField,
      sortDirection,
      resultCount,
    });
  }, [
    assetsByDex,
    filteredQuery,
    logSearchEvent,
    selectorConfig?.activeTab,
    selectorConfig?.direction,
    selectorConfig?.field,
  ]);

  useEffect(
    () => () => {
      logSearchEvent.cancel();
    },
    [logSearchEvent],
  );

  return {
    searchQuery,
    setSearchQuery,
    clearSearch,
    refreshAllAssets,
  };
}
