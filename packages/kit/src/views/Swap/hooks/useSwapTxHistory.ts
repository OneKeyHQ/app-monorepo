import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ETabSwapRoutes } from '../../../routes/Tab/Swap/type';
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

export function useSwapTxHistoryList() {
  const [, setSwapHistory] = useSwapTxHistoryAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.simpleDb.swapHistory.getSwapHistoryList();
      setSwapHistory(histories);
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

  const generateSwapPendingHistoryInterval = useCallback(() => {
    if (swapTxHistoryPending.length > 0) {
      swapTxHistoryPending.forEach(async (swapTxHistory) => {
        if (!swapTxHistory.syncInterval) {
          const interval = setInterval(async () => {
            console.log('interval run--id', swapTxHistory.txInfo.txId);
            console.log('interval run', interval);
            const txState = await backgroundApiProxy.serviceSwap.fetchTxState({
              txId: swapTxHistory.txInfo.txId,
              provider: swapTxHistory.swapInfo.provider.provider,
              protocol: EExchangeProtocol.SWAP,
              networkId: swapTxHistory.baseInfo.fromToken.networkId,
            });
            if (txState !== ESwapTxHistoryStatus.PENDING) {
              clearInterval(interval);
              await updateSwapHistoryItem({
                ...swapTxHistory,
                status: txState,
                syncInterval: undefined,
              });
            }
          }, 1000 * 5);
          await updateSwapHistoryItem({
            ...swapTxHistory,
            syncInterval: interval,
          });
        }
      });
    }
  }, [swapTxHistoryPending, updateSwapHistoryItem]);

  const cleanupInterval = useCallback(() => {
    swapTxHistoryPending.forEach(async (swapTxHistory) => {
      console.log('1113');
      if (swapTxHistory.syncInterval) {
        console.log('interval clear--id', swapTxHistory.syncInterval);
        clearInterval(swapTxHistory.syncInterval);
        await updateSwapHistoryItem({
          ...swapTxHistory,
          syncInterval: undefined,
        });
      }
    });
  }, [swapTxHistoryPending, updateSwapHistoryItem]);

  useListenTabFocusState(ETabRoutes.Swap, (isFocus: boolean) => {
    console.log('isFocus---', isFocus);
    if (isFocus) {
      generateSwapPendingHistoryInterval();
    } else {
      cleanupInterval();
    }
  });
  //   useEffect(() => {
  //     if (swapTxHistoryPending.length > 0) {
  //       swapTxHistoryPending.forEach(async (swapTxHistory) => {
  //         if (!swapTxHistory.syncInterval) {
  //           const interval = setInterval(async () => {
  //             console.log('interval run--id', swapTxHistory.txInfo.txId);
  //             console.log('interval run', interval);
  //             const txState = await backgroundApiProxy.serviceSwap.fetchTxState({
  //               txId: swapTxHistory.txInfo.txId,
  //               provider: swapTxHistory.swapInfo.provider.provider,
  //               protocol: EExchangeProtocol.SWAP,
  //               networkId: swapTxHistory.baseInfo.fromToken.networkId,
  //             });
  //             if (txState !== ESwapTxHistoryStatus.PENDING) {
  //               clearInterval(interval);
  //               await updateSwapHistoryItem({
  //                 ...swapTxHistory,
  //                 status: txState,
  //                 syncInterval: undefined,
  //               });
  //             }
  //           }, 1000 * 5);
  //           await updateSwapHistoryItem({
  //             ...swapTxHistory,
  //             syncInterval: interval,
  //           });
  //         }
  //       });
  //     }
  //     return () => {
  //       console.log('interval clear');
  //       const cleanup = async () => {
  //         console.log('1112');
  //         await Promise.all(
  //           swapTxHistoryPending.map(async (swapTxHistory) => {
  //             console.log('1113');
  //             if (swapTxHistory.syncInterval) {
  //               console.log('interval clear--id', swapTxHistory.syncInterval);
  //               clearInterval(swapTxHistory.syncInterval);
  //               await updateSwapHistoryItem({
  //                 ...swapTxHistory,
  //                 syncInterval: undefined,
  //               });
  //             }
  //           }),
  //         );
  //       };
  //       void cleanup();
  //     };
  //   }, [swapTxHistoryPending, updateSwapHistoryItem]);
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
