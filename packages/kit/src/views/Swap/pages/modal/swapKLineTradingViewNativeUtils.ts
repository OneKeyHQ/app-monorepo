import {
  getTradingViewNativeSource,
  getTradingViewNativeSourceKey,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource';
import type { ITradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IMarketPerpsInfo,
  IMarketTokenDetail,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export type ISwapKLineTokenMarketInfoSuccess = {
  status: 'success';
  perpsInfo?: IMarketPerpsInfo;
  tokenKey: string;
  tokenMarketDetail?: IMarketTokenDetail;
  updatedAt: number;
  websocketConfig?: IMarketTokenDetailWebsocket;
};

export type ISwapKLineTokenMarketInfoRequestResult =
  | ISwapKLineTokenMarketInfoSuccess
  | {
      status: 'error';
      tokenKey: string;
    };

export function isSwapKLineIdentityRequestPending({
  enabled,
  networkId,
  requestTokenKey,
  tokenKey,
}: {
  enabled: boolean;
  networkId: string;
  requestTokenKey?: string;
  tokenKey: string;
}) {
  return Boolean(enabled && networkId && requestTokenKey !== tokenKey);
}

export function resolveSwapKLineTokenMarketInfo({
  enabled,
  lastGoodResult,
  networkId,
  result,
  tokenKey,
}: {
  enabled: boolean;
  lastGoodResult?: ISwapKLineTokenMarketInfoSuccess;
  networkId: string;
  result?: ISwapKLineTokenMarketInfoRequestResult;
  tokenKey: string;
}) {
  const currentResult = result?.tokenKey === tokenKey ? result : undefined;
  const currentLastGoodResult =
    lastGoodResult?.tokenKey === tokenKey ? lastGoodResult : undefined;
  const resolvedResult =
    currentResult?.status === 'success' ? currentResult : currentLastGoodResult;

  return {
    isLoading: isSwapKLineIdentityRequestPending({
      enabled,
      networkId,
      requestTokenKey: currentResult?.tokenKey,
      tokenKey,
    }),
    perpsInfo: resolvedResult?.perpsInfo,
    tokenMarketDetail: resolvedResult?.tokenMarketDetail,
    updatedAt: resolvedResult?.updatedAt,
    websocketConfig: resolvedResult?.websocketConfig,
  };
}

export function getSwapKLineTradingViewNativeSource({
  isTokenMarketInfoLoading,
  perpsInfo,
  token,
  websocketConfig,
}: {
  isTokenMarketInfoLoading?: boolean;
  perpsInfo?: IMarketPerpsInfo;
  token?: ISwapToken;
  websocketConfig?: IMarketTokenDetailWebsocket;
}): ITradingViewNativeSource | undefined {
  if (!token?.networkId) {
    return undefined;
  }

  const mayUseHyperliquid =
    token.isNative && networkUtils.isBTCMainnet(token.networkId);
  if (mayUseHyperliquid && isTokenMarketInfoLoading) {
    return undefined;
  }

  const hyperliquidCoin = mayUseHyperliquid ? (perpsInfo?.hlTicker ?? '') : '';

  return getTradingViewNativeSource({
    hyperliquidCoin,
    marketDataSource: websocketConfig?.kline ? 'websocket' : 'polling',
    networkId: token.networkId,
    symbol: token.symbol,
    tokenAddress: token.contractAddress ?? '',
  });
}

export function getSwapKLineTradingViewNativeSourceKey(
  source?: ITradingViewNativeSource,
) {
  return source ? getTradingViewNativeSourceKey(source) : 'pending';
}
