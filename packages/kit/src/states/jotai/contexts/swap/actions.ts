import { useRef } from 'react';

import { debounce } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { moveNetworkToFirst } from '@onekeyhq/kit/src/views/Swap/utils/utils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  swapQuoteFetchInterval,
  swapSlippageAutoValue,
  swapTokenCatchMapMaxCount,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapFetchCancelCause,
  ESwapSlippageSegmentKey,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchTokensParams,
  ISwapToken,
  ISwapTxHistory,
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
  swapTokenFetchingAtom,
  swapTokenMapAtom,
  swapTxHistoryAtom,
  swapTxHistoryStatusChangeAtom,
} from './atoms';

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  private quoteInterval: ReturnType<typeof setTimeout> | undefined;

  private approvingInterval: ReturnType<typeof setTimeout> | undefined;

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

  resetSwapSlippage = contextAtomMethod((get, set) => {
    set(swapSlippagePercentageAtom(), {
      key: ESwapSlippageSegmentKey.AUTO,
      value: swapSlippageAutoValue,
    });
  });

  cleanManualSelectQuoteProviders = contextAtomMethod((get, set) => {
    set(swapManualSelectQuoteProvidersAtom(), undefined);
  });

  catchSwapTokensMap = contextAtomMethod(
    async (get, set, key: string, tokens: ISwapToken[]) => {
      const swapTokenMap = get(swapTokenMapAtom());
      const swapNetworksList = get(swapNetworks());
      const catchTokens = swapTokenMap.tokenCatch?.[key];
      const dateNow = Date.now();
      let catchCount = 0;
      const newTokens = tokens.map((token) => {
        const network = swapNetworksList.find(
          (n) => n.networkId === token.networkId,
        );
        if (network) {
          token.networkLogoURI = network.logoURI;
        }
        return token;
      });
      if (swapTokenMap.tokenCatch && catchTokens?.data) {
        // have catch
        if (JSON.stringify(catchTokens.data) !== JSON.stringify(newTokens)) {
          // catch data not equal
          swapTokenMap.tokenCatch[key] = {
            data: newTokens,
            updatedAt: dateNow,
          };
        }
        catchCount = Object.keys(swapTokenMap.tokenCatch).length;
      } else {
        // no catch
        swapTokenMap.tokenCatch = {
          ...(swapTokenMap.tokenCatch ?? {}),
          [key]: { data: newTokens, updatedAt: dateNow },
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
    if (
      fromToken?.networkId !== token.networkId ||
      fromToken?.contractAddress !== token.contractAddress
    ) {
      this.cleanManualSelectQuoteProviders.call(set);
      this.resetSwapSlippage.call(set);
      await this.syncNetworksSort.call(set, token.networkId);
    }
    set(swapSelectFromTokenAtom(), token);
  });

  selectToToken = contextAtomMethod(async (get, set, token: ISwapToken) => {
    const toToken = get(swapSelectToTokenAtom());
    if (
      toToken?.networkId !== token.networkId ||
      toToken?.contractAddress !== token.contractAddress
    ) {
      this.cleanManualSelectQuoteProviders.call(set);
      this.resetSwapSlippage.call(set);
      await this.syncNetworksSort.call(set, token.networkId);
    }
    set(swapSelectToTokenAtom(), token);
  });

  alternationToken = contextAtomMethod((get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    if (!fromToken && !toToken) {
      return;
    }
    set(swapSelectFromTokenAtom(), toToken);
    set(swapSelectToTokenAtom(), fromToken);
    this.resetSwapSlippage.call(set);
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

  tokenListFetchAction = contextAtomMethod(
    async (get, set, params: IFetchTokensParams) => {
      set(swapTokenFetchingAtom(), true);
      const result = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        ...params,
      });
      if (result.length > 0) {
        await this.catchSwapTokensMap.call(set, JSON.stringify(params), result);
      }
      set(swapTokenFetchingAtom(), false);
    },
  );

  runQuote = contextAtomMethod(
    async (
      get,
      set,
      fromToken: ISwapToken,
      toToken: ISwapToken,
      fromTokenAmount: string,
      slippagePercentage: number,
      address?: string,
      loadingDelayEnable?: boolean,
    ) => {
      try {
        if (!loadingDelayEnable) {
          set(swapQuoteFetchingAtom(), true);
        }
        const res = await backgroundApiProxy.serviceSwap.fetchQuotes({
          fromToken,
          toToken,
          fromTokenAmount,
          userAddress: address,
          slippagePercentage,
        });

        if (!loadingDelayEnable) {
          set(swapQuoteFetchingAtom(), false);
        } else {
          set(swapQuoteFetchingAtom(), true);
          setTimeout(() => {
            set(swapQuoteFetchingAtom(), false);
          }, 800);
        }
        set(swapQuoteListAtom(), res);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e?.cause !== ESwapFetchCancelCause.SWAP_QUOTE_CANCEL) {
          set(swapQuoteFetchingAtom(), false);
        }
      }
    },
  );

  quoteAction = contextAtomMethod(async (get, set, address?: string) => {
    this.cleanQuoteInterval();
    set(swapBuildTxFetchingAtom(), false);
    set(swapApprovingTransactionAtom(), undefined);
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    const fromTokenAmount = get(swapFromTokenAmountAtom());
    const swapSlippage = get(swapSlippagePercentageAtom());
    const fromTokenAmountNumber = Number(fromTokenAmount);
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
          true,
        );
      }, swapQuoteFetchInterval);
    } else {
      await backgroundApiProxy.serviceSwap.cancelFetchQuotes();
      set(swapQuoteFetchingAtom(), false);
      set(swapQuoteListAtom(), []);
    }
  });

  approvingStateRunSync = contextAtomMethod(
    async (get, set, networkId: string, txId: string) => {
      const txState = await backgroundApiProxy.serviceSwap.fetchTxState({
        txId,
        networkId,
      });
      if (txState.state === ESwapTxHistoryStatus.SUCCESS) {
        set(swapApprovingTransactionAtom(), undefined);
        set(swapBuildTxFetchingAtom(), false);
        if (this.approvingInterval) {
          clearInterval(this.approvingInterval);
        }
      }
    },
  );

  approvingStateAction = contextAtomMethod(async (get, set) => {
    this.cleanApprovingInterval();
    const approvingTransaction = get(swapApprovingTransactionAtom());
    if (approvingTransaction && approvingTransaction.txId) {
      this.approvingInterval = setInterval(() => {
        if (approvingTransaction.txId) {
          void this.approvingStateRunSync.call(
            set,
            approvingTransaction.fromToken.networkId,
            approvingTransaction.txId,
          );
        }
      }, 2000);
    }
  });

  recoverQuoteInterval = contextAtomMethod(
    async (get, set, address?: string) => {
      this.cleanQuoteInterval();
      const fromToken = get(swapSelectFromTokenAtom());
      const toToken = get(swapSelectToTokenAtom());
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      const swapSlippage = get(swapSlippagePercentageAtom());
      const fromTokenAmountNumber = Number(fromTokenAmount);
      if (
        fromToken &&
        toToken &&
        !Number.isNaN(fromTokenAmountNumber) &&
        fromTokenAmountNumber > 0
      ) {
        this.quoteInterval = setInterval(() => {
          void this.runQuote.call(
            set,
            fromToken,
            toToken,
            fromTokenAmount,
            swapSlippage.value,
            address,
            true,
          );
        }, swapQuoteFetchInterval);
      }
    },
  );

  cleanQuoteInterval = () => {
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
    }
    void backgroundApiProxy.serviceSwap.cancelFetchQuotes();
  };

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
  const recoverQuoteInterval = actions.recoverQuoteInterval.use();
  const quoteAction = debounce(actions.quoteAction.use(), 100);
  const approvingStateAction = debounce(
    actions.approvingStateAction.use(),
    100,
  );
  const tokenListFetchAction = actions.tokenListFetchAction.use();
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
    tokenListFetchAction,
    recoverQuoteInterval,
  });
};
