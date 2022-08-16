import { createContext } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

type NetworkSelectorContextValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
};

export const NetworkSelectorContext =
  createContext<NetworkSelectorContextValues>({
    networkId: '',
  });

type SearchContextValues = {
  isLoading: boolean;
  keyword: string;
  setKeyword: (text: string) => void;
  terms: string;
  tokens: Token[];
};

export const SearchContext = createContext<SearchContextValues>({
  isLoading: false,
  keyword: '',
  setKeyword: () => {},
  terms: '',
  tokens: [],
});
