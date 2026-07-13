export async function resolveMarketTokenDetailRequestTokenAddress({
  tokenAddress,
  networkId,
  getNativeTokenAddress,
}: {
  tokenAddress: string;
  networkId: string;
  getNativeTokenAddress: (params: { networkId: string }) => Promise<string>;
}) {
  if (tokenAddress) return tokenAddress;

  return getNativeTokenAddress({ networkId });
}
