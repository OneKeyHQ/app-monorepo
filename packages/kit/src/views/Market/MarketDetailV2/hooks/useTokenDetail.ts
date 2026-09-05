import { useMemo, useRef } from 'react';

import {
  useIsNativeAtom,
  useNetworkIdAtom,
  usePerpsInfoAtom,
  useTokenAddressAtom,
  useTokenDetailAtom,
  useTokenDetailLoadingAtom,
  useTokenDetailPreviewAtom,
  useTokenDetailWebsocketAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import type {
  IMarketPerpsInfo,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';

import {
  buildMarketTradingViewBootstrap,
  isSameMarketTradingViewBootstrap,
  normalizeChartTokenAddress,
} from '../utils/marketTradingViewBootstrap';
import { resolveIsStockToken } from '../utils/resolveIsStockToken';

import { useStockDetail } from './StockDetailContext';

import type { IMarketTradingViewBootstrap } from '../utils/marketTradingViewBootstrap';

interface IUseTokenDetailResult {
  tokenDetail?: IMarketTokenDetail;
  tokenDetailPreview?: IMarketTokenDetailPreview;
  isLoading: boolean;
  tokenAddress: string;
  networkId: string;
  isNative: boolean;
  websocketConfig?: IMarketTokenDetailWebsocket;
  perpsInfo?: IMarketPerpsInfo;
  isReady: boolean;
  isStockToken: boolean;
}

export function useTokenDetail(): IUseTokenDetailResult {
  const { isStockRoute } = useStockDetail();
  const [tokenDetail] = useTokenDetailAtom();
  const [tokenDetailPreview] = useTokenDetailPreviewAtom();
  const [isLoading] = useTokenDetailLoadingAtom();
  const [tokenAddress] = useTokenAddressAtom();
  const [networkId] = useNetworkIdAtom();
  const [isNative] = useIsNativeAtom();
  const [websocketConfig] = useTokenDetailWebsocketAtom();
  const [perpsInfo] = usePerpsInfoAtom();

  const isReady = useMemo(
    () => !isLoading && !!tokenDetail,
    [isLoading, tokenDetail],
  );

  const isStockToken =
    isStockRoute || resolveIsStockToken(tokenDetail, tokenDetailPreview);

  return {
    tokenDetail,
    tokenDetailPreview,
    isLoading,
    tokenAddress,
    networkId,
    isNative,
    websocketConfig,
    perpsInfo,
    isReady,
    isStockToken,
  };
}

type IUseMarketTradingViewParamsOptions = {
  tokenAddress: string;
  networkId: string;
  tokenDetail?: IMarketTokenDetail;
  tokenDetailPreview?: IMarketTokenDetailPreview;
  isNative: boolean;
  websocketConfig?: IMarketTokenDetailWebsocket;
  routeIdentity?: {
    tokenAddress: string;
    networkId: string;
    isNative: boolean;
  };
};

export function useMarketTradingViewParams({
  tokenAddress,
  networkId,
  tokenDetail,
  tokenDetailPreview,
  isNative,
  websocketConfig,
  routeIdentity,
}: IUseMarketTradingViewParamsOptions) {
  const chartTokenAddress = routeIdentity?.tokenAddress ?? tokenAddress;
  const chartNetworkId = routeIdentity?.networkId ?? networkId;
  const chartIsNative = routeIdentity?.isNative ?? isNative;
  const chartIdentity = `${chartNetworkId}:${normalizeChartTokenAddress(
    chartTokenAddress,
    chartNetworkId,
  )}:${chartIsNative ? 'native' : 'token'}`;
  const chartBootstrapRef = useRef<{
    identity: string;
    value?: IMarketTradingViewBootstrap;
  } | null>(null);
  const nextChartBootstrap = buildMarketTradingViewBootstrap({
    tokenAddress: chartTokenAddress,
    networkId: chartNetworkId,
    tokenDetail,
    tokenDetailPreview,
    isNative: chartIsNative,
  });

  if (chartBootstrapRef.current?.identity !== chartIdentity) {
    chartBootstrapRef.current = {
      identity: chartIdentity,
      value: nextChartBootstrap,
    };
  } else if (
    nextChartBootstrap &&
    !isSameMarketTradingViewBootstrap(
      chartBootstrapRef.current.value,
      nextChartBootstrap,
    )
  ) {
    chartBootstrapRef.current.value = nextChartBootstrap;
  }

  const chartBootstrap = chartBootstrapRef.current.value;

  return useMemo(() => {
    if (!chartBootstrap) {
      return undefined;
    }

    return {
      ...chartBootstrap,
      dataSource: websocketConfig?.kline
        ? ('websocket' as const)
        : ('polling' as const),
    };
  }, [chartBootstrap, websocketConfig?.kline]);
}
