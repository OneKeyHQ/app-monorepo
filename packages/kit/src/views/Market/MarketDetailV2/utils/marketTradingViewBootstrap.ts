import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

export interface IMarketTradingViewBootstrap {
  tokenAddress: string;
  networkId: string;
  tokenSymbol: string;
  decimal: number;
  marketPrice?: string | number;
  isNative: boolean;
  historyStartTime?: number;
}

interface IBuildMarketTradingViewBootstrapOptions {
  tokenAddress: string;
  networkId: string;
  tokenDetail?: IMarketTokenDetail;
  tokenDetailPreview?: IMarketTokenDetailPreview;
  isNative: boolean;
}

export function normalizeChartTokenAddress(
  address: string | undefined,
  networkId: string,
) {
  return (
    normalizeTokenContractAddress({
      networkId,
      contractAddress: address?.trim(),
    }) ?? ''
  );
}

export function isSameMarketTradingViewBootstrap(
  current: IMarketTradingViewBootstrap | undefined,
  next: IMarketTradingViewBootstrap,
) {
  // marketPrice is only an initial price-scale hint and must not rotate the
  // chart bootstrap when live prices update.
  return (
    current?.networkId === next.networkId &&
    normalizeChartTokenAddress(current.tokenAddress, current.networkId) ===
      normalizeChartTokenAddress(next.tokenAddress, next.networkId) &&
    current.tokenSymbol === next.tokenSymbol &&
    current.decimal === next.decimal &&
    current.isNative === next.isNative &&
    current.historyStartTime === next.historyStartTime
  );
}

export function normalizeMarketHistoryStartTimeSeconds(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }
  return numericValue > 10_000_000_000
    ? Math.floor(numericValue / 1000)
    : Math.floor(numericValue);
}

function isMatchingChartToken(
  token:
    | Pick<IMarketTokenDetail, 'address' | 'networkId'>
    | Pick<IMarketTokenDetailPreview, 'address' | 'networkId'>,
  {
    tokenAddress,
    networkId,
    isNative,
  }: Pick<
    IBuildMarketTradingViewBootstrapOptions,
    'tokenAddress' | 'networkId' | 'isNative'
  >,
) {
  if (token.networkId && token.networkId !== networkId) {
    return false;
  }

  if (isNative && !tokenAddress) {
    return true;
  }

  return (
    normalizeChartTokenAddress(token.address, networkId) ===
    normalizeChartTokenAddress(tokenAddress, networkId)
  );
}

export function buildMarketTradingViewBootstrap({
  tokenAddress,
  networkId,
  tokenDetail,
  tokenDetailPreview,
  isNative,
}: IBuildMarketTradingViewBootstrapOptions):
  | IMarketTradingViewBootstrap
  | undefined {
  const preview =
    tokenDetailPreview &&
    isMatchingChartToken(tokenDetailPreview, {
      tokenAddress,
      networkId,
      isNative,
    })
      ? tokenDetailPreview
      : undefined;
  const detail =
    tokenDetail &&
    isMatchingChartToken(tokenDetail, {
      tokenAddress,
      networkId,
      isNative,
    })
      ? tokenDetail
      : undefined;
  // Preview starts the chart early, but the authoritative detail must replace
  // it when fields such as symbol, address, or decimals differ.
  const chartToken = detail ?? preview;

  if (!chartToken?.symbol || !networkId) {
    return undefined;
  }

  return {
    tokenAddress: chartToken.address || tokenAddress,
    networkId,
    tokenSymbol: chartToken.symbol,
    decimal: chartToken.decimals,
    marketPrice: detail?.price ?? preview?.price,
    isNative,
    historyStartTime: normalizeMarketHistoryStartTimeSeconds(
      detail?.firstTradeTime ?? preview?.firstTradeTime,
    ),
  };
}
