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

export function resolveStockPageHeaderIdentity({
  stockDetailSymbol,
  stockDetailName,
  stockDetailLogoUrl,
  stockPreviewSymbol,
  stockPreviewName,
  stockPreviewLogoUrl,
  underlyingTicker,
  stockTitle,
  stockSubtitle,
  stockId,
  tokenSymbol,
  tokenName,
  tokenLogoUrl,
  issuerLogoUrl,
}: {
  stockDetailSymbol?: string;
  stockDetailName?: string;
  stockDetailLogoUrl?: string;
  stockPreviewSymbol?: string;
  stockPreviewName?: string;
  stockPreviewLogoUrl?: string;
  underlyingTicker?: string;
  stockTitle?: string;
  stockSubtitle?: string;
  stockId?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenLogoUrl?: string;
  issuerLogoUrl?: string;
}) {
  const listingSymbol =
    stockDetailSymbol?.trim() ||
    stockPreviewSymbol?.trim() ||
    underlyingTicker?.trim() ||
    stockTitle?.trim() ||
    stockId?.trim() ||
    '';
  const symbol = listingSymbol || tokenSymbol?.trim() || '';
  const name =
    stockDetailName?.trim() ||
    stockPreviewName?.trim() ||
    stockSubtitle?.trim() ||
    (listingSymbol ? undefined : tokenName?.trim());
  const logoUrl = listingSymbol
    ? stockDetailLogoUrl?.trim() || stockPreviewLogoUrl?.trim() || undefined
    : tokenLogoUrl?.trim() || issuerLogoUrl?.trim() || undefined;
  return {
    symbol,
    name,
    logoUrl,
  };
}
