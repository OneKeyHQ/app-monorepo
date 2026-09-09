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
  isNative: boolean;
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

export function isMatchingMarketTokenIdentity(
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
  const identity = { tokenAddress, networkId, isNative };
  const preview =
    tokenDetailPreview &&
    isMatchingMarketTokenIdentity(tokenDetailPreview, identity)
      ? tokenDetailPreview
      : undefined;
  const detail =
    tokenDetail && isMatchingMarketTokenIdentity(tokenDetail, identity)
      ? tokenDetail
      : undefined;
  const chartToken = detail ?? preview;

  if (!chartToken?.symbol || !networkId) {
    return undefined;
  }

  return {
    tokenAddress: chartToken.address || tokenAddress,
    networkId,
    tokenSymbol: chartToken.symbol,
    decimal: chartToken.decimals,
    isNative,
  };
}

export function isSameMarketTradingViewBootstrap(
  current: IMarketTradingViewBootstrap | undefined,
  next: IMarketTradingViewBootstrap,
) {
  return (
    current?.networkId === next.networkId &&
    normalizeChartTokenAddress(current.tokenAddress, current.networkId) ===
      normalizeChartTokenAddress(next.tokenAddress, next.networkId) &&
    current.tokenSymbol === next.tokenSymbol &&
    current.decimal === next.decimal &&
    current.isNative === next.isNative
  );
}
