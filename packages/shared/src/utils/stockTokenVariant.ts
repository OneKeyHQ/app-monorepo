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
  const tradableItems = items.filter(isStockTokenVariantTradable);
  const backendDefault = tradableItems.find(
    (item) => item.tokenId === defaultTokenId,
  );
  if (backendDefault) {
    return backendDefault;
  }

  // Keep the fallback deterministic when the public endpoint does not supply
  // defaultTokenId. This is the product order for stock issuers and networks;
  // unknown future variants retain the server list order below.
  const normalized = (value?: string) =>
    value
      ?.trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]/g, '') ?? '';
  const fallbackPriority = [
    (item: IMarketStockTokenVariant) => normalized(item.issuer) === 'bstocks',
    (item: IMarketStockTokenVariant) =>
      normalized(item.issuer) === 'ondo' &&
      normalized(item.networkName).includes('bsc'),
    (item: IMarketStockTokenVariant) =>
      normalized(item.issuer).includes('xstock') &&
      normalized(item.networkName).includes('sol'),
  ];
  return (
    fallbackPriority
      .map((matches) => tradableItems.find(matches))
      .find((item): item is IMarketStockTokenVariant => Boolean(item)) ??
    tradableItems[0]
  );
}
