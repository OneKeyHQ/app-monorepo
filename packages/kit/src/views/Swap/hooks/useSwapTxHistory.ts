import { useCallback } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapFromTokenAmountAtom,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapTxHistoryActions() {
  const [swapNetworks] = useSwapNetworksAtom();
  const [, setFromToken] = useSwapSelectFromTokenAtom();
  const [, setToken] = useSwapSelectToTokenAtom();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [settingsAtom] = useSettingsPersistAtom();
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
          currency: settingsAtom.currencyInfo.symbol,
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
            protocolFee:
              swapTxInfo.swapBuildResData.result.fee?.protocolFees ?? 0,
          },
          ctx: swapTxInfo.swapBuildResData.ctx,
        };
        await backgroundApiProxy.serviceSwap.addSwapHistoryItem(
          swapHistoryItem,
        );
      }
    },
    [settingsAtom.currencyInfo.symbol, swapNetworks],
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
