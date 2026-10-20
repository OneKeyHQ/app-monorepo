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
  const preferredItems = items.filter(isPreferredStockTokenVariant);
  const candidates = preferredItems.length ? preferredItems : items;
  return (
    candidates.find(
      (item) =>
        item.tokenId === defaultTokenId && isStockTokenVariantTradable(item),
    ) ?? candidates.find(isStockTokenVariantTradable)
  );
}

export function isPreferredStockTokenVariant(
  variant: IMarketStockTokenVariant,
) {
  const issuer = variant.issuer.trim().toLowerCase();
  return (
    (issuer === 'bstock' || issuer === 'bstocks') &&
    isStockTokenVariantTradable(variant)
  );
}
