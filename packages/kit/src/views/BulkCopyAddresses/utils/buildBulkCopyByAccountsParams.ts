import { isNil } from 'lodash';

import type { IBatchCreateCustomNetworkParams } from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/batchCreateCustomNetworks';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export type IBulkCopyNetworkAccountsItem = {
  network: { id: string };
  networkAccounts: {
    deriveType: string;
    account?: { pathIndex?: number };
  }[];
};

/**
 * Build the batch-create normal-flow params for "bulk copy by my accounts".
 * Each existing (network, deriveType) pair carries exactly its own account
 * indexes so the flow fetches one address per existing account — the
 * progress denominator then equals the visible total account count instead
 * of the (derive types x max indexes) cartesian product.
 */
export function buildBulkCopyByAccountsFlowParams({
  networkAccounts,
}: {
  networkAccounts: IBulkCopyNetworkAccountsItem[];
}): {
  customNetworks: (IBatchCreateCustomNetworkParams & { indexes: number[] })[];
  indexes: number[];
  addressCount: number;
} {
  const byPairKey = new Map<
    string,
    IBatchCreateCustomNetworkParams & { indexes: number[] }
  >();
  const allIndexes = new Set<number>();

  for (const networkAccount of networkAccounts) {
    for (const account of networkAccount.networkAccounts) {
      const pathIndex = account.account?.pathIndex;
      if (!isNil(pathIndex)) {
        const pairKey = `${networkAccount.network.id}_${account.deriveType}`;
        let entry = byPairKey.get(pairKey);
        if (!entry) {
          entry = {
            networkId: networkAccount.network.id,
            deriveType: account.deriveType as IAccountDeriveTypes,
            indexes: [],
          };
          byPairKey.set(pairKey, entry);
        }
        if (!entry.indexes.includes(pathIndex)) {
          entry.indexes.push(pathIndex);
        }
        allIndexes.add(pathIndex);
      }
    }
  }

  const customNetworks = Array.from(byPairKey.values());
  return {
    customNetworks,
    indexes: Array.from(allIndexes),
    addressCount: customNetworks.reduce(
      (sum, item) => sum + item.indexes.length,
      0,
    ),
  };
}
