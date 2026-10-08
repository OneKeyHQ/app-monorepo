import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

export function isStockTokenVariantTradable(variant: IMarketStockTokenVariant) {
  return Boolean(
    variant.tradingEnabled &&
    !variant.isPaused &&
    !variant.tradingHours?.isPaused &&
    variant.status.trim().toLowerCase() === 'active',
  );
}

export function getDefaultStockTokenVariant(
  items: IMarketStockTokenVariant[],
  defaultTokenId?: string,
) {
  return (
    items.find(
      (item) =>
        item.tokenId === defaultTokenId && isStockTokenVariantTradable(item),
    ) ?? items.find(isStockTokenVariantTradable)
  );
}
