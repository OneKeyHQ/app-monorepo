import { useCallback } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapToken,
  ISwapTokenBase,
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

function buildSwapHistoryToken({
  buildToken,
  selectedToken,
}: {
  buildToken?: ISwapTokenBase;
  selectedToken: ISwapToken;
}): ISwapToken {
  if (
    !buildToken ||
    !equalTokenNoCaseSensitive({
      token1: buildToken,
      token2: selectedToken,
    })
  ) {
    return selectedToken;
  }

  return {
    ...selectedToken,
    price: buildToken.price ?? selectedToken.price,
    currency: buildToken.currency ?? selectedToken.currency,
    fiatValue: buildToken.fiatValue ?? selectedToken.fiatValue,
    name: selectedToken.name ?? buildToken.name,
    logoURI: selectedToken.logoURI ?? buildToken.logoURI,
    isNative: selectedToken.isNative ?? buildToken.isNative,
  };
}

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
        const fromToken = buildSwapHistoryToken({
          buildToken: swapTxInfo.swapBuildResData.result?.fromTokenInfo,
          selectedToken: swapTxInfo.sender.token,
        });
        const toToken = buildSwapHistoryToken({
          buildToken: swapTxInfo.swapBuildResData.result?.toTokenInfo,
          selectedToken: swapTxInfo.receiver.token,
        });
        const swapHistoryItem: ISwapTxHistory = {
          protocol: swapTxInfo.protocol,
          status: ESwapTxHistoryStatus.PENDING,
          currency: settingsAtom.currencyInfo?.symbol,
          currencyId: settingsAtom.currencyInfo?.id,
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
            fromToken,
            toToken,
            fromNetwork: swapNetworks.find(
              (item) => item?.networkId === fromToken.networkId,
            ),
            toNetwork: swapNetworks.find(
              (item) => item?.networkId === toToken.networkId,
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
    [
      settingsAtom.currencyInfo.id,
      settingsAtom.currencyInfo.symbol,
      swapNetworks,
    ],
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
