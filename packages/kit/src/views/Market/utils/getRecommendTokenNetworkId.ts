/**
 * Top-coin and stock listings carry `assetId` / `stockId` and never show a
 * network badge, including when the recommend row also has a contract.
 * A chain token that does not match a listing keeps its chain badge.
 */
export function getRecommendTokenNetworkId(token: {
  chainId?: string;
  contractAddress?: string;
  assetId?: string;
  stockId?: string;
}): string | undefined {
  if (
    token.assetId?.trim() ||
    token.stockId?.trim() ||
    !token.contractAddress?.trim()
  ) {
    return undefined;
  }
  const chainId = token.chainId?.trim();
  return chainId || undefined;
}

/**
 * Hide the badge until the top-coin match finishes, then apply the listing
 * result. A contract token can still be a mainstream coin, so the config
 * contract alone must not paint a badge early.
 */
export function getVisibleRecommendTokenNetworkId({
  token,
  listing,
  listingResolved,
}: {
  token: {
    chainId?: string;
    contractAddress?: string;
    assetId?: string;
    stockId?: string;
  };
  listing?: {
    assetId?: string;
    stockId?: string;
  };
  listingResolved: boolean;
}): string | undefined {
  if (!listingResolved) {
    return undefined;
  }
  return getRecommendTokenNetworkId({
    chainId: token.chainId,
    contractAddress: token.contractAddress,
    assetId: listing?.assetId ?? token.assetId,
    stockId: listing?.stockId ?? token.stockId,
  });
}
