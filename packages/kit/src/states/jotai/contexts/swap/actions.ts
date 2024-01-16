import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';
import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/kit/src/views/Swap/types';
import { moveNetworkToFirst } from '@onekeyhq/kit/src/views/Swap/utils/utils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  swapManualSelectQuoteProvidersAtom,
  swapNetworks,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapTxHistoryAtom,
  swapTxHistoryStatusChangeAtom,
} from './atoms';

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  syncNetworksSort = contextAtomMethod(async (get, set, netWorkId: string) => {
    const networks = get(swapNetworks());
    const sortNetworks = moveNetworkToFirst(networks, netWorkId);
    set(swapNetworks(), sortNetworks);
    await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
      data: sortNetworks,
    });
  });

  syncSwapHistorySimpleDb = contextAtomMethod(async (get) => {
    const currentHistoryList = get(swapTxHistoryAtom());
    await backgroundApiProxy.simpleDb.swapHistory.setRawData({
      histories: currentHistoryList,
    });
  });

  cleanManualSelectQuoteProviders = contextAtomMethod((get, set) => {
    set(swapManualSelectQuoteProvidersAtom(), undefined);
  });

  selectFromToken = contextAtomMethod(async (get, set, token: ISwapToken) => {
    const fromToken = get(swapSelectFromTokenAtom());
    set(swapSelectFromTokenAtom(), token);
    set(swapSelectToTokenAtom(), undefined);
    if (fromToken?.symbol !== token.symbol) {
      await this.syncNetworksSort.call(set, token.networkId);
      this.cleanManualSelectQuoteProviders.call(set);
    }
  });

  selectToToken = contextAtomMethod(async (get, set, token: ISwapToken) => {
    const toToken = get(swapSelectToTokenAtom());
    set(swapSelectToTokenAtom(), token);
    if (toToken?.symbol !== token.symbol) {
      this.cleanManualSelectQuoteProviders.call(set);
      await this.syncNetworksSort.call(set, token.networkId);
    }
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

  addSwapHistoryItem = contextAtomMethod(
    async (get, set, item: ISwapTxHistory) => {
      const currentHistoryList = get(swapTxHistoryAtom());
      const histories = [item, ...currentHistoryList];
      set(swapTxHistoryAtom(), histories);
      await this.syncSwapHistorySimpleDb.call(set);
    },
  );

  updateSwapHistoryItem = contextAtomMethod(
    async (get, set, item: ISwapTxHistory) => {
      const currentHistoryList = get(swapTxHistoryAtom());
      const index = currentHistoryList.findIndex(
        (i) => i.txInfo.txId === item.txInfo.txId,
      );
      if (index !== -1) {
        const updated = getTimeStamp();
        item.date = { ...item.date, updated };
        currentHistoryList[index] = item;
        set(swapTxHistoryAtom(), currentHistoryList);
        set(swapTxHistoryStatusChangeAtom(), (items) => {
          if (!items.find((i) => i.txInfo.txId === item.txInfo.txId)) {
            return [...items, item];
          }
          return items;
        });
        await this.syncSwapHistorySimpleDb.call(set);
      }
    },
  );

  cleanSwapHistoryItems = contextAtomMethod(async (get, set) => {
    set(swapTxHistoryAtom(), []);
    await this.syncSwapHistorySimpleDb.call(set);
  });
}

const createActions = memoFn(() => new ContentJotaiActionsSwap());

export const useSwapActions = () => {
  const actions = createActions();
  const selectFromToken = actions.selectFromToken.use();
  const selectToToken = actions.selectToToken.use();
  const alternationToken = actions.alternationToken.use();
  const syncNetworksSort = actions.syncNetworksSort.use();
  const updateSwapHistoryItem = actions.updateSwapHistoryItem.use();
  const addSwapHistoryItem = actions.addSwapHistoryItem.use();
  const cleanSwapHistoryItems = actions.cleanSwapHistoryItems.use();
  return useRef({
    selectFromToken,
    selectToToken,
    alternationToken,
    cleanSwapHistoryItems,
    syncNetworksSort,
    updateSwapHistoryItem,
    addSwapHistoryItem,
  });
};
