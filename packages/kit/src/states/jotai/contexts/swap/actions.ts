import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { moveNetworkToFirst } from '../../../../views/Swap/utils/utils';
import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  swapNetworks,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
} from './atoms';

import type { ISwapToken } from '../../../../views/Swap/types';

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  syncNetworksSort = contextAtomMethod(async (get, set, token: ISwapToken) => {
    const networks = get(swapNetworks());
    const sortNetworks = moveNetworkToFirst(networks, token.networkId);
    set(swapNetworks(), sortNetworks);
    await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
      data: sortNetworks,
    });
  });

  selectFromToken = contextAtomMethod(async (get, set, token: ISwapToken) => {
    set(swapSelectFromTokenAtom(), token);
    set(swapSelectToTokenAtom(), undefined);
    await this.syncNetworksSort.call(set, token);
  });

  selectToToken = contextAtomMethod(async (get, set, token: ISwapToken) => {
    set(swapSelectToTokenAtom(), token);
    await this.syncNetworksSort.call(set, token);
  });

  alternationToken = contextAtomMethod((get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    if (!fromToken && !toToken) {
      return;
    }
    set(swapSelectFromTokenAtom(), toToken);
    set(swapSelectToTokenAtom(), fromToken);
  });
}

const createActions = memoFn(() => new ContentJotaiActionsSwap());

export const useSwapActions = () => {
  const actions = createActions();
  const selectFromToken = actions.selectFromToken.use();
  const selectToToken = actions.selectToToken.use();
  const alternationToken = actions.alternationToken.use();
  return {
    selectFromToken,
    selectToToken,
    alternationToken,
  };
};
