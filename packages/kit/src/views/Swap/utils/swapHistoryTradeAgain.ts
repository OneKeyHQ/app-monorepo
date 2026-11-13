import BigNumber from 'bignumber.js';

import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import {
  isPrivateSendSwapHistoryItem,
  isSwapHistoryTerminalStatus,
} from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import {
  EProtocolOfExchange,
  ESwapLimitOrderStatus,
  ESwapTabSwitchType,
  type IFetchLimitOrderRes,
  type ISwapToken,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

type ITradeAgainRouteParams =
  IModalSwapParamList[EModalSwapRoutes.SwapMainLand] & {
    importFromToken: ISwapToken;
    importToToken: ISwapToken;
    swapTabSwitchType:
      | ESwapTabSwitchType.SWAP
      | ESwapTabSwitchType.BRIDGE
      | ESwapTabSwitchType.LIMIT;
    tradeAgainFromHistory: true;
  };

function getTokenIdentity(token?: ISwapToken): ISwapToken | undefined {
  if (
    !token ||
    typeof token.networkId !== 'string' ||
    !token.networkId.trim() ||
    typeof token.symbol !== 'string' ||
    !token.symbol.trim() ||
    !Number.isInteger(token.decimals) ||
    token.decimals < 0 ||
    (token.isNative !== true &&
      (typeof token.contractAddress !== 'string' ||
        !token.contractAddress.trim()))
  ) {
    return undefined;
  }

  return {
    networkId: token.networkId,
    contractAddress:
      typeof token.contractAddress === 'string' ? token.contractAddress : '',
    symbol: token.symbol,
    decimals: token.decimals,
    ...(typeof token.name === 'string' ? { name: token.name } : {}),
    ...(typeof token.logoURI === 'string' ? { logoURI: token.logoURI } : {}),
    ...(typeof token.isNative === 'boolean'
      ? { isNative: token.isNative }
      : {}),
    ...(typeof token.isStock === 'boolean' ? { isStock: token.isStock } : {}),
    ...(typeof token.riskLevel === 'number' && Number.isFinite(token.riskLevel)
      ? { riskLevel: token.riskLevel }
      : {}),
    ...(typeof token.balanceMultiplier === 'string'
      ? { balanceMultiplier: token.balanceMultiplier }
      : {}),
  };
}

export function buildSwapHistoryTradeAgainParams(
  item?: ISwapTxHistory | null,
): ITradeAgainRouteParams | undefined {
  if (
    !item ||
    !isSwapHistoryTerminalStatus(item.status) ||
    isPrivateSendSwapHistoryItem(item) ||
    (item.protocol !== undefined &&
      item.protocol !== EProtocolOfExchange.SWAP &&
      item.protocol !== EProtocolOfExchange.STOCK)
  ) {
    return undefined;
  }

  const fromToken = getTokenIdentity(item.baseInfo?.fromToken);
  const toToken = getTokenIdentity(item.baseInfo?.toToken);
  if (!fromToken || !toToken) return undefined;

  const swapTabSwitchType: ITradeAgainRouteParams['swapTabSwitchType'] =
    fromToken.networkId === toToken.networkId
      ? ESwapTabSwitchType.SWAP
      : ESwapTabSwitchType.BRIDGE;
  return {
    tradeAgainFromHistory: true,
    importFromToken: fromToken,
    importToToken: toToken,
    fromAmount:
      typeof item.baseInfo?.fromAmount === 'string'
        ? item.baseInfo.fromAmount
        : undefined,
    swapTabSwitchType,
  };
}

export function buildLimitOrderTradeAgainParams(
  order?: IFetchLimitOrderRes,
): ITradeAgainRouteParams | undefined {
  if (
    !order ||
    ![
      ESwapLimitOrderStatus.FULFILLED,
      ESwapLimitOrderStatus.CANCELLED,
      ESwapLimitOrderStatus.EXPIRED,
      ESwapLimitOrderStatus.PARTIALLY_FILLED,
    ].includes(order.status)
  )
    return undefined;
  const fromToken = getTokenIdentity(order.fromTokenInfo);
  const toToken = getTokenIdentity(order.toTokenInfo);
  if (
    !fromToken ||
    !toToken ||
    fromToken.networkId !== toToken.networkId ||
    fromToken.networkId !== order.networkId ||
    typeof order.fromAmount !== 'string' ||
    !/^\d+$/.test(order.fromAmount)
  )
    return undefined;
  const amount = new BigNumber(order.fromAmount).shiftedBy(-fromToken.decimals);
  if (!amount.isFinite() || !amount.gt(0)) return undefined;
  return {
    importFromToken: fromToken,
    importToToken: toToken,
    fromAmount: amount.toFixed(),
    swapTabSwitchType: ESwapTabSwitchType.LIMIT,
    tradeAgainFromHistory: true,
  };
}
