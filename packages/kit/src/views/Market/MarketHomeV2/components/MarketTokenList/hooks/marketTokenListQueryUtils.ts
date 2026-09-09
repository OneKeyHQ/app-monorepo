export function getMarketTokenListApiNetworkId({
  networkId,
  isAllNetworks,
  type,
}: {
  networkId: string;
  isAllNetworks: boolean;
  type?: string;
}) {
  return isAllNetworks || type === 'stocks' ? '' : networkId;
}
