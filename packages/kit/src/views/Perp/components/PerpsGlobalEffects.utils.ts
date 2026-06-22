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
