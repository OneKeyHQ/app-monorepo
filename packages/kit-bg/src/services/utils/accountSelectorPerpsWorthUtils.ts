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
  resolvePerpsAddressesByIndexedAccountIds,
}: {
  accounts: {
    accountId: string;
    indexedAccountId?: string;
    accountAddress?: string;
  }[];
  snapshotNetWorthUsdByAddress: Record<string, string>;
  resolvePerpsAddressesByIndexedAccountIds: (
    indexedAccountIds: string[],
  ) => Promise<Record<string, string | undefined>>;
}): Promise<(string | undefined)[]> {
  // No cached snapshots — skip address resolution entirely.
  if (Object.keys(snapshotNetWorthUsdByAddress).length === 0) {
    return accounts.map(() => undefined);
  }
  // Only rows without an indexed identity (imported/watching/external) may
  // use their row address directly, and only when it is EVM-shaped. Indexed
  // rows always resolve through the perps network's global derive type the
  // same way Home does — the row's scene address may be derived differently
  // (linkNetworkDeriveType) and would look up the snapshot under the wrong
  // key.
  const directAddresses: (string | undefined)[] = accounts.map((account) =>
    !isResolvableIndexedAccountId(account.indexedAccountId) &&
    account.accountAddress &&
    EVM_ADDRESS_REGEX.test(account.accountAddress)
      ? account.accountAddress.toLowerCase()
      : undefined,
  );
  // Resolve indexed rows' perps network address in one batch instead of per
  // row.
  const idsToResolve = Array.from(
    new Set(
      accounts
        .map((account) => account.indexedAccountId)
        .filter(isResolvableIndexedAccountId),
    ),
  );
  const resolvedByIndexedAccountId = idsToResolve.length
    ? await resolvePerpsAddressesByIndexedAccountIds(idsToResolve)
    : {};
  return accounts.map((account, index) => {
    const address =
      directAddresses[index] ??
      (isResolvableIndexedAccountId(account.indexedAccountId)
        ? resolvedByIndexedAccountId[account.indexedAccountId]?.toLowerCase()
        : undefined);
    return address ? snapshotNetWorthUsdByAddress[address] : undefined;
  });
}
