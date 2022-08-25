import { createContext } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

type TokenSelectorContextValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
  impl?: string;
};

export const TokenSelectorContext = createContext<TokenSelectorContextValues>({
  networkId: '',
});
