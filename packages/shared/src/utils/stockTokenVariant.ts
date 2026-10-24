import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

// Backend issuer values come in several spellings; collapse them to one key so
// labels, defaults and the remembered preference agree on the same issuer.
const STOCK_ISSUER_ALIASES: Record<string, string> = {
  // cspell:disable-next-line
  bstock: 'bstocks',
  // cspell:disable-next-line
  bstocks: 'bstocks',
  coingecko: 'ondo',
  ondo: 'ondo',
  // cspell:disable-next-line
  xstock: 'xstocks',
  // cspell:disable-next-line
  xstocks: 'xstocks',
};

export function normalizeStockIssuer(issuer: string | undefined) {
  const key = issuer?.trim().toLowerCase() ?? '';
  return STOCK_ISSUER_ALIASES[key] ?? key;
}

export function isStockTokenVariantTradable(variant: IMarketStockTokenVariant) {
  return Boolean(
    variant.tradingEnabled &&
    !variant.isPaused &&
    !variant.tradingHours?.isPaused &&
    variant.status.trim().toLowerCase() === 'active',
  );
}

function pickTradableStockTokenVariant(
  candidates: IMarketStockTokenVariant[],
  defaultTokenId?: string,
) {
  return (
    candidates.find(
      (item) =>
        item.tokenId === defaultTokenId && isStockTokenVariantTradable(item),
    ) ?? candidates.find(isStockTokenVariantTradable)
  );
}

/**
 * Order: the issuer the user last picked by hand, then bStocks, then the
 * backend default or list order. Variants that cannot trade are skipped.
 */
export function getDefaultStockTokenVariant(
  items: IMarketStockTokenVariant[],
  defaultTokenId?: string,
  preferredIssuer?: string,
) {
  const preferredIssuerKey = normalizeStockIssuer(preferredIssuer);
  if (preferredIssuerKey) {
    const userPreferred = pickTradableStockTokenVariant(
      items.filter(
        (item) => normalizeStockIssuer(item.issuer) === preferredIssuerKey,
      ),
      defaultTokenId,
    );
    if (userPreferred) return userPreferred;
  }
  const preferredItems = items.filter(isPreferredStockTokenVariant);
  return pickTradableStockTokenVariant(
    preferredItems.length ? preferredItems : items,
    defaultTokenId,
  );
}

export function isPreferredStockTokenVariant(
  variant: IMarketStockTokenVariant,
) {
  return (
    // cspell:disable-next-line
    normalizeStockIssuer(variant.issuer) === 'bstocks' &&
    isStockTokenVariantTradable(variant)
  );
}
