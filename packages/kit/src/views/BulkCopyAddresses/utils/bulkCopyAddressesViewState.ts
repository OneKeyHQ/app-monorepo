/**
 * View state for the "My accounts" list on the bulk copy addresses page.
 *
 * "No Results Found" is only a valid state once a load for the current
 * wallet / network has actually completed; before that (first frame, wallet
 * list still resolving, request in flight) the list must render its skeleton
 * so the page never flashes an error empty state (OK-61586).
 */
export function computeBulkCopyByAccountsViewState({
  isAccountMode,
  hasSelectedWallet,
  accountsLoaded,
  hasAccounts,
  isFormValid,
}: {
  isAccountMode: boolean;
  hasSelectedWallet: boolean;
  accountsLoaded: boolean;
  hasAccounts: boolean;
  isFormValid: boolean;
}): {
  showSkeleton: boolean;
  showEmpty: boolean;
  isExportDisabled: boolean;
} {
  if (!isAccountMode) {
    return { showSkeleton: false, showEmpty: false, isExportDisabled: false };
  }
  const isReady = hasSelectedWallet && accountsLoaded;
  return {
    showSkeleton: !isReady,
    showEmpty: isReady && !hasAccounts,
    isExportDisabled: !isFormValid || !isReady || !hasAccounts,
  };
}
