import { createContext } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

type TokenSelectorValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
};

export const TokenSelectorContext = createContext<TokenSelectorValues>({
  networkId: '',
});
