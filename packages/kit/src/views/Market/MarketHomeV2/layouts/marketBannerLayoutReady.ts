export function shouldWaitForNativeMarketBannerBeforeLayout(): boolean {
  // Native watchlist quotes cannot start until Market layout mounts, so the
  // banner request must not sit on the first-paint path. Banner header height
  // is applied after fetch via resolveMarketBannerHeaderDecision.
  return false;
}

export function shouldFetchWatchlistQuotesWhileFocused({
  isFocused,
  pageIndex,
  isNative,
  isInitialLoad,
}: {
  isFocused: boolean;
  pageIndex: number;
  isNative: boolean;
  isInitialLoad: boolean;
}): boolean {
  if (isNative && isInitialLoad) {
    return true;
  }
  return isFocused && pageIndex === 0;
}
