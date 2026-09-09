import BigNumber from 'bignumber.js';

export type ITokenDetailsMarketNavigationTarget =
  | {
      type: 'detail';
      token: string;
    }
  | {
      type: 'chart';
      isNative: boolean;
      networkId: string;
      networkName?: string;
      symbol: string;
      tokenAddress: string;
      tokenImageUri?: string;
    };

type ITokenDetailsMarketMetadata = {
  coingeckoId?: string;
  networkId?: string;
  tokenAddress?: string;
  price?: number;
  priceChange24h?: number;
};

// Every tab of a token-details page shows the same asset (aggregate members
// or derive-type accounts), so metadata fetched for a previously active tab
// is still this asset's market data. Keep it on screen while the new tab's
// fetch is in flight (stale-while-revalidate) instead of unmounting the
// footer, which reads as a flash on every tab switch. Hide only when there
// is no metadata at all or the market data is confirmed empty.
export function shouldHideTokenDetailsMarketFooter({
  tokenMetadata,
}: {
  tokenMetadata?: ITokenDetailsMarketMetadata;
}) {
  if (!tokenMetadata) {
    return true;
  }
  return (
    new BigNumber(tokenMetadata.priceChange24h ?? 0).isZero() &&
    new BigNumber(tokenMetadata.price ?? 0).isZero()
  );
}

export function isTokenDetailsMarketMetadataForToken({
  networkId,
  tokenAddress,
  tokenMetadata,
}: {
  networkId?: string;
  tokenAddress?: string;
  tokenMetadata?: ITokenDetailsMarketMetadata;
}) {
  return Boolean(
    networkId &&
    tokenMetadata?.networkId === networkId &&
    tokenMetadata.tokenAddress === (tokenAddress ?? ''),
  );
}

export function buildTokenDetailsMarketNavigationTarget({
  isNative,
  networkId,
  networkName,
  symbol,
  tokenAddress,
  tokenImageUri,
  tokenMetadata,
}: {
  isNative?: boolean;
  networkId?: string;
  networkName?: string;
  symbol?: string;
  tokenAddress?: string;
  tokenImageUri?: string;
  tokenMetadata?: ITokenDetailsMarketMetadata;
}): ITokenDetailsMarketNavigationTarget | undefined {
  if (
    tokenMetadata?.coingeckoId &&
    isTokenDetailsMarketMetadataForToken({
      networkId,
      tokenAddress,
      tokenMetadata,
    })
  ) {
    return {
      type: 'detail',
      token: tokenMetadata.coingeckoId,
    };
  }

  const resolvedIsNative = isNative ?? !tokenAddress;
  if (networkId && symbol && (tokenAddress || resolvedIsNative)) {
    return {
      type: 'chart',
      isNative: resolvedIsNative,
      networkId,
      networkName,
      symbol,
      tokenAddress: tokenAddress ?? '',
      tokenImageUri,
    };
  }

  return undefined;
}
