import { useMemo } from 'react';

import type {
  IMarketStockDetailPreview,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { resolveIsStockToken } from '../utils/resolveIsStockToken';

import { useStockDetail } from './StockDetailContext';
import { useTokenDetail } from './useTokenDetail';

function toDisplayNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : undefined;
}

function buildPreviewTokenDetail(
  tokenDetailPreview?: IMarketTokenDetailPreview,
): IMarketTokenDetail | undefined {
  if (!tokenDetailPreview) return undefined;

  return {
    address: tokenDetailPreview.address,
    networkId: tokenDetailPreview.networkId,
    isNative: tokenDetailPreview.isNative,
    logoUrl: tokenDetailPreview.tokenImageUri ?? '',
    logoUrls: tokenDetailPreview.tokenImageUris,
    name: tokenDetailPreview.name,
    symbol: tokenDetailPreview.symbol,
    decimals: tokenDetailPreview.decimals,
    price: toDisplayNumber(tokenDetailPreview.price),
    priceChange24hPercent: toDisplayNumber(tokenDetailPreview.change24h),
    marketCap: toDisplayNumber(tokenDetailPreview.marketCap),
    liquidity: toDisplayNumber(tokenDetailPreview.liquidity),
    holders: tokenDetailPreview.holders,
    volume24h: toDisplayNumber(tokenDetailPreview.turnover),
    communityRecognized: tokenDetailPreview.communityRecognized,
    stock: tokenDetailPreview.stock,
    lastUpdated: tokenDetailPreview.selectedAt,
  };
}

function buildStockPreviewTokenDetail({
  networkId,
  stockPreview,
  tokenAddress,
}: {
  networkId: string;
  stockPreview?: IMarketStockDetailPreview;
  tokenAddress: string;
}): IMarketTokenDetail | undefined {
  if (!stockPreview) return undefined;

  return {
    address: tokenAddress,
    networkId,
    logoUrl: stockPreview.logoUrl,
    name: stockPreview.name,
    symbol: stockPreview.symbol,
    decimals: 0,
    decimalsResolved: false,
  };
}

export function useMarketDetailDisplayData() {
  const tokenDetailData = useTokenDetail();
  const { stockPreview } = useStockDetail();
  const { networkId, tokenAddress, tokenDetail, tokenDetailPreview } =
    tokenDetailData;

  const previewTokenDetail = useMemo(
    () => buildPreviewTokenDetail(tokenDetailPreview),
    [tokenDetailPreview],
  );
  const stockPreviewTokenDetail = useMemo(
    () =>
      buildStockPreviewTokenDetail({
        networkId,
        stockPreview,
        tokenAddress,
      }),
    [networkId, stockPreview, tokenAddress],
  );

  const displayTokenDetail =
    tokenDetail ?? previewTokenDetail ?? stockPreviewTokenDetail;

  return useMemo(
    () => ({
      ...tokenDetailData,
      tokenDetail: displayTokenDetail,
      fullTokenDetail: tokenDetail,
      isPreviewTokenDetail: Boolean(displayTokenDetail && !tokenDetail),
      isStockToken:
        tokenDetailData.isStockToken || resolveIsStockToken(displayTokenDetail),
    }),
    [displayTokenDetail, tokenDetail, tokenDetailData],
  );
}

export const useMarketDetailHeaderDisplayData = useMarketDetailDisplayData;
