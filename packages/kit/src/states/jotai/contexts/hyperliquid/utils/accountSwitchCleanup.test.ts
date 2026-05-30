import { getPerpsAccountSwitchCleanupPlan } from './accountSwitchCleanup';

describe('getPerpsAccountSwitchCleanupPlan', () => {
  it('preserves cached rows but clears account-local transient data when switching to a cached account', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xbbb',
        cachedOpenOrdersAccountAddress: undefined,
      }),
    ).toEqual({
      shouldClearActiveAccountData: false,
      shouldClearTransientData: true,
    });
  });

  it('clears account-scoped rows when the resolved account has no address', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: null,
        nextAccountAddress: null,
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: undefined,
      }),
    ).toEqual({
      shouldClearActiveAccountData: true,
      shouldClearTransientData: false,
    });
  });

  it('clears account-scoped rows when switching to an account with no cache', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: '0xaaa',
      }),
    ).toEqual({
      shouldClearActiveAccountData: true,
      shouldClearTransientData: false,
    });
  });

  it('does not clear anything for same-account refreshes', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xAAA',
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: undefined,
      }),
    ).toEqual({
      shouldClearActiveAccountData: false,
      shouldClearTransientData: false,
    });
  });
});
