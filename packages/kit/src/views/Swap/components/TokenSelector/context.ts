import { createContext } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

type TokenSelectorValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
  accountId?: string;
};

export const TokenSelectorContext = createContext<TokenSelectorValues>({
  networkId: '',
});
