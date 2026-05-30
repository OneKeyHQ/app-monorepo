import {
  getPerpsAccountScopedListData,
  isPerpsAccountScopedDataReady,
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

  it('keeps cached rows while the active account is still restoring', () => {
    expect(
      getPerpsAccountScopedListData({
        activeAccountAddress: undefined,
        dataAccountAddress: '0xabc',
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
