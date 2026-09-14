import {
  getPerpsAccountScopedListData,
  isPerpsAccountAddressMatched,
  isPerpsAccountScopedDataReady,
  isPerpsAccountSelectionResolved,
  shouldPreserveColdStartButtonVisualState,
} from './accountScopedData';

describe('getPerpsAccountScopedListData', () => {
  const rows = [{ coin: 'BTC' }];

  it('keeps cached rows only when they belong to the active account', () => {
    expect(
      getPerpsAccountScopedListData({
        activeAccountAddress: '0xABC',
        dataAccountAddress: '0xabc',
        data: rows,
      }),
    ).toBe(rows);
  });

  it('drops account-scoped cached rows while the active account is still restoring', () => {
    expect(
      getPerpsAccountScopedListData({
        activeAccountAddress: undefined,
        dataAccountAddress: '0xabc',
        data: rows,
      }),
    ).toEqual([]);
  });

  it('keeps unscoped rows when there is no active account', () => {
    expect(
      getPerpsAccountScopedListData({
        activeAccountAddress: undefined,
        dataAccountAddress: undefined,
        data: rows,
      }),
    ).toBe(rows);
  });

  it('drops cached rows when the active account is different', () => {
    expect(
      getPerpsAccountScopedListData({
        activeAccountAddress: '0xdef',
        dataAccountAddress: '0xabc',
        data: rows,
      }),
    ).toEqual([]);
  });
});

describe('isPerpsAccountAddressMatched', () => {
  it('matches normalized addresses', () => {
    expect(
      isPerpsAccountAddressMatched({
        activeAccountAddress: '0xABC',
        dataAccountAddress: '0xabc',
      }),
    ).toBe(true);
  });

  it('requires both addresses before allowing mutations', () => {
    expect(
      isPerpsAccountAddressMatched({
        activeAccountAddress: undefined,
        dataAccountAddress: '0xabc',
      }),
    ).toBe(false);
    expect(
      isPerpsAccountAddressMatched({
        activeAccountAddress: '0xabc',
        dataAccountAddress: undefined,
      }),
    ).toBe(false);
  });
});

describe('isPerpsAccountSelectionResolved', () => {
  it('waits for the selected wallet and Perps selection to finish', () => {
    expect(
      isPerpsAccountSelectionResolved({
        selectedWalletReady: false,
        selectAccountLoading: false,
      }),
    ).toBe(false);
    expect(
      isPerpsAccountSelectionResolved({
        selectedWalletReady: true,
        selectAccountLoading: true,
      }),
    ).toBe(false);
  });

  it('requires the active Perps account to match the selected account', () => {
    expect(
      isPerpsAccountSelectionResolved({
        selectedWalletReady: true,
        selectAccountLoading: false,
        selectedAccountId: 'hd-1--m/44/60/0/0/0',
        activeAccountId: null,
      }),
    ).toBe(false);
    expect(
      isPerpsAccountSelectionResolved({
        selectedWalletReady: true,
        selectAccountLoading: false,
        selectedIndexedAccountId: 'indexed-1',
        activeIndexedAccountId: 'indexed-1',
      }),
    ).toBe(true);
  });

  it('resolves a disconnected wallet only after stale Perps account IDs clear', () => {
    expect(
      isPerpsAccountSelectionResolved({
        selectedWalletReady: true,
        selectAccountLoading: false,
        activeAccountId: 'hd-1--m/44/60/0/0/0',
      }),
    ).toBe(false);
    expect(
      isPerpsAccountSelectionResolved({
        selectedWalletReady: true,
        selectAccountLoading: false,
      }),
    ).toBe(true);
  });
});

describe('isPerpsAccountScopedDataReady', () => {
  it('waits for scoped data when an active account exists', () => {
    expect(
      isPerpsAccountScopedDataReady({
        activeAccountAddress: '0xabc',
        dataAccountAddress: undefined,
      }),
    ).toBe(false);
  });

  it('treats the no-account state as ready so empty UI can render', () => {
    expect(
      isPerpsAccountScopedDataReady({
        activeAccountAddress: undefined,
        dataAccountAddress: undefined,
      }),
    ).toBe(true);
  });

  it('waits while only account-scoped cached data exists and no account is active', () => {
    expect(
      isPerpsAccountScopedDataReady({
        activeAccountAddress: undefined,
        dataAccountAddress: '0xabc',
      }),
    ).toBe(false);
  });
});

describe('shouldPreserveColdStartButtonVisualState', () => {
  it('preserves the active visual state while only live status is pending', () => {
    expect(
      shouldPreserveColdStartButtonVisualState({
        isLiveStatusPending: true,
        hasNonColdStartDisabledReason: false,
      }),
    ).toBe(true);
  });

  it('keeps normal disabled styling for real validation and server disables', () => {
    expect(
      shouldPreserveColdStartButtonVisualState({
        isLiveStatusPending: true,
        hasNonColdStartDisabledReason: true,
      }),
    ).toBe(false);
    expect(
      shouldPreserveColdStartButtonVisualState({
        isLiveStatusPending: false,
        hasNonColdStartDisabledReason: false,
      }),
    ).toBe(false);
  });
});
