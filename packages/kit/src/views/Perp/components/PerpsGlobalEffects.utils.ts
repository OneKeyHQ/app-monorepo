type IShouldCheckPerpsAccountStatusOnFocusParams = {
  isFocused: boolean;
  hasSelectedAccountParams: boolean;
  isSelectingAccount: boolean;
  lastCheckTimeMs: number;
  nowMs: number;
  staleMs: number;
};

export function shouldCheckPerpsAccountStatusOnFocus({
  isFocused,
  hasSelectedAccountParams,
  isSelectingAccount,
  lastCheckTimeMs,
  nowMs,
  staleMs,
}: IShouldCheckPerpsAccountStatusOnFocusParams) {
  if (!isFocused || !hasSelectedAccountParams || isSelectingAccount) {
    return false;
  }
  return lastCheckTimeMs + staleMs < nowMs;
}

type IShouldRunPerpsAccountSelectParams = {
  lastParams: string | null;
  currentParams: string;
  isExternalAccount: boolean;
  lastAddress: string | null;
  currentAddress: string | null;
};

// Decides whether selectPerpsAccount should run past its dedup gate.
//
// The id-based `params` key (indexedAccountId/accountId/walletId/deriveType/
// refreshHook) deliberately excludes the account address: for HD/indexed
// accounts the EVM address resolves asynchronously AFTER the id (undefined ->
// defined), so keying on it would re-fire the rebind + network status check on
// every account mount.
//
// The core extra signal is a "defined -> different defined" address transition
// while the id-based key is unchanged: that only happens when an account's EVM
// address mutates IN PLACE under a stable account row. The one account class
// that does this today is an external/connected dApp wallet in web-dapp mode —
// switching the connected account on the extension rewrites the same row's
// address while the id stays constant (OK-56744), so the id-based key never
// changes and the rebind is skipped, leaving perpsActiveAccountAtom on the old
// address and the Perps asset panel stale. We gate on isExternalAccount so the
// bypass is scoped to that known case and an undefined->defined mount (HD) is
// never mistaken for an in-place switch.
//
// So: always run when the id-based key changes; additionally force a run only
// for an external account whose address transitions between two distinct
// DEFINED values.
export function shouldRunPerpsAccountSelect({
  lastParams,
  currentParams,
  isExternalAccount,
  lastAddress,
  currentAddress,
}: IShouldRunPerpsAccountSelectParams): boolean {
  if (lastParams !== currentParams) {
    return true;
  }
  return (
    isExternalAccount &&
    !!lastAddress &&
    !!currentAddress &&
    lastAddress !== currentAddress
  );
}
