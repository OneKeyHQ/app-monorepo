import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

export function resolveMarketTradeFallbackSwapType({
  isStock,
  onlySupportCrossChain,
}: {
  isStock?: boolean;
  onlySupportCrossChain?: boolean;
}) {
  if (isStock) {
    return ESwapTabSwitchType.STOCK;
  }
  return onlySupportCrossChain
    ? ESwapTabSwitchType.BRIDGE
    : ESwapTabSwitchType.SWAP;
}

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
  const shouldJumpToSwap = shouldJumpToMarketTradeFallback({
    supportSpeedSwap,
    isAccountNetworkSupported,
    isWrapped,
    isRefreshQuote,
  });
  const shouldDisable =
    !shouldJumpToSwap &&
    !isRefreshQuote &&
    (isInsufficientBalance || (isWrapped && !isBalanceAvailable));

  return { shouldDisable, shouldJumpToSwap };
}

export function shouldJumpToMarketTradeFallback({
  supportSpeedSwap,
  isAccountNetworkSupported,
  isWrapped,
  isRefreshQuote = false,
}: {
  supportSpeedSwap?: boolean;
  isAccountNetworkSupported: boolean;
  isWrapped?: boolean;
  isRefreshQuote?: boolean;
}) {
  return (
    !isRefreshQuote &&
    (!isAccountNetworkSupported || (!isWrapped && !supportSpeedSwap))
  );
}
