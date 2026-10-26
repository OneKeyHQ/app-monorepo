import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

export function resolveMarketDetailHeaderIdentity({
  isStockToken,
  stockSymbol,
  stockLogoUrl,
  tokenSymbol,
  tokenLogoUrl,
  tokenLogoUrls,
  tokenVariant,
}: {
  isStockToken: boolean;
  stockSymbol?: string;
  stockLogoUrl?: string;
  tokenSymbol?: string;
  tokenLogoUrl?: string;
  tokenLogoUrls?: string[];
  tokenVariant?: Pick<IMarketStockTokenVariant, 'symbol' | 'name' | 'logoUrl'>;
}): {
  symbol: string;
  logoUrl?: string;
  logoUrls?: string[];
} {
  // The stock list row is the underlying listing (AAPL, its mark), not the
  // wrapped token (AAPLon) the detail endpoint resolves afterwards. Once that
  // listing is known, an empty company logo must not fall back to the issuer.
  if (isStockToken && (stockSymbol || stockLogoUrl)) {
    return {
      symbol: stockSymbol || tokenSymbol || '',
      logoUrl: stockLogoUrl?.trim() || undefined,
    };
  }
  // Variant selection can precede the detail request clearing the old token.
  if (tokenVariant) {
    return {
      symbol: tokenVariant.symbol || tokenVariant.name || '',
      logoUrl: tokenVariant.logoUrl,
    };
  }
  return {
    symbol: tokenSymbol || '',
    logoUrl: tokenLogoUrl,
    logoUrls: tokenLogoUrls,
  };
}
