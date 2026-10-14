/**
 * A recommend row is a mainstream coin only when it carries `assetId`.
 * Those rows hide the network badge. Every other chain token keeps it,
 * including native coins whose contract is empty.
 */
export function getRecommendTokenNetworkId(token: {
  chainId?: string;
  contractAddress?: string;
  assetId?: string;
  stockId?: string;
}): string | undefined {
  if (token.assetId?.trim() || token.stockId?.trim()) {
    return undefined;
  }
  const chainId = token.chainId?.trim();
  return chainId || undefined;
}
