export const NETWORK_ID_SEPARATOR = '--';

export function parseNetworkId({ networkId }: { networkId: string }) {
  const [impl, chainId] = networkId.split(NETWORK_ID_SEPARATOR);
  return { impl, chainId };
}
