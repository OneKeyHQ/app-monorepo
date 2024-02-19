import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import {
  useSwapActions,
  useSwapTxHistoryPendingAtom,
} from '../../../states/jotai/contexts/swap';
import { EExchangeProtocol, ESwapTxHistoryStatus } from '../types';

export function useSwapTxHistoryStateSyncInterval() {
  const [swapTxHistoryPending] = useSwapTxHistoryPendingAtom();
  const { updateSwapHistoryItem } = useSwapActions().current;
  const internalRef = useRef<Record<string, NodeJS.Timeout>>({});

  const triggerSwapPendingHistoryInterval = useCallback(() => {
    if (swapTxHistoryPending.length > 0) {
      swapTxHistoryPending.forEach(async (swapTxHistory) => {
        if (!internalRef.current[swapTxHistory.txInfo.txId]) {
          const interval = setInterval(async () => {
            const txStatusRes =
              await backgroundApiProxy.serviceSwap.fetchTxState({
                txId: swapTxHistory.txInfo.txId,
                provider: swapTxHistory.swapInfo.provider.provider,
                protocol: EExchangeProtocol.SWAP,
                networkId: swapTxHistory.baseInfo.fromToken.networkId,
                ctx: swapTxHistory.ctx,
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
                },
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
