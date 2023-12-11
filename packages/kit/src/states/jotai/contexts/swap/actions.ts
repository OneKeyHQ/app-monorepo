import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/kit-bg/src/services/ServiceSwap';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  checkCrossChainProviderIntersection,
  checkSingleChainProviderIntersection,
  isOnlySupportSingleChainProvider,
} from '../../../../views/Swap/utils/utils';
import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  swapOnlySupportSingleChainAtom,
  swapSelectFromNetworkAtom,
  swapSelectFromTokenAtom,
  swapSelectToNetworkAtom,
  swapSelectToTokenAtom,
} from './atoms';

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  selectFromNetwork = contextAtomMethod((get, set, network: ISwapNetwork) => {
    set(swapSelectFromNetworkAtom(), network);
    const selectToNetwork = get(swapSelectToNetworkAtom());
    const selectFromToken = get(swapSelectFromTokenAtom());
    const selectToToken = get(swapSelectToTokenAtom());
    const isOnlySupportSingleChain = isOnlySupportSingleChainProvider(network);
    if (isOnlySupportSingleChain) {
      set(swapSelectToNetworkAtom(), network);
      if (selectToToken && selectToToken.networkId !== network.networkId) {
        set(swapSelectToTokenAtom(), undefined);
      }
    } else if (selectToNetwork) {
      if (
        !checkCrossChainProviderIntersection(network, selectToNetwork) &&
        !(
          checkSingleChainProviderIntersection(network, selectToNetwork) &&
          selectToNetwork.networkId === network.networkId
        )
      ) {
        set(swapSelectToNetworkAtom(), undefined);
        set(swapSelectToTokenAtom(), undefined);
      }
    }
    if (selectFromToken && selectFromToken.networkId !== network.networkId) {
      set(swapSelectFromTokenAtom(), undefined);
    }
  });

  selectToNetwork = contextAtomMethod((get, set, network: ISwapNetwork) => {
    const isOnlySupportSingleChain = get(swapOnlySupportSingleChainAtom());
    if (isOnlySupportSingleChain) {
      return;
    }
    set(swapSelectToNetworkAtom(), network);
    const selectToToken = get(swapSelectToTokenAtom());
    if (selectToToken && selectToToken.networkId !== network.networkId) {
      set(swapSelectToTokenAtom(), undefined);
    }
  });

  selectFromToken = contextAtomMethod((get, set, token: ISwapToken) => {
    set(swapSelectFromTokenAtom(), token);
    const selectToToken = get(swapSelectToTokenAtom());
    const selectToNetwork = get(swapSelectToNetworkAtom());
    const selectFromNetwork = get(swapSelectFromNetworkAtom());
    const isOnlySupportSingleChain = isOnlySupportSingleChainProvider(token);
    if (isOnlySupportSingleChain) {
      set(swapSelectToNetworkAtom(), selectFromNetwork);
      if (
        selectToToken &&
        (selectToToken.networkId !== token.networkId ||
          !checkSingleChainProviderIntersection(token, selectToToken))
      ) {
        set(swapSelectToTokenAtom(), undefined);
      }
    } else {
      if (
        selectToNetwork &&
        !checkCrossChainProviderIntersection(token, selectToNetwork) &&
        !(
          checkSingleChainProviderIntersection(token, selectToNetwork) &&
          selectToNetwork.networkId === token.networkId
        )
      ) {
        set(swapSelectToNetworkAtom(), undefined);
        set(swapSelectToTokenAtom(), undefined);
      }
      if (
        selectToToken &&
        !checkCrossChainProviderIntersection(token, selectToToken) &&
        !(
          checkSingleChainProviderIntersection(token, selectToToken) &&
          token.networkId === selectToToken.networkId
        )
      ) {
        set(swapSelectToTokenAtom(), undefined);
      }
    }
  });

  selectToToken = contextAtomMethod((get, set, token: ISwapToken) => {
    set(swapSelectToTokenAtom(), token);
  });

  alternationToken = contextAtomMethod((get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    const fromNetwork = get(swapSelectFromNetworkAtom());
    const toNetwork = get(swapSelectToNetworkAtom());
    if (!fromToken || !toToken) {
      return;
    }
    set(swapSelectFromNetworkAtom(), toNetwork);
    set(swapSelectToNetworkAtom(), fromNetwork);
    set(swapSelectFromTokenAtom(), toToken);
    set(swapSelectToTokenAtom(), fromToken);
  });
}

const createActions = memoFn(() => new ContentJotaiActionsSwap());

export const useSwapActions = () => {
  const actions = createActions();
  const selectFromNetwork = actions.selectFromNetwork.use();
  const selectToNetwork = actions.selectToNetwork.use();
  const selectFromToken = actions.selectFromToken.use();
  const selectToToken = actions.selectToToken.use();
  const alternationToken = actions.alternationToken.use();
  return {
    selectFromNetwork,
    selectToNetwork,
    selectFromToken,
    selectToToken,
    alternationToken,
  };
};
