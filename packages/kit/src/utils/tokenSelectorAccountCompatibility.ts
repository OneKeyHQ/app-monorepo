import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

// Others (imported / watch-only / external) accounts are one credential on one
// impl: they can never produce an address on an incompatible network, and the
// cross-network press path would fall through to the HD/HW batch createAddress
// with no indexedAccountId. Drop those rows so they are never offered. An
// imported EVM key still keeps every EVM network, which is the point.
//
// Lives in kit rather than next to the other cross-network helpers in shared:
// it needs the kit-bg-owned IDBAccount type, and shared may not depend on
// another OneKey package.
export function filterTokensByAccountNetworkCompatibility({
  tokens,
  account,
}: {
  tokens: IAccountToken[];
  account: IDBAccount;
}): IAccountToken[] {
  return tokens.filter(
    (token) =>
      !token.networkId ||
      accountUtils.isAccountCompatibleWithNetwork({
        account,
        networkId: token.networkId,
      }),
  );
}
