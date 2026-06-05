import { useMemo } from 'react';

import {
  useIsNativeAtom,
  useNetworkIdAtom,
  usePerpsInfoAtom,
  useTokenAddressAtom,
  useTokenDetailAtom,
  useTokenDetailLoadingAtom,
  useTokenDetailWebsocketAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useChartPredictedSymbolAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useTokenDetail() {
  const [tokenDetail] = useTokenDetailAtom();
  const [isLoading] = useTokenDetailLoadingAtom();
  const [tokenAddress] = useTokenAddressAtom();
  const [networkId] = useNetworkIdAtom();
  const [isNative] = useIsNativeAtom();
  const [websocketConfig] = useTokenDetailWebsocketAtom();
  const [perpsInfo] = usePerpsInfoAtom();
  const [predictedSymbol] = useChartPredictedSymbolAtom();

  const isReady = useMemo(
    () => !isLoading && !!tokenDetail,
    [isLoading, tokenDetail],
  );

  // Symbol to drive the chart with. Prefer the loaded detail; before it arrives,
  // fall back to the symbol predicted at tap (only when it matches THIS token, so
  // a stale prediction never leaks). Lets the chart mount immediately instead of
  // waiting on the token-detail API, and keeps it warm across in-place switches
  // (the gate would otherwise close while tokenDetail is cleared mid-fetch).
  const chartSymbol = useMemo(() => {
    if (tokenDetail?.symbol) return tokenDetail.symbol;
    if (
      predictedSymbol?.symbol &&
      predictedSymbol.address === tokenAddress &&
      predictedSymbol.networkId === networkId
    ) {
      return predictedSymbol.symbol;
    }
    return '';
  }, [tokenDetail?.symbol, predictedSymbol, tokenAddress, networkId]);

  // Price decimals to drive the chart priceScale. Prefer the loaded detail;
  // before it arrives, fall back to the decimals predicted at tap (only when it
  // matches THIS token). Keeps micro-price tokens at the correct priceScale
  // during the warm-chart / SYMBOL_CHANGE window instead of the chart's default
  // decimal=8. Returns undefined when unknown so the chart keeps its default.
  const chartDecimal = useMemo(() => {
    if (typeof tokenDetail?.decimals === 'number') return tokenDetail.decimals;
    if (
      typeof predictedSymbol?.decimal === 'number' &&
      predictedSymbol.address === tokenAddress &&
      predictedSymbol.networkId === networkId
    ) {
      return predictedSymbol.decimal;
    }
    return undefined;
  }, [tokenDetail?.decimals, predictedSymbol, tokenAddress, networkId]);

  const isStockToken = useMemo(
    () => !!tokenDetail?.stock?.underlyingAssetTicker,
    [tokenDetail?.stock?.underlyingAssetTicker],
  );

  return {
    tokenDetail,
    isLoading,
    tokenAddress,
    networkId,
    isNative,
    websocketConfig,
    perpsInfo,
    isReady,
    isStockToken,
    chartSymbol,
    chartDecimal,
  };
}
