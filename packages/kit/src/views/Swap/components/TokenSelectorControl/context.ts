import { createContext } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import type { TokenListItem } from '../../typings';

export type NetworkOption = {
  networkId?: string;
  name: string;
  logoURI: string;
};

export type TokenSelectorControlValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
  accountId?: string;
  tokenList?: TokenListItem[];
  networkOptions?: NetworkOption[];
  otherNetworkOptions?: NetworkOption[];
};

export const TokenSelectorControlContext =
  createContext<TokenSelectorControlValues>({
    networkId: '',
  });
