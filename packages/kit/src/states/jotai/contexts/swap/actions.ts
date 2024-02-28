import { useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { debounce } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { moveNetworkToFirst } from '@onekeyhq/kit/src/views/Swap/utils/utils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  swapQuoteFetchInterval,
  swapTokenCatchMapMaxCount,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  type ISwapToken,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  swapApprovingTransactionAtom,
  swapBuildTxFetchingAtom,
  swapFromTokenAmountAtom,
  swapManualSelectQuoteProvidersAtom,
  swapNetworks,
  swapQuoteFetchingAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSlippagePercentageAtom,
  swapTokenMapAtom,
  swapTxHistoryAtom,
  swapTxHistoryStatusChangeAtom,
} from './atoms';

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  private quoteInterval: NodeJS.Timeout | undefined;

  private approvingInterval: NodeJS.Timeout | undefined;

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

  catchSwapTokensMap = contextAtomMethod(
    async (get, set, key: string, tokens: ISwapToken[]) => {
      const swapTokenMap = get(swapTokenMapAtom());
      const catchTokens = swapTokenMap.tokenCatch?.[key];
      const dateNow = Date.now();
      let catchCount = 0;
      if (swapTokenMap.tokenCatch && catchTokens?.data) {
        // have catch
        if (JSON.stringify(catchTokens.data) !== JSON.stringify(tokens)) {
          // catch data not equal
          swapTokenMap.tokenCatch[key] = { data: tokens, updatedAt: dateNow };
        }
        catchCount = Object.keys(swapTokenMap.tokenCatch).length;
      } else {
        // no catch
        swapTokenMap.tokenCatch = {
          ...(swapTokenMap.tokenCatch ?? {}),
          [key]: { data: tokens, updatedAt: dateNow },
        };
        catchCount = Object.keys(swapTokenMap.tokenCatch).length;
      }
      if (swapTokenMap.tokenCatch && catchCount > swapTokenCatchMapMaxCount) {
        // clean old catch
        const oldUpdatedAtKey = Object.entries(swapTokenMap.tokenCatch).reduce(
          (min, [mapKey, obj]) =>
            obj.updatedAt < (swapTokenMap.tokenCatch?.[min]?.updatedAt ?? 0)
              ? mapKey
              : min,
          Object.keys(swapTokenMap.tokenCatch)[0],
        );
        if (oldUpdatedAtKey) {
          delete swapTokenMap.tokenCatch[oldUpdatedAtKey];
        }
      }
      set(swapTokenMapAtom(), { ...swapTokenMap, updatedAt: dateNow });
    },
  );

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
        const updated = Date.now();
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

  runQuote = contextAtomMethod(
    async (
      get,
      set,
      fromToken: ISwapToken,
      toToken: ISwapToken,
      fromTokenAmount: string,
      slippagePercentage: number,
      address?: string,
    ) => {
      try {
        set(swapQuoteFetchingAtom(), true);
        const res = await backgroundApiProxy.serviceSwap.fetchQuotes({
          fromToken,
          toToken,
          fromTokenAmount,
          userAddress: address,
          slippagePercentage,
        });
        set(swapQuoteListAtom(), res);
        set(swapQuoteFetchingAtom(), false);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e?.message !== 'cancel') {
          set(swapQuoteFetchingAtom(), false);
        }
      }
    },
  );

  quoteAction = contextAtomMethod(async (get, set, address?: string) => {
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
    }
    const approvingTransaction = get(swapApprovingTransactionAtom());
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    const fromTokenAmount = get(swapFromTokenAmountAtom());
    const swapSlippage = get(swapSlippagePercentageAtom());
    const fromTokenAmountNumber = Number(fromTokenAmount);
    if (
      fromToken?.contractAddress ===
        approvingTransaction?.fromToken.contractAddress &&
      fromTokenAmount === approvingTransaction?.amount &&
      toToken?.contractAddress ===
        approvingTransaction?.toToken.contractAddress &&
      fromToken?.networkId === approvingTransaction?.fromToken.networkId &&
      toToken?.networkId === approvingTransaction?.toToken.networkId
    ) {
      console.log('quoteAction skip approvingTransaction');
      return;
    }
    if (
      fromToken &&
      toToken &&
      !Number.isNaN(fromTokenAmountNumber) &&
      fromTokenAmountNumber > 0
    ) {
      void this.runQuote.call(
        set,
        fromToken,
        toToken,
        fromTokenAmount,
        swapSlippage.value,
        address,
      );
      this.quoteInterval = setInterval(() => {
        void this.runQuote.call(
          set,
          fromToken,
          toToken,
          fromTokenAmount,
          swapSlippage.value,
          address,
        );
      }, swapQuoteFetchInterval);
    } else {
      await backgroundApiProxy.serviceSwap.cancelQuoteFetchQuotes();
      set(swapQuoteFetchingAtom(), false);
      set(swapQuoteListAtom(), []);
    }
  });

  cleanQuoteInterval = () => {
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
    }
    void backgroundApiProxy.serviceSwap.cancelQuoteFetchQuotes();
  };

  approvingStateRunSync = contextAtomMethod(
    async (
      get,
      set,
      networkId: string,
      tokenAddress: string,
      userAddress: string,
      spenderAddress: string,
      amount: string,
    ) => {
      const res = await backgroundApiProxy.serviceSwap.fetchApproveAllowance({
        networkId,
        tokenAddress,
        walletAddress: userAddress,
        spenderAddress,
      });
      if (res) {
        const allowanceBN = new BigNumber(res);
        const amountBN = new BigNumber(amount);
        if (!allowanceBN.isNaN() && allowanceBN.gte(amountBN)) {
          set(swapApprovingTransactionAtom(), undefined);
          set(swapBuildTxFetchingAtom(), false);
          if (this.approvingInterval) {
            clearInterval(this.approvingInterval);
          }
        }
      }
    },
  );

  approvingStateAction = contextAtomMethod(async (get, set) => {
    if (this.approvingInterval) {
      clearInterval(this.approvingInterval);
    }
    const approvingTransaction = get(swapApprovingTransactionAtom());
    if (approvingTransaction && approvingTransaction.txId) {
      void this.approvingStateRunSync.call(
        set,
        approvingTransaction.fromToken.networkId,
        approvingTransaction.fromToken.contractAddress,
        approvingTransaction.useAddress,
        approvingTransaction.spenderAddress,
        approvingTransaction.amount,
      );
      this.approvingInterval = setInterval(() => {
        if (approvingTransaction.txId) {
          void this.approvingStateRunSync.call(
            set,
            approvingTransaction.fromToken.networkId,
            approvingTransaction.fromToken.contractAddress,
            approvingTransaction.useAddress,
            approvingTransaction.spenderAddress,
            approvingTransaction.amount,
          );
        }
      }, 3000);
    }
  });

  cleanApprovingInterval = () => {
    if (this.approvingInterval) {
      clearInterval(this.approvingInterval);
    }
  };
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
  const catchSwapTokensMap = actions.catchSwapTokensMap.use();
  const quoteAction = debounce(actions.quoteAction.use(), 100);
  const approvingStateAction = debounce(
    actions.approvingStateAction.use(),
    100,
  );
  const { cleanQuoteInterval, cleanApprovingInterval } = actions;

  return useRef({
    selectFromToken,
    quoteAction,
    selectToToken,
    alternationToken,
    cleanSwapHistoryItems,
    syncNetworksSort,
    updateSwapHistoryItem,
    addSwapHistoryItem,
    catchSwapTokensMap,
    cleanQuoteInterval,
    cleanApprovingInterval,
    approvingStateAction,
  });
};
