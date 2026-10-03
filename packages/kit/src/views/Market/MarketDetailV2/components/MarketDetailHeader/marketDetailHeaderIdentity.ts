export function resolveMarketDetailHeaderIdentity({
  isStockToken,
  stockSymbol,
  stockLogoUrl,
  tokenSymbol,
  tokenLogoUrl,
  tokenLogoUrls,
}: {
  isStockToken: boolean;
  stockSymbol?: string;
  stockLogoUrl?: string;
  tokenSymbol?: string;
  tokenLogoUrl?: string;
  tokenLogoUrls?: string[];
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
  return {
    symbol: tokenSymbol || '',
    logoUrl: tokenLogoUrl,
    logoUrls: tokenLogoUrls,
  };
}
