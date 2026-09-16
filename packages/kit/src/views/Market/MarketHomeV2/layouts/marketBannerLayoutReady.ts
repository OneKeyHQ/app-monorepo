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
