/**
 * View state for the "My accounts" list on the bulk copy addresses page.
 *
 * "No Results Found" is only a valid state once a load for the current
 * wallet / network has actually completed; before that (first frame, wallet
 * list still resolving, request in flight) the list must render its skeleton
 * so the page never flashes an error empty state (OK-61586). A failed
 * enumeration is its own recoverable state with a retry: it must neither
 * look like "still loading" nor enable export on a partial set.
 */
export function computeBulkCopyByAccountsViewState({
  isAccountMode,
  hasSelectedWallet,
  accountsLoaded,
  accountsLoadFailed,
  hasAccounts,
  isFormValid,
}: {
  isAccountMode: boolean;
  hasSelectedWallet: boolean;
  accountsLoaded: boolean;
  accountsLoadFailed: boolean;
  hasAccounts: boolean;
  isFormValid: boolean;
}): {
  showSkeleton: boolean;
  showError: boolean;
  showEmpty: boolean;
  isExportDisabled: boolean;
} {
  if (!isAccountMode) {
    return {
      showSkeleton: false,
      showError: false,
      showEmpty: false,
      isExportDisabled: false,
    };
  }
  const isReady = hasSelectedWallet && accountsLoaded;
  const isFailed = isReady && accountsLoadFailed;
  return {
    showSkeleton: !isReady,
    showError: isFailed,
    showEmpty: isReady && !isFailed && !hasAccounts,
    isExportDisabled: !isFormValid || !isReady || isFailed || !hasAccounts,
  };
}
