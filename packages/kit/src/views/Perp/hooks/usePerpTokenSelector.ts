import { useCallback, useMemo, useState } from 'react';

import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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

export function usePerpTokenSelector() {
  const [searchQuery, setSearchQuery] = useState('');
  const actions = useHyperliquidActions();

  const { result } = usePromiseResult(() => {
    return backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
  }, []);
  const allTokens = useMemo(
    () => result?.universeItems || [],
    [result?.universeItems],
  );

  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return allTokens;
    }

    const query = searchQuery.toLowerCase();
    const tokens = allTokens.filter((token) =>
      token.name?.toLowerCase().includes(query),
    );
    return tokens;
  }, [allTokens, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    allTokens,
    searchQuery,
    filteredTokens,
    setSearchQuery,
    clearSearch,
  };
}
