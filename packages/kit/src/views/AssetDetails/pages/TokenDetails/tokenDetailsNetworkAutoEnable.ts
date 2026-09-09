import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';

export type IAllNetworksEnableState = {
  disabledNetworks: Record<string, boolean>;
  enabledNetworks: Record<string, boolean>;
};

/**
 * Enable `networkId` in All Networks unless the live state already has it on.
 *
 * The decision is made against a fresh state read, never a render snapshot:
 * the native Tabs container captures the index-change callback once, and
 * several tab switches can land before the snapshot refreshes, so a snapshot
 * cannot tell whether an earlier switch already enabled this network
 * (OK-61863). Overlapping calls for the same network collapse into one enable.
 *
 * Resolves to `true` only when this call performed the enable, so the caller
 * can toast and refresh exactly once.
 */
export async function enableNetworkInAllNetworksOnce({
  networkId,
  inFlightNetworkIds,
  getAllNetworksState,
  enableNetwork,
}: {
  networkId: string;
  inFlightNetworkIds: Set<string>;
  getAllNetworksState: () => Promise<IAllNetworksEnableState>;
  enableNetwork: (networkId: string) => Promise<void>;
}): Promise<boolean> {
  if (inFlightNetworkIds.has(networkId)) {
    return false;
  }
  inFlightNetworkIds.add(networkId);
  try {
    const { disabledNetworks, enabledNetworks } = await getAllNetworksState();
    if (
      isEnabledNetworksInAllNetworks({
        networkId,
        disabledNetworks,
        enabledNetworks,
        isTestnet: false,
      })
    ) {
      return false;
    }
    await enableNetwork(networkId);
    return true;
  } finally {
    inFlightNetworkIds.delete(networkId);
  }
}
