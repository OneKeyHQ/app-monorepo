// Pure decision core for attaching Hyperliquid perps net worth (USD basis) to
// account selector rows, so the row totals can match the Home overview which
// already sums tokens + DeFi + perps. Reads ONLY the local portfolio snapshot
// cache handed in by the caller — never the network — mirroring the local-only
// semantics of the selector's DeFi overview source.

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

// `accountsForValuesQuery` builds indexedAccountId unconditionally as
// `${walletId}--${index}`, which degenerates to strings like '--undefined'
// for others-wallet rows (no walletId / index). Only a non-empty walletId
// followed by a numeric index is a resolvable indexed account id.
const INDEXED_ACCOUNT_ID_REGEX = /^.+--\d+$/;

export function isResolvableIndexedAccountId(
  indexedAccountId: string | undefined,
): indexedAccountId is string {
  return !!indexedAccountId && INDEXED_ACCOUNT_ID_REGEX.test(indexedAccountId);
}

export async function buildAccountsPerpsNetWorthUsd({
  accounts,
  snapshotNetWorthUsdByAddress,
  resolvePerpsAddressByIndexedAccountId,
}: {
  accounts: {
    accountId: string;
    indexedAccountId?: string;
    accountAddress?: string;
  }[];
  snapshotNetWorthUsdByAddress: Record<string, string>;
  resolvePerpsAddressByIndexedAccountId: (
    indexedAccountId: string,
  ) => Promise<string | undefined>;
}): Promise<(string | undefined)[]> {
  // No cached snapshots — skip per-row address resolution entirely.
  if (Object.keys(snapshotNetWorthUsdByAddress).length === 0) {
    return accounts.map(() => undefined);
  }
  return Promise.all(
    accounts.map(async (account) => {
      let address: string | undefined;
      if (
        account.accountAddress &&
        EVM_ADDRESS_REGEX.test(account.accountAddress)
      ) {
        // EVM rows (linked EVM network / others EVM accounts) already carry
        // the address Hyperliquid is keyed by.
        address = account.accountAddress.toLowerCase();
      } else if (isResolvableIndexedAccountId(account.indexedAccountId)) {
        // All-Networks / non-EVM linked contexts: resolve the row's perps
        // network address the same way Home does.
        address = (
          await resolvePerpsAddressByIndexedAccountId(account.indexedAccountId)
        )?.toLowerCase();
      }
      if (!address) {
        return undefined;
      }
      return snapshotNetWorthUsdByAddress[address];
    }),
  );
}
