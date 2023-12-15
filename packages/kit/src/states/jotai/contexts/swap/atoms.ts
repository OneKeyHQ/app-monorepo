import { isOnlySupportSingleChainProvider } from '../../../../views/Swap/utils/utils';
import { createJotaiContext } from '../../utils/createJotaiContext';

import type { ISwapNetwork, ISwapToken } from '../../../../views/Swap/types';

const {
  Provider: ProviderJotaiContextSwap,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext({ isSingletonStore: true });
export { ProviderJotaiContextSwap, contextAtomMethod };

// swap networks
export const { atom: swapNetworks, use: useSwapNetworksAtom } = contextAtom<
  ISwapNetwork[]
>([]);

// export const {
//   atom: swapNetworkTokenMapAtom,
//   use: useSwapNetworkTokenMapAtom,
// } = contextAtom<Record<string, ISwapToken[]>>({});

// swap select token
export const {
  atom: swapSelectFromTokenAtom,
  use: useSwapSelectFromTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export const { atom: swapSelectToTokenAtom, use: useSwapSelectToTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

export const {
  atom: swapOnlySupportSingleChainAtom,
  use: useSwapOnlySupportSingleChainAtom,
} = contextAtomComputed((get) => {
  const fromToken = get(swapSelectFromTokenAtom());
  return fromToken && isOnlySupportSingleChainProvider(fromToken)
    ? fromToken.networkId
    : undefined;
});
