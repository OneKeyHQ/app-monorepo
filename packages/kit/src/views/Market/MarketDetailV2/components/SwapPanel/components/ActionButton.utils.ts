export function resolveMarketTradeActionState({
  supportSpeedSwap,
  isAccountNetworkSupported,
  isInsufficientBalance,
  isWrapped,
}: {
  supportSpeedSwap?: boolean;
  isAccountNetworkSupported: boolean;
  isInsufficientBalance: boolean;
  isWrapped?: boolean;
}) {
  const shouldJumpToSwap =
    !isAccountNetworkSupported || (!isWrapped && !supportSpeedSwap);
  const shouldDisable = isInsufficientBalance && !shouldJumpToSwap;

  return { shouldDisable, shouldJumpToSwap };
}
