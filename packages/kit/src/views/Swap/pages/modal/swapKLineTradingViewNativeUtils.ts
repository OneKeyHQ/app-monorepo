import {
  getTradingViewNativeSource,
  getTradingViewNativeSourceKey,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource';
import type {
  ITradingViewNativeMarketHistorySource,
  ITradingViewNativeSource,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
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

export function isSwapKLineStockToken({
  token,
  tokenMarketDetail,
}: {
  token?: ISwapToken;
  tokenMarketDetail?: IMarketTokenDetail;
}) {
  return Boolean(
    token?.isStock || tokenMarketDetail?.stock?.underlyingAssetTicker,
  );
}

export function getSwapKLineTradingViewNativeSource({
  coinGeckoId,
  perpsInfo,
  preferCoinGecko,
  token,
  websocketConfig,
}: {
  coinGeckoId?: string;
  perpsInfo?: IMarketPerpsInfo;
  preferCoinGecko?: boolean;
  token?: ISwapToken;
  websocketConfig?: IMarketTokenDetailWebsocket;
}): ITradingViewNativeSource | undefined {
  if (!token?.networkId) {
    return undefined;
  }

  const hyperliquidCoin =
    token.isNative && networkUtils.isBTCMainnet(token.networkId)
      ? (perpsInfo?.hlTicker ?? '')
      : '';
  const normalizedCoinGeckoId = coinGeckoId?.trim();
  if (preferCoinGecko && !normalizedCoinGeckoId && !hyperliquidCoin) {
    return undefined;
  }

  let marketHistory: ITradingViewNativeMarketHistorySource | undefined;
  if (normalizedCoinGeckoId) {
    marketHistory = preferCoinGecko
      ? {
          provider: 'coinGecko',
          coinGeckoId: normalizedCoinGeckoId,
        }
      : {
          provider: 'market',
          fallback: {
            provider: 'coinGecko',
            coinGeckoId: normalizedCoinGeckoId,
          },
        };
  }

  return getTradingViewNativeSource({
    hyperliquidCoin,
    marketDataSource: websocketConfig?.kline ? 'websocket' : 'polling',
    marketHistory,
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
