import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

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

export function usePerpTokenSelector() {
  const [searchQuery, setSearchQuery] = useState('');
  const actions = useHyperliquidActions();

  const allAssetsRef = useRef<IPerpsUniverse[] | undefined>(undefined);

  const refreshAllAssets = useCallback(async () => {
    const { universeItems } =
      await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
    allAssetsRef.current = universeItems || [];
    actions.current.updateAllAssetsFiltered({
      allAssets: allAssetsRef.current,
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
        allAssets: [],
        query: '',
      });
    };
  }, [actions]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    clearSearch,
    refreshAllAssets,
  };
}
