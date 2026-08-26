export function resolveMarketTradeActionState({
  supportSpeedSwap,
  isAccountNetworkSupported,
  isBalanceAvailable,
  isInsufficientBalance,
  isWrapped,
  isRefreshQuote = false,
}: {
  supportSpeedSwap?: boolean;
  isAccountNetworkSupported: boolean;
  isBalanceAvailable: boolean;
  isInsufficientBalance: boolean;
  isWrapped?: boolean;
  isRefreshQuote?: boolean;
}) {
  const shouldJumpToSwap =
    !isRefreshQuote &&
    (!isAccountNetworkSupported || (!isWrapped && !supportSpeedSwap));
  const shouldDisable =
    !shouldJumpToSwap &&
    !isRefreshQuote &&
    (isInsufficientBalance || (isWrapped && !isBalanceAvailable));

  return { shouldDisable, shouldJumpToSwap };
}
