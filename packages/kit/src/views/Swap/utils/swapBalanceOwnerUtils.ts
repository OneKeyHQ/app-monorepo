import type { ISwapSelectedTokenBalanceMeta } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from '../hooks/swapStockChannelUtils';

export interface ISwapBalanceOwner {
  tokenKey: string;
  // Lower-cased; only ever compared with itself.
  accountAddress: string;
  // Network-agnostic account identity the figure was fetched for.
  accountIdentity?: string;
}

// Identity of the account a stored balance belongs to. Deliberately
// network-agnostic: switching the wallet network keeps the same indexed
// account and must keep its figure (the address comparison covers the
// cross-network case once it resolves), while a different wallet or indexed/db
// account must not inherit the previous account's figure before the
// cross-network lookup lands.
export function buildSwapBalanceAccountIdentity(activeAccount?: {
  wallet?: { id?: string };
  indexedAccount?: { id?: string };
  dbAccount?: { id?: string };
  account?: { id?: string };
}) {
  const walletId = activeAccount?.wallet?.id;
  const accountId =
    activeAccount?.indexedAccount?.id ??
    activeAccount?.dbAccount?.id ??
    activeAccount?.account?.id;
  const parts = [walletId, accountId].filter((part): part is string => !!part);
  if (!parts.length) return undefined;
  return parts.join('|');
}

// Identity of the balance stored for one side: the token plus the account it
// was fetched for. Any reload for the same owner is a refresh and must keep the
// current figure; a different owner is a new selection and must clear it.
export function buildSwapBalanceOwner({
  token,
  accountAddress,
  accountIdentity,
}: {
  token?: ISwapToken;
  accountAddress?: string;
  accountIdentity?: string;
}): ISwapBalanceOwner | undefined {
  const tokenKey = getTokenIdentityKey(token);
  if (!tokenKey || !accountAddress) return undefined;
  return {
    tokenKey,
    accountAddress: accountAddress.toLowerCase(),
    accountIdentity,
  };
}

export function isSameSwapBalanceOwner(
  stored: Pick<
    ISwapSelectedTokenBalanceMeta,
    'tokenKey' | 'accountAddress' | 'accountIdentity'
  >,
  owner: ISwapBalanceOwner | undefined,
): boolean {
  return (
    !!owner &&
    stored.tokenKey === owner.tokenKey &&
    stored.accountAddress === owner.accountAddress &&
    (!owner.accountIdentity || stored.accountIdentity === owner.accountIdentity)
  );
}

export interface IResolveVerifiedSwapBalanceParams {
  balance: string | undefined;
  balanceMeta: ISwapSelectedTokenBalanceMeta;
  token?: ISwapToken;
  accountAddress?: string;
  // Current active account identity (buildSwapBalanceAccountIdentity); a
  // mismatch drops the figure even while the address lookup is pending.
  accountIdentity?: string;
  isAddressInfoReady: boolean;
}

// The stored balance as the current selection may read it, or undefined when
// it must count as "not loaded": a fetch fallback (`unverified`), or a figure
// that belongs to another token or account. Selecting a new From token only
// swaps the token atom; the balance atom keeps the previous token's figure
// until the debounced detail reload clears it, so without this check a loaded
// zero would offer "Deposit to Trade" for a token the user may well hold.
// While a cross-network account lookup is pending the current address is
// unknown (or still the previous network's), so the account identity decides
// instead: the same account keeps the figure (alternationToken carries it
// across without flickering), another account drops it.
export function resolveVerifiedSwapBalance({
  balance,
  balanceMeta,
  token,
  accountAddress,
  accountIdentity,
  isAddressInfoReady,
}: IResolveVerifiedSwapBalanceParams): string | undefined {
  if (balanceMeta.unverified) return undefined;
  const tokenKey = getTokenIdentityKey(token);
  if (!tokenKey || balanceMeta.tokenKey !== tokenKey) return undefined;
  if (accountIdentity && balanceMeta.accountIdentity !== accountIdentity) {
    return undefined;
  }
  if (
    isAddressInfoReady &&
    (!accountAddress ||
      balanceMeta.accountAddress !== accountAddress.toLowerCase())
  ) {
    return undefined;
  }
  return balance;
}
