import { createContext } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import type { TokenListItem } from '../../typings';

export type NetworkOption = {
  networkId?: string;
  name: string;
  logoURI: string;
};

type TokenSelectorValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
  accountId?: string;
  tokenList?: TokenListItem[];
  networkOptions?: NetworkOption[];
};

export const TokenSelectorContext = createContext<TokenSelectorValues>({
  networkId: '',
});
