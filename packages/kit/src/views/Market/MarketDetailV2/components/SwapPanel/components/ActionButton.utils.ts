export function shouldJumpFromMarketToSwap({
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
  return (
    !isAccountNetworkSupported ||
    (!isWrapped && (!supportSpeedSwap || isInsufficientBalance))
  );
}
