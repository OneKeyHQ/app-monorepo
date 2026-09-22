import type { ISwapSelectedTokenBalanceMeta } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from '../hooks/swapStockChannelUtils';

export interface ISwapBalanceOwner {
  tokenKey: string;
  // Lower-cased; only ever compared with itself.
  accountAddress: string;
}

// Identity of the balance stored for one side: the token plus the account it
// was fetched for. Any reload for the same owner is a refresh and must keep the
// current figure; a different owner is a new selection and must clear it.
export function buildSwapBalanceOwner({
  token,
  accountAddress,
}: {
  token?: ISwapToken;
  accountAddress?: string;
}): ISwapBalanceOwner | undefined {
  const tokenKey = getTokenIdentityKey(token);
  if (!tokenKey || !accountAddress) return undefined;
  return { tokenKey, accountAddress: accountAddress.toLowerCase() };
}

export function isSameSwapBalanceOwner(
  stored: Pick<ISwapSelectedTokenBalanceMeta, 'tokenKey' | 'accountAddress'>,
  owner: ISwapBalanceOwner | undefined,
): boolean {
  return (
    !!owner &&
    stored.tokenKey === owner.tokenKey &&
    stored.accountAddress === owner.accountAddress
  );
}

export interface IResolveVerifiedSwapBalanceParams {
  balance: string | undefined;
  balanceMeta: ISwapSelectedTokenBalanceMeta;
  token?: ISwapToken;
  accountAddress?: string;
  isAddressInfoReady: boolean;
}

// The stored balance as the current selection may read it, or undefined when
// it must count as "not loaded": a fetch fallback (`unverified`), or a figure
// that belongs to another token or account. Selecting a new From token only
// swaps the token atom; the balance atom keeps the previous token's figure
// until the debounced detail reload clears it, so without this check a loaded
// zero would offer "Deposit to Trade" for a token the user may well hold.
// While a cross-network account lookup is pending the current address is
// unknown (or still the previous network's), so only the token is compared:
// the balance alternationToken carries across stays usable instead of
// flickering off and on until the lookup lands.
export function resolveVerifiedSwapBalance({
  balance,
  balanceMeta,
  token,
  accountAddress,
  isAddressInfoReady,
}: IResolveVerifiedSwapBalanceParams): string | undefined {
  if (balanceMeta.unverified) return undefined;
  const tokenKey = getTokenIdentityKey(token);
  if (!tokenKey || balanceMeta.tokenKey !== tokenKey) return undefined;
  if (
    isAddressInfoReady &&
    (!accountAddress ||
      balanceMeta.accountAddress !== accountAddress.toLowerCase())
  ) {
    return undefined;
  }
  return balance;
}
