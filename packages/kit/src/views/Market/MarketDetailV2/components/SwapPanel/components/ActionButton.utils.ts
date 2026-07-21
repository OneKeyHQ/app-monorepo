export function shouldJumpFromMarketToSwap({
  supportSpeedSwap,
  isInsufficientBalance,
  isWrapped,
}: {
  supportSpeedSwap?: boolean;
  isInsufficientBalance: boolean;
  isWrapped?: boolean;
}) {
  return !isWrapped && (!supportSpeedSwap || isInsufficientBalance);
}
