import { useCallback, useEffect } from 'react';

import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
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
  const { historyStateAction, cleanHistoryStateIntervals } =
    useSwapActions().current;

  useEffect(() => {
    void historyStateAction();
    return () => {
      cleanHistoryStateIntervals();
    };
  }, [historyStateAction, cleanHistoryStateIntervals, swapTxHistoryPending]);
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
            instantRate: swapTxInfo.swapBuildResData.result.instantRate ?? '0',
            provider: swapTxInfo.swapBuildResData.result.info,
            socketBridgeScanUrl:
              swapTxInfo.swapBuildResData.socketBridgeScanUrl,
            oneKeyFee:
              swapTxInfo.swapBuildResData.result.fee?.percentageFee ?? 0,
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
