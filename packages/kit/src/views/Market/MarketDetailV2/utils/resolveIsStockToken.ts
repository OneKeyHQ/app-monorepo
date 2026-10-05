import type {
  IMarketStockInfo,
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

type IMarketStockIdentity = {
  stockId?: string;
  stock?: Pick<IMarketStockInfo, 'stockId'>;
};

export function resolveMarketStockId(item: IMarketStockIdentity) {
  const explicitStockId = [item.stockId, item.stock?.stockId].find((stockId) =>
    stockId?.trim(),
  );
  if (explicitStockId) {
    return explicitStockId.trim().toUpperCase();
  }

  return undefined;
}

export function resolveIsStockToken(
  tokenDetail?: Pick<IMarketTokenDetail, 'stock'>,
  tokenDetailPreview?: Pick<IMarketTokenDetailPreview, 'stock'>,
): boolean {
  return Boolean(tokenDetail?.stock || tokenDetailPreview?.stock);
}
