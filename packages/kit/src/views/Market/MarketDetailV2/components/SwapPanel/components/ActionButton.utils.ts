export function resolveMarketTradeActionState({
  supportSpeedSwap,
  isAccountNetworkSupported,
  isBalanceAvailable,
  isInsufficientBalance,
  isWrapped,
}: {
  supportSpeedSwap?: boolean;
  isAccountNetworkSupported: boolean;
  isBalanceAvailable: boolean;
  isInsufficientBalance: boolean;
  isWrapped?: boolean;
}) {
  const shouldJumpToSwap =
    !isAccountNetworkSupported || (!isWrapped && !supportSpeedSwap);
  const shouldDisable =
    !shouldJumpToSwap &&
    (isInsufficientBalance || (isWrapped && !isBalanceAvailable));

  return { shouldDisable, shouldJumpToSwap };
}
