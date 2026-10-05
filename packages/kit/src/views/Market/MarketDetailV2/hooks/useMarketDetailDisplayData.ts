import { useMemo } from 'react';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketStockDetailPreview,
  IMarketStockTokenVariant,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { isMatchingMarketTokenIdentity } from '../utils/marketTokenIdentity';
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
  tokenVariant,
}: {
  networkId: string;
  stockPreview?: IMarketStockDetailPreview;
  tokenAddress: string;
  tokenVariant?: IMarketStockTokenVariant;
}): IMarketTokenDetail | undefined {
  if (!stockPreview) return undefined;
  // Once the variant is known the page shows that token, so preview its
  // identity instead of the underlying stock's. Its quote stays out: the
  // variant list and the detail endpoint report different 24h changes.
  const variant =
    tokenVariant &&
    equalTokenNoCaseSensitive({
      token1: {
        networkId: tokenVariant.networkId,
        contractAddress: tokenVariant.contractAddress,
      },
      token2: { networkId, contractAddress: tokenAddress },
    })
      ? tokenVariant
      : undefined;

  return {
    address: tokenAddress,
    networkId,
    logoUrl: variant?.logoUrl || stockPreview.logoUrl,
    name: variant?.name || stockPreview.name,
    symbol: variant?.symbol || stockPreview.symbol,
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
  return isMatchingMarketTokenIdentity(previewTokenDetail, {
    tokenAddress: tokenDetail.address ?? '',
    networkId: tokenDetail.networkId ?? '',
    isNative: Boolean(tokenDetail.isNative),
  });
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
  const { stockPreview, selectedTokenVariant } = useStockDetail();
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
        tokenVariant: selectedTokenVariant,
      }),
    [networkId, selectedTokenVariant, stockPreview, tokenAddress],
  );

  const { displayTokenDetail, isPreviewTokenDetail } = useMemo(() => {
    // The stock route has no token preview, only a stock one, and its image is
    // just as worth preserving across the swap to the full detail.
    const previewDisplay = previewTokenDetail ?? stockPreviewTokenDetail;
    const matchesPreview =
      !previewTokenDetail ||
      isSameTokenIdentity({ previewTokenDetail, tokenDetail });
    if (tokenDetail && matchesPreview) {
      return {
        displayTokenDetail: preserveMarketDetailPreviewImage({
          previewTokenDetail: previewDisplay,
          tokenDetail,
        }),
        isPreviewTokenDetail: false,
      };
    }
    return {
      displayTokenDetail: previewDisplay,
      isPreviewTokenDetail: Boolean(previewDisplay),
    };
  }, [previewTokenDetail, stockPreviewTokenDetail, tokenDetail]);

  return useMemo(
    () => ({
      ...tokenDetailData,
      tokenDetail: displayTokenDetail,
      fullTokenDetail: tokenDetail,
      isPreviewTokenDetail,
      isStockToken:
        tokenDetailData.isStockToken || resolveIsStockToken(displayTokenDetail),
    }),
    [displayTokenDetail, isPreviewTokenDetail, tokenDetail, tokenDetailData],
  );
}

export const useMarketDetailHeaderDisplayData = useMarketDetailDisplayData;
