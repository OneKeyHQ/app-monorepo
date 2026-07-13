import { useMemo } from 'react';

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

  const isStockToken = useMemo(
    () => !!tokenDetail?.stock?.underlyingAssetTicker,
    [tokenDetail?.stock?.underlyingAssetTicker],
  );

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
  isNative: boolean;
  websocketConfig?: IMarketTokenDetailWebsocket;
};

export function useMarketTradingViewParams({
  tokenAddress,
  networkId,
  tokenDetail,
  isNative,
  websocketConfig,
}: IUseMarketTradingViewParamsOptions) {
  return useMemo(() => {
    if (!tokenDetail?.symbol || !networkId) {
      return undefined;
    }

    return {
      tokenAddress: tokenDetail.address || tokenAddress,
      networkId,
      tokenSymbol: tokenDetail.symbol,
      isNative,
      dataSource: websocketConfig?.kline
        ? ('websocket' as const)
        : ('polling' as const),
    };
  }, [
    isNative,
    networkId,
    tokenAddress,
    tokenDetail?.address,
    tokenDetail?.symbol,
    websocketConfig?.kline,
  ]);
}
