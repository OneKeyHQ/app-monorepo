export type ITokenDetailsMarketNavigationTarget =
  | {
      type: 'detail';
      token: string;
    }
  | {
      type: 'chart';
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
};

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
      networkId,
      networkName,
      symbol,
      tokenAddress: tokenAddress ?? '',
      tokenImageUri,
    };
  }

  return undefined;
}
