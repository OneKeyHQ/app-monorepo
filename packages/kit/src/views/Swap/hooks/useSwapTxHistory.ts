import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ETabRoutes } from '../../../routes/Tab/type';
import {
  useSwapActions,
  useSwapBuildTxResultAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTxHistoryAtom,
  useSwapTxHistoryPendingAtom,
} from '../../../states/jotai/contexts/swap';
import { getTimeStamp } from '../../../utils/helper';
import { EExchangeProtocol, ESwapTxHistoryStatus } from '../types';
import { mockAddress } from '../utils/utils';

import type { ISwapTxHistory } from '../types';

export function useSwapTxHistoryListSyncFromSimpleDb() {
  const [, setSwapHistory] = useSwapTxHistoryAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.simpleDb.swapHistory.getSwapHistoryList();
      const sortHistories = histories.sort(
        (a, b) => a.date.created - b.date.created,
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
  const { updateSwapHistoryItem } = useSwapActions();
  const internalRef = useRef<Record<string, NodeJS.Timeout>>({});

  const triggerSwapPendingHistoryInterval = useCallback(() => {
    if (swapTxHistoryPending.length > 0) {
      swapTxHistoryPending.forEach(async (swapTxHistory) => {
        if (!internalRef.current[swapTxHistory.txInfo.txId]) {
          const interval = setInterval(async () => {
            const txState = await backgroundApiProxy.serviceSwap.fetchTxState({
              txId: swapTxHistory.txInfo.txId,
              provider: swapTxHistory.swapInfo.provider.provider,
              protocol: EExchangeProtocol.SWAP,
              networkId: swapTxHistory.baseInfo.fromToken.networkId,
              ctx: swapTxHistory.ctx,
            });
            if (txState !== ESwapTxHistoryStatus.PENDING) {
              clearInterval(interval);
              delete internalRef.current[swapTxHistory.txInfo.txId];
              await updateSwapHistoryItem({
                ...swapTxHistory,
                status: txState,
              });
            }
          }, 1000 * 5);
          internalRef.current[swapTxHistory.txInfo.txId] = interval;
        }
      });
    }
  }, [swapTxHistoryPending, updateSwapHistoryItem]);

  const cleanupSwapPendingHistoryInterval = useCallback(() => {
    const currentInternalRef = internalRef.current;
    Object.entries(currentInternalRef).forEach(([key, value]) => {
      clearInterval(value);
      delete currentInternalRef[key];
    });
  }, []);

  useListenTabFocusState(ETabRoutes.Swap, (isFocus: boolean) => {
    if (isFocus) {
      triggerSwapPendingHistoryInterval();
    } else {
      cleanupSwapPendingHistoryInterval();
    }
  });

  useEffect(
    () => () => {
      cleanupSwapPendingHistoryInterval();
    },
    [cleanupSwapPendingHistoryInterval],
  );
  return {
    swapTxHistoryPending,
  };
}

export function useSwapTxHistoryActions() {
  const { addSwapHistoryItem } = useSwapActions();
  const [swapBuildTxResult] = useSwapBuildTxResultAtom(); // current build tx result
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  // const [receiverAddress] = useSwapReceiverAddressAtom();
  const generateSwapHistoryItem = useCallback(
    async ({ txId, netWorkFee }: { txId: string; netWorkFee: string }) => {
      if (swapBuildTxResult && fromToken && toToken) {
        const swapHistoryItem: ISwapTxHistory = {
          status: ESwapTxHistoryStatus.PENDING,
          baseInfo: {
            toAmount: swapBuildTxResult.result.toAmount,
            fromAmount: fromTokenAmount,
            fromToken,
            toToken,
          },
          txInfo: {
            txId,
            netWorkFee,
            sender: mockAddress,
            receiver: mockAddress,
          },
          date: {
            created: getTimeStamp(),
            updated: getTimeStamp(),
          },
          swapInfo: {
            instantRate: swapBuildTxResult.result.instantRate,
            provider: swapBuildTxResult.result.info,
          },
          ctx: swapBuildTxResult.ctx,
        };
        await addSwapHistoryItem(swapHistoryItem);
      }
    },
    [
      addSwapHistoryItem,
      fromToken,
      fromTokenAmount,
      swapBuildTxResult,
      toToken,
    ],
  );

  return { generateSwapHistoryItem };
}
