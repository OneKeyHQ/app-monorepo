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

function isSameTokenIdentity({
  previewTokenDetail,
  tokenDetail,
}: {
  previewTokenDetail?: IMarketTokenDetail;
  tokenDetail?: IMarketTokenDetail;
}) {
  if (!previewTokenDetail || !tokenDetail) {
    return false;
  }
  return (
    (!previewTokenDetail.networkId ||
      !tokenDetail.networkId ||
      previewTokenDetail.networkId === tokenDetail.networkId) &&
    (previewTokenDetail.isNative === undefined ||
      tokenDetail.isNative === undefined ||
      previewTokenDetail.isNative === tokenDetail.isNative) &&
    previewTokenDetail.address.toLowerCase() ===
      tokenDetail.address.toLowerCase()
  );
}

export function preserveMarketDetailPreviewImage({
  previewTokenDetail,
  tokenDetail,
}: {
  previewTokenDetail?: IMarketTokenDetail;
  tokenDetail?: IMarketTokenDetail;
}): IMarketTokenDetail | undefined {
  const hasPreviewImage = Boolean(
    previewTokenDetail?.logoUrl || previewTokenDetail?.logoUrls?.length,
  );
  const previewImageUris = previewTokenDetail?.logoUrls?.length
    ? previewTokenDetail.logoUrls
    : [previewTokenDetail?.logoUrl ?? ''];
  const fullImageUris = tokenDetail?.logoUrls?.length
    ? tokenDetail.logoUrls
    : [tokenDetail?.logoUrl ?? ''];
  const fullDetailConfirmsPreviewImage = previewImageUris
    .filter(Boolean)
    .every((uri) => fullImageUris.includes(uri));
  if (
    !tokenDetail ||
    !hasPreviewImage ||
    !fullDetailConfirmsPreviewImage ||
    !isSameTokenIdentity({ previewTokenDetail, tokenDetail })
  ) {
    return tokenDetail;
  }

  // Preserve both the URI and the image component mode used by the preview.
  // Switching between Image and Image.WithFallbackSources after detail loading
  // would reload an icon that was already visible in the Market list.
  return {
    ...tokenDetail,
    logoUrl: previewTokenDetail?.logoUrl ?? '',
    logoUrls: previewTokenDetail?.logoUrls,
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

  const stableFullTokenDetail = useMemo(
    () =>
      preserveMarketDetailPreviewImage({
        previewTokenDetail,
        tokenDetail,
      }),
    [previewTokenDetail, tokenDetail],
  );
  const displayTokenDetail =
    stableFullTokenDetail ?? previewTokenDetail ?? stockPreviewTokenDetail;

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
