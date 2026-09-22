/**
 * Mainstream coins are configured with a chain but no contract, and listings
 * carry `assetId` / `stockId`. Neither shows a network badge. A chain token
 * with a contract address, such as AAVE, keeps its badge.
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
