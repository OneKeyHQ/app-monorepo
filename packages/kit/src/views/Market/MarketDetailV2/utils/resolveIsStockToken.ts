import type {
  IMarketStockInfo,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

type IMarketStockIdentity = {
  stockId?: string;
  stock?: Pick<IMarketStockInfo, 'underlyingAssetTicker'>;
};

export function resolveMarketStockId(item: IMarketStockIdentity) {
  const stockId = item.stockId ?? item.stock?.underlyingAssetTicker;
  return stockId?.trim().toUpperCase() || undefined;
}

export function resolveIsStockToken(
  tokenDetail?: Pick<IMarketTokenDetail, 'stock'>,
  tokenDetailPreview?: Pick<IMarketTokenDetailPreview, 'stock'>,
): boolean {
  return Boolean(tokenDetail?.stock || tokenDetailPreview?.stock);
}
