import type { IAccountDeriveTypes } from '../../vaults/types';

export type IBatchCreateCustomNetworkParams = {
  networkId: string;
  deriveType: IAccountDeriveTypes;
  /**
   * Per-(network, deriveType) index list. When present, the batch flow
   * derives only these indexes for this pair instead of the flow-level
   * `indexes`. Bulk copy relies on this so derive types with fewer
   * accounts do not inherit the largest derive type's whole index range
   * (e.g. 10 taproot + 1 legacy must fetch 11 addresses, not 20).
   */
  indexes?: number[];
};

export function mergeBatchCreateCustomNetworks({
  defaultNetworks,
  customNetworks,
}: {
  defaultNetworks: IBatchCreateCustomNetworkParams[];
  customNetworks: IBatchCreateCustomNetworkParams[] | undefined;
}): IBatchCreateCustomNetworkParams[] {
  const byPairKey = new Map<string, IBatchCreateCustomNetworkParams>();
  for (const item of defaultNetworks.concat(customNetworks ?? [])) {
    const pairKey = `${item.networkId}_${item.deriveType}`;
    const prev = byPairKey.get(pairKey);
    // uniqBy semantics (first occurrence wins, insertion order kept),
    // except a duplicate that carries its own index list beats an
    // index-less one: the flow seeds an index-less (networkId, deriveType)
    // entry from its top-level params, and that seed must not shadow the
    // caller's index-scoped entry for the same pair.
    if (!prev || (!prev.indexes && item.indexes)) {
      byPairKey.set(pairKey, item);
    }
  }
  return Array.from(byPairKey.values());
}
