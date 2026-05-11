export function shouldShowProtocolListBalances(
  protocols: Array<{ network?: { networkId?: string } }>,
) {
  if (!protocols.length) {
    return true;
  }

  const networkIds = new Set<string>();

  for (const protocol of protocols) {
    const networkId = protocol.network?.networkId?.trim();

    if (!networkId) {
      return true;
    }

    networkIds.add(networkId);

    if (networkIds.size > 1) {
      return true;
    }
  }

  return false;
}
