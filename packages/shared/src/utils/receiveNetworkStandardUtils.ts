// Token-standard tag appended to the network name on the receive page,
// e.g. "Ethereum (ERC20)". Purpose: match exchange withdrawal-channel
// naming so users pick the right network. Deliberately keyed by networkId
// only (NO byImpl generalization): exchanges call Ethereum L1 "ERC20" but
// call EVM L2s (Arbitrum/Polygon/Base...) by chain name — tagging L2s with
// "ERC20" would steer users to the wrong withdrawal channel.
export const RECEIVE_NETWORK_STANDARD_DEFAULT: Record<string, string> = {
  'evm--1': 'ERC20', // Ethereum L1
  'evm--56': 'BEP20', // BNB Smart Chain
  'tron--0x2b6653dc': 'TRC20', // Tron mainnet
};

// Server-delivered override config. Same delivery constraints as
// IReceiveArrivalTimeOverride: fetched as a standalone map, never embedded
// in the network list payload.
export type IReceiveNetworkStandardOverride = {
  version?: number;
  byNetworkId?: Record<string, string>;
};

export function resolveReceiveNetworkStandard({
  networkId,
  isTestnet,
  isCustomNetwork,
  override,
}: {
  networkId: string | undefined;
  isTestnet?: boolean;
  isCustomNetwork?: boolean;
  override?: IReceiveNetworkStandardOverride;
}): string | undefined {
  if (!networkId || isTestnet || isCustomNetwork) {
    return undefined;
  }
  const maps = [override?.byNetworkId, RECEIVE_NETWORK_STANDARD_DEFAULT];
  for (const map of maps) {
    if (map && Object.prototype.hasOwnProperty.call(map, networkId)) {
      const value = map[networkId];
      if (typeof value !== 'string') {
        // malformed entry: ignore this layer, fall through to the next
        // eslint-disable-next-line no-continue
        continue;
      }
      const trimmed = value.trim();
      // explicit empty string means force-hide, overriding bundled defaults
      return trimmed ? trimmed : undefined;
    }
  }
  return undefined;
}

export function getReceiveNetworkDisplayName({
  networkName,
  networkId,
  isTestnet,
  isCustomNetwork,
  override,
}: {
  networkName: string | undefined;
  networkId: string | undefined;
  isTestnet?: boolean;
  isCustomNetwork?: boolean;
  override?: IReceiveNetworkStandardOverride;
}): string {
  if (!networkName) {
    return '';
  }
  const standard = resolveReceiveNetworkStandard({
    networkId,
    isTestnet,
    isCustomNetwork,
    override,
  });
  return standard ? `${networkName} (${standard})` : networkName;
}
