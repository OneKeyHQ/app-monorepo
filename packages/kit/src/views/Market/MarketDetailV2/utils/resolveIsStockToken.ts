import type {
  IMarketStockInfo,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

type IMarketStockIdentity = {
  stockId?: string;
  name?: string;
  symbol?: string;
  stock?: Pick<IMarketStockInfo, 'stockId' | 'underlyingAssetTicker'>;
};

export function resolveMarketStockId(item: IMarketStockIdentity) {
  const explicitStockId =
    item.stockId ?? item.stock?.stockId ?? item.stock?.underlyingAssetTicker;
  if (explicitStockId?.trim()) {
    return explicitStockId.trim().toUpperCase();
  }

  const name = item.name?.trim().toLowerCase();
  const symbol = item.symbol?.trim();
  if (name?.endsWith(' xstock') && symbol?.endsWith('x')) {
    return symbol.slice(0, -1).trim().toUpperCase() || undefined;
  }

  return undefined;
}

export function resolveIsStockToken(
  tokenDetail?: Pick<IMarketTokenDetail, 'stock'>,
  tokenDetailPreview?: Pick<IMarketTokenDetailPreview, 'stock'>,
): boolean {
  return Boolean(tokenDetail?.stock || tokenDetailPreview?.stock);
}
