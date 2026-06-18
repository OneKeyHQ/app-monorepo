import { useCallback } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
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
import { buildSwapHistoryIdentity } from '../utils/swapHistoryIdentity';

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
      txId?: string;
      gasFeeInNative?: string;
      gasFeeFiatValue?: string;
      swapTxInfo: ISwapTxInfo;
    }) => {
      if (
        swapTxInfo &&
        (swapTxInfo.protocol === EProtocolOfExchange.SWAP ||
          swapTxInfo.protocol === EProtocolOfExchange.PRIVATE_SEND ||
          swapTxInfo.protocol === EProtocolOfExchange.STOCK ||
          swapTxInfo.swapBuildResData.result.isWrapped)
      ) {
        const { orderId, serviceOrderId, useOrderId } =
          buildSwapHistoryIdentity({
            buildRes: swapTxInfo.swapBuildResData,
            protocol: swapTxInfo.protocol,
            txId,
          });
        const swapHistoryItem: ISwapTxHistory = {
          protocol: swapTxInfo.protocol,
          status: ESwapTxHistoryStatus.PENDING,
          currency: settingsAtom.currencyInfo?.symbol,
          accountInfo: {
            sender: {
              accountId: swapTxInfo.sender.accountInfo?.accountId,
              networkId: swapTxInfo.sender.accountInfo?.networkId,
            },
            receiver: {
              accountId: swapTxInfo.receiver.accountInfo?.accountId,
              networkId: swapTxInfo.receiver.accountInfo?.networkId,
            },
          },
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
            useOrderId,
            gasFeeFiatValue,
            gasFeeInNative,
            orderId,
            sender: swapTxInfo.accountAddress,
            receiver: swapTxInfo.receivingAddress,
          },
          date: {
            created: Date.now(),
            updated: Date.now(),
          },
          swapInfo: {
            instantRate: swapTxInfo.swapBuildResData.result?.instantRate ?? '',
            provider: swapTxInfo.swapBuildResData.result?.info,
            socketBridgeScanUrl:
              swapTxInfo.swapBuildResData.socketBridgeScanUrl,
            oneKeyFee: swapTxInfo.swapBuildResData.result?.fee?.percentageFee,
            protocolFee: swapTxInfo.swapBuildResData.result?.fee?.protocolFees,
            otherFeeInfos:
              swapTxInfo.swapBuildResData.result?.fee?.otherFeeInfos ?? [],
            orderId: serviceOrderId,
            supportUrl: swapTxInfo.swapBuildResData.result?.supportUrl,
            orderSupportUrl:
              swapTxInfo.swapBuildResData.result?.orderSupportUrl,
            oneKeyFeeExtraInfo:
              swapTxInfo.swapBuildResData.result?.oneKeyFeeExtraInfo,
          },
          ctx: swapTxInfo.swapBuildResData.ctx,
        };
        await backgroundApiProxy.serviceSwap.addSwapHistoryItem(
          swapHistoryItem,
        );
        if (swapTxInfo.protocol === EProtocolOfExchange.SWAP) {
          // Record SWAP task completion for rookie guide
          void backgroundApiProxy.serviceRookieGuide.recordTaskCompleted(
            ERookieTaskType.SWAP,
          );
        }
      }
    },
    [settingsAtom.currencyInfo.symbol, swapNetworks],
  );

  const swapAgainUseHistoryItem = useCallback(
    (item: ISwapTxHistory) => {
      setFromToken(item?.baseInfo.fromToken);
      setToken(item?.baseInfo.toToken);
      setFromTokenAmount({
        value: item?.baseInfo.fromAmount,
        isInput: true,
      });
    },
    [setFromToken, setFromTokenAmount, setToken],
  );
  return { generateSwapHistoryItem, swapAgainUseHistoryItem };
}
