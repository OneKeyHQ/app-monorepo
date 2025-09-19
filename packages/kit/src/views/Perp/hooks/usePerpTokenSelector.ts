import { useCallback, useMemo, useState } from 'react';

import {
  useCurrentTokenAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { useTokenList } from './usePerpMarketData';

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
  const [currentToken] = useCurrentTokenAtom();
  const [searchQuery, setSearchQuery] = useState('');
  const actions = useHyperliquidActions();

  const { data: tokenList } = useTokenList();

  const enhancedTokens = useMemo(() => {
    return tokenList.map((token) => {
      const priceDecimals = getValidPriceDecimals(token.szDecimals);
      return {
        ...token,
        change24h: (
          parseFloat(token.markPrice) - parseFloat(token.prevDayPrice)
        ).toFixed(priceDecimals),
        change24hPercent:
          ((parseFloat(token.markPrice) - parseFloat(token.prevDayPrice)) /
            parseFloat(token.prevDayPrice)) *
          100,
      };
    });
  }, [tokenList]);

  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return enhancedTokens;
    }

    const query = searchQuery.toLowerCase();
    return enhancedTokens.filter((token) =>
      token.name?.toLowerCase().includes(query),
    );
  }, [enhancedTokens, searchQuery]);

  const selectToken = useCallback(
    async (symbol: string) => {
      if (symbol === currentToken) return;
      try {
        await backgroundApiProxy.serviceHyperliquid.changeSelectedSymbol({
          coin: symbol,
        });
        await actions.current.setCurrentToken(symbol);
      } catch (error) {
        console.error('[PerpTokenSelector] Failed to select token:', error);
      }
    },
    [currentToken, actions],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    tokens: enhancedTokens,
    currentToken,
    searchQuery,
    filteredTokens,
    setSearchQuery,
    selectToken,
    clearSearch,
  };
}
