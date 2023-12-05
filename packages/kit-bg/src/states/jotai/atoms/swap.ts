import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { ISwapNetwork, ISwapToken } from '../../../services/ServiceSwap';

export type ISwapAtom = {
  fromNetwork?: ISwapNetwork;
  fromNetworkList?: ISwapNetwork[];
  fromToken?: ISwapToken;
  fromTokenList?: ISwapToken[];
  toNetwork?: ISwapNetwork;
  toNetworkList?: ISwapNetwork[];
  toToken?: ISwapToken;
  toTokenList?: ISwapToken[];
  SwapNetworkTokensMap?: Record<string, ISwapToken[]>;
  isOnlySupportSingleChain?: boolean;
};
export const { target: swapAtom, use: useSwapAtom } = globalAtom<ISwapAtom>({
  persist: false,
  name: EAtomNames.swapAtom,
  initialValue: {
    fromNetworkList: undefined,
    fromTokenList: undefined,
    toNetworkList: undefined,
    toTokenList: undefined,
    fromNetwork: undefined,
    fromToken: undefined,
    toNetwork: undefined,
    toToken: undefined,
    isOnlySupportSingleChain: false,
  },
});
