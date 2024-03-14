import { useCallback, useEffect, useRef } from 'react';

import { debounce } from 'lodash';

import {
  EExchangeProtocol,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ETabRoutes } from '../../../routes/Tab/type';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTxHistoryAtom,
  useSwapTxHistoryPendingAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapTxHistoryListSyncFromSimpleDb() {
  const [, setSwapHistory] = useSwapTxHistoryAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.simpleDb.swapHistory.getSwapHistoryList();
      const sortHistories = histories.sort(
        (a, b) => b.date.created - a.date.created,
      );
      setSwapHistory(sortHistories);
    },
    [setSwapHistory],
    {
      watchLoading: true,
    },
  );
  return { syncLoading: isLoading };
}

export function useSwapTxHistoryStateSyncInterval() {
  const [swapTxHistoryPending] = useSwapTxHistoryPendingAtom();
  const { updateSwapHistoryItem } = useSwapActions().current;
  const internalRef = useRef<Record<string, NodeJS.Timeout>>({});
  const swapTxHistoryPendingRef = useRef<ISwapTxHistory[]>([]);
  if (swapTxHistoryPendingRef.current !== swapTxHistoryPending) {
    swapTxHistoryPendingRef.current = swapTxHistoryPending;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const triggerSwapPendingHistoryInterval = useCallback(
    debounce(() => {
      if (swapTxHistoryPendingRef.current.length > 0) {
        swapTxHistoryPendingRef.current.forEach(async (swapTxHistory) => {
          if (!internalRef.current[swapTxHistory.txInfo.txId]) {
            const interval = setInterval(async () => {
              const txStatusRes =
                await backgroundApiProxy.serviceSwap.fetchTxState({
                  txId: swapTxHistory.txInfo.txId,
                  provider: swapTxHistory.swapInfo.provider.provider,
                  protocol: EExchangeProtocol.SWAP,
                  networkId: swapTxHistory.baseInfo.fromToken.networkId,
                  ctx: swapTxHistory.ctx,
                  toTokenAddress:
                    swapTxHistory.baseInfo.toToken.contractAddress,
                  receivedAddress: swapTxHistory.txInfo.receiver,
                });
              if (txStatusRes.state !== ESwapTxHistoryStatus.PENDING) {
                clearInterval(interval);
                delete internalRef.current[swapTxHistory.txInfo.txId];
                await updateSwapHistoryItem({
                  ...swapTxHistory,
                  status: txStatusRes.state,
                  txInfo: {
                    ...swapTxHistory.txInfo,
                    receiverTransactionId:
                      txStatusRes.crossChainReceiveTxHash || '',
                    gasFeeInNative: txStatusRes.gasFee
                      ? txStatusRes.gasFee
                      : swapTxHistory.txInfo.gasFeeInNative,
                    gasFeeFiatValue: txStatusRes.gasFeeFiatValue
                      ? txStatusRes.gasFeeFiatValue
                      : swapTxHistory.txInfo.gasFeeFiatValue,
                  },
                  baseInfo: {
                    ...swapTxHistory.baseInfo,
                    toAmount: txStatusRes.dealReceiveAmount
                      ? txStatusRes.dealReceiveAmount
                      : swapTxHistory.baseInfo.toAmount,
                  },
                });
              }
            }, 1000 * 5);
            internalRef.current[swapTxHistory.txInfo.txId] = interval;
          }
        });
      }
    }, 100),
    [updateSwapHistoryItem],
  );

  const cleanupSwapPendingHistoryInterval = useCallback(() => {
    const currentInternalRef = internalRef.current;
    Object.entries(currentInternalRef).forEach(([key, value]) => {
      clearInterval(value);
      delete currentInternalRef[key];
    });
  }, []);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel) {
        triggerSwapPendingHistoryInterval();
      } else {
        cleanupSwapPendingHistoryInterval();
      }
    },
  );

  useEffect(() => {
    triggerSwapPendingHistoryInterval();
    return () => {
      cleanupSwapPendingHistoryInterval();
    };
  }, [cleanupSwapPendingHistoryInterval, triggerSwapPendingHistoryInterval]);
  return {
    swapTxHistoryPending,
  };
}

export function useSwapTxHistoryActions() {
  const { addSwapHistoryItem } = useSwapActions().current;
  const [swapNetworks] = useSwapNetworksAtom();
  const [, setFromToken] = useSwapSelectFromTokenAtom();
  const [, setToken] = useSwapSelectToTokenAtom();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const generateSwapHistoryItem = useCallback(
    async ({
      txId,
      gasFeeInNative,
      gasFeeFiatValue,
      swapTxInfo,
    }: {
      txId: string;
      gasFeeInNative?: string;
      gasFeeFiatValue?: string;
      swapTxInfo: ISwapTxInfo;
    }) => {
      if (swapTxInfo) {
        const swapHistoryItem: ISwapTxHistory = {
          status: ESwapTxHistoryStatus.PENDING,
          baseInfo: {
            toAmount: swapTxInfo.receiver.amount,
            fromAmount: swapTxInfo.sender.amount,
            fromToken: swapTxInfo.sender.token,
            toToken: swapTxInfo.receiver.token,
            fromNetwork: swapNetworks.find(
              (item) => item?.networkId === swapTxInfo.sender.token.networkId,
            ),
            toNetwork: swapNetworks.find(
              (item) => item?.networkId === swapTxInfo.receiver.token.networkId,
            ),
          },
          txInfo: {
            txId,
            gasFeeFiatValue,
            gasFeeInNative,
            orderId: swapTxInfo.swapBuildResData.swftOrder?.orderId,
            sender: swapTxInfo.accountAddress,
            receiver: swapTxInfo.receivingAddress,
          },
          date: {
            created: Date.now(),
            updated: Date.now(),
          },
          swapInfo: {
            instantRate: swapTxInfo.swapBuildResData.result.instantRate,
            provider: swapTxInfo.swapBuildResData.result.info,
            oneKeyFee: swapTxInfo.swapBuildResData.result.fee.percentageFee,
          },
          ctx: swapTxInfo.swapBuildResData.ctx,
        };
        await addSwapHistoryItem(swapHistoryItem);
      }
    },
    [addSwapHistoryItem, swapNetworks],
  );

  const swapAgainUseHistoryItem = useCallback(
    (item: ISwapTxHistory) => {
      setFromToken(item?.baseInfo.fromToken);
      setToken(item?.baseInfo.toToken);
      setFromTokenAmount(item?.baseInfo.fromAmount);
    },
    [setFromToken, setFromTokenAmount, setToken],
  );
  return { generateSwapHistoryItem, swapAgainUseHistoryItem };
}
