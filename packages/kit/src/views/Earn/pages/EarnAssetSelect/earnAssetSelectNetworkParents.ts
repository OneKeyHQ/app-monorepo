import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

// Swap's own word on which networks are L2s and which mainnet each is on, so
// the selector's network column groups them under it as Swap's does. Asked
// once a session, as a window with a pick opens; a failed ask is asked again
// the next time
let parentsById: ReadonlyMap<string, string> | undefined;
let pending: Promise<ReadonlyMap<string, string>> | undefined;

export function getLoadedSwapNetworkParents() {
  return parentsById;
}

export function loadSwapNetworkParents(): Promise<ReadonlyMap<string, string>> {
  if (parentsById) {
    return Promise.resolve(parentsById);
  }
  pending ??= backgroundApiProxy.serviceSwap
    .fetchSwapNetworks()
    .then((networks) => {
      const parents = new Map<string, string>();
      networks.forEach((network) => {
        if (network.isL2 && network.parentNetworkId) {
          parents.set(network.networkId, network.parentNetworkId);
        }
      });
      parentsById = parents;
      return parents;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}

// For a window that opens a selector: the ask goes out with it
export function warmSwapNetworkParents() {
  loadSwapNetworkParents().catch(() => undefined);
}
