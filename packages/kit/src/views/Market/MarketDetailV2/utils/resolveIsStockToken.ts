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

export function buildMarketStockTokenMetadata(
  stock: IMarketStockInfo | undefined,
  stockId: string | undefined,
): IMarketStockInfo | undefined {
  const resolvedStockId = resolveMarketStockId({ stockId, stock });
  if (!resolvedStockId || resolvedStockId === stock?.stockId) return stock;
  return {
    subtitle: '',
    sourceLogoUri: '',
    ...stock,
    stockId: resolvedStockId,
  };
}

export function resolveIsStockToken(
  tokenDetail?: Pick<IMarketTokenDetail, 'stock'>,
  tokenDetailPreview?: Pick<IMarketTokenDetailPreview, 'stock'>,
): boolean {
  return Boolean(tokenDetail?.stock || tokenDetailPreview?.stock);
}
