import { createContext } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import type { TokenListItem } from '../../typings';

export type NetworkOption = {
  networkId?: string;
  name: string;
  logoURI?: string;
  isCrosschain?: boolean;
};

export type OutputCrosschainTokenSelectorValues = {
  selectedToken?: Token;
  networkId?: string;
  setNetworkId?: (networkId?: string) => void;
  accountId?: string;
  tokenList?: TokenListItem[];
  networkOptions?: NetworkOption[];
  crosschainOptions?: NetworkOption[];
};

export const OutputCrosschainTokenSelectorContext =
  createContext<OutputCrosschainTokenSelectorValues>({
    networkId: '',
  });
