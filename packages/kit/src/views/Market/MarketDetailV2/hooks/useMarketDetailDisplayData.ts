import { useMemo } from 'react';

import type {
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

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

export function useMarketDetailDisplayData() {
  const tokenDetailData = useTokenDetail();
  const { tokenDetail, tokenDetailPreview } = tokenDetailData;

  const previewTokenDetail = useMemo(
    () => buildPreviewTokenDetail(tokenDetailPreview),
    [tokenDetailPreview],
  );

  const displayTokenDetail = tokenDetail ?? previewTokenDetail;

  return useMemo(
    () => ({
      ...tokenDetailData,
      tokenDetail: displayTokenDetail,
      fullTokenDetail: tokenDetail,
      isPreviewTokenDetail: Boolean(displayTokenDetail && !tokenDetail),
      isStockToken: Boolean(displayTokenDetail?.stock?.underlyingAssetTicker),
    }),
    [displayTokenDetail, tokenDetail, tokenDetailData],
  );
}

export const useMarketDetailHeaderDisplayData = useMarketDetailDisplayData;
