import { computeBulkCopyByAccountsViewState } from './bulkCopyAddressesViewState';

describe('computeBulkCopyByAccountsViewState', () => {
  const loadedWithAccounts = {
    isAccountMode: true,
    hasSelectedWallet: true,
    accountsLoaded: true,
    accountsLoadFailed: false,
    hasAccounts: true,
    isFormValid: true,
  };

  it('shows the skeleton, never the empty state, before the first load completes', () => {
    // OK-61586: the page used to fall through to "No Results Found" on its
    // first frame because the loading flag is undefined until the request
    // starts and the wallet list has not resolved yet.
    expect(
      computeBulkCopyByAccountsViewState({
        ...loadedWithAccounts,
        hasSelectedWallet: false,
        accountsLoaded: false,
        hasAccounts: false,
      }),
    ).toEqual({
      showSkeleton: true,
      showError: false,
      showEmpty: false,
      isExportDisabled: true,
    });
    expect(
      computeBulkCopyByAccountsViewState({
        ...loadedWithAccounts,
        accountsLoaded: false,
        hasAccounts: false,
      }),
    ).toEqual({
      showSkeleton: true,
      showError: false,
      showEmpty: false,
      isExportDisabled: true,
    });
  });

  it('shows the empty state only once a completed load has no accounts', () => {
    expect(
      computeBulkCopyByAccountsViewState({
        ...loadedWithAccounts,
        hasAccounts: false,
      }),
    ).toEqual({
      showSkeleton: false,
      showError: false,
      showEmpty: true,
      isExportDisabled: true,
    });
  });

  it('renders the list and enables export when accounts are loaded', () => {
    expect(computeBulkCopyByAccountsViewState(loadedWithAccounts)).toEqual({
      showSkeleton: false,
      showError: false,
      showEmpty: false,
      isExportDisabled: false,
    });
  });

  it('keeps export disabled while the form is invalid', () => {
    expect(
      computeBulkCopyByAccountsViewState({
        ...loadedWithAccounts,
        isFormValid: false,
      }).isExportDisabled,
    ).toBe(true);
  });

  it('renders nothing for the account list outside account mode', () => {
    expect(
      computeBulkCopyByAccountsViewState({
        ...loadedWithAccounts,
        isAccountMode: false,
        accountsLoaded: false,
        hasAccounts: false,
      }),
    ).toEqual({
      showSkeleton: false,
      showError: false,
      showEmpty: false,
      isExportDisabled: false,
    });
  });

  it('shows a retryable error, not the skeleton or empty state, when the load failed', () => {
    // A rejected account enumeration used to keep `loaded: false`, which the
    // helper read as "still loading" forever.
    expect(
      computeBulkCopyByAccountsViewState({
        ...loadedWithAccounts,
        accountsLoadFailed: true,
        hasAccounts: false,
      }),
    ).toEqual({
      showSkeleton: false,
      showError: true,
      showEmpty: false,
      isExportDisabled: true,
    });
  });
});
