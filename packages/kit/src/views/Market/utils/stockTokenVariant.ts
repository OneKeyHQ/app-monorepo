import type {
  IMarketStockTokenVariant,
  IMarketStockTokenVariantsResponse,
} from '@onekeyhq/shared/types/marketV2';

export function isStockTokenVariantTradable(variant: IMarketStockTokenVariant) {
  return Boolean(
    variant.tradingEnabled &&
    !variant.isPaused &&
    !variant.tradingHours?.isPaused &&
    variant.status.trim().toLowerCase() === 'active',
  );
}

export function selectMarketStockWatchlistVariant(
  response: IMarketStockTokenVariantsResponse,
) {
  const defaultVariant = response.items.find(
    (item) =>
      item.tokenId === response.defaultTokenId &&
      isStockTokenVariantTradable(item),
  );
  return defaultVariant ?? response.items.find(isStockTokenVariantTradable);
}
