import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/kit-bg/src/services/ServiceSwap';

import {
  checkCrossChainProviderIntersection,
  checkSingleChainProviderIntersection,
  isOnlySupportSingleChainProvider,
} from '../../../../views/Swap/utils/utils';
import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextSwap,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextSwap, contextAtomMethod };

// swap source
export const { atom: swapNetworks, use: useSwapNetworksAtom } = contextAtom<
  ISwapNetwork[]
>([]);

export const {
  atom: swapNetworkTokenMapAtom,
  use: useSwapNetworkTokenMapAtom,
} = contextAtom<Record<string, ISwapToken[]>>({});

// swap select

export const {
  atom: swapSelectFromNetworkAtom,
  use: useSwapSelectFromNetworkAtom,
} = contextAtom<ISwapNetwork | undefined>(undefined);

export const {
  atom: swapSelectToNetworkAtom,
  use: useSwapSelectToNetworkAtom,
} = contextAtom<ISwapNetwork | undefined>(undefined);

export const {
  atom: swapSelectFromTokenAtom,
  use: useSwapSelectFromTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export const { atom: swapSelectToTokenAtom, use: useSwapSelectToTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

// swap select list

export const { atom: swapFromNetworksAtom, use: useSwapFromNetworksAtom } =
  contextAtomComputed((get) => {
    const networks = get(swapNetworks());
    return networks;
  });

export const { atom: swapToNetworksAtom, use: useSwapToNetworksAtom } =
  contextAtomComputed((get) => {
    const networks = get(swapNetworks());
    const fromNetwork = get(swapSelectFromNetworkAtom());
    return fromNetwork
      ? networks.map((network) => {
          if (
            checkCrossChainProviderIntersection(network, fromNetwork) ||
            (checkSingleChainProviderIntersection(network, fromNetwork) &&
              fromNetwork.networkId === network.networkId)
          ) {
            return network;
          }
          return {
            ...network,
            unSupported: true,
          };
        })
      : networks;
  });

export const { atom: swapFromTokensAtom, use: useSwapFromTokensAtom } =
  contextAtomComputed((get) => {
    const fromNetwork = get(swapSelectFromNetworkAtom());
    const networkTokenMap = get(swapNetworkTokenMapAtom());
    return fromNetwork ? networkTokenMap[fromNetwork.networkId] : [];
  });

export const { atom: swapToTokensAtom, use: useSwapToTokensAtom } =
  contextAtomComputed((get) => {
    const toNetwork = get(swapSelectToNetworkAtom());
    const swapSelectFromToken = get(swapSelectFromTokenAtom());
    const networkTokenMap = get(swapNetworkTokenMapAtom());
    const toTokens = toNetwork ? networkTokenMap[toNetwork.networkId] : [];
    return swapSelectFromToken
      ? toTokens.map((token) => {
          if (
            checkCrossChainProviderIntersection(token, swapSelectFromToken) ||
            (checkSingleChainProviderIntersection(token, swapSelectFromToken) &&
              swapSelectFromToken.networkId === token.networkId)
          ) {
            return token;
          }
          return {
            ...token,
            unSupported: true,
          };
        })
      : toTokens;
  });

export const {
  atom: swapOnlySupportSingleChainAtom,
  use: useSwapOnlySupportSingleChainAtom,
} = contextAtomComputed((get) => {
  const fromNetwork = get(swapSelectFromNetworkAtom());
  const fromToken = get(swapSelectFromTokenAtom());
  return (
    (fromNetwork && isOnlySupportSingleChainProvider(fromNetwork)) ||
    (fromToken && isOnlySupportSingleChainProvider(fromToken))
  );
});
