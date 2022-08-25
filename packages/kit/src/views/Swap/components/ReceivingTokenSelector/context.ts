import { createContext } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

type ReceivingTokenSelectorValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
};

export const ReceivingTokenSelectorContext =
  createContext<ReceivingTokenSelectorValues>({
    networkId: '',
  });
